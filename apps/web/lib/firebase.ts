/**
 * Firebase Client SDK Initialization
 * Connects to Firebase Authentication, Firestore, and Cloud Storage.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCpxJlxYaM2eVK2NG0pB0-7yLBITsLoBok",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "kerala-lottery-intelligence.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kerala-lottery-intelligence",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kerala-lottery-intelligence.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "660682986882",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:660682986882:web:32a1f0c4549be1f68e2b9b"
};

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Connect to emulators if running locally in emulator mode
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectStorageEmulator(storage, "localhost", 9199);
    console.info("Connected to local Firebase Emulators (Auth: 9099, Firestore: 8080, Storage: 9199)");
  } catch (err) {
    console.warn("Firebase Emulators connection skipped or already initialized:", err);
  }
}
