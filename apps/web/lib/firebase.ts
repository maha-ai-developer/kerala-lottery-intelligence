/**
 * Firebase Client SDK Initialization & Safety Guard
 * Resolves configuration strictly based on environment variables.
 * Never silently defaults missing configuration to production.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";

export interface FirebaseClientStatus {
  isConfigured: boolean;
  environment: "emulator" | "development" | "production" | "unconfigured";
  projectId: string;
  error: string | null;
}

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const rawProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const rawApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const rawAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const rawStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const rawMessagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const rawAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

function resolveFirebaseConfig(): {
  config: Record<string, string>;
  status: FirebaseClientStatus;
} {
  // 1. Explicit Emulator Mode
  if (useEmulators) {
    const emulatorProjectId = rawProjectId || "kerala-lottery-intel-dev";
    return {
      config: {
        apiKey: rawApiKey || "fake-emulator-api-key",
        authDomain: rawAuthDomain || `${emulatorProjectId}.firebaseapp.com`,
        projectId: emulatorProjectId,
        storageBucket: rawStorageBucket || `${emulatorProjectId}.firebasestorage.app`,
        messagingSenderId: rawMessagingSenderId || "608186999779",
        appId: rawAppId || "1:608186999779:web:emulator"
      },
      status: {
        isConfigured: true,
        environment: "emulator",
        projectId: emulatorProjectId,
        error: null
      }
    };
  }

  // 4. Missing Configuration Guard - Fail clearly, NEVER default to PROD
  if (!rawProjectId || !rawApiKey) {
    const errorMsg =
      "Firebase client configuration is missing. NEXT_PUBLIC_FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_API_KEY must be provided via environment variables. Silently defaulting to production is forbidden.";

    // In server/build prerender context, provide a safe placeholder so static page compilation succeeds without connecting to cloud
    return {
      config: {
        apiKey: "unconfigured-api-key",
        authDomain: "unconfigured.firebaseapp.com",
        projectId: "unconfigured-project",
        storageBucket: "unconfigured.firebasestorage.app",
        messagingSenderId: "000000000000",
        appId: "1:000000000000:web:unconfigured"
      },
      status: {
        isConfigured: false,
        environment: "unconfigured",
        projectId: "unconfigured",
        error: errorMsg
      }
    };
  }

  // Cross-environment consistency validation
  if (rawProjectId === "kerala-lottery-intel-dev") {
    if (rawMessagingSenderId === "660682986882") {
      const err =
        "Configuration Mismatch: DEV project (kerala-lottery-intel-dev) cannot use PROD messagingSenderId (660682986882).";
      return {
        config: {
          apiKey: rawApiKey,
          projectId: rawProjectId,
          authDomain: rawAuthDomain || "",
          storageBucket: rawStorageBucket || "",
          messagingSenderId: rawMessagingSenderId,
          appId: rawAppId || ""
        },
        status: { isConfigured: false, environment: "development", projectId: rawProjectId, error: err }
      };
    }
  }

  if (rawProjectId === "kerala-lottery-intelligence") {
    if (rawMessagingSenderId === "608186999779") {
      const err =
        "Configuration Mismatch: PROD project (kerala-lottery-intelligence) cannot use DEV messagingSenderId (608186999779).";
      return {
        config: {
          apiKey: rawApiKey,
          projectId: rawProjectId,
          authDomain: rawAuthDomain || "",
          storageBucket: rawStorageBucket || "",
          messagingSenderId: rawMessagingSenderId,
          appId: rawAppId || ""
        },
        status: { isConfigured: false, environment: "production", projectId: rawProjectId, error: err }
      };
    }
  }

  // 2. Explicit DEV Configuration
  if (rawProjectId === "kerala-lottery-intel-dev") {
    return {
      config: {
        apiKey: rawApiKey,
        authDomain: rawAuthDomain || "kerala-lottery-intel-dev.firebaseapp.com",
        projectId: "kerala-lottery-intel-dev",
        storageBucket: rawStorageBucket || "kerala-lottery-intel-dev.firebasestorage.app",
        messagingSenderId: rawMessagingSenderId || "608186999779",
        appId: rawAppId || ""
      },
      status: {
        isConfigured: true,
        environment: "development",
        projectId: "kerala-lottery-intel-dev",
        error: null
      }
    };
  }

  // 3. Explicit PROD Configuration
  if (rawProjectId === "kerala-lottery-intelligence") {
    return {
      config: {
        apiKey: rawApiKey,
        authDomain: rawAuthDomain || "kerala-lottery-intelligence.firebaseapp.com",
        projectId: "kerala-lottery-intelligence",
        storageBucket: rawStorageBucket || "kerala-lottery-intelligence.firebasestorage.app",
        messagingSenderId: rawMessagingSenderId || "660682986882",
        appId: rawAppId || ""
      },
      status: {
        isConfigured: true,
        environment: "production",
        projectId: "kerala-lottery-intelligence",
        error: null
      }
    };
  }

  // Generic / Custom project configuration
  return {
    config: {
      apiKey: rawApiKey,
      authDomain: rawAuthDomain || `${rawProjectId}.firebaseapp.com`,
      projectId: rawProjectId,
      storageBucket: rawStorageBucket || `${rawProjectId}.firebasestorage.app`,
      messagingSenderId: rawMessagingSenderId || "",
      appId: rawAppId || ""
    },
    status: {
      isConfigured: true,
      environment: process.env.NEXT_PUBLIC_APP_ENV === "production" ? "production" : "development",
      projectId: rawProjectId,
      error: null
    }
  };
}

const { config: firebaseConfig, status: clientStatus } = resolveFirebaseConfig();

export const firebaseClientStatus = clientStatus;
export const isFirebaseConfigured = clientStatus.isConfigured;

export const firebaseApp: FirebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);

// Connect to emulators if running locally in emulator mode
if (typeof window !== "undefined" && useEmulators) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectStorageEmulator(storage, "localhost", 9199);
    console.info("Connected to local Firebase Emulators (Auth: 9099, Firestore: 8080, Storage: 9199)");
  } catch (err) {
    console.warn("Firebase Emulators connection skipped or already initialized:", err);
  }
}

if (typeof window !== "undefined" && !isFirebaseConfigured && clientStatus.error) {
  console.warn(`[Firebase Configuration Guard] ${clientStatus.error}`);
}
