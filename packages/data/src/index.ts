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
  HttpProvenanceMetadata
} from "@kerala-lottery/domain";

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

import { doc, getDoc, runTransaction, type Firestore } from "firebase/firestore";

export interface DocumentRepository {
  getBySha256(sha256: string): Promise<SourceDocument | null>;
  create(document: SourceDocument): Promise<void>;
  findById?(id: string): Promise<SourceDocument | null>;
  findBySha256?(sha256: string): Promise<SourceDocument | null>;
  save?(doc: SourceDocument): Promise<void>;
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
