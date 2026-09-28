/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 8B — Operational Ingestion Run Repository & State Persistence
 *
 * Persists durable audit records for every scheduled/manual ingestion execution.
 * Enforces secret sanitization to protect sensitive operational credentials.
 */

import { IngestionRunRecord, RunStatus } from "./types";

export interface IngestionRunRepository {
  createRun(record: IngestionRunRecord): Promise<void>;
  updateRun(runId: string, updates: Partial<IngestionRunRecord>): Promise<void>;
  updateRunStatus(runId: string, status: RunStatus, updates?: Partial<IngestionRunRecord>): Promise<void>;
  getRun(runId: string): Promise<IngestionRunRecord | null>;
  listRuns(limit?: number): Promise<IngestionRunRecord[]>;
  getLastSuccessfulRun(): Promise<IngestionRunRecord | null>;
  getLastAttemptedRun(): Promise<IngestionRunRecord | null>;
}

/**
 * Sanitizes object by removing any potential secret keys or authorization tokens.
 */
export function sanitizeOperationalRecord<T extends Record<string, any>>(record: T): T {
  const secretPattern = /token|secret|password|credential|private_key|api_key|apikey|_key|auth|bearer|pat/i;

  function deepSanitize(val: any): any {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      return val
        .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
        .replace(/([?&](?:token|auth_token|auth|key|api_key|secret)=)[^&\s]+/gi, "$1[REDACTED]");
    }
    if (typeof val !== "object") return val;
    if (Array.isArray(val)) {
      return val.map(deepSanitize);
    }
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (secretPattern.test(k) && typeof v === "string") {
        clean[k] = "[REDACTED_SECRET]";
      } else {
        clean[k] = deepSanitize(v);
      }
    }
    return clean;
  }

  return deepSanitize(record);
}

/**
 * In-Memory Ingestion Run Repository.
 */
export class InMemoryIngestionRunRepository implements IngestionRunRepository {
  private runs = new Map<string, IngestionRunRecord>();

  public async createRun(record: IngestionRunRecord): Promise<void> {
    const clean = sanitizeOperationalRecord(record);
    this.runs.set(clean.runId, clean);
  }

  public async updateRun(runId: string, updates: Partial<IngestionRunRecord>): Promise<void> {
    const existing = this.runs.get(runId);
    if (!existing) {
      throw new Error(`Ingestion run '${runId}' not found for update.`);
    }
    const cleanUpdates = sanitizeOperationalRecord(updates);
    const updated: IngestionRunRecord = {
      ...existing,
      ...cleanUpdates,
      runId // ensure primary key cannot be overwritten
    };
    this.runs.set(runId, updated);
  }

  public async updateRunStatus(
    runId: string,
    status: RunStatus,
    updates?: Partial<IngestionRunRecord>
  ): Promise<void> {
    await this.updateRun(runId, {
      status,
      ...(updates || {})
    });
  }

  public async getRun(runId: string): Promise<IngestionRunRecord | null> {
    const record = this.runs.get(runId);
    return record ? { ...record } : null;
  }

  public async listRuns(limit: number = 20): Promise<IngestionRunRecord[]> {
    const list = Array.from(this.runs.values()).sort((a, b) => {
      const timeA = new Date(a.requestedAt || a.startedAt || 0).getTime();
      const timeB = new Date(b.requestedAt || b.startedAt || 0).getTime();
      return timeB - timeA;
    });
    return list.slice(0, limit);
  }

  public async getLastSuccessfulRun(): Promise<IngestionRunRecord | null> {
    const all = await this.listRuns(100);
    return all.find((r) => r.status === "SUCCEEDED" || r.status === "PARTIAL_SUCCESS") || null;
  }

  public async getLastAttemptedRun(): Promise<IngestionRunRecord | null> {
    const all = await this.listRuns(1);
    return all[0] || null;
  }

  public clear(): void {
    this.runs.clear();
  }
}

/**
 * Firestore-Backed Ingestion Run Repository.
 * Writes records to the `/ingestion_runs/{runId}` collection.
 */
export class FirestoreIngestionRunRepository implements IngestionRunRepository {
  private inMemoryFallback: InMemoryIngestionRunRepository;
  private readonly collectionName = "ingestion_runs";
  private readonly db?: any;

  constructor(options?: { db?: any }) {
    this.db = options?.db;
    this.inMemoryFallback = new InMemoryIngestionRunRepository();
  }

  public async createRun(record: IngestionRunRecord): Promise<void> {
    const clean = sanitizeOperationalRecord(record);
    this.inMemoryFallback.createRun(clean);

    if (!this.db) return;

    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const ref = doc(this.db, this.collectionName, clean.runId);
      await setDoc(ref, clean);
    } catch {
      // Offline fallback
    }
  }

  public async updateRun(runId: string, updates: Partial<IngestionRunRecord>): Promise<void> {
    const clean = sanitizeOperationalRecord(updates);
    await this.inMemoryFallback.updateRun(runId, clean);

    if (!this.db) return;

    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const ref = doc(this.db, this.collectionName, runId);
      await updateDoc(ref, clean);
    } catch {
      // Offline fallback
    }
  }

  public async updateRunStatus(
    runId: string,
    status: RunStatus,
    updates?: Partial<IngestionRunRecord>
  ): Promise<void> {
    await this.updateRun(runId, {
      status,
      ...(updates || {})
    });
  }

  public async getRun(runId: string): Promise<IngestionRunRecord | null> {
    if (!this.db) {
      return this.inMemoryFallback.getRun(runId);
    }

    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const ref = doc(this.db, this.collectionName, runId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return this.inMemoryFallback.getRun(runId);
      }
      return snap.data() as IngestionRunRecord;
    } catch {
      return this.inMemoryFallback.getRun(runId);
    }
  }

  public async listRuns(limit: number = 20): Promise<IngestionRunRecord[]> {
    if (!this.db) {
      return this.inMemoryFallback.listRuns(limit);
    }

    try {
      const { collection, query, orderBy, limit: firestoreLimit, getDocs } = await import("firebase/firestore");
      const q = query(
        collection(this.db, this.collectionName),
        orderBy("requestedAt", "desc"),
        firestoreLimit(limit)
      );
      const snaps = await getDocs(q);
      const results: IngestionRunRecord[] = [];
      snaps.forEach((s: any) => results.push(s.data() as IngestionRunRecord));
      if (results.length > 0) return results;
      return this.inMemoryFallback.listRuns(limit);
    } catch {
      return this.inMemoryFallback.listRuns(limit);
    }
  }

  public async getLastSuccessfulRun(): Promise<IngestionRunRecord | null> {
    const runs = await this.listRuns(50);
    return runs.find((r) => r.status === "SUCCEEDED" || r.status === "PARTIAL_SUCCESS") || null;
  }

  public async getLastAttemptedRun(): Promise<IngestionRunRecord | null> {
    const runs = await this.listRuns(1);
    return runs[0] || null;
  }
}
