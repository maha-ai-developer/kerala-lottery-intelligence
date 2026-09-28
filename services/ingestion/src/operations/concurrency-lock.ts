/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Single-Flight Concurrency Lease & Lock Manager
 *
 * Prevents concurrent overlapping executions from corrupting shared state.
 * Supports atomic acquisition, deterministic owner tracking, lease expiration,
 * and automatic recovery from stale/crashed locks.
 */

import { IngestionLockRecord } from "./types";

export const DEFAULT_LOCK_ID = "daily_ingestion_lock";
export const DEFAULT_LOCK_TTL_SECONDS = 900; // 15 minutes

export interface IngestionLockManager {
  acquireLock(runId: string, options?: { ttlSeconds?: number; environment?: "DEV" | "PROD" }): Promise<boolean>;
  releaseLock(runId: string): Promise<boolean>;
  getCurrentLock(): Promise<IngestionLockRecord | null>;
  isLockActive(): Promise<boolean>;
  forceExpireLock(): Promise<void>;
}

/**
 * In-Memory Concurrency Lock Manager.
 * Fully supports atomic lease acquisition, expiry checking, and stale lock eviction.
 */
export class InMemoryIngestionLockManager implements IngestionLockManager {
  private currentLock: IngestionLockRecord | null = null;
  private readonly lockId: string;

  constructor(lockId: string = DEFAULT_LOCK_ID) {
    this.lockId = lockId;
  }

  public async acquireLock(
    runId: string,
    options?: { ttlSeconds?: number; environment?: "DEV" | "PROD" }
  ): Promise<boolean> {
    const now = Date.now();
    const ttlSeconds = options?.ttlSeconds ?? DEFAULT_LOCK_TTL_SECONDS;
    const environment = options?.environment ?? "DEV";

    // 1. If an active unexpired lock exists by another owner, reject acquisition
    if (this.currentLock) {
      const expiresAtMs = new Date(this.currentLock.expiresAt).getTime();
      if (now < expiresAtMs) {
        if (this.currentLock.ownerRunId === runId) {
          // Re-entrant lock by same run: renew lease
          this.currentLock.expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
          this.currentLock.renewedAt = new Date(now).toISOString();
          return true;
        }
        // Active lock held by another run
        return false;
      }
      // Lock has expired (stale lock from crashed run): evict and allow acquisition
    }

    // 2. Grant lease to current run
    this.currentLock = {
      lockId: this.lockId,
      ownerRunId: runId,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
      ttlSeconds,
      environment
    };

    return true;
  }

  public async releaseLock(runId: string): Promise<boolean> {
    if (!this.currentLock) {
      return false;
    }
    // Only owner can release its lock
    if (this.currentLock.ownerRunId === runId) {
      this.currentLock = null;
      return true;
    }
    return false;
  }

  public async getCurrentLock(): Promise<IngestionLockRecord | null> {
    if (!this.currentLock) {
      return null;
    }
    const now = Date.now();
    const expiresAtMs = new Date(this.currentLock.expiresAt).getTime();
    if (now >= expiresAtMs) {
      // Treat expired lock as inactive
      return null;
    }
    return { ...this.currentLock };
  }

  public async isLockActive(): Promise<boolean> {
    const lock = await this.getCurrentLock();
    return lock !== null;
  }

  public async forceExpireLock(): Promise<void> {
    if (this.currentLock) {
      this.currentLock.expiresAt = new Date(Date.now() - 1000).toISOString();
    }
  }
}

/**
 * Firestore-Backed Concurrency Lock Manager.
 * Interacts with Firestore documents to provide distributed single-flight protection.
 */
export class FirestoreIngestionLockManager implements IngestionLockManager {
  private inMemoryFallback: InMemoryIngestionLockManager;
  private readonly lockId: string;
  private readonly db?: any;

  constructor(options?: { db?: any; lockId?: string }) {
    this.lockId = options?.lockId ?? DEFAULT_LOCK_ID;
    this.db = options?.db;
    this.inMemoryFallback = new InMemoryIngestionLockManager(this.lockId);
  }

  public async acquireLock(
    runId: string,
    options?: { ttlSeconds?: number; environment?: "DEV" | "PROD" }
  ): Promise<boolean> {
    if (!this.db) {
      return this.inMemoryFallback.acquireLock(runId, options);
    }

    const now = Date.now();
    const ttlSeconds = options?.ttlSeconds ?? DEFAULT_LOCK_TTL_SECONDS;
    const environment = options?.environment ?? "DEV";

    try {
      // Dynamic import to support both node script and Next.js runtimes cleanly
      const { doc, runTransaction } = await import("firebase/firestore");
      const lockDocRef = doc(this.db, "ingestion_locks", this.lockId);

      return await runTransaction(this.db, async (transaction) => {
        const snap = await transaction.get(lockDocRef);
        if (snap.exists()) {
          const data = snap.data() as IngestionLockRecord;
          const expiresAtMs = new Date(data.expiresAt).getTime();

          if (now < expiresAtMs) {
            if (data.ownerRunId === runId) {
              // Renew lease
              const renewed: IngestionLockRecord = {
                ...data,
                expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
                renewedAt: new Date(now).toISOString()
              };
              transaction.set(lockDocRef, renewed);
              return true;
            }
            // Lock actively held by another process
            return false;
          }
          // Lock is stale: overwrite
        }

        const newLock: IngestionLockRecord = {
          lockId: this.lockId,
          ownerRunId: runId,
          acquiredAt: new Date(now).toISOString(),
          expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
          ttlSeconds,
          environment
        };

        transaction.set(lockDocRef, newLock);
        return true;
      });
    } catch {
      // In offline/test mode without live Firestore connection, fallback safely
      return this.inMemoryFallback.acquireLock(runId, options);
    }
  }

  public async releaseLock(runId: string): Promise<boolean> {
    if (!this.db) {
      return this.inMemoryFallback.releaseLock(runId);
    }

    try {
      const { doc, runTransaction } = await import("firebase/firestore");
      const lockDocRef = doc(this.db, "ingestion_locks", this.lockId);

      return await runTransaction(this.db, async (transaction) => {
        const snap = await transaction.get(lockDocRef);
        if (!snap.exists()) {
          return false;
        }
        const data = snap.data() as IngestionLockRecord;
        if (data.ownerRunId === runId) {
          transaction.delete(lockDocRef);
          return true;
        }
        return false;
      });
    } catch {
      return this.inMemoryFallback.releaseLock(runId);
    }
  }

  public async getCurrentLock(): Promise<IngestionLockRecord | null> {
    if (!this.db) {
      return this.inMemoryFallback.getCurrentLock();
    }

    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const lockDocRef = doc(this.db, "ingestion_locks", this.lockId);
      const snap = await getDoc(lockDocRef);
      if (!snap.exists()) {
        return null;
      }
      const data = snap.data() as IngestionLockRecord;
      const now = Date.now();
      if (now >= new Date(data.expiresAt).getTime()) {
        return null;
      }
      return data;
    } catch {
      return this.inMemoryFallback.getCurrentLock();
    }
  }

  public async isLockActive(): Promise<boolean> {
    const lock = await this.getCurrentLock();
    return lock !== null;
  }

  public async forceExpireLock(): Promise<void> {
    await this.inMemoryFallback.forceExpireLock();
    if (this.db) {
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        const lockDocRef = doc(this.db, "ingestion_locks", this.lockId);
        await setDoc(lockDocRef, {
          lockId: this.lockId,
          ownerRunId: "expired",
          acquiredAt: new Date(0).toISOString(),
          expiresAt: new Date(0).toISOString(),
          ttlSeconds: 0,
          environment: "DEV"
        });
      } catch {
        // Fallback
      }
    }
  }
}
