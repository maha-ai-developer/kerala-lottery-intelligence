/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 3B — Acquisition Error Domain
 */

export class AcquisitionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AcquisitionError";
  }
}

export class AcquisitionNetworkError extends AcquisitionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "NETWORK_ERROR", details);
    this.name = "AcquisitionNetworkError";
  }
}

export class AcquisitionHttpError extends AcquisitionError {
  constructor(
    message: string,
    public readonly statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message, "HTTP_ERROR", { statusCode, ...details });
    this.name = "AcquisitionHttpError";
  }
}

export class AcquisitionSecurityError extends AcquisitionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SECURITY_ERROR", details);
    this.name = "AcquisitionSecurityError";
  }
}

export class AcquisitionValidationError extends AcquisitionError {
  constructor(
    message: string,
    code = "VALIDATION_ERROR",
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = "AcquisitionValidationError";
  }
}
