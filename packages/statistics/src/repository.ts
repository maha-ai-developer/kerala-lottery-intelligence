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
import type { MultiDrawLotteryCorpus } from "./multi-draw-corpus";
import type { HistoricalAnalysisSuite } from "./historical-analysis-types";
import type {
  HistoricalExperimentRecord,
  ExperimentResult,
  ExperimentDefinition
} from "./experiment-types";
import type {
  HistoricalRobustnessRecord,
  RobustnessReport,
  RobustnessDefinition
} from "./robustness-types";

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface MultiDrawCorpusRepository {
  saveCorpus(corpus: MultiDrawLotteryCorpus): Promise<void>;
  getCorpusById(id: string): Promise<MultiDrawLotteryCorpus | null>;
  listCorpora(limit?: number): Promise<MultiDrawLotteryCorpus[]>;
}

export interface HistoricalAnalysisRepository {
  saveAnalysis(analysis: HistoricalAnalysisSuite): Promise<void>;
  getAnalysisById(id: string): Promise<HistoricalAnalysisSuite | null>;
  listAnalyses(limit?: number): Promise<HistoricalAnalysisSuite[]>;
}

export interface HistoricalExperimentRepository {
  saveExperiment(experiment: HistoricalExperimentRecord): Promise<void>;
  getExperimentById(experimentId: string): Promise<HistoricalExperimentRecord | null>;
  listExperiments(limit?: number): Promise<HistoricalExperimentRecord[]>;
}

export interface HistoricalRobustnessRepository {
  saveReport(report: HistoricalRobustnessRecord): Promise<void>;
  getReportById(robustnessId: string): Promise<HistoricalRobustnessRecord | null>;
  listReports(limit?: number): Promise<HistoricalRobustnessRecord[]>;
}


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

// ============================================================================
// Multi-Draw Corpus Repository Implementations
// ============================================================================

export class InMemoryMultiDrawCorpusRepository implements MultiDrawCorpusRepository {
  private readonly corporaById = new Map<string, MultiDrawLotteryCorpus>();

  async saveCorpus(corpus: MultiDrawLotteryCorpus): Promise<void> {
    this.corporaById.set(corpus.id, JSON.parse(JSON.stringify(corpus)));
  }

  async getCorpusById(id: string): Promise<MultiDrawLotteryCorpus | null> {
    const item = this.corporaById.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listCorpora(limit = 10): Promise<MultiDrawLotteryCorpus[]> {
    const all = Array.from(this.corporaById.values()).map((c) => JSON.parse(JSON.stringify(c)));
    return all.slice(0, limit);
  }
}

export class FirestoreRestMultiDrawCorpusRepository implements MultiDrawCorpusRepository {
  private readonly baseUrl: string;
  private readonly collectionName: string;
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: FirestoreRestHistoricalStatisticsRepositoryOptions) {
    const databaseId = options.databaseId || "(default)";
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/${databaseId}/documents`;
    this.collectionName = "lottery_corpora";
    this.getAccessToken = options.getAccessToken;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  async saveCorpus(corpus: MultiDrawLotteryCorpus): Promise<void> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(corpus.id)}`;
    const headers = await this.getHeaders();
    // Do not encode full knowledgeGraphs directly to avoid Firestore 1MB document limit; store draw profiles and summaries
    const persistable = {
      id: corpus.id,
      corpusHash: corpus.corpusHash,
      version: corpus.version,
      computedAt: corpus.computedAt,
      draws: corpus.draws,
      documentSha256s: corpus.documentSha256s,
      validationReport: corpus.validationReport,
      totalDraws: corpus.draws.length,
      totalWinningResults: corpus.validationReport.totalWinningResults
    };
    const body = JSON.stringify({
      fields: encodeFirestoreValue(persistable).mapValue.fields
    });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to save corpus ${corpus.id}: HTTP ${res.status} - ${errText}`);
    }
  }

  async getCorpusById(id: string): Promise<MultiDrawLotteryCorpus | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(id)}`;
    const headers = await this.getHeaders();

    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get corpus ${id}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return decodeFirestoreValue({ mapValue: { fields: data.fields } });
  }

  async listCorpora(limit = 10): Promise<MultiDrawLotteryCorpus[]> {
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
      throw new Error(`Failed to list corpora: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: MultiDrawLotteryCorpus[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(decodeFirestoreValue({ mapValue: { fields: item.document.fields } }));
      }
    }
    return results;
  }
}

// ============================================================================
// Historical Analysis In-Memory & Firestore Implementations (Milestone 5C)
// ============================================================================

export class InMemoryHistoricalAnalysisRepository implements HistoricalAnalysisRepository {
  private readonly analysesById = new Map<string, HistoricalAnalysisSuite>();

  async saveAnalysis(analysis: HistoricalAnalysisSuite): Promise<void> {
    this.analysesById.set(analysis.id, JSON.parse(JSON.stringify(analysis)));
  }

  async getAnalysisById(id: string): Promise<HistoricalAnalysisSuite | null> {
    const item = this.analysesById.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listAnalyses(limit = 10): Promise<HistoricalAnalysisSuite[]> {
    return Array.from(this.analysesById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }
}

export class FirestoreRestHistoricalAnalysisRepository implements HistoricalAnalysisRepository {
  private readonly baseUrl: string;
  private readonly collectionName = "historical_analyses";
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: FirestoreRestHistoricalStatisticsRepositoryOptions) {
    const projectId = options.projectId || "kerala-lottery-intel-dev";
    const databaseId = options.databaseId || "(default)";
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    this.getAccessToken = options.getAccessToken;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  async saveAnalysis(analysis: HistoricalAnalysisSuite): Promise<void> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(analysis.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({
      fields: encodeFirestoreValue(analysis).mapValue.fields
    });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to save historical analysis ${analysis.id}: HTTP ${res.status} - ${errText}`);
    }
  }

  async getAnalysisById(id: string): Promise<HistoricalAnalysisSuite | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(id)}`;
    const headers = await this.getHeaders();

    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get historical analysis ${id}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return decodeFirestoreValue({ mapValue: { fields: data.fields } });
  }

  async listAnalyses(limit = 10): Promise<HistoricalAnalysisSuite[]> {
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
      throw new Error(`Failed to list historical analyses: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: HistoricalAnalysisSuite[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(decodeFirestoreValue({ mapValue: { fields: item.document.fields } }));
      }
    }
    return results;
  }
}

// ============================================================================
// Historical Experiment In-Memory & Firestore Implementations (Milestone 5D)
// ============================================================================

export function createHistoricalExperimentRecord(
  definition: ExperimentDefinition,
  result: ExperimentResult
): HistoricalExperimentRecord {
  return {
    id: definition.id,
    experimentId: definition.id,
    definition,
    result,
    createdAt: result.executedAt || new Date().toISOString()
  };
}

export class InMemoryHistoricalExperimentRepository implements HistoricalExperimentRepository {
  private readonly experimentsById = new Map<string, HistoricalExperimentRecord>();

  async saveExperiment(experiment: HistoricalExperimentRecord): Promise<void> {
    this.experimentsById.set(experiment.id, JSON.parse(JSON.stringify(experiment)));
  }

  async getExperimentById(experimentId: string): Promise<HistoricalExperimentRecord | null> {
    const item = this.experimentsById.get(experimentId);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listExperiments(limit = 10): Promise<HistoricalExperimentRecord[]> {
    return Array.from(this.experimentsById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }
}

export class FirestoreRestHistoricalExperimentRepository implements HistoricalExperimentRepository {
  private readonly baseUrl: string;
  private readonly collectionName = "historical_experiments";
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: FirestoreRestHistoricalStatisticsRepositoryOptions) {
    const projectId = options.projectId || "kerala-lottery-intel-dev";
    const databaseId = options.databaseId || "(default)";
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    this.getAccessToken = options.getAccessToken;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  async saveExperiment(experiment: HistoricalExperimentRecord): Promise<void> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(experiment.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({
      fields: encodeFirestoreValue(experiment).mapValue.fields
    });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to save historical experiment ${experiment.id}: HTTP ${res.status} - ${errText}`);
    }
  }

  async getExperimentById(experimentId: string): Promise<HistoricalExperimentRecord | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(experimentId)}`;
    const headers = await this.getHeaders();

    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get historical experiment ${experimentId}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return decodeFirestoreValue({ mapValue: { fields: data.fields } });
  }

  async listExperiments(limit = 10): Promise<HistoricalExperimentRecord[]> {
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
      throw new Error(`Failed to list historical experiments: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: HistoricalExperimentRecord[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(decodeFirestoreValue({ mapValue: { fields: item.document.fields } }));
      }
    }
    return results;
  }
}

// ============================================================================
// Historical Robustness In-Memory & Firestore Implementations (Milestone 5E)
// ============================================================================

export function createHistoricalRobustnessRecord(
  definition: RobustnessDefinition,
  report: RobustnessReport
): HistoricalRobustnessRecord {
  return {
    id: definition.id,
    robustnessId: definition.id,
    definition,
    report,
    createdAt: report.evaluatedAt || new Date().toISOString()
  };
}

export class InMemoryHistoricalRobustnessRepository implements HistoricalRobustnessRepository {
  private readonly reportsById = new Map<string, HistoricalRobustnessRecord>();

  async saveReport(report: HistoricalRobustnessRecord): Promise<void> {
    this.reportsById.set(report.id, JSON.parse(JSON.stringify(report)));
  }

  async getReportById(robustnessId: string): Promise<HistoricalRobustnessRecord | null> {
    const item = this.reportsById.get(robustnessId);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listReports(limit = 10): Promise<HistoricalRobustnessRecord[]> {
    return Array.from(this.reportsById.values())
      .slice(0, limit)
      .map((item) => JSON.parse(JSON.stringify(item)));
  }
}

export class FirestoreRestHistoricalRobustnessRepository implements HistoricalRobustnessRepository {
  private readonly baseUrl: string;
  private readonly collectionName = "historical_robustness_reports";
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: FirestoreRestHistoricalStatisticsRepositoryOptions) {
    const projectId = options.projectId || "kerala-lottery-intel-dev";
    const databaseId = options.databaseId || "(default)";
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    this.getAccessToken = options.getAccessToken;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  async saveReport(report: HistoricalRobustnessRecord): Promise<void> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(report.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({
      fields: encodeFirestoreValue(report).mapValue.fields
    });

    const res = await fetch(url, { method: "PATCH", headers, body });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to save historical robustness report ${report.id}: HTTP ${res.status} - ${errText}`);
    }
  }

  async getReportById(robustnessId: string): Promise<HistoricalRobustnessRecord | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(robustnessId)}`;
    const headers = await this.getHeaders();

    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get historical robustness report ${robustnessId}: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return decodeFirestoreValue({ mapValue: { fields: data.fields } });
  }

  async listReports(limit = 10): Promise<HistoricalRobustnessRecord[]> {
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
      throw new Error(`Failed to list historical robustness reports: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: HistoricalRobustnessRecord[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(decodeFirestoreValue({ mapValue: { fields: item.document.fields } }));
      }
    }
    return results;
  }
}


