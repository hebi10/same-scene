import AsyncStorage from "@react-native-async-storage/async-storage";
import { type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

export type SubscriptionPlan = "free" | "premium";
export type SubscriptionStatus = "inactive" | "active" | "expired";

export type UserSubscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: "none" | "mock";
  startedAt: string | null;
  expiresAt: string | null;
  lastPaymentAt: string | null;
  priceLabel: string;
  productName: string;
};

const createSubscriptionStorageKey = (uid: string) =>
  `travel-frame.subscription.${uid}.v1`;

export const freeSubscription: UserSubscription = {
  plan: "free",
  status: "inactive",
  provider: "none",
  startedAt: null,
  expiresAt: null,
  lastPaymentAt: null,
  priceLabel: "무료",
  productName: "무료 플랜"
};

export const isPremiumSubscription = (subscription: UserSubscription | null) => {
  if (!subscription || subscription.plan !== "premium" || subscription.status !== "active") {
    return false;
  }

  if (!subscription.expiresAt) {
    return true;
  }

  return new Date(subscription.expiresAt).getTime() > Date.now();
};

const parseSubscription = (value: string | null): UserSubscription => {
  if (!value) {
    return freeSubscription;
  }

  try {
    const parsed = JSON.parse(value) as Partial<UserSubscription>;
    return {
      ...freeSubscription,
      ...parsed
    };
  } catch {
    return freeSubscription;
  }
};

export const getLocalSubscription = async (uid?: string | null) => {
  if (!uid) {
    return freeSubscription;
  }

  const value = await AsyncStorage.getItem(createSubscriptionStorageKey(uid));
  return parseSubscription(value);
};

export const getUserSubscription = async (user: User | null) => {
  if (!user) {
    return freeSubscription;
  }

  if (!firestore) {
    return getLocalSubscription(user.uid);
  }

  try {
    const snapshot = await getDoc(
      doc(firestore, "users", user.uid, "subscriptions", "current")
    );

    if (!snapshot.exists()) {
      return getLocalSubscription(user.uid);
    }

    const subscription = parseSubscription(JSON.stringify(snapshot.data()));
    await saveLocalSubscription(user.uid, subscription);
    return subscription;
  } catch {
    return getLocalSubscription(user.uid);
  }
};

const saveLocalSubscription = async (uid: string, subscription: UserSubscription) => {
  await AsyncStorage.setItem(
    createSubscriptionStorageKey(uid),
    JSON.stringify(subscription)
  );
};

const addMonths = (date: Date, months: number) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

export const activateMockSubscription = async (user: User) => {
  if (!firestore) {
    throw new Error("Firestore가 설정되지 않았습니다.");
  }

  const now = new Date();
  const expiresAt = addMonths(now, 1);
  const subscription: UserSubscription = {
    plan: "premium",
    status: "active",
    provider: "mock",
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastPaymentAt: now.toISOString(),
    priceLabel: "월 4,900원",
    productName: "트래블프레임 프리미엄"
  };

  await setDoc(
    doc(firestore, "users", user.uid, "subscriptions", "current"),
    {
      ...subscription,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await addDoc(collection(firestore, "users", user.uid, "paymentEvents"), {
    type: "mock_payment_completed",
    plan: subscription.plan,
    provider: subscription.provider,
    productName: subscription.productName,
    priceLabel: subscription.priceLabel,
    startedAt: subscription.startedAt,
    expiresAt: subscription.expiresAt,
    createdAt: serverTimestamp()
  });

  await saveLocalSubscription(user.uid, subscription);
  return subscription;
};
