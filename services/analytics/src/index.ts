/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Analytics & BigQuery ETL Contracts
 */

export interface BigQueryConfig {
  projectId: string;
  datasets: {
    raw: string;
    canonical: string;
    derived: string;
    experiments: string;
  };
}

export interface AnalyticsExportJob {
  id: string;
  datasetVersion: string;
  status: "PENDING" | "EXPORTING" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt?: string;
  rowCount: number;
}
