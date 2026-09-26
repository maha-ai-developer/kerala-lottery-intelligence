/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Repository & Data Access Contracts
 */

import type {
  Draw,
  WinningNumber,
  SourceDocument,
  DatasetVersion,
  AuditLog,
  UserProfile,
  DocumentProvenance,
  HttpProvenanceMetadata,
  DocumentPage,
  TextBlock,
  PageExtractionStatus,
  SemanticDocumentKind,
  SemanticRegionType,
  RegionBoundingBox,
  SemanticRegion,
  SemanticField,
  DrawMetadata,
  ClassificationEvidence,
  DocumentClassificationResult,
  DocumentSemanticSegmentation,
  PrizeTier,
  WinningResult,
  Series
} from "@kerala-lottery/domain";
import {
  getDocumentPageId,
  validateDocumentPage,
  validateDocumentSemanticSegmentation,
  DEFAULT_SEMANTIC_VERSION,
  validatePrizeTier,
  validateWinningResult
} from "@kerala-lottery/documents";

export type {
  DocumentPage,
  TextBlock,
  PageExtractionStatus,
  SemanticDocumentKind,
  SemanticRegionType,
  RegionBoundingBox,
  SemanticRegion,
  SemanticField,
  DrawMetadata,
  ClassificationEvidence,
  DocumentClassificationResult,
  DocumentSemanticSegmentation,
  PrizeTier,
  WinningResult,
  Series
};
export { DEFAULT_SEMANTIC_VERSION };

export interface DrawRepository {
  findById(id: string): Promise<Draw | null>;
  findByLotteryId(lotteryId: string, limit?: number): Promise<Draw[]>;
  findByDateRange(startDate: string, endDate: string): Promise<Draw[]>;
  save(draw: Draw): Promise<void>;
}

export interface WinningNumberRepository {
  findByDrawId(drawId: string): Promise<WinningNumber[]>;
  findByCanonicalNumber(canonicalNumber: string): Promise<WinningNumber[]>;
  saveMany(numbers: WinningNumber[]): Promise<void>;
}

export interface PrizeTierRepository {
  getById(id: string): Promise<PrizeTier | null>;
  getByDocumentSha256(documentSha256: string): Promise<PrizeTier[]>;
  save(tier: PrizeTier): Promise<void>;
  saveBatch(tiers: PrizeTier[]): Promise<void>;
}

export interface WinningResultRepository {
  getById(id: string): Promise<WinningResult | null>;
  getByDocumentSha256(documentSha256: string): Promise<WinningResult[]>;
  getByPrizeTierId(prizeTierId: string): Promise<WinningResult[]>;
  save(result: WinningResult): Promise<void>;
  saveBatch(results: WinningResult[]): Promise<void>;
}

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  type Firestore
} from "firebase/firestore";

export interface DocumentRepository {
  getBySha256(sha256: string): Promise<SourceDocument | null>;
  create(document: SourceDocument): Promise<void>;
  findById?(id: string): Promise<SourceDocument | null>;
  findBySha256?(sha256: string): Promise<SourceDocument | null>;
  save?(doc: SourceDocument): Promise<void>;
}

export interface DocumentPageRepository {
  getById(id: string): Promise<DocumentPage | null>;
  getByDocumentAndPage(documentSha256: string, pageNumber: number): Promise<DocumentPage | null>;
  getByDocumentSha256(documentSha256: string): Promise<DocumentPage[]>;
  create(page: DocumentPage): Promise<void>;
  createBatch(pages: DocumentPage[]): Promise<void>;
  save(page: DocumentPage): Promise<void>;
}

export interface StorageMetadata {
  sha256: string;
  originalFileName: string;
  retrievedAt: string;
  contentType?: string;
  customMetadata?: Record<string, string>;
}

export interface StorageObject {
  path: string;
  size: number;
  sha256: string;
  contentType: string;
  created: string;
  etag?: string;
  generation?: string;
}

export interface StorageService {
  putIfAbsent(
    path: string,
    data: Uint8Array,
    metadata: StorageMetadata
  ): Promise<StorageObject>;
  getObject?(path: string): Promise<Uint8Array | null>;
}

// ============================================================================
// Error Types
// ============================================================================

export class DocumentAlreadyExistsError extends Error {
  constructor(message: string, public readonly documentId?: string) {
    super(message);
    this.name = "DocumentAlreadyExistsError";
  }
}

export class PageAlreadyExistsError extends Error {
  constructor(message: string, public readonly pageId?: string) {
    super(message);
    this.name = "PageAlreadyExistsError";
  }
}

export class StorageAlreadyExistsError extends Error {
  constructor(message: string, public readonly existingObject?: StorageObject) {
    super(message);
    this.name = "StorageAlreadyExistsError";
  }
}

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

// ============================================================================
// In-Memory Implementations for Testing & Offline Execution
// ============================================================================

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, SourceDocument>();

  async getBySha256(sha256: string): Promise<SourceDocument | null> {
    const doc = this.documents.get(sha256);
    return doc ? { ...doc } : null;
  }

  async create(document: SourceDocument): Promise<void> {
    if (this.documents.has(document.sha256)) {
      throw new DocumentAlreadyExistsError(
        `Document with SHA-256 '${document.sha256}' already exists in repository`,
        document.sha256
      );
    }
    this.documents.set(document.sha256, { ...document });
  }

  async findById(id: string): Promise<SourceDocument | null> {
    return this.getBySha256(id);
  }

  async findBySha256(sha256: string): Promise<SourceDocument | null> {
    return this.getBySha256(sha256);
  }

  async save(doc: SourceDocument): Promise<void> {
    return this.create(doc);
  }

  getAll(): SourceDocument[] {
    return Array.from(this.documents.values()).map((d) => ({ ...d }));
  }

  clear(): void {
    this.documents.clear();
  }
}

export class InMemoryDocumentPageRepository implements DocumentPageRepository {
  private readonly pages = new Map<string, DocumentPage>();

  async getById(id: string): Promise<DocumentPage | null> {
    const page = this.pages.get(id);
    return page ? JSON.parse(JSON.stringify(page)) : null;
  }

  async getByDocumentAndPage(documentSha256: string, pageNumber: number): Promise<DocumentPage | null> {
    const pageId = getDocumentPageId(documentSha256, pageNumber);
    return this.getById(pageId);
  }

  async getByDocumentSha256(documentSha256: string): Promise<DocumentPage[]> {
    const normalized = documentSha256.trim().toLowerCase();
    const matches: DocumentPage[] = [];
    for (const page of this.pages.values()) {
      if (page.documentSha256 === normalized) {
        matches.push(JSON.parse(JSON.stringify(page)));
      }
    }
    return matches.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async create(page: DocumentPage): Promise<void> {
    validateDocumentPage(page);
    if (this.pages.has(page.id)) {
      throw new PageAlreadyExistsError(
        `DocumentPage with ID '${page.id}' already exists in repository`,
        page.id
      );
    }
    this.pages.set(page.id, JSON.parse(JSON.stringify(page)));
  }

  async createBatch(pages: DocumentPage[]): Promise<void> {
    for (const page of pages) {
      await this.create(page);
    }
  }

  async save(page: DocumentPage): Promise<void> {
    validateDocumentPage(page);
    this.pages.set(page.id, JSON.parse(JSON.stringify(page)));
  }

  getAll(): DocumentPage[] {
    return Array.from(this.pages.values()).map((p) => JSON.parse(JSON.stringify(p)));
  }

  clear(): void {
    this.pages.clear();
  }
}

export class InMemoryStorageService implements StorageService {
  private readonly objects = new Map<
    string,
    { data: Uint8Array; metadata: StorageMetadata; created: string }
  >();

  async putIfAbsent(
    path: string,
    data: Uint8Array,
    metadata: StorageMetadata
  ): Promise<StorageObject> {
    const normalizedPath = path.replace(/^\/+/, "");
    if (this.objects.has(normalizedPath)) {
      const existing = this.objects.get(normalizedPath)!;
      throw new StorageAlreadyExistsError(
        `Storage object already exists at '${normalizedPath}'`,
        {
          path: normalizedPath,
          size: existing.data.byteLength,
          sha256: existing.metadata.sha256,
          contentType: existing.metadata.contentType || "application/pdf",
          created: existing.created
        }
      );
    }

    const created = new Date().toISOString();
    this.objects.set(normalizedPath, {
      data: new Uint8Array(data),
      metadata: { ...metadata },
      created
    });

    return {
      path: normalizedPath,
      size: data.byteLength,
      sha256: metadata.sha256,
      contentType: metadata.contentType || "application/pdf",
      created
    };
  }

  async getObject(path: string): Promise<Uint8Array | null> {
    const normalizedPath = path.replace(/^\/+/, "");
    const obj = this.objects.get(normalizedPath);
    return obj ? new Uint8Array(obj.data) : null;
  }

  has(path: string): boolean {
    return this.objects.has(path.replace(/^\/+/, ""));
  }

  get(path: string): Uint8Array | undefined {
    return this.objects.get(path.replace(/^\/+/, ""))?.data;
  }

  clear(): void {
    this.objects.clear();
  }
}

// ============================================================================
// Production Firestore & Cloud Storage Implementations
// ============================================================================

export class FirestoreDocumentRepository implements DocumentRepository {
  constructor(
    private readonly db: Firestore,
    private readonly collectionName = "documents"
  ) {}

  async getBySha256(sha256: string): Promise<SourceDocument | null> {
    const docRef = doc(this.db, this.collectionName, sha256);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as SourceDocument;
  }

  async create(document: SourceDocument): Promise<void> {
    const docRef = doc(this.db, this.collectionName, document.id);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(docRef);
      if (snap.exists()) {
        throw new DocumentAlreadyExistsError(
          `Document with ID '${document.id}' already exists in Firestore collection '${this.collectionName}'`,
          document.id
        );
      }
      tx.set(docRef, document);
    });
  }

  async findById(id: string): Promise<SourceDocument | null> {
    return this.getBySha256(id);
  }

  async findBySha256(sha256: string): Promise<SourceDocument | null> {
    return this.getBySha256(sha256);
  }

  async save(doc: SourceDocument): Promise<void> {
    return this.create(doc);
  }
}

export class FirestoreDocumentPageRepository implements DocumentPageRepository {
  constructor(
    private readonly db: Firestore,
    private readonly collectionName = "document_pages"
  ) {}

  async getById(id: string): Promise<DocumentPage | null> {
    const docRef = doc(this.db, this.collectionName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as DocumentPage;
  }

  async getByDocumentAndPage(documentSha256: string, pageNumber: number): Promise<DocumentPage | null> {
    const pageId = getDocumentPageId(documentSha256, pageNumber);
    return this.getById(pageId);
  }

  async getByDocumentSha256(documentSha256: string): Promise<DocumentPage[]> {
    const normalized = documentSha256.trim().toLowerCase();
    const colRef = collection(this.db, this.collectionName);
    const q = query(colRef, where("documentSha256", "==", normalized));
    const snap = await getDocs(q);
    const pages: DocumentPage[] = [];
    snap.forEach((d) => pages.push(d.data() as DocumentPage));
    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async create(page: DocumentPage): Promise<void> {
    validateDocumentPage(page);
    const docRef = doc(this.db, this.collectionName, page.id);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(docRef);
      if (snap.exists()) {
        throw new PageAlreadyExistsError(
          `DocumentPage with ID '${page.id}' already exists in Firestore collection '${this.collectionName}'`,
          page.id
        );
      }
      tx.set(docRef, page);
    });
  }

  async createBatch(pages: DocumentPage[]): Promise<void> {
    for (const page of pages) {
      await this.create(page);
    }
  }

  async save(page: DocumentPage): Promise<void> {
    validateDocumentPage(page);
    const docRef = doc(this.db, this.collectionName, page.id);
    await setDoc(docRef, page, { merge: true });
  }
}

export interface FirebaseStorageServiceOptions {
  bucketName: string;
  getAccessToken?: () => Promise<string> | string;
}

export class FirebaseStorageService implements StorageService {
  private readonly bucket: string;
  private readonly getAccessToken?: () => Promise<string> | string;

  constructor(options: FirebaseStorageServiceOptions) {
    this.bucket = options.bucketName
      .replace(/^gs:\/\//, "")
      .replace(/\/.*$/, "");
    this.getAccessToken = options.getAccessToken;
  }

  async putIfAbsent(
    path: string,
    data: Uint8Array,
    metadata: StorageMetadata
  ): Promise<StorageObject> {
    const cleanPath = path.replace(/^\/+/, "");
    const token = this.getAccessToken
      ? await this.getAccessToken()
      : undefined;

    // Google Cloud Storage REST upload with atomic ifGenerationMatch=0 precondition
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=${encodeURIComponent(
      cleanPath
    )}&ifGenerationMatch=0`;

    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType || "application/pdf"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: Buffer.from(data.buffer, data.byteOffset, data.byteLength) as unknown as BodyInit
    });

    if (response.status === 412) {
      // 412 Precondition Failed: Object already exists with generation > 0
      throw new StorageAlreadyExistsError(
        `Storage object already exists at '${cleanPath}'`,
        {
          path: cleanPath,
          size: data.byteLength,
          sha256: metadata.sha256,
          contentType: metadata.contentType || "application/pdf",
          created: new Date().toISOString()
        }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new StorageError(
        `Failed to upload storage object to '${cleanPath}' (HTTP ${response.status}): ${errText}`
      );
    }

    const result = (await response.json()) as {
      name: string;
      size: string;
      timeCreated: string;
      etag: string;
      generation: string;
    };

    // Patch custom metadata if needed
    if (metadata.customMetadata || metadata.sha256) {
      const metaUrl = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(cleanPath)}`;
      const metaBody = {
        metadata: {
          sha256: metadata.sha256,
          originalFileName: metadata.originalFileName,
          retrievedAt: metadata.retrievedAt,
          ...metadata.customMetadata
        }
      };
      await fetch(metaUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(metaBody)
      }).catch(() => {
        // non-blocking for basic object creation
      });
    }

    return {
      path: cleanPath,
      size: parseInt(result.size, 10) || data.byteLength,
      sha256: metadata.sha256,
      contentType: metadata.contentType || "application/pdf",
      created: result.timeCreated || new Date().toISOString(),
      etag: result.etag,
      generation: result.generation
    };
  }

  async getObject(path: string): Promise<Uint8Array | null> {
    const cleanPath = path.replace(/^\/+/, "");
    const token = this.getAccessToken
      ? await this.getAccessToken()
      : undefined;

    const url = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(cleanPath)}?alt=media`;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const errText = await response.text();
      throw new StorageError(
        `Failed to get storage object from '${cleanPath}' (HTTP ${response.status}): ${errText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}

export interface FirestoreRestConfig {
  projectId: string;
  databaseId?: string;
  getAccessToken?: () => Promise<string> | string;
}

export class FirestoreRestDocumentRepository implements DocumentRepository {
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly getAccessToken?: () => Promise<string> | string;
  private readonly collectionName: string;

  constructor(config: FirestoreRestConfig, collectionName = "documents") {
    this.projectId = config.projectId;
    this.databaseId = config.databaseId || "(default)";
    this.getAccessToken = config.getAccessToken;
    this.collectionName = collectionName;
  }

  private baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  async getBySha256(sha256: string): Promise<SourceDocument | null> {
    const url = `${this.baseUrl()}/${this.collectionName}/${sha256}`;
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to get document ${sha256}: HTTP ${res.status} - ${err}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return this.fromFirestoreFields(data.fields);
  }

  async create(document: SourceDocument): Promise<void> {
    const url = `${this.baseUrl()}/${this.collectionName}?documentId=${document.id}`;
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const body = JSON.stringify({
      fields: this.toFirestoreFields(document)
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (res.status === 409) {
      throw new DocumentAlreadyExistsError(
        `Document with ID '${document.id}' already exists in Firestore collection '${this.collectionName}'`,
        document.id
      );
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create document ${document.id}: HTTP ${res.status} - ${err}`);
    }
  }

  async findById(id: string): Promise<SourceDocument | null> {
    return this.getBySha256(id);
  }

  async findBySha256(sha256: string): Promise<SourceDocument | null> {
    return this.getBySha256(sha256);
  }

  async save(doc: SourceDocument): Promise<void> {
    return this.create(doc);
  }

  private toFirestoreFields(doc: SourceDocument): Record<string, any> {
    const fields: Record<string, any> = {
      id: { stringValue: doc.id },
      type: { stringValue: doc.type },
      title: { stringValue: doc.title },
      storagePath: { stringValue: doc.storagePath },
      sha256: { stringValue: doc.sha256 },
      mimeType: { stringValue: doc.mimeType },
      fileSize: { integerValue: doc.fileSize.toString() },
      sourceOrganization: { stringValue: doc.sourceOrganization },
      retrievedAt: { stringValue: doc.retrievedAt },
      ingestionVersion: { stringValue: doc.ingestionVersion },
      status: { stringValue: doc.status },
      createdAt: { stringValue: doc.createdAt }
    };
    if (doc.sourceUrl) fields.sourceUrl = { stringValue: doc.sourceUrl };
    if (doc.publishedAt) fields.publishedAt = { stringValue: doc.publishedAt };
    if (doc.parserVersion) fields.parserVersion = { stringValue: doc.parserVersion };
    if (doc.provenance) {
      const p = doc.provenance;
      const provFields: Record<string, any> = {
        sourceId: { stringValue: p.sourceId },
        sourceOrganization: { stringValue: p.sourceOrganization },
        requestedUrl: { stringValue: p.requestedUrl },
        finalUrl: { stringValue: p.finalUrl },
        redirectCount: { integerValue: p.redirectCount.toString() },
        retrievedAt: { stringValue: p.retrievedAt }
      };
      if (p.discoveryUrl) provFields.discoveryUrl = { stringValue: p.discoveryUrl };
      if (p.originalFileName) provFields.originalFileName = { stringValue: p.originalFileName };
      if (p.contentTypeMismatch !== undefined) provFields.contentTypeMismatch = { booleanValue: p.contentTypeMismatch };
      if (p.declaredContentType) provFields.declaredContentType = { stringValue: p.declaredContentType };
      if (p.httpMetadata) {
        const h = p.httpMetadata;
        const httpFields: Record<string, any> = {
          statusCode: { integerValue: h.statusCode.toString() },
          contentType: { stringValue: h.contentType },
          sha256: { stringValue: h.sha256 },
          byteSize: { integerValue: h.byteSize.toString() }
        };
        if (h.contentLength !== undefined) httpFields.contentLength = { integerValue: h.contentLength.toString() };
        if (h.etag) httpFields.etag = { stringValue: h.etag };
        if (h.lastModified) httpFields.lastModified = { stringValue: h.lastModified };
        if (h.server) httpFields.server = { stringValue: h.server };
        provFields.httpMetadata = { mapValue: { fields: httpFields } };
      }
      fields.provenance = { mapValue: { fields: provFields } };
    }
    return fields;
  }

  private fromFirestoreFields(fields: Record<string, any>): SourceDocument {
    let provenance: DocumentProvenance | undefined;
    if (fields.provenance?.mapValue?.fields) {
      const pf = fields.provenance.mapValue.fields;
      let httpMetadata: HttpProvenanceMetadata = {
        statusCode: 200,
        contentType: "application/pdf",
        sha256: fields.sha256?.stringValue || "",
        byteSize: parseInt(fields.fileSize?.integerValue || "0", 10)
      };
      if (pf.httpMetadata?.mapValue?.fields) {
        const hf = pf.httpMetadata.mapValue.fields;
        httpMetadata = {
          statusCode: parseInt(hf.statusCode?.integerValue || "200", 10),
          contentType: hf.contentType?.stringValue || "application/pdf",
          contentLength: hf.contentLength?.integerValue ? parseInt(hf.contentLength.integerValue, 10) : undefined,
          etag: hf.etag?.stringValue,
          lastModified: hf.lastModified?.stringValue,
          server: hf.server?.stringValue,
          sha256: hf.sha256?.stringValue || "",
          byteSize: parseInt(hf.byteSize?.integerValue || "0", 10)
        };
      }
      provenance = {
        sourceId: pf.sourceId?.stringValue || "",
        sourceOrganization: pf.sourceOrganization?.stringValue || "",
        discoveryUrl: pf.discoveryUrl?.stringValue,
        requestedUrl: pf.requestedUrl?.stringValue || "",
        finalUrl: pf.finalUrl?.stringValue || "",
        redirectCount: parseInt(pf.redirectCount?.integerValue || "0", 10),
        retrievedAt: pf.retrievedAt?.stringValue || "",
        originalFileName: pf.originalFileName?.stringValue,
        contentTypeMismatch: pf.contentTypeMismatch?.booleanValue,
        declaredContentType: pf.declaredContentType?.stringValue,
        httpMetadata
      };
    }

    return {
      id: fields.id?.stringValue || "",
      type: (fields.type?.stringValue || "LOTTERY_RESULT") as any,
      title: fields.title?.stringValue || "",
      sourceUrl: fields.sourceUrl?.stringValue,
      storagePath: fields.storagePath?.stringValue || "",
      sha256: fields.sha256?.stringValue || "",
      mimeType: fields.mimeType?.stringValue || "application/pdf",
      fileSize: parseInt(fields.fileSize?.integerValue || "0", 10),
      sourceOrganization: fields.sourceOrganization?.stringValue || "",
      publishedAt: fields.publishedAt?.stringValue,
      retrievedAt: fields.retrievedAt?.stringValue || "",
      ingestionVersion: fields.ingestionVersion?.stringValue || "v1.0.0-source-foundation",
      parserVersion: fields.parserVersion?.stringValue,
      status: (fields.status?.stringValue || "UPLOADED") as any,
      createdAt: fields.createdAt?.stringValue || "",
      provenance
    };
  }
}

export class FirestoreRestDocumentPageRepository implements DocumentPageRepository {
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly getAccessToken?: () => Promise<string> | string;
  private readonly collectionName: string;

  constructor(config: FirestoreRestConfig, collectionName = "document_pages") {
    this.projectId = config.projectId;
    this.databaseId = config.databaseId || "(default)";
    this.getAccessToken = config.getAccessToken;
    this.collectionName = collectionName;
  }

  private baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  async getById(id: string): Promise<DocumentPage | null> {
    const url = `${this.baseUrl()}/${this.collectionName}/${id}`;
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to get document page ${id}: HTTP ${res.status} - ${err}`);
    }

    const data = (await res.json()) as { fields: Record<string, any> };
    return this.fromFirestoreFields(data.fields);
  }

  async getByDocumentAndPage(documentSha256: string, pageNumber: number): Promise<DocumentPage | null> {
    const pageId = getDocumentPageId(documentSha256, pageNumber);
    return this.getById(pageId);
  }

  async getByDocumentSha256(documentSha256: string): Promise<DocumentPage[]> {
    const normalized = documentSha256.trim().toLowerCase();
    const url = `${this.baseUrl()}:runQuery`;
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: "documentSha256" },
            op: "EQUAL",
            value: { stringValue: normalized }
          }
        }
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to query document pages for ${normalized}: HTTP ${res.status} - ${err}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const pages: DocumentPage[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        pages.push(this.fromFirestoreFields(item.document.fields));
      }
    }
    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async create(page: DocumentPage): Promise<void> {
    validateDocumentPage(page);
    const existing = await this.getById(page.id);
    if (existing) {
      throw new PageAlreadyExistsError(
        `DocumentPage with ID '${page.id}' already exists in Firestore collection '${this.collectionName}'`,
        page.id
      );
    }

    const url = `${this.baseUrl()}/${this.collectionName}?documentId=${page.id}`;
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const body = JSON.stringify({
      fields: this.toFirestoreFields(page)
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (res.status === 409) {
      throw new PageAlreadyExistsError(
        `DocumentPage with ID '${page.id}' already exists in Firestore collection '${this.collectionName}'`,
        page.id
      );
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create page ${page.id}: HTTP ${res.status} - ${err}`);
    }
  }

  async createBatch(pages: DocumentPage[]): Promise<void> {
    for (const page of pages) {
      await this.create(page);
    }
  }

  async save(page: DocumentPage): Promise<void> {
    validateDocumentPage(page);
    const existing = await this.getById(page.id);
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (existing) {
      const url = `${this.baseUrl()}/${this.collectionName}/${page.id}`;
      const body = JSON.stringify({
        fields: this.toFirestoreFields(page)
      });
      const res = await fetch(url, { method: "PATCH", headers, body });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to update page ${page.id}: HTTP ${res.status} - ${err}`);
      }
    } else {
      await this.create(page);
    }
  }

  private toFirestoreFields(page: DocumentPage): Record<string, any> {
    const fields: Record<string, any> = {
      id: { stringValue: page.id },
      documentSha256: { stringValue: page.documentSha256 },
      pageNumber: { integerValue: page.pageNumber.toString() },
      pageCount: { integerValue: page.pageCount.toString() },
      extractionMethod: { stringValue: page.extractionMethod },
      extractionVersion: { stringValue: page.extractionVersion },
      extractionStatus: { stringValue: page.extractionStatus },
      text: { stringValue: page.text },
      pageWidth: { doubleValue: page.pageWidth },
      pageHeight: { doubleValue: page.pageHeight },
      unit: { stringValue: page.unit },
      hasImages: { booleanValue: page.hasImages },
      createdAt: { stringValue: page.createdAt },
      updatedAt: { stringValue: page.updatedAt }
    };
    if (page.errorMessage) {
      fields.errorMessage = { stringValue: page.errorMessage };
    }
    if (Array.isArray(page.textBlocks)) {
      const values = page.textBlocks.map((b) => {
        const bf: Record<string, any> = {
          order: { integerValue: b.order.toString() },
          text: { stringValue: b.text },
          x: { doubleValue: b.x },
          y: { doubleValue: b.y },
          width: { doubleValue: b.width },
          height: { doubleValue: b.height }
        };
        if (b.id) bf.id = { stringValue: b.id };
        if (b.top !== undefined) bf.top = { doubleValue: b.top };
        if (b.fontName) bf.fontName = { stringValue: b.fontName };
        if (b.fontSize !== undefined) bf.fontSize = { doubleValue: b.fontSize };
        if (b.fontWeight) bf.fontWeight = { stringValue: b.fontWeight };
        if (b.rotation !== undefined) bf.rotation = { integerValue: b.rotation.toString() };
        return { mapValue: { fields: bf } };
      });
      fields.textBlocks = { arrayValue: { values } };
    }
    return fields;
  }

  private fromFirestoreFields(fields: Record<string, any>): DocumentPage {
    const textBlocks: TextBlock[] = [];
    if (fields.textBlocks?.arrayValue?.values) {
      for (const val of fields.textBlocks.arrayValue.values) {
        if (val.mapValue?.fields) {
          const bf = val.mapValue.fields;
          textBlocks.push({
            id: bf.id?.stringValue,
            order: parseInt(bf.order?.integerValue || "0", 10),
            text: bf.text?.stringValue || "",
            x: parseFloat(bf.x?.doubleValue || bf.x?.integerValue || "0"),
            y: parseFloat(bf.y?.doubleValue || bf.y?.integerValue || "0"),
            width: parseFloat(bf.width?.doubleValue || bf.width?.integerValue || "0"),
            height: parseFloat(bf.height?.doubleValue || bf.height?.integerValue || "0"),
            top: bf.top ? parseFloat(bf.top.doubleValue || bf.top.integerValue || "0") : undefined,
            fontName: bf.fontName?.stringValue,
            fontSize: bf.fontSize ? parseFloat(bf.fontSize.doubleValue || bf.fontSize.integerValue || "0") : undefined,
            fontWeight: bf.fontWeight?.stringValue,
            rotation: bf.rotation ? parseInt(bf.rotation.integerValue || "0", 10) : undefined
          });
        }
      }
    }

    return {
      id: fields.id?.stringValue || "",
      documentSha256: fields.documentSha256?.stringValue || "",
      pageNumber: parseInt(fields.pageNumber?.integerValue || "1", 10),
      pageCount: parseInt(fields.pageCount?.integerValue || "1", 10),
      extractionMethod: fields.extractionMethod?.stringValue || "PDFJS_TEXT_LAYOUT",
      extractionVersion: fields.extractionVersion?.stringValue || "v1.0.0-text-layout",
      extractionStatus: (fields.extractionStatus?.stringValue || "TEXT_LAYER") as any,
      text: fields.text?.stringValue || "",
      textBlocks,
      pageWidth: parseFloat(fields.pageWidth?.doubleValue || fields.pageWidth?.integerValue || "595.28"),
      pageHeight: parseFloat(fields.pageHeight?.doubleValue || fields.pageHeight?.integerValue || "841.89"),
      unit: "pt",
      hasImages: fields.hasImages?.booleanValue || false,
      createdAt: fields.createdAt?.stringValue || "",
      updatedAt: fields.updatedAt?.stringValue || "",
      errorMessage: fields.errorMessage?.stringValue
    };
  }
}

export interface DatasetVersionRepository {
  findById(id: string): Promise<DatasetVersion | null>;
  listVersions(): Promise<DatasetVersion[]>;
  createVersion(version: DatasetVersion): Promise<void>;
}

export interface AuditRepository {
  recordLog(log: AuditLog): Promise<void>;
}

export interface UserRepository {
  findById(uid: string): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;
}

// ============================================================================
// Milestone 3D: Semantic Document Segmentation Repositories
// ============================================================================

export interface DocumentSegmentationRepository {
  getByDocumentSha256(documentSha256: string): Promise<DocumentSemanticSegmentation | null>;
  save(segmentation: DocumentSemanticSegmentation): Promise<void>;
}

export class InMemoryDocumentSegmentationRepository implements DocumentSegmentationRepository {
  private readonly storage = new Map<string, DocumentSemanticSegmentation>();

  async getByDocumentSha256(documentSha256: string): Promise<DocumentSemanticSegmentation | null> {
    const found = this.storage.get(documentSha256.toLowerCase());
    return found ? { ...found } : null;
  }

  async save(segmentation: DocumentSemanticSegmentation): Promise<void> {
    validateDocumentSemanticSegmentation(segmentation);
    this.storage.set(segmentation.documentSha256.toLowerCase(), { ...segmentation });
  }

  clear(): void {
    this.storage.clear();
  }
}

export class FirestoreDocumentSegmentationRepository implements DocumentSegmentationRepository {
  constructor(
    private readonly firestore: Firestore,
    private readonly collectionName: string = "document_segmentations"
  ) {}

  async getByDocumentSha256(documentSha256: string): Promise<DocumentSemanticSegmentation | null> {
    const docRef = doc(this.firestore, this.collectionName, documentSha256.toLowerCase());
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as DocumentSemanticSegmentation;
  }

  async save(segmentation: DocumentSemanticSegmentation): Promise<void> {
    validateDocumentSemanticSegmentation(segmentation);
    const docRef = doc(this.firestore, this.collectionName, segmentation.documentSha256.toLowerCase());
    await setDoc(docRef, segmentation);
  }
}

export class FirestoreRestDocumentSegmentationRepository implements DocumentSegmentationRepository {
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly collectionName: string;
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: {
    projectId: string;
    databaseId?: string;
    collectionName?: string;
    getAccessToken: () => Promise<string> | string;
  }) {
    this.projectId = options.projectId;
    this.databaseId = options.databaseId || "(default)";
    this.collectionName = options.collectionName || "document_segmentations";
    this.getAccessToken = options.getAccessToken;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  private get baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  async getByDocumentSha256(documentSha256: string): Promise<DocumentSemanticSegmentation | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${documentSha256.toLowerCase()}`;
    const headers = await this.getHeaders();
    const res = await fetch(url, { headers });

    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST GET failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.fields) return null;
    return this.fromFirestoreFields(data.fields);
  }

  async save(segmentation: DocumentSemanticSegmentation): Promise<void> {
    validateDocumentSemanticSegmentation(segmentation);
    const url = `${this.baseUrl}/${this.collectionName}/${segmentation.documentSha256.toLowerCase()}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({ fields: this.toFirestoreFields(segmentation) });

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST PATCH failed (${res.status}): ${errText}`);
    }
  }

  private toFirestoreFields(seg: DocumentSemanticSegmentation): Record<string, any> {
    const fields: Record<string, any> = {
      id: { stringValue: seg.id },
      documentSha256: { stringValue: seg.documentSha256 },
      pageCount: { integerValue: seg.pageCount.toString() },
      extractionVersion: { stringValue: seg.extractionVersion },
      semanticVersion: { stringValue: seg.semanticVersion },
      createdAt: { stringValue: seg.createdAt },
      classification: {
        mapValue: {
          fields: {
            documentSha256: { stringValue: seg.classification.documentSha256 },
            kind: { stringValue: seg.classification.kind },
            confidence: { doubleValue: seg.classification.confidence },
            ruleId: { stringValue: seg.classification.ruleId },
            semanticVersion: { stringValue: seg.classification.semanticVersion },
            evidence: {
              arrayValue: {
                values: seg.classification.evidence.map((e) => ({
                  mapValue: {
                    fields: {
                      ruleId: { stringValue: e.ruleId },
                      description: { stringValue: e.description },
                      matchedText: { stringValue: e.matchedText },
                      pageNumber: { integerValue: e.pageNumber.toString() },
                      textBlockOrder: { integerValue: e.textBlockOrder.toString() }
                    }
                  }
                }))
              }
            }
          }
        }
      },
      regions: {
        arrayValue: {
          values: seg.regions.map((r) => {
            const rf: Record<string, any> = {
              id: { stringValue: r.id },
              documentSha256: { stringValue: r.documentSha256 },
              pageId: { stringValue: r.pageId },
              pageNumber: { integerValue: r.pageNumber.toString() },
              type: { stringValue: r.type },
              textBlockOrders: {
                arrayValue: {
                  values: r.textBlockOrders.map((o) => ({ integerValue: o.toString() }))
                }
              },
              boundingBox: {
                mapValue: {
                  fields: {
                    x: { doubleValue: r.boundingBox.x },
                    y: { doubleValue: r.boundingBox.y },
                    width: { doubleValue: r.boundingBox.width },
                    height: { doubleValue: r.boundingBox.height },
                    top: { doubleValue: r.boundingBox.top ?? 0 },
                    unit: { stringValue: r.boundingBox.unit }
                  }
                }
              },
              confidence: { doubleValue: r.confidence },
              ruleId: { stringValue: r.ruleId },
              evidence: {
                arrayValue: {
                  values: r.evidence.map((ev) => ({ stringValue: ev }))
                }
              }
            };
            if (r.summaryText) rf.summaryText = { stringValue: r.summaryText };
            return { mapValue: { fields: rf } };
          })
        }
      }
    };

    if (seg.drawMetadata) {
      const dmFields: Record<string, any> = {};
      const mapField = (f?: SemanticField<string>) => {
        if (!f) return undefined;
        return {
          mapValue: {
            fields: {
              name: { stringValue: f.name },
              value: { stringValue: f.value },
              rawText: { stringValue: f.rawText },
              sourceDocumentSha256: { stringValue: f.sourceDocumentSha256 },
              sourcePageId: { stringValue: f.sourcePageId },
              sourcePageNumber: { integerValue: f.sourcePageNumber.toString() },
              textBlockOrder: { integerValue: f.textBlockOrder.toString() },
              boundingBox: {
                mapValue: {
                  fields: {
                    x: { doubleValue: f.boundingBox.x },
                    y: { doubleValue: f.boundingBox.y },
                    width: { doubleValue: f.boundingBox.width },
                    height: { doubleValue: f.boundingBox.height },
                    top: { doubleValue: f.boundingBox.top ?? 0 }
                  }
                }
              },
              ruleId: { stringValue: f.ruleId },
              confidence: { doubleValue: f.confidence }
            }
          }
        };
      };

      if (seg.drawMetadata.lotteryName) dmFields.lotteryName = mapField(seg.drawMetadata.lotteryName);
      if (seg.drawMetadata.drawNumber) dmFields.drawNumber = mapField(seg.drawMetadata.drawNumber);
      if (seg.drawMetadata.drawDate) dmFields.drawDate = mapField(seg.drawMetadata.drawDate);
      if (seg.drawMetadata.drawTime) dmFields.drawTime = mapField(seg.drawMetadata.drawTime);
      if (seg.drawMetadata.location) dmFields.location = mapField(seg.drawMetadata.location);

      fields.drawMetadata = { mapValue: { fields: dmFields } };
    }

    return fields;
  }

  private fromFirestoreFields(fields: Record<string, any>): DocumentSemanticSegmentation {
    const cf = fields.classification?.mapValue?.fields || {};
    const evidence: ClassificationEvidence[] = [];
    if (cf.evidence?.arrayValue?.values) {
      for (const ev of cf.evidence.arrayValue.values) {
        const ef = ev.mapValue?.fields || {};
        evidence.push({
          ruleId: ef.ruleId?.stringValue || "",
          description: ef.description?.stringValue || "",
          matchedText: ef.matchedText?.stringValue || "",
          pageNumber: parseInt(ef.pageNumber?.integerValue || "1", 10),
          textBlockOrder: parseInt(ef.textBlockOrder?.integerValue || "0", 10)
        });
      }
    }

    const classification: DocumentClassificationResult = {
      documentSha256: cf.documentSha256?.stringValue || fields.documentSha256?.stringValue || "",
      kind: (cf.kind?.stringValue || "UNCLASSIFIED") as SemanticDocumentKind,
      confidence: parseFloat(cf.confidence?.doubleValue || cf.confidence?.integerValue || "0"),
      ruleId: cf.ruleId?.stringValue || "",
      semanticVersion: cf.semanticVersion?.stringValue || "v1.0.0-semantic-regions",
      evidence
    };

    const regions: SemanticRegion[] = [];
    if (fields.regions?.arrayValue?.values) {
      for (const rv of fields.regions.arrayValue.values) {
        const rf = rv.mapValue?.fields || {};
        const bbf = rf.boundingBox?.mapValue?.fields || {};
        const blockOrders: number[] = [];
        if (rf.textBlockOrders?.arrayValue?.values) {
          for (const ov of rf.textBlockOrders.arrayValue.values) {
            blockOrders.push(parseInt(ov.integerValue || "0", 10));
          }
        }
        const evList: string[] = [];
        if (rf.evidence?.arrayValue?.values) {
          for (const ev of rf.evidence.arrayValue.values) {
            if (ev.stringValue) evList.push(ev.stringValue);
          }
        }

        regions.push({
          id: rf.id?.stringValue || "",
          documentSha256: rf.documentSha256?.stringValue || "",
          pageId: rf.pageId?.stringValue || "",
          pageNumber: parseInt(rf.pageNumber?.integerValue || "1", 10),
          type: (rf.type?.stringValue || "HEADER") as SemanticRegionType,
          textBlockOrders: blockOrders,
          boundingBox: {
            x: parseFloat(bbf.x?.doubleValue || bbf.x?.integerValue || "0"),
            y: parseFloat(bbf.y?.doubleValue || bbf.y?.integerValue || "0"),
            width: parseFloat(bbf.width?.doubleValue || bbf.width?.integerValue || "0"),
            height: parseFloat(bbf.height?.doubleValue || bbf.height?.integerValue || "0"),
            top: bbf.top ? parseFloat(bbf.top.doubleValue || bbf.top.integerValue || "0") : undefined,
            unit: "pt"
          },
          confidence: parseFloat(rf.confidence?.doubleValue || rf.confidence?.integerValue || "1.0"),
          ruleId: rf.ruleId?.stringValue || "",
          evidence: evList,
          summaryText: rf.summaryText?.stringValue
        });
      }
    }

    let drawMetadata: DrawMetadata | undefined;
    if (fields.drawMetadata?.mapValue?.fields) {
      const dmf = fields.drawMetadata.mapValue.fields;
      const parseField = (fVal?: any): SemanticField<string> | undefined => {
        if (!fVal?.mapValue?.fields) return undefined;
        const ff = fVal.mapValue.fields;
        const bbf = ff.boundingBox?.mapValue?.fields || {};
        return {
          name: ff.name?.stringValue || "",
          value: ff.value?.stringValue || "",
          rawText: ff.rawText?.stringValue || "",
          sourceDocumentSha256: ff.sourceDocumentSha256?.stringValue || "",
          sourcePageId: ff.sourcePageId?.stringValue || "",
          sourcePageNumber: parseInt(ff.sourcePageNumber?.integerValue || "1", 10),
          textBlockOrder: parseInt(ff.textBlockOrder?.integerValue || "0", 10),
          boundingBox: {
            x: parseFloat(bbf.x?.doubleValue || bbf.x?.integerValue || "0"),
            y: parseFloat(bbf.y?.doubleValue || bbf.y?.integerValue || "0"),
            width: parseFloat(bbf.width?.doubleValue || bbf.width?.integerValue || "0"),
            height: parseFloat(bbf.height?.doubleValue || bbf.height?.integerValue || "0"),
            top: bbf.top ? parseFloat(bbf.top.doubleValue || bbf.top.integerValue || "0") : undefined
          },
          ruleId: ff.ruleId?.stringValue || "",
          confidence: parseFloat(ff.confidence?.doubleValue || ff.confidence?.integerValue || "1.0")
        };
      };

      drawMetadata = {
        lotteryName: parseField(dmf.lotteryName),
        drawNumber: parseField(dmf.drawNumber),
        drawDate: parseField(dmf.drawDate),
        drawTime: parseField(dmf.drawTime),
        location: parseField(dmf.location)
      };
    }

    return {
      id: fields.id?.stringValue || "",
      documentSha256: fields.documentSha256?.stringValue || "",
      classification,
      regions,
      drawMetadata,
      pageCount: parseInt(fields.pageCount?.integerValue || "1", 10),
      extractionVersion: fields.extractionVersion?.stringValue || "v1.0.0-text-layout",
      semanticVersion: fields.semanticVersion?.stringValue || "v1.0.0-semantic-regions",
      createdAt: fields.createdAt?.stringValue || ""
    };
  }
}

// ============================================================================
// Milestone 3E: Validated Lottery Entity Repositories
// ============================================================================

export class InMemoryPrizeTierRepository implements PrizeTierRepository {
  private readonly storage = new Map<string, PrizeTier>();

  async getById(id: string): Promise<PrizeTier | null> {
    const found = this.storage.get(id);
    return found ? { ...found } : null;
  }

  async getByDocumentSha256(documentSha256: string): Promise<PrizeTier[]> {
    const normalized = documentSha256.toLowerCase();
    const result: PrizeTier[] = [];
    for (const tier of this.storage.values()) {
      if (tier.documentSha256.toLowerCase() === normalized) {
        result.push({ ...tier });
      }
    }
    return result.sort((a, b) => a.rank - b.rank);
  }

  async save(tier: PrizeTier): Promise<void> {
    validatePrizeTier(tier);
    this.storage.set(tier.id, { ...tier });
  }

  async saveBatch(tiers: PrizeTier[]): Promise<void> {
    for (const t of tiers) {
      await this.save(t);
    }
  }

  clear(): void {
    this.storage.clear();
  }
}

export class InMemoryWinningResultRepository implements WinningResultRepository {
  private readonly storage = new Map<string, WinningResult>();

  async getById(id: string): Promise<WinningResult | null> {
    const found = this.storage.get(id);
    return found ? { ...found } : null;
  }

  async getByDocumentSha256(documentSha256: string): Promise<WinningResult[]> {
    const normalized = documentSha256.toLowerCase();
    const result: WinningResult[] = [];
    for (const r of this.storage.values()) {
      if (r.documentSha256.toLowerCase() === normalized) {
        result.push({ ...r });
      }
    }
    return result;
  }

  async getByPrizeTierId(prizeTierId: string): Promise<WinningResult[]> {
    const result: WinningResult[] = [];
    for (const r of this.storage.values()) {
      if (r.prizeTierId === prizeTierId) {
        result.push({ ...r });
      }
    }
    return result;
  }

  async save(result: WinningResult): Promise<void> {
    validateWinningResult(result);
    this.storage.set(result.id, { ...result });
  }

  async saveBatch(results: WinningResult[]): Promise<void> {
    for (const r of results) {
      await this.save(r);
    }
  }

  clear(): void {
    this.storage.clear();
  }
}

export class FirestoreRestPrizeTierRepository implements PrizeTierRepository {
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly collectionName: string;
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: {
    projectId: string;
    databaseId?: string;
    collectionName?: string;
    getAccessToken: () => Promise<string> | string;
  }) {
    this.projectId = options.projectId;
    this.databaseId = options.databaseId || "(default)";
    this.collectionName = options.collectionName || "prize_tiers";
    this.getAccessToken = options.getAccessToken;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  private get baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  async getById(id: string): Promise<PrizeTier | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(id)}`;
    const headers = await this.getHeaders();
    const res = await fetch(url, { headers });

    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST GET failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.fields) return null;
    return this.fromFirestoreFields(data.fields);
  }

  async getByDocumentSha256(documentSha256: string): Promise<PrizeTier[]> {
    const normalized = documentSha256.trim().toLowerCase();
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: "documentSha256" },
            op: "EQUAL",
            value: { stringValue: normalized }
          }
        }
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to query prize tiers for ${normalized}: HTTP ${res.status} - ${err}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const tiers: PrizeTier[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        tiers.push(this.fromFirestoreFields(item.document.fields));
      }
    }
    return tiers.sort((a, b) => a.rank - b.rank);
  }

  async save(tier: PrizeTier): Promise<void> {
    validatePrizeTier(tier);
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(tier.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({ fields: this.toFirestoreFields(tier) });

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST PATCH failed (${res.status}): ${errText}`);
    }
  }

  async saveBatch(tiers: PrizeTier[]): Promise<void> {
    for (const tier of tiers) {
      await this.save(tier);
    }
  }

  private toFirestoreFields(tier: PrizeTier): Record<string, any> {
    const fields: Record<string, any> = {
      id: { stringValue: tier.id },
      documentSha256: { stringValue: tier.documentSha256 },
      pageId: { stringValue: tier.pageId },
      pageNumber: { integerValue: tier.pageNumber.toString() },
      sourceTextBlockOrders: {
        arrayValue: {
          values: tier.sourceTextBlockOrders.map((o) => ({ integerValue: o.toString() }))
        }
      },
      rawSourceText: { stringValue: tier.rawSourceText },
      boundingBox: {
        mapValue: {
          fields: {
            x: { doubleValue: tier.boundingBox.x },
            y: { doubleValue: tier.boundingBox.y },
            width: { doubleValue: tier.boundingBox.width },
            height: { doubleValue: tier.boundingBox.height },
            top: { doubleValue: tier.boundingBox.top ?? 0 },
            unit: { stringValue: tier.boundingBox.unit }
          }
        }
      },
      parserRule: { stringValue: tier.parserRule },
      parserVersion: { stringValue: tier.parserVersion },
      name: { stringValue: tier.name },
      rank: { integerValue: tier.rank.toString() },
      tierType: { stringValue: tier.tierType },
      isSuffix: { booleanValue: tier.isSuffix },
      expectedLength: { integerValue: tier.expectedLength.toString() },
      confidence: { doubleValue: tier.confidence },
      createdAt: { stringValue: tier.createdAt }
    };
    if (tier.amount !== undefined) {
      fields.amount = { integerValue: tier.amount.toString() };
    }
    if (tier.currency) {
      fields.currency = { stringValue: tier.currency };
    }
    return fields;
  }

  private fromFirestoreFields(fields: Record<string, any>): PrizeTier {
    const bbf = fields.boundingBox?.mapValue?.fields || {};
    const orders: number[] = [];
    if (fields.sourceTextBlockOrders?.arrayValue?.values) {
      for (const v of fields.sourceTextBlockOrders.arrayValue.values) {
        orders.push(parseInt(v.integerValue || "0", 10));
      }
    }

    return {
      id: fields.id?.stringValue || "",
      documentSha256: fields.documentSha256?.stringValue || "",
      pageId: fields.pageId?.stringValue || "",
      pageNumber: parseInt(fields.pageNumber?.integerValue || "1", 10),
      sourceTextBlockOrders: orders,
      rawSourceText: fields.rawSourceText?.stringValue || "",
      boundingBox: {
        x: parseFloat(bbf.x?.doubleValue || bbf.x?.integerValue || "0"),
        y: parseFloat(bbf.y?.doubleValue || bbf.y?.integerValue || "0"),
        width: parseFloat(bbf.width?.doubleValue || bbf.width?.integerValue || "0"),
        height: parseFloat(bbf.height?.doubleValue || bbf.height?.integerValue || "0"),
        top: bbf.top ? parseFloat(bbf.top.doubleValue || bbf.top.integerValue || "0") : undefined,
        unit: "pt"
      },
      parserRule: fields.parserRule?.stringValue || "",
      parserVersion: fields.parserVersion?.stringValue || "",
      name: fields.name?.stringValue || "",
      rank: parseInt(fields.rank?.integerValue || "0", 10),
      tierType: (fields.tierType?.stringValue || "OTHER") as any,
      amount: fields.amount?.integerValue ? parseInt(fields.amount.integerValue, 10) : undefined,
      currency: fields.currency?.stringValue as "INR" | undefined,
      isSuffix: fields.isSuffix?.booleanValue ?? false,
      expectedLength: parseInt(fields.expectedLength?.integerValue || "6", 10),
      confidence: parseFloat(fields.confidence?.doubleValue || fields.confidence?.integerValue || "1.0"),
      createdAt: fields.createdAt?.stringValue || ""
    };
  }
}

export class FirestoreRestWinningResultRepository implements WinningResultRepository {
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly collectionName: string;
  private readonly getAccessToken: () => Promise<string> | string;

  constructor(options: {
    projectId: string;
    databaseId?: string;
    collectionName?: string;
    getAccessToken: () => Promise<string> | string;
  }) {
    this.projectId = options.projectId;
    this.databaseId = options.databaseId || "(default)";
    this.collectionName = options.collectionName || "winning_results";
    this.getAccessToken = options.getAccessToken;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  private get baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  async getById(id: string): Promise<WinningResult | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(id)}`;
    const headers = await this.getHeaders();
    const res = await fetch(url, { headers });

    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST GET failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.fields) return null;
    return this.fromFirestoreFields(data.fields);
  }

  async getByDocumentSha256(documentSha256: string): Promise<WinningResult[]> {
    const normalized = documentSha256.trim().toLowerCase();
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: "documentSha256" },
            op: "EQUAL",
            value: { stringValue: normalized }
          }
        }
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to query winning results for ${normalized}: HTTP ${res.status} - ${err}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: WinningResult[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(this.fromFirestoreFields(item.document.fields));
      }
    }
    return results;
  }

  async getByPrizeTierId(prizeTierId: string): Promise<WinningResult[]> {
    const url = `${this.baseUrl}:runQuery`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: this.collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: "prizeTierId" },
            op: "EQUAL",
            value: { stringValue: prizeTierId }
          }
        }
      }
    });

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to query winning results for tier ${prizeTierId}: HTTP ${res.status} - ${err}`);
    }

    const data = (await res.json()) as Array<{ document?: { fields: Record<string, any> } }>;
    const results: WinningResult[] = [];
    for (const item of data) {
      if (item.document?.fields) {
        results.push(this.fromFirestoreFields(item.document.fields));
      }
    }
    return results;
  }

  async save(result: WinningResult): Promise<void> {
    validateWinningResult(result);
    const url = `${this.baseUrl}/${this.collectionName}/${encodeURIComponent(result.id)}`;
    const headers = await this.getHeaders();
    const body = JSON.stringify({ fields: this.toFirestoreFields(result) });

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST PATCH failed (${res.status}): ${errText}`);
    }
  }

  async saveBatch(results: WinningResult[]): Promise<void> {
    for (const r of results) {
      await this.save(r);
    }
  }

  private toFirestoreFields(result: WinningResult): Record<string, any> {
    const fields: Record<string, any> = {
      id: { stringValue: result.id },
      documentSha256: { stringValue: result.documentSha256 },
      pageId: { stringValue: result.pageId },
      pageNumber: { integerValue: result.pageNumber.toString() },
      sourceTextBlockOrders: {
        arrayValue: {
          values: result.sourceTextBlockOrders.map((o) => ({ integerValue: o.toString() }))
        }
      },
      rawSourceText: { stringValue: result.rawSourceText },
      boundingBox: {
        mapValue: {
          fields: {
            x: { doubleValue: result.boundingBox.x },
            y: { doubleValue: result.boundingBox.y },
            width: { doubleValue: result.boundingBox.width },
            height: { doubleValue: result.boundingBox.height },
            top: { doubleValue: result.boundingBox.top ?? 0 },
            unit: { stringValue: result.boundingBox.unit }
          }
        }
      },
      parserRule: { stringValue: result.parserRule },
      parserVersion: { stringValue: result.parserVersion },
      prizeTierId: { stringValue: result.prizeTierId },
      prizeTierName: { stringValue: result.prizeTierName },
      rank: { integerValue: result.rank.toString() },
      canonicalNumber: { stringValue: result.canonicalNumber },
      numberLength: { integerValue: result.numberLength.toString() },
      isSuffix: { booleanValue: result.isSuffix },
      confidence: { doubleValue: result.confidence },
      validationStatus: { stringValue: result.validationStatus },
      createdAt: { stringValue: result.createdAt }
    };
    if (result.drawId) fields.drawId = { stringValue: result.drawId };
    if (result.amount !== undefined) fields.amount = { integerValue: result.amount.toString() };
    if (result.series) fields.series = { stringValue: result.series };
    if (result.location) fields.location = { stringValue: result.location };
    return fields;
  }

  private fromFirestoreFields(fields: Record<string, any>): WinningResult {
    const bbf = fields.boundingBox?.mapValue?.fields || {};
    const orders: number[] = [];
    if (fields.sourceTextBlockOrders?.arrayValue?.values) {
      for (const v of fields.sourceTextBlockOrders.arrayValue.values) {
        orders.push(parseInt(v.integerValue || "0", 10));
      }
    }

    return {
      id: fields.id?.stringValue || "",
      documentSha256: fields.documentSha256?.stringValue || "",
      pageId: fields.pageId?.stringValue || "",
      pageNumber: parseInt(fields.pageNumber?.integerValue || "1", 10),
      sourceTextBlockOrders: orders,
      rawSourceText: fields.rawSourceText?.stringValue || "",
      boundingBox: {
        x: parseFloat(bbf.x?.doubleValue || bbf.x?.integerValue || "0"),
        y: parseFloat(bbf.y?.doubleValue || bbf.y?.integerValue || "0"),
        width: parseFloat(bbf.width?.doubleValue || bbf.width?.integerValue || "0"),
        height: parseFloat(bbf.height?.doubleValue || bbf.height?.integerValue || "0"),
        top: bbf.top ? parseFloat(bbf.top.doubleValue || bbf.top.integerValue || "0") : undefined,
        unit: "pt"
      },
      parserRule: fields.parserRule?.stringValue || "",
      parserVersion: fields.parserVersion?.stringValue || "",
      drawId: fields.drawId?.stringValue,
      prizeTierId: fields.prizeTierId?.stringValue || "",
      prizeTierName: fields.prizeTierName?.stringValue || "",
      rank: parseInt(fields.rank?.integerValue || "0", 10),
      amount: fields.amount?.integerValue ? parseInt(fields.amount.integerValue, 10) : undefined,
      series: fields.series?.stringValue,
      canonicalNumber: fields.canonicalNumber?.stringValue || "",
      numberLength: parseInt(fields.numberLength?.integerValue || "4", 10),
      isSuffix: fields.isSuffix?.booleanValue ?? false,
      location: fields.location?.stringValue,
      confidence: parseFloat(fields.confidence?.doubleValue || fields.confidence?.integerValue || "1.0"),
      validationStatus: (fields.validationStatus?.stringValue || "VALID") as any,
      createdAt: fields.createdAt?.stringValue || ""
    };
  }
}

// ============================================================================
// Milestone 4A: Knowledge Graph Re-exports
// ============================================================================
export type {
  KnowledgeEntityType,
  KnowledgeRelationType,
  EdgeProvenance,
  KnowledgeNode,
  KnowledgeEdge,
  LotteryKnowledgeGraph,
  KnowledgeGraphRepository,
  FirestoreRestKnowledgeGraphRepositoryOptions
} from "@kerala-lottery/knowledge";

export {
  DEFAULT_GRAPH_VERSION,
  getDocumentNodeId,
  getLotteryNodeId,
  getDrawNodeId,
  getPrizeTierNodeId,
  getWinningResultNodeId,
  getSeriesNodeId,
  getWinningNumberNodeId,
  getKnowledgeEdgeId,
  buildLotteryKnowledgeGraph,
  LotteryKnowledgeGraphBuilder,
  getNode,
  getOutEdges,
  getInEdges,
  getTargetNodes,
  getSourceNodes,
  findPaths,
  validateLotteryKnowledgeGraph,
  KnowledgeGraphValidationError,
  InMemoryKnowledgeGraphRepository,
  FirestoreRestKnowledgeGraphRepository
} from "@kerala-lottery/knowledge";

// ============================================================================
// Milestone 5A: Historical Statistics Re-exports
// ============================================================================
export type {
  ResultTypeFilter,
  StatisticalFilterCriteria,
  StatisticalPopulationScope,
  NumberFrequencyItem,
  NumberFrequencyReport,
  SeriesFrequencyItem,
  SeriesFrequencyReport,
  DigitDistributionItem,
  LastDigitFrequencyReport,
  DigitPositionDistribution,
  DigitPositionFrequencyReport,
  SuffixFrequencyItem,
  SuffixFrequencyReport,
  PrizeTierStatisticsItem,
  PrizeTierStatisticsReport,
  DrawSummaryStatistics,
  HistoricalLotteryStatisticsAggregate,
  HistoricalStatisticsRepository,
  FirestoreRestHistoricalStatisticsRepositoryOptions,
  StatisticalEngineInput,
  StatisticalEngineOptions,
  ValidatedStatisticalEntities,
  MultiDrawCorpusDrawProfile,
  MultiDrawCorpusValidationReport,
  MultiDrawLotteryCorpus,
  MultiDrawCorpusOptions,
  MultiDrawCorpusRepository,
  AnalysisTargetLevel,
  AnalysisPopulationScope,
  ResultProvenanceRecord,
  AnalysisProvenanceSummary,
  LotteryProfileItem,
  LotteryDimensionalAnalysisReport,
  DrawProfileItem,
  DrawDimensionalAnalysisReport,
  PrizeTierProfileItem,
  PrizeTierDimensionalAnalysisReport,
  ResultTypeProfileItem,
  ResultTypeDimensionalAnalysisReport,
  SeriesProfileItem,
  SeriesDimensionalAnalysisReport,
  LastDigitItem,
  LastDigitDimensionalAnalysisReport,
  DigitPositionItem,
  DigitPositionDimensionalAnalysisReport,
  NumberFrequencyProfileItem,
  NumberFrequencyDimensionalAnalysisReport,
  SuffixFrequencyProfileItem,
  SuffixFrequencyDimensionalAnalysisReport,
  CrossDrawMetricRow,
  RepeatedNumberAcrossDraws,
  CrossDrawComparisonReport,
  CrossLotteryMetricRow,
  CrossLotteryComparisonReport,
  PopulationLevelComparisonItem,
  PopulationLevelComparisonReport,
  HistoricalAnalysisSuite,
  AnalysisOptions,
  HistoricalAnalysisRepository,
  StatisticalTestType,
  ExperimentBaselineType,
  ExperimentTargetMetric,
  ExperimentPopulationCriteria,
  ResolvedExperimentPopulation,
  ExperimentBaselineDefinition,
  ExperimentTestConfiguration,
  ExperimentDefinition,
  CategoryTestDetail,
  ExperimentStatisticalTestResult,
  ExperimentResult,
  HistoricalExperimentRecord,
  HistoricalExperimentRepository,
  RobustnessVariantDimension,
  RobustnessVariantDefinition,
  EffectSizeMagnitude,
  EffectSizeMetrics,
  RobustnessSensitivityMetric,
  RobustnessClassification,
  RobustnessEvaluationSummary,
  MultipleComparisonCorrectionMethod,
  RobustnessConfiguration,
  RobustnessDefinition,
  RobustnessReport,
  HistoricalRobustnessRecord,
  HistoricalRobustnessRepository
} from "@kerala-lottery/statistics";

export {
  DEFAULT_STATISTICAL_VERSION,
  DEFAULT_CORPUS_VERSION,
  DEFAULT_ANALYSIS_VERSION,
  DEFAULT_EXPERIMENT_VERSION,
  DEFAULT_ROBUSTNESS_VERSION,
  HISTORICAL_ANALYSIS_DISCLAIMER,
  HISTORICAL_EXPERIMENT_DISCLAIMER,
  HISTORICAL_ROBUSTNESS_DISCLAIMER,
  StatisticalValidationError,
  calculateHistoricalStatistics,
  computeDrawSummaryStatistics,
  computePrizeTierStatistics,
  computeNumberFrequency,
  computeSeriesFrequency,
  computeLastDigitFrequency,
  computeDigitPositionFrequency,
  computeSuffixFrequency,
  computeScopeHash,
  extractEntitiesFromKnowledgeGraph,
  normalizeStatisticalInput,
  InMemoryHistoricalStatisticsRepository,
  FirestoreRestHistoricalStatisticsRepository,
  buildMultiDrawCorpus,
  getCorpusDrawCount,
  getCorpusLotteries,
  getDrawsByLottery,
  getDrawByDate,
  getSourceDocumentForDraw,
  getResultsPerDraw,
  getResultTypesPerDraw,
  getSeriesPerDraw,
  getConflictingOrDuplicateResults,
  getMissingOrMalformedRecords,
  calculateCorpusHistoricalStatistics,
  InMemoryMultiDrawCorpusRepository,
  FirestoreRestMultiDrawCorpusRepository,
  buildAnalysisPopulationScope,
  extractAnalysisProvenanceRecords,
  analyzeByLottery,
  analyzeByDraw,
  analyzeByPrizeTier,
  analyzeByResultType,
  analyzeBySeries,
  analyzeByLastDigit,
  analyzeByDigitPosition,
  analyzeByNumberFrequency,
  analyzeBySuffixFrequency,
  compareCrossDraws,
  compareCrossLotteries,
  comparePopulationLevels,
  runComprehensiveHistoricalAnalysis,
  InMemoryHistoricalAnalysisRepository,
  FirestoreRestHistoricalAnalysisRepository,
  computeExperimentDefinitionHash,
  computeExperimentResultHash,
  createLastDigitUniformityExperiment,
  createDigitPositionUniformityExperiment,
  resolveExperimentPopulation,
  resolveBaselineExpectedCounts,
  calculateChiSquareTest,
  executeStatisticalExperiment,
  createHistoricalExperimentRecord,
  InMemoryHistoricalExperimentRepository,
  FirestoreRestHistoricalExperimentRepository,
  calculateCramersV,
  calculateChiSquareCriticalValue,
  computeRobustnessDefinitionHash,
  computeRobustnessReportHash,
  createStandardPopulationRobustnessVariants,
  createPopulationRobustnessDefinition,
  executeRobustnessEvaluation,
  createHistoricalRobustnessRecord,
  InMemoryHistoricalRobustnessRepository,
  FirestoreRestHistoricalRobustnessRepository,
  DEFAULT_FEATURE_VERSION,
  HISTORICAL_FEATURE_DISCLAIMER,
  FeatureValidationError,
  computeFeatureRecordHash,
  computeFeatureMatrixHash,
  validateResultForFeatureExtraction,
  extractResultFeatures,
  transformToFeatureMatrix,
  extractCorpusFeatures,
  InMemoryFeatureRepository,
  type FeatureRecord,
  type FeatureFamily,
  type FeatureValueType,
  type DrawFeatureContext,
  type ResultFeatureVector,
  type FeatureMatrix,
  type FeatureMatrixRow,
  type FeatureRepository,
  DEFAULT_FEATURE_EVALUATION_VERSION,
  HISTORICAL_FEATURE_EVALUATION_DISCLAIMER,
  computePopulationScopeHash,
  computeFeatureEvaluationHash,
  calculateFeatureCoverage,
  calculateFeatureCardinality,
  calculateFeatureDistribution,
  calculateFeatureStability,
  calculateFeatureRedundancy,
  validateFeatureMatrixIntegrity,
  evaluateFeatureMatrix,
  InMemoryFeatureEvaluationRepository,
  type FeatureEvaluationReport,
  type FeatureEvaluationMetric,
  type FeatureCoverageSummary,
  type FeatureCardinalitySummary,
  type FeatureDistributionSummary,
  type FeatureStabilitySummary,
  type FeatureRedundancySummary,
  type FeatureIntegrityReport,
  type FeatureValidationIssue,
  type FeatureEvaluationRepository,
  type FeatureEvaluationPopulationScope,
  type FeatureStabilityClassification
} from "@kerala-lottery/statistics";



