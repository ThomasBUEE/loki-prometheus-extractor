import { DataAggregator } from '../src/aggregators/data-aggregator';
import { QueryResult, AggregationConfig } from '../src/types/config.types';

describe('DataAggregator', () => {
  let aggregator: DataAggregator;

  beforeEach(() => {
    aggregator = new DataAggregator();
  });

  const sampleData: QueryResult[] = [
    {
      timestamp: 1705320000000, // 2024-01-15T12:00:00Z
      value: 100,
      labels: { service: 'api', status: '200' },
      metadata: { source: 'test' }
    },
    {
      timestamp: 1705320060000, // 2024-01-15T12:01:00Z
      value: 150,
      labels: { service: 'api', status: '200' },
      metadata: { source: 'test' }
    },
    {
      timestamp: 1705320120000, // 2024-01-15T12:02:00Z
      value: 200,
      labels: { service: 'api', status: '500' },
      metadata: { source: 'test' }
    },
    {
      timestamp: 1705320180000, // 2024-01-15T12:03:00Z
      value: 75,
      labels: { service: 'web', status: '200' },
      metadata: { source: 'test' }
    }
  ];

  describe('basic aggregation without grouping', () => {
    it('should return original data when no config provided', () => {
      const result = aggregator.aggregate(sampleData);
      expect(result).toEqual(sampleData);
    });

    it('should apply simple function aggregation', () => {
      const config: AggregationConfig = {
        function: 'sum'
      };
      const result = aggregator.aggregate(sampleData, config);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(525); // 100 + 150 + 200 + 75
    });

    it('should calculate average', () => {
      const config: AggregationConfig = {
        function: 'avg'
      };
      const result = aggregator.aggregate(sampleData, config);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(131.25); // 525 / 4
    });

    it('should find min and max values', () => {
      const minConfig: AggregationConfig = { function: 'min' };
      const maxConfig: AggregationConfig = { function: 'max' };
      
      const minResult = aggregator.aggregate(sampleData, minConfig);
      const maxResult = aggregator.aggregate(sampleData, maxConfig);
      
      expect(minResult[0].value).toBe(75);
      expect(maxResult[0].value).toBe(200);
    });

    it('should count items', () => {
      const config: AggregationConfig = {
        function: 'count'
      };
      const result = aggregator.aggregate(sampleData, config);
      expect(result[0].value).toBe(4);
    });
  });

  describe('groupBy aggregation', () => {
    it('should group by single field', () => {
      const config: AggregationConfig = {
        groupBy: ['service'],
        function: 'count'
      };
      const result = aggregator.aggregate(sampleData, config);
      
      expect(result).toHaveLength(2);
      
      const apiGroup = result.find(r => r.labels?.service === 'api');
      const webGroup = result.find(r => r.labels?.service === 'web');
      
      expect(apiGroup?.value).toBe(3);
      expect(webGroup?.value).toBe(1);
    });

    it('should group by multiple fields', () => {
      const config: AggregationConfig = {
        groupBy: ['service', 'status'],
        function: 'sum'
      };
      const result = aggregator.aggregate(sampleData, config);
      
      expect(result).toHaveLength(3); // api-200, api-500, web-200
      
      const api200 = result.find(r => r.labels?.service === 'api' && r.labels?.status === '200');
      const api500 = result.find(r => r.labels?.service === 'api' && r.labels?.status === '500');
      const web200 = result.find(r => r.labels?.service === 'web' && r.labels?.status === '200');
      
      expect(api200?.value).toBe(250); // 100 + 150
      expect(api500?.value).toBe(200);
      expect(web200?.value).toBe(75);
    });

    it('should group by timestamp with date formatting', () => {
      const config: AggregationConfig = {
        groupBy: [
          {
            field: 'timestamp',
            dateFormat: 'yyyy-MM-dd HH:mm'
          }
        ],
        function: 'count'
      };
      const result = aggregator.aggregate(sampleData, config);
      
      expect(result).toHaveLength(4); // Each timestamp is different to the minute
      // Account for timezone differences - could be 12:xx or 13:xx depending on local time
      expect(result[0].labels?.timestamp_formatted).toMatch(/2024-01-15 1[2-3]:0[0-3]/);
    });
  });

  describe('metrics aggregation', () => {
    it('should handle multiple metrics', () => {
      const config: AggregationConfig = {
        groupBy: ['service'],
        metrics: [
          { name: 'total_count', function: 'count' },
          { name: 'sum_value', function: 'sum' },
          { name: 'avg_value', function: 'avg' }
        ]
      };
      const result = aggregator.aggregate(sampleData, config);
      
      expect(result).toHaveLength(2);
      
      const apiGroup = result.find(r => r.labels?.service === 'api');
      expect(apiGroup?.value).toEqual({
        total_count: 3,
        sum_value: 450, // 100 + 150 + 200
        avg_value: 150  // 450 / 3
      });
    });

    it('should handle field-specific metrics', () => {
      // Add some test data with extracted fields
      const dataWithFields: QueryResult[] = sampleData.map(item => ({
        ...item,
        metadata: {
          ...item.metadata,
          extractedFields: {
            user_id: Math.floor(Math.random() * 100).toString(),
            duration: Math.floor(Math.random() * 1000)
          }
        }
      }));

      const config: AggregationConfig = {
        groupBy: ['service'],
        metrics: [
          { name: 'request_count', function: 'count' },
          { name: 'avg_duration', field: 'duration', function: 'avg' }
        ]
      };
      
      const result = aggregator.aggregate(dataWithFields, config);
      expect(result).toHaveLength(2);
      
      const apiGroup = result.find(r => r.labels?.service === 'api');
      expect(apiGroup?.value).toHaveProperty('request_count', 3);
      expect(apiGroup?.value).toHaveProperty('avg_duration');
    });
  });

  describe('percentile calculation', () => {
    it('should calculate 95th percentile', () => {
      const config: AggregationConfig = {
        function: 'percentile',
        percentile: 95
      };
      const result = aggregator.aggregate(sampleData, config);
      
      // For values [75, 100, 150, 200], 95th percentile should be close to 200
      expect(result[0].value).toBeGreaterThan(190);
    });

    it('should calculate 50th percentile (median)', () => {
      const config: AggregationConfig = {
        function: 'percentile',
        percentile: 50
      };
      const result = aggregator.aggregate(sampleData, config);
      
      // For values [75, 100, 150, 200], median should be 125
      expect(result[0].value).toBe(125);
    });
  });

  describe('first and last functions', () => {
    it('should return first value chronologically', () => {
      const config: AggregationConfig = {
        function: 'first'
      };
      const result = aggregator.aggregate(sampleData, config);
      expect(result[0].value).toBe(100); // First chronologically
    });

    it('should return last value chronologically', () => {
      const config: AggregationConfig = {
        function: 'last'
      };
      const result = aggregator.aggregate(sampleData, config);
      expect(result[0].value).toBe(75); // Last chronologically
    });
  });

  describe('edge cases', () => {
    it('should handle empty data', () => {
      const config: AggregationConfig = {
        function: 'sum'
      };
      const result = aggregator.aggregate([], config);
      expect(result).toEqual([]);
    });

    it('should handle single data point', () => {
      const config: AggregationConfig = {
        groupBy: ['service'],
        function: 'avg'
      };
      const result = aggregator.aggregate([sampleData[0]], config);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(100);
    });

    it('should handle non-numeric values gracefully', () => {
      const nonNumericData: QueryResult[] = [
        {
          timestamp: 1705320000000,
          value: 'not a number',
          labels: { service: 'api' },
          metadata: { source: 'test' }
        }
      ];
      
      const config: AggregationConfig = {
        function: 'sum'
      };
      const result = aggregator.aggregate(nonNumericData, config);
      expect(result[0].value).toBe(0); // Should handle gracefully
    });
  });
});
