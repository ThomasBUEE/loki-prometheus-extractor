import { DataFilterService } from '../src/services/data-filter.service';
import { DataFilter, QueryResult } from '../src/types/config.types';

describe('DataFilterService', () => {
  let filterService: DataFilterService;

  const sampleData: QueryResult[] = [
    {
      timestamp: 1705320000000,
      value: 'INFO: User login successful',
      labels: { level: 'info', service: 'auth', user_id: '12345' },
      metadata: { source: 'test' }
    },
    {
      timestamp: 1705320060000,
      value: 'ERROR: Database connection failed',
      labels: { level: 'error', service: 'db', error_code: '500' },
      metadata: { source: 'test' }
    },
    {
      timestamp: 1705320120000,
      value: 'DEBUG: Cache miss for key user_12345',
      labels: { level: 'debug', service: 'cache', user_id: '12345' },
      metadata: { source: 'test' }
    },
    {
      timestamp: 1705320180000,
      value: 'WARN: Rate limit approaching',
      labels: { level: 'warn', service: 'api', endpoint: '/users' },
      metadata: { source: 'test' }
    }
  ];

  describe('with no filters', () => {
    beforeEach(() => {
      filterService = new DataFilterService([]);
    });

    it('should return all data when no filters configured', () => {
      const result = filterService.filterResults(sampleData);
      expect(result).toEqual(sampleData);
      expect(result).toHaveLength(4);
    });
  });

  describe('exact match filters', () => {
    it('should include only exact matches', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'error',
          mode: 'include',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(1);
      expect(result[0].labels?.level).toBe('error');
    });

    it('should exclude exact matches', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'debug',
          mode: 'exclude',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(3);
      expect(result.every(r => r.labels?.level !== 'debug')).toBe(true);
    });
  });

  describe('contains filters', () => {
    it('should include items containing pattern', () => {
      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: 'User',
          mode: 'include',
          type: 'contains'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(2); // "User login" and "Cache miss for key user_12345"
    });

    it('should be case sensitive when specified', () => {
      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: 'user',
          mode: 'include',
          type: 'contains',
          caseSensitive: true
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(1); // Only "Cache miss for key user_12345"
      expect(result[0].value).toContain('user_12345');
    });

    it('should be case insensitive by default', () => {
      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: 'user',
          mode: 'include',
          type: 'contains'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(2); // Both "User login" and "user_12345"
    });
  });

  describe('startsWith and endsWith filters', () => {
    it('should filter by starts with pattern', () => {
      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: 'INFO:',
          mode: 'include',
          type: 'startsWith'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(1);
      expect((result[0].value as string).startsWith('INFO:')).toBe(true);
    });

    it('should filter by ends with pattern', () => {
      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: 'failed',
          mode: 'include',
          type: 'endsWith'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(1);
      expect((result[0].value as string).endsWith('failed')).toBe(true);
    });
  });

  describe('regex filters', () => {
    it('should filter using regex patterns', () => {
      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: '\\d{5}', // Match 5 digits
          mode: 'include',
          type: 'regex'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(1); // Only item with "12345" in value
      expect(result.every(r => /\d{5}/.test(r.value as string))).toBe(true);
    });

    it('should handle invalid regex gracefully', () => {
      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: '[invalid regex',
          mode: 'include',
          type: 'regex'
        }
      ];

      filterService = new DataFilterService(filters);
      
      // Should not throw and should return empty results for invalid regex
      expect(() => {
        const result = filterService.filterResults(sampleData);
        expect(result).toHaveLength(0);
      }).not.toThrow();
    });
  });

  describe('multiple filters', () => {
    it('should apply all filters (AND logic)', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'error',
          mode: 'exclude',
          type: 'exact'
        },
        {
          field: 'labels.service',
          pattern: 'auth',
          mode: 'include',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(1);
      expect(result[0].labels?.service).toBe('auth');
      expect(result[0].labels?.level).toBe('info');
    });

    it('should handle conflicting filters', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'info',
          mode: 'include',
          type: 'exact'
        },
        {
          field: 'labels.level',
          pattern: 'info',
          mode: 'exclude',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(0); // Conflicting filters result in no matches
    });
  });

  describe('filtering on nested fields', () => {
    it('should filter on nested label fields', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.user_id',
          pattern: '12345',
          mode: 'include',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(2);
      expect(result.every(r => r.labels?.user_id === '12345')).toBe(true);
    });

    it('should handle non-existent nested fields', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.nonexistent.field',
          pattern: 'anything',
          mode: 'include',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);

      expect(result).toHaveLength(0); // No items have this field
    });
  });

  describe('filter statistics', () => {
    it('should provide correct filter statistics', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'error',
          mode: 'exclude',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(sampleData);
      const stats = filterService.getFilterStats(sampleData.length, result.length);

      expect(stats.original).toBe(4);
      expect(stats.filtered).toBe(3);
      expect(stats.excluded).toBe(1);
      expect(stats.excludedPercentage).toBe('25.0');
    });

    it('should handle zero original count', () => {
      filterService = new DataFilterService([]);
      const stats = filterService.getFilterStats(0, 0);

      expect(stats.original).toBe(0);
      expect(stats.filtered).toBe(0);
      expect(stats.excluded).toBe(0);
      expect(stats.excludedPercentage).toBe('0');
    });
  });

  describe('edge cases', () => {
    it('should handle empty data array', () => {
      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'info',
          mode: 'include',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults([]);

      expect(result).toEqual([]);
    });

    it('should handle null/undefined field values', () => {
      const dataWithNulls: QueryResult[] = [
        {
          timestamp: 1705320000000,
          value: 'test',
          labels: { level: null as any },
          metadata: { source: 'test' }
        }
      ];

      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'info',
          mode: 'include',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(dataWithNulls);

      expect(result).toHaveLength(0); // null values don't match
    });

    it('should handle numeric field values', () => {
      const dataWithNumbers: QueryResult[] = [
        {
          timestamp: 1705320000000,
          value: 500,
          labels: { status_code: '200' },
          metadata: { source: 'test' }
        }
      ];

      const filters: DataFilter[] = [
        {
          field: 'value',
          pattern: '500',
          mode: 'include',
          type: 'exact'
        }
      ];

      filterService = new DataFilterService(filters);
      const result = filterService.filterResults(dataWithNumbers);

      expect(result).toHaveLength(1); // Should convert number to string for comparison
    });
  });
});
