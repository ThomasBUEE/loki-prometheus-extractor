import {
    APP_CONFIG,
    API_ENDPOINTS,
    TIME_CONSTANTS,
    AGGREGATION_FUNCTIONS,
    TRANSFORM_TYPES,
    FILTER_TYPES,
    FILTER_MODES
} from '../src/constants/app.constants';

describe('App Constants', () => {
  describe('APP_CONFIG', () => {
    it('should have all required configuration values', () => {
      expect(APP_CONFIG.DEFAULT_TIMEOUT).toBe(30000);
      expect(APP_CONFIG.DEFAULT_LOKI_LIMIT).toBe(5000);
      expect(APP_CONFIG.DEFAULT_DIRECTION).toBe('forward');
      expect(APP_CONFIG.DEFAULT_THANOS_STEP).toBe('60s');
      expect(APP_CONFIG.DEFAULT_DATE_FORMAT).toBe('yyyy-MM-dd HH:mm:ss');
      expect(APP_CONFIG.VERSION).toBe('1.0.0');
    });

    it('should have numeric values for timeouts and limits', () => {
      expect(typeof APP_CONFIG.DEFAULT_TIMEOUT).toBe('number');
      expect(typeof APP_CONFIG.DEFAULT_LOKI_LIMIT).toBe('number');
      expect(APP_CONFIG.DEFAULT_TIMEOUT).toBeGreaterThan(0);
      expect(APP_CONFIG.DEFAULT_LOKI_LIMIT).toBeGreaterThan(0);
    });
  });

  describe('API_ENDPOINTS', () => {
    it('should have correct endpoint paths', () => {
      expect(API_ENDPOINTS.LOKI_QUERY_RANGE).toBe('/loki/api/v1/query_range');
      expect(API_ENDPOINTS.THANOS_QUERY_RANGE).toBe('/api/v1/query_range');
    });

    it('should have valid URL path format', () => {
      Object.values(API_ENDPOINTS).forEach(endpoint => {
        expect(typeof endpoint).toBe('string');
        expect(endpoint).toMatch(/^\/.*$/); // Should start with /
      });
    });
  });

  describe('TIME_CONSTANTS', () => {
    it('should have correct conversion factors', () => {
      expect(TIME_CONSTANTS.NS_TO_MS_DIVISOR).toBe(1_000_000);
      expect(TIME_CONSTANTS.MS_TO_S_DIVISOR).toBe(1000);
      expect(TIME_CONSTANTS.S_TO_MS_MULTIPLIER).toBe(1000);
      expect(TIME_CONSTANTS.TIMESTAMP_THRESHOLD).toBe(1e12);
    });

    it('should have correct string values', () => {
      expect(TIME_CONSTANTS.NS_PADDING).toBe('000000');
      expect(typeof TIME_CONSTANTS.NS_PADDING).toBe('string');
    });

    it('should maintain mathematical relationships', () => {
      // Test conversion consistency
      expect(TIME_CONSTANTS.MS_TO_S_DIVISOR * TIME_CONSTANTS.S_TO_MS_MULTIPLIER).toBe(1_000_000);
    });
  });

  describe('AGGREGATION_FUNCTIONS', () => {
    it('should contain all expected aggregation functions', () => {
      const expectedFunctions = ['sum', 'avg', 'min', 'max', 'count', 'percentile', 'last', 'first'];
      
      expectedFunctions.forEach(func => {
        expect(AGGREGATION_FUNCTIONS).toContain(func);
      });
      
      expect(AGGREGATION_FUNCTIONS).toHaveLength(expectedFunctions.length);
    });

    it('should be readonly array', () => {
      // TypeScript should prevent modification, but let's check the structure
      expect(Array.isArray(AGGREGATION_FUNCTIONS)).toBe(true);
      expect(AGGREGATION_FUNCTIONS.length).toBeGreaterThan(0);
    });
  });

  describe('TRANSFORM_TYPES', () => {
    it('should contain all expected transform types', () => {
      const expectedTransforms = ['date', 'uppercase', 'lowercase', 'trim'];
      
      expectedTransforms.forEach(transform => {
        expect(TRANSFORM_TYPES).toContain(transform);
      });
      
      expect(TRANSFORM_TYPES).toHaveLength(expectedTransforms.length);
    });
  });

  describe('FILTER_TYPES', () => {
    it('should contain all expected filter types', () => {
      const expectedTypes = ['regex', 'exact', 'contains', 'startsWith', 'endsWith'];
      
      expectedTypes.forEach(type => {
        expect(FILTER_TYPES).toContain(type);
      });
      
      expect(FILTER_TYPES).toHaveLength(expectedTypes.length);
    });
  });

  describe('FILTER_MODES', () => {
    it('should contain all expected filter modes', () => {
      const expectedModes = ['include', 'exclude'];
      
      expectedModes.forEach(mode => {
        expect(FILTER_MODES).toContain(mode);
      });
      
      expect(FILTER_MODES).toHaveLength(expectedModes.length);
    });
  });

  describe('Type safety', () => {
    it('should have all constants as const assertions', () => {
      // These should compile without errors due to const assertions
      const timeout: 30000 = APP_CONFIG.DEFAULT_TIMEOUT;
      const direction: 'forward' = APP_CONFIG.DEFAULT_DIRECTION;
      const endpoint: '/loki/api/v1/query_range' = API_ENDPOINTS.LOKI_QUERY_RANGE;
      
      expect(timeout).toBe(30000);
      expect(direction).toBe('forward');
      expect(endpoint).toBe('/loki/api/v1/query_range');
    });
  });

  describe('Immutability', () => {
    it('should not allow modification of constant objects', () => {
      // These operations should not modify the original constants
      expect(() => {
        (APP_CONFIG as any).DEFAULT_TIMEOUT = 60000;
      }).toThrow();
    });

    it('should not allow modification of constant arrays', () => {
      expect(() => {
        (AGGREGATION_FUNCTIONS as any).push('new_function');
      }).toThrow();
    });
  });
});
