/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 10A: Geographic Persistence & Repository Layer
 *
 * Implements immutable caching and retrieval for:
 * - Geographic observations & datasets
 * - District exposure distributions
 * - Geographic analysis artifacts
 * - 11-stage geographic provenance lineage
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  GeographicAnalysis,
  GeographicFindingLineage,
  GeographicObservation,
  GeographicWinnerDataset,
  TicketDistributionExposure
} from "./geographic-types";

export class GeographicRepository {
  private readonly baseDir: string;
  private readonly geoDatasetPath: string;
  private readonly geoAnalysisPath: string;
  private readonly exposureDir: string;
  private readonly lineageDir: string;

  constructor(options?: { baseDir?: string }) {
    const cwd = process.cwd();
    this.baseDir = options?.baseDir || join(cwd, "data/processed-cache/experiments/geography");
    this.geoDatasetPath = join(this.baseDir, "geowin_canonical.json");
    this.geoAnalysisPath = join(this.baseDir, "geoanalysis_canonical.json");
    this.exposureDir = join(this.baseDir, "exposure");
    this.lineageDir = join(this.baseDir, "lineage");

    this.ensureDirs();
  }

  private ensureDirs(): void {
    if (!existsSync(this.baseDir)) mkdirSync(this.baseDir, { recursive: true });
    if (!existsSync(this.exposureDir)) mkdirSync(this.exposureDir, { recursive: true });
    if (!existsSync(this.lineageDir)) mkdirSync(this.lineageDir, { recursive: true });
  }

  // ==========================================================================
  // 1. Geographic Dataset
  // ==========================================================================

  public saveGeographicDataset(dataset: GeographicWinnerDataset): void {
    this.ensureDirs();
    if (existsSync(this.geoDatasetPath)) {
      const existing = JSON.parse(readFileSync(this.geoDatasetPath, "utf-8")) as GeographicWinnerDataset;
      if (existing.datasetId === dataset.datasetId && existing.deterministicHash !== dataset.deterministicHash) {
        throw new Error(
          `IMMUTABILITY_VIOLATION: Attempted to overwrite geographic dataset '${dataset.datasetId}' with differing hash.`
        );
      }
    }
    writeFileSync(this.geoDatasetPath, JSON.stringify(dataset, null, 2), "utf-8");
  }

  public getGeographicDataset(): GeographicWinnerDataset | null {
    if (!existsSync(this.geoDatasetPath)) return null;
    try {
      return JSON.parse(readFileSync(this.geoDatasetPath, "utf-8")) as GeographicWinnerDataset;
    } catch {
      return null;
    }
  }

  public getGeographicObservations(options?: {
    district?: string;
    drawId?: string;
    prizeTier?: string;
  }): GeographicObservation[] {
    const dataset = this.getGeographicDataset();
    if (!dataset) return [];

    let obs = dataset.observations;
    if (options?.district) {
      const d = options.district.toLowerCase();
      obs = obs.filter(o => o.normalizedDistrict.toLowerCase() === d);
    }
    if (options?.drawId) {
      obs = obs.filter(o => o.drawId === options.drawId);
    }
    if (options?.prizeTier) {
      const t = options.prizeTier.toLowerCase();
      obs = obs.filter(o => o.prizeTier.toLowerCase().includes(t));
    }
    return obs;
  }

  // ==========================================================================
  // 2. Geographic Analysis
  // ==========================================================================

  public saveGeographicAnalysis(analysis: GeographicAnalysis): void {
    this.ensureDirs();
    if (existsSync(this.geoAnalysisPath)) {
      const existing = JSON.parse(readFileSync(this.geoAnalysisPath, "utf-8")) as GeographicAnalysis;
      if (existing.analysisId === analysis.analysisId && existing.deterministicHash !== analysis.deterministicHash) {
        throw new Error(
          `IMMUTABILITY_VIOLATION: Attempted to overwrite geographic analysis '${analysis.analysisId}' with differing hash.`
        );
      }
    }
    writeFileSync(this.geoAnalysisPath, JSON.stringify(analysis, null, 2), "utf-8");
  }

  public getGeographicAnalysis(): GeographicAnalysis | null {
    if (!existsSync(this.geoAnalysisPath)) return null;
    try {
      return JSON.parse(readFileSync(this.geoAnalysisPath, "utf-8")) as GeographicAnalysis;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // 3. Ticket Exposure
  // ==========================================================================

  public saveTicketExposure(drawId: string, exposures: TicketDistributionExposure[]): void {
    this.ensureDirs();
    const filePath = join(this.exposureDir, `${drawId}.json`);
    writeFileSync(filePath, JSON.stringify(exposures, null, 2), "utf-8");
  }

  public getTicketExposure(drawId?: string): TicketDistributionExposure[] {
    if (drawId) {
      const filePath = join(this.exposureDir, `${drawId}.json`);
      if (!existsSync(filePath)) return [];
      try {
        return JSON.parse(readFileSync(filePath, "utf-8")) as TicketDistributionExposure[];
      } catch {
        return [];
      }
    }

    if (!existsSync(this.exposureDir)) return [];
    const files = readdirSync(this.exposureDir).filter(f => f.endsWith(".json"));
    const all: TicketDistributionExposure[] = [];
    for (const f of files) {
      try {
        const list = JSON.parse(readFileSync(join(this.exposureDir, f), "utf-8")) as TicketDistributionExposure[];
        all.push(...list);
      } catch {
        // continue
      }
    }
    return all;
  }

  // ==========================================================================
  // 4. Geographic Lineage
  // ==========================================================================

  public saveGeographicLineage(lineage: GeographicFindingLineage): void {
    this.ensureDirs();
    const filePath = join(this.lineageDir, `${lineage.findingId}.json`);
    if (existsSync(filePath)) {
      const existing = JSON.parse(readFileSync(filePath, "utf-8")) as GeographicFindingLineage;
      if (existing.lineageId === lineage.lineageId && existing.deterministicHash !== lineage.deterministicHash) {
        throw new Error(
          `IMMUTABILITY_VIOLATION: Overwriting lineage '${lineage.lineageId}' with mismatched hash.`
        );
      }
    }
    writeFileSync(filePath, JSON.stringify(lineage, null, 2), "utf-8");
  }

  public getGeographicLineage(findingId: string): GeographicFindingLineage | null {
    const filePath = join(this.lineageDir, `${findingId}.json`);
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, "utf-8")) as GeographicFindingLineage;
    } catch {
      return null;
    }
  }
}
