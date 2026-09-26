/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 5A: Historical Statistics Repository Interfaces & Implementations
 *
 * Provides repository contracts and implementations for persisting and querying:
 * - HistoricalLotteryStatisticsAggregate
 *
 * Implements:
 * - InMemoryHistoricalStatisticsRepository (offline testing & local caching)
 * - FirestoreRestHistoricalStatisticsRepository (DEV Cloud Firestore via REST)
 *
 * Security: Safe runtime authentication without inspecting or exposing credential files.
 */

import type { HistoricalLotteryStatisticsAggregate } from "./statistical-types";

// ============================================================================
// Repository Interface
// ============================================================================

export interface HistoricalStatisticsRepository {
  saveAggregate(aggregate: HistoricalLotteryStatisticsAggregate): Promise<void>;
  getAggregateById(id: string): Promise<HistoricalLotteryStatisticsAggregate | null>;
  getAggregatesByDocumentSha(documentSha256: string): Promise<HistoricalLotteryStatisticsAggregate[]>;
  getAggregatesByLotteryCode(lotteryCode: string): Promise<HistoricalLotteryStatisticsAggregate[]>;
  listAggregates(limit?: number): Promise<HistoricalLotteryStatisticsAggregate[]>;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

export class InMemoryHistoricalStatisticsRepository implements HistoricalStatisticsRepository {
  private readonly aggregatesById = new Map<string, HistoricalLotteryStatisticsAggregate>();

  async saveAggregate(aggregate: HistoricalLotteryStatisticsAggregate): Promise<void> {
    this.aggregatesById.set(aggregate.id, JSON.parse(JSON.stringify(aggregate)));
  }

  async getAggregateById(id: string): Promise<HistoricalLotteryStatisticsAggregate | null> {
    const item = this.aggregatesById.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async getAggregatesByDocumentSha(
    documentSha256: string
  ): Promise<HistoricalLotteryStatisticsAggregate[]> {
    const norm = documentSha256.trim().toLowerCase();
    const results: HistoricalLotteryStatisticsAggregate[] = [];

    for (const agg of this.aggregatesById.values()) {
      if (agg.population.documentIds.some((d) => d.toLowerCase() === norm)) {
        results.push(JSON.parse(JSON.stringify(agg)));
      }
    }
    return results;
  }

  async getAggregatesByLotteryCode(
    lotteryCode: string
  ): Promise<HistoricalLotteryStatisticsAggregate[]> {
    const norm = lotteryCode.trim().toUpperCase();
    const results: HistoricalLotteryStatisticsAggregate[] = [];

    for (const agg of this.aggregatesById.values()) {
      if (agg.population.lotteryCode?.toUpperCase() === norm) {
        results.push(JSON.parse(JSON.stringify(agg)));
      }
    }
    return results;
  }

  async listAggregates(limit = 100): Promise<HistoricalLotteryStatisticsAggregate[]> {
    const all = Array.from(this.aggregatesById.values()).map((a) =>
      JSON.parse(JSON.stringify(a))
    );
    return all.slice(0, limit);
  }
}

// ============================================================================
// Firestore REST Value Serialization
// ============================================================================

function encodeFirestoreValue(val: unknown): Record<string, any> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => encodeFirestoreValue(item))
      }
    };
  }
  if (typeof val === "object") {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeFirestoreValue(f: Record<string, any>): any {
  if ("nullValue" in f) return null;
  if ("booleanValue" in f) return f.booleanValue;
  if ("integerValue" in f) return parseInt(f.integerValue, 10);
  if ("doubleValue" in f) return parseFloat(f.doubleValue);
  if ("stringValue" in f) return f.stringValue;
  if ("timestampValue" in f) return f.timestampValue;
  if ("arrayValue" in f) {
    return (f.arrayValue.values || []).map((v: any) => decodeFirestoreValue(v));
  }
  if ("mapValue" in f) {
    const result: Record<string, any> = {};
    const subFields = f.mapValue.fields || {};
    for (const [k, v] of Object.entries(subFields)) {
      result[k] = decodeFirestoreValue(v as Record<string, any>);
    }
    return result;
  }
  return null;
}

// ============================================================================
// Firestore REST Implementation
// ============================================================================

export interface FirestoreRestHistoricalStatisticsRepositoryOptions {
  projectId: string;
  databaseId?: string;
  collectionName?: string;
  getAccessToken: () => Promise<string> | string;
}

export class FirestoreRestHistoricalStatisticsRepository
  implements HistoricalStatisticsRepository
{
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly collectionName: string;
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: FirestoreRestHistoricalStatisticsRepositoryOptions) {
    this.projectId = options.projectId;
    this.databaseId = options.databaseId || "(default)";
    this.collectionName = options.collectionName || "statistical_reports";
    this.getAccessToken = options.getAccessToken;
  }

  private get baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  async saveAggregate(aggregate: HistoricalLotteryStatisticsAggregate): Promise<void> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(aggregate.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({ fields: encodeFirestoreValue(aggregate).mapValue.fields });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Failed to save historical statistics aggregate '${aggregate.id}': HTTP ${res.status} - ${errText}`
      );
    }
  }

  async getAggregateById(id: string): Promise<HistoricalLotteryStatisticsAggregate | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(id)}`;
    const headers = await this.getHeaders();

    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get aggregate '${id}': HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return decodeFirestoreValue({ mapValue: { fields: data.fields } });
  }

  async getAggregatesByDocumentSha(
    documentSha256: string
  ): Promise<HistoricalLotteryStatisticsAggregate[]> {
    const norm = documentSha256.trim().toLowerCase();
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();

    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: "population.documentIds" },
            op: "ARRAY_CONTAINS",
            value: { stringValue: norm }
          }
        }
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Failed to query aggregates for document '${norm}': HTTP ${res.status} - ${errText}`
      );
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: HistoricalLotteryStatisticsAggregate[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(decodeFirestoreValue({ mapValue: { fields: item.document.fields } }));
      }
    }
    return results;
  }

  async getAggregatesByLotteryCode(
    lotteryCode: string
  ): Promise<HistoricalLotteryStatisticsAggregate[]> {
    const norm = lotteryCode.trim().toUpperCase();
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();

    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: "population.lotteryCode" },
            op: "EQUAL",
            value: { stringValue: norm }
          }
        }
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Failed to query aggregates for lottery '${norm}': HTTP ${res.status} - ${errText}`
      );
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: HistoricalLotteryStatisticsAggregate[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(decodeFirestoreValue({ mapValue: { fields: item.document.fields } }));
      }
    }
    return results;
  }

  async listAggregates(limit = 100): Promise<HistoricalLotteryStatisticsAggregate[]> {
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();

    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.collectionName }],
        limit
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to list aggregates: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: HistoricalLotteryStatisticsAggregate[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(decodeFirestoreValue({ mapValue: { fields: item.document.fields } }));
      }
    }
    return results;
  }
}
