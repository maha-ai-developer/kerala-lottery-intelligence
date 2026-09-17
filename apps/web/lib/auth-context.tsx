"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithPhoneNumber,
  ConfirmationResult,
  RecaptchaVerifier,
  UserCredential
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type UserRole = "VIEWER" | "RESEARCHER" | "ANALYST" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface UserProfile {
  uid: string;
  phoneNumber: string | null;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  sendOtp: (phoneNumber: string, appVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyOtp: (confirmationResult: ConfirmationResult, verificationCode: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateProfile = useCallback(async (firebaseUser: User): Promise<UserProfile> => {
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      return userDocSnap.data() as UserProfile;
    }

    // Initialize minimal profile strictly complying with Firestore security rules:
    // Only VIEWER role and ACTIVE status are allowed for client-initiated creation.
    const initialProfile: UserProfile = {
      uid: firebaseUser.uid,
      phoneNumber: firebaseUser.phoneNumber || null,
      displayName: firebaseUser.displayName || firebaseUser.phoneNumber || "Verified User",
      role: "VIEWER",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(userDocRef, initialProfile);
    return initialProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    try {
      const profile = await fetchOrCreateProfile(user);
      setUserProfile(profile);
    } catch (err: unknown) {
      console.error("Failed to refresh user profile from Firestore:", err);
      setError(err instanceof Error ? err.message : "Failed to load user profile");
    }
  }, [user, fetchOrCreateProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setLoading(true);
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            const profile = await fetchOrCreateProfile(firebaseUser);
            setUserProfile(profile);
            setError(null);
          } catch (profileErr: unknown) {
            console.error("Profile synchronization error:", profileErr);
            setError(
              profileErr instanceof Error
                ? profileErr.message
                : "Failed to initialize or fetch user profile from Firestore."
            );
          }
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      },
      (authErr) => {
        console.error("Auth state observer error:", authErr);
        setError(authErr.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [fetchOrCreateProfile]);

  const sendOtp = async (
    phoneNumber: string,
    appVerifier: RecaptchaVerifier
  ): Promise<ConfirmationResult> => {
    setError(null);
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      return confirmationResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send SMS OTP";
      setError(msg);
      throw err;
    }
  };

  const verifyOtp = async (
    confirmationResult: ConfirmationResult,
    verificationCode: string
  ): Promise<UserCredential> => {
    setError(null);
    try {
      const credential = await confirmationResult.confirm(verificationCode);
      return credential;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code";
      setError(msg);
      throw err;
    }
  };

  const signOut = async (): Promise<void> => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign out";
      setError(msg);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        sendOtp,
        verifyOtp,
        signOut,
        clearError,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
