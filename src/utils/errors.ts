/**
 * Custom error classes for better error handling
 */

export class ExtractorError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ExtractorError';
  }
}

export class ConfigurationError extends ExtractorError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class APIError extends ExtractorError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message, 'API_ERROR');
    this.name = 'APIError';
  }
}

export class ValidationError extends ExtractorError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ProcessingError extends ExtractorError {
  constructor(message: string, public readonly source?: string) {
    super(message, 'PROCESSING_ERROR');
    this.name = 'ProcessingError';
  }
}

export class FileSystemError extends ExtractorError {
  constructor(message: string, public readonly path?: string) {
    super(message, 'FS_ERROR');
    this.name = 'FileSystemError';
  }
}

export class GoogleSheetsError extends ExtractorError {
  constructor(message: string, public readonly sheetId?: string) {
    super(message, 'GOOGLE_SHEETS_ERROR');
    this.name = 'GoogleSheetsError';
  }
}

/**
 * Type guard to check if an error is an ExtractorError
 */
export function isExtractorError(error: unknown): error is ExtractorError {
  return error instanceof ExtractorError;
}

/**
 * Helper function to create appropriate error from unknown error
 */
export function normalizeError(error: unknown, context?: string): ExtractorError {
  if (isExtractorError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ExtractorError(`${context ? `${context}: ` : ''}${error.message}`);
  }

  return new ExtractorError(`${context ? `${context}: ` : ''}Unknown error occurred`);
}
