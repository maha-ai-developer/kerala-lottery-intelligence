/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * AI Gateway Service Layer
 * 
 * CORE PRINCIPLE:
 * Authenticated proxy between web application and external AI APIs.
 * Enforces user role checks, rate limits, and zero leakage of provider secrets.
 */

import type { UserRole } from "@kerala-lottery/domain";
import type { AITaskType } from "@kerala-lottery/ai";

export interface AIInvocationRequest {
  userId: string;
  userRole: UserRole;
  task: AITaskType;
  prompt: string;
  contextData?: Record<string, unknown>;
}

export interface AIInvocationResponse {
  answer: string;
  citations: Array<{
    documentId: string;
    pageNumber: number;
    title: string;
    textSnippet: string;
  }>;
  tokensUsed?: number;
  modelUsed: string;
}
