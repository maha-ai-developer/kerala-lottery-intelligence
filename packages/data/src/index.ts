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
  UserProfile
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

export interface DocumentRepository {
  findById(id: string): Promise<SourceDocument | null>;
  findBySha256(sha256: string): Promise<SourceDocument | null>;
  save(doc: SourceDocument): Promise<void>;
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
