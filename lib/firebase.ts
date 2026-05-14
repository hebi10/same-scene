import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth, type Persistence } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const getAsyncStoragePersistence = (storage: typeof AsyncStorage) =>
  class ReactNativeAsyncStoragePersistence {
    static type = "LOCAL";
    readonly type = "LOCAL";

    async _isAvailable() {
      try {
        await storage.setItem("firebase:persistence:test", "1");
        await storage.removeItem("firebase:persistence:test");
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown) {
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get(key: string) {
      const value = await storage.getItem(key);
      return value ? JSON.parse(value) : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    _addListener() {
      return undefined;
    }

    _removeListener() {
      return undefined;
    }
  } as unknown as Persistence;

const createFirebaseAuth = () => {
  if (!firebaseApp) {
    return null;
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: getAsyncStoragePersistence(AsyncStorage)
    });
  } catch {
    return getAuth(firebaseApp);
  }
};

export const firebaseAuth: Auth | null = createFirebaseAuth();
export const firestore: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseStorage: FirebaseStorage | null = firebaseApp
  ? getStorage(firebaseApp)
  : null;
