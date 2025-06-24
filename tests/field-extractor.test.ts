import { FieldExtractor } from '../src/services/field-extractor';
import { FieldExtraction, QueryResult } from '../src/types/config.types';

describe('FieldExtractor', () => {
  const mockJsonData = {
    user: {
      id: '12345',
      profile: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    },
    request: {
      method: 'POST',
      status: 200,
      duration: 125.5
    },
    timestamp: 1705320000000,
    tags: ['api', 'production'],
    trace: {
      span_id: 'abc123',
      trace_id: 'def456'
    }
  };

  describe('with no field extractions', () => {
    it('should return empty object when no fields configured', () => {
      const extractor = new FieldExtractor([]);
      const result = extractor.extractFields(mockJsonData);
      expect(result).toEqual({});
    });
  });

  describe('basic field extraction', () => {
    const fields: FieldExtraction[] = [
      { name: 'user_id', path: 'user.id' },
      { name: 'user_name', path: 'user.profile.name' },
      { name: 'method', path: 'request.method' },
      { name: 'status', path: 'request.status', type: 'number' }
    ];

    let extractor: FieldExtractor;

    beforeEach(() => {
      extractor = new FieldExtractor(fields);
    });

    it('should extract simple nested fields', () => {
      const result = extractor.extractFields(mockJsonData);
      
      expect(result).toEqual({
        user_id: '12345',
        user_name: 'John Doe',
        method: 'POST',
        status: 200
      });
    });

    it('should handle missing fields gracefully', () => {
      const fieldsWithMissing: FieldExtraction[] = [
        { name: 'existing', path: 'user.id' },
        { name: 'missing', path: 'nonexistent.field' }
      ];
      
      const extractor = new FieldExtractor(fieldsWithMissing);
      const result = extractor.extractFields(mockJsonData);
      
      expect(result).toEqual({
        existing: '12345'
        // missing field should not be included
      });
    });

    it('should extract from arrays', () => {
      const arrayFields: FieldExtraction[] = [
        { name: 'first_tag', path: 'tags.0' },
        { name: 'second_tag', path: 'tags.1' }
      ];
      
      const extractor = new FieldExtractor(arrayFields);
      const result = extractor.extractFields(mockJsonData);
      
      expect(result).toEqual({
        first_tag: 'api',
        second_tag: 'production'
      });
    });
  });

  describe('field transformations', () => {
    it('should apply uppercase transformation', () => {
      const fields: FieldExtraction[] = [
        { name: 'method_upper', path: 'request.method', transform: 'uppercase' }
      ];
      
      const extractor = new FieldExtractor(fields);
      const result = extractor.extractFields(mockJsonData);
      
      expect(result.method_upper).toBe('POST');
    });

    it('should apply lowercase transformation', () => {
      const fields: FieldExtraction[] = [
        { name: 'method_lower', path: 'request.method', transform: 'lowercase' }
      ];
      
      const extractor = new FieldExtractor(fields);
      const result = extractor.extractFields(mockJsonData);
      
      expect(result.method_lower).toBe('post');
    });

    it('should apply trim transformation', () => {
      const dataWithSpaces = {
        name: '  John Doe  '
      };
      
      const fields: FieldExtraction[] = [
        { name: 'trimmed_name', path: 'name', transform: 'trim' }
      ];
      
      const extractor = new FieldExtractor(fields);
      const result = extractor.extractFields(dataWithSpaces);
      
      expect(result.trimmed_name).toBe('John Doe');
    });

    it('should apply date transformation', () => {
      const fields: FieldExtraction[] = [
        { 
          name: 'formatted_timestamp', 
          path: 'timestamp', 
          transform: 'date',
          format: 'yyyy-MM-dd'
        }
      ];
      
      const extractor = new FieldExtractor(fields);
      const result = extractor.extractFields(mockJsonData);
      
      expect(result.formatted_timestamp).toBe('2024-01-15');
    });
  });

  describe('type conversion', () => {
    it('should convert to number type', () => {
      const stringNumber = { value: '123.45' };
      const fields: FieldExtraction[] = [
        { name: 'numeric_value', path: 'value', type: 'number' }
      ];
      
      const extractor = new FieldExtractor(fields);
      const result = extractor.extractFields(stringNumber);
      
      expect(result.numeric_value).toBe(123.45);
      expect(typeof result.numeric_value).toBe('number');
    });

    it('should convert to boolean type', () => {
      const stringBoolean = { 
        isActive: 'true',
        isDisabled: 'false',
        isEmpty: ''
      };
      
      const fields: FieldExtraction[] = [
        { name: 'active', path: 'isActive', type: 'boolean' },
        { name: 'disabled', path: 'isDisabled', type: 'boolean' },
        { name: 'empty', path: 'isEmpty', type: 'boolean' }
      ];
      
      const extractor = new FieldExtractor(fields);
      const result = extractor.extractFields(stringBoolean);
      
      expect(result.active).toBe(true);
      expect(result.disabled).toBe(false);
      expect(result.empty).toBe(false);
    });
  });

  describe('applyToQueryResult', () => {
    it('should apply field extraction to QueryResult', () => {
      const fields: FieldExtraction[] = [
        { name: 'user_id', path: 'user.id' },
        { name: 'span_id', path: 'trace.span_id' }
      ];
      
      const extractor = new FieldExtractor(fields);
      
      const queryResult: QueryResult = {
        timestamp: 1705320000000,
        value: 'log message',
        labels: { service: 'api' },
        metadata: { source: 'test' }
      };
      
      const jsonString = JSON.stringify(mockJsonData);
      const result = extractor.applyToQueryResult(queryResult, jsonString);
      
      expect(result.labels).toEqual({
        service: 'api',
        user_id: '12345',
        span_id: 'abc123'
      });
      
      expect(result.metadata?.extractedFields).toEqual({
        user_id: '12345',
        span_id: 'abc123'
      });
    });

    it('should handle non-JSON strings gracefully', () => {
      const fields: FieldExtraction[] = [
        { name: 'user_id', path: 'user.id' }
      ];
      
      const extractor = new FieldExtractor(fields);
      
      const queryResult: QueryResult = {
        timestamp: 1705320000000,
        value: 'plain text log message',
        labels: { service: 'api' },
        metadata: { source: 'test' }
      };
      
      const result = extractor.applyToQueryResult(queryResult, 'plain text log message');
      
      // Should return original result since no JSON parsing is possible
      expect(result.labels).toEqual({ service: 'api' });
      expect(result.metadata?.extractedFields).toBeUndefined();
    });

    it('should work with object data directly', () => {
      const fields: FieldExtraction[] = [
        { name: 'user_id', path: 'user.id' }
      ];
      
      const extractor = new FieldExtractor(fields);
      
      const queryResult: QueryResult = {
        timestamp: 1705320000000,
        value: mockJsonData,
        labels: { service: 'api' },
        metadata: { source: 'test' }
      };
      
      const result = extractor.applyToQueryResult(queryResult, mockJsonData);
      
      expect(result.labels?.user_id).toBe('12345');
      expect((result.metadata?.extractedFields as any)?.user_id).toBe('12345');
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values', () => {
      const fields: FieldExtraction[] = [
        { name: 'null_field', path: 'nonexistent' }
      ];
      
      const extractor = new FieldExtractor(fields);
      
      expect(extractor.extractFields(null)).toEqual({});
      expect(extractor.extractFields(undefined)).toEqual({});
      expect(extractor.extractFields({})).toEqual({});
    });

    it('should handle circular references in objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      const fields: FieldExtraction[] = [
        { name: 'name', path: 'name' }
      ];
      
      const extractor = new FieldExtractor(fields);
      
      expect(() => {
        extractor.extractFields(circularObj);
      }).not.toThrow();
    });

    it('should handle very deep nested paths', () => {
      const deepObj = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'deep value'
              }
            }
          }
        }
      };
      
      const fields: FieldExtraction[] = [
        { name: 'deep', path: 'level1.level2.level3.level4.level5' }
      ];
      
      const extractor = new FieldExtractor(fields);
      const result = extractor.extractFields(deepObj);
      
      expect(result.deep).toBe('deep value');
    });
  });
});
