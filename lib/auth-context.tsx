import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "@firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { firebaseAuth, firestore, isFirebaseConfigured } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  isFirebaseReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ensureFirebaseAuth = () => {
  if (!firebaseAuth) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  return firebaseAuth;
};

const ensureUserDocument = async (user: User) => {
  if (!firestore) {
    return;
  }

  await setDoc(
    doc(firestore, "users", user.uid),
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      providerIds: user.providerData.map((provider) => provider.providerId),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setIsAuthLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);

      if (nextUser) {
        try {
          await ensureUserDocument(nextUser);
        } catch {
          // User profile sync should not block local app usage.
        }
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = ensureFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    await ensureUserDocument(credential.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const auth = ensureFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await ensureUserDocument(credential.user);
  }, []);

  const logOut = useCallback(async () => {
    const auth = ensureFirebaseAuth();
    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      isAuthLoading,
      isFirebaseReady: isFirebaseConfigured && Boolean(firebaseAuth),
      signIn,
      signUp,
      logOut
    }),
    [isAuthLoading, logOut, signIn, signUp, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }

  return value;
};
