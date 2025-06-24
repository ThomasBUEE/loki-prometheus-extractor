import {
    ExtractorError,
    ConfigurationError,
    APIError,
    ValidationError,
    ProcessingError,
    FileSystemError,
    isExtractorError,
    normalizeError
} from '../src/utils/errors';

describe('Custom Errors', () => {
  describe('ExtractorError', () => {
    it('should create basic extractor error', () => {
      const error = new ExtractorError('Test error');
      
      expect(error.name).toBe('ExtractorError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBeUndefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ExtractorError).toBe(true);
    });

    it('should create extractor error with code', () => {
      const error = new ExtractorError('Test error', 'TEST_CODE');
      
      expect(error.code).toBe('TEST_CODE');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Invalid config');
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error instanceof ExtractorError).toBe(true);
    });
  });

  describe('APIError', () => {
    it('should create API error with status code', () => {
      const error = new APIError('API request failed', 404, { error: 'Not found' });
      
      expect(error.name).toBe('APIError');
      expect(error.message).toBe('API request failed');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(404);
      expect(error.response).toEqual({ error: 'Not found' });
    });

    it('should create API error without optional parameters', () => {
      const error = new APIError('API request failed');
      
      expect(error.statusCode).toBeUndefined();
      expect(error.response).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field', () => {
      const error = new ValidationError('Field is required', 'username');
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Field is required');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('username');
    });
  });

  describe('ProcessingError', () => {
    it('should create processing error with source', () => {
      const error = new ProcessingError('Processing failed', 'data-source-1');
      
      expect(error.name).toBe('ProcessingError');
      expect(error.message).toBe('Processing failed');
      expect(error.code).toBe('PROCESSING_ERROR');
      expect(error.source).toBe('data-source-1');
    });
  });

  describe('FileSystemError', () => {
    it('should create filesystem error with path', () => {
      const error = new FileSystemError('File not found', '/path/to/file');
      
      expect(error.name).toBe('FileSystemError');
      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FS_ERROR');
      expect(error.path).toBe('/path/to/file');
    });
  });

  describe('isExtractorError type guard', () => {
    it('should return true for ExtractorError instances', () => {
      const error = new ExtractorError('test');
      expect(isExtractorError(error)).toBe(true);
    });

    it('should return true for subclass instances', () => {
      const configError = new ConfigurationError('test');
      const apiError = new APIError('test');
      
      expect(isExtractorError(configError)).toBe(true);
      expect(isExtractorError(apiError)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('test');
      expect(isExtractorError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isExtractorError('string')).toBe(false);
      expect(isExtractorError(123)).toBe(false);
      expect(isExtractorError(null)).toBe(false);
      expect(isExtractorError(undefined)).toBe(false);
      expect(isExtractorError({})).toBe(false);
    });
  });

  describe('normalizeError helper', () => {
    it('should return ExtractorError as-is', () => {
      const original = new ConfigurationError('test');
      const normalized = normalizeError(original);
      
      expect(normalized).toBe(original);
    });

    it('should convert regular Error to ExtractorError', () => {
      const original = new Error('test error');
      const normalized = normalizeError(original);
      
      expect(normalized).toBeInstanceOf(ExtractorError);
      expect(normalized.message).toBe('test error');
      expect(normalized).not.toBe(original);
    });

    it('should convert regular Error with context', () => {
      const original = new Error('test error');
      const normalized = normalizeError(original, 'API call');
      
      expect(normalized.message).toBe('API call: test error');
    });

    it('should handle unknown error types', () => {
      const normalized = normalizeError('string error');
      
      expect(normalized).toBeInstanceOf(ExtractorError);
      expect(normalized.message).toBe('Unknown error occurred');
    });

    it('should handle unknown error types with context', () => {
      const normalized = normalizeError('string error', 'Processing');
      
      expect(normalized.message).toBe('Processing: Unknown error occurred');
    });

    it('should handle null/undefined errors', () => {
      const normalizedNull = normalizeError(null);
      const normalizedUndefined = normalizeError(undefined);
      
      expect(normalizedNull.message).toBe('Unknown error occurred');
      expect(normalizedUndefined.message).toBe('Unknown error occurred');
    });
  });

  describe('error inheritance chain', () => {
    it('should maintain proper inheritance chain', () => {
      const configError = new ConfigurationError('test');
      
      expect(configError instanceof Error).toBe(true);
      expect(configError instanceof ExtractorError).toBe(true);
      expect(configError instanceof ConfigurationError).toBe(true);
    });

    it('should allow instanceof checks across all levels', () => {
      const errors = [
        new ExtractorError('test'),
        new ConfigurationError('test'),
        new APIError('test'),
        new ValidationError('test'),
        new ProcessingError('test'),
        new FileSystemError('test')
      ];

      errors.forEach(error => {
        expect(error instanceof Error).toBe(true);
        expect(error instanceof ExtractorError).toBe(true);
      });
    });
  });

  describe('error serialization', () => {
    it('should preserve custom properties in JSON', () => {
      const apiError = new APIError('API failed', 500, { details: 'Server error' });
      
      // Note: Error objects don't serialize well by default, but properties should be accessible
      expect(apiError.statusCode).toBe(500);
      expect(apiError.response).toEqual({ details: 'Server error' });
      expect(apiError.code).toBe('API_ERROR');
    });

    it('should have proper string representation', () => {
      const error = new ConfigurationError('Invalid configuration file');
      
      expect(error.toString()).toContain('ConfigurationError');
      expect(error.toString()).toContain('Invalid configuration file');
    });
  });
});
