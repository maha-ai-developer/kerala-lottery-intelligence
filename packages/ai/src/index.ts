/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * AI Gateway & Provider Abstractions
 * 
 * CORE PRINCIPLE:
 * Server-side only provider calls.
 * Never invoke AI APIs directly from browser client.
 * Model registry must be dynamic, not hardcoded.
 */

export type AIProviderType = "GEMINI" | "OPENAI" | "ANTHROPIC";

export type AITaskType =
  | "DOCUMENT_EXTRACTION"
  | "DOCUMENT_REVIEW"
  | "RULE_ANALYSIS"
  | "SEMANTIC_SEARCH"
  | "DATA_ANALYSIS"
  | "EXPERIMENT_INTERPRETATION"
  | "RESEARCH_ASSISTANT"
  | "REPORT_GENERATION";

export interface AIModelInfo {
  provider: AIProviderType;
  modelId: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  status: "ACTIVE" | "DEPRECATED" | "EXPERIMENTAL";
}

export interface GenerateTextOptions {
  modelId?: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateStructuredOptions<T> {
  modelId?: string;
  prompt: string;
  systemInstruction?: string;
  schema: Record<string, unknown>;
  validate: (parsed: unknown) => T;
}

export interface DocumentAnalysisOptions {
  modelId?: string;
  pdfBuffer: Buffer | Uint8Array;
  prompt: string;
}

export interface AIProvider {
  readonly providerType: AIProviderType;
  listModels(): Promise<AIModelInfo[]>;
  healthCheck(): Promise<boolean>;
  generateText(options: GenerateTextOptions): Promise<{ text: string; tokenUsage?: { prompt: number; completion: number } }>;
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<{ data: T; tokenUsage?: { prompt: number; completion: number } }>;
  embed(text: string): Promise<number[]>;
  analyzeDocument(options: DocumentAnalysisOptions): Promise<{ text: string; structuredData?: unknown }>;
}

export class GeminiAdapter implements AIProvider {
  readonly providerType: AIProviderType = "GEMINI";

  constructor(private readonly apiKey: string) {}

  async listModels(): Promise<AIModelInfo[]> {
    return [
      {
        provider: "GEMINI",
        modelId: "gemini-2.5-flash",
        contextWindow: 1000000,
        supportsVision: true,
        supportsTools: true,
        supportsStructuredOutput: true,
        status: "ACTIVE"
      },
      {
        provider: "GEMINI",
        modelId: "gemini-2.5-pro",
        contextWindow: 2000000,
        supportsVision: true,
        supportsTools: true,
        supportsStructuredOutput: true,
        status: "ACTIVE"
      }
    ];
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  async generateText(options: GenerateTextOptions): Promise<{ text: string; tokenUsage?: { prompt: number; completion: number } }> {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    // Detailed implementation will be added during Phase 7 AI milestone
    return { text: `[Gemini Response stub for: ${options.prompt.slice(0, 30)}...]` };
  }

  async generateStructured<T>(_options: GenerateStructuredOptions<T>): Promise<{ data: T; tokenUsage?: { prompt: number; completion: number } }> {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    return { data: {} as T };
  }

  async embed(_text: string): Promise<number[]> {
    return new Array(768).fill(0);
  }

  async analyzeDocument(_options: DocumentAnalysisOptions): Promise<{ text: string; structuredData?: unknown }> {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    return { text: "PDF Analysis stub" };
  }
}
