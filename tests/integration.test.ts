import { DataAggregator } from '../src/aggregators/data-aggregator';
import { FieldExtractor } from '../src/services/field-extractor';
import { DataFilterService } from '../src/services/data-filter.service';
import { CsvWriter } from '../src/writers/csv-writer';
import { QueryResult, FieldExtraction, DataFilter, AggregationConfig, OutputConfig } from '../src/types/config.types';
import * as fs from 'fs';
import * as path from 'path';

describe('Integration Tests', () => {
  const testOutputDir = path.join(__dirname, 'test-output');

  beforeAll(() => {
    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  describe('End-to-End Data Processing Pipeline', () => {
    it('should process data through complete pipeline', async () => {
      // 1. Setup: Create sample log data
      const rawLogData: QueryResult[] = [
        {
          timestamp: 1705320000000, // 2024-01-15T12:00:00Z
          value: '{"user":{"id":"user1","name":"John"},"request":{"method":"GET","status":200,"duration":150},"trace":{"span_id":"abc123"}}',
          labels: { service: 'api' },
          metadata: { source: 'loki-logs' }
        },
        {
          timestamp: 1705320060000, // 2024-01-15T12:01:00Z
          value: '{"user":{"id":"user2","name":"Jane"},"request":{"method":"POST","status":200,"duration":250},"trace":{"span_id":"def456"}}',
          labels: { service: 'api' },
          metadata: { source: 'loki-logs' }
        },
        {
          timestamp: 1705320120000, // 2024-01-15T12:02:00Z
          value: '{"user":{"id":"user1","name":"John"},"request":{"method":"GET","status":500,"duration":1000},"trace":{"span_id":"ghi789"}}',
          labels: { service: 'api' },
          metadata: { source: 'loki-logs' }
        },
        {
          timestamp: 1705320180000, // 2024-01-15T12:03:00Z
          value: '{"user":{"id":"user3","name":"Bob"},"request":{"method":"POST","status":200,"duration":300},"trace":{"span_id":"jkl012"}}',
          labels: { service: 'web' },
          metadata: { source: 'loki-logs' }
        }
      ];

      // 2. Field Extraction: Extract fields from JSON logs
      const fieldExtractions: FieldExtraction[] = [
        { name: 'user_id', path: 'user.id' },
        { name: 'method', path: 'request.method' },
        { name: 'status', path: 'request.status', type: 'number' },
        { name: 'duration', path: 'request.duration', type: 'number' },
        { name: 'span_id', path: 'trace.span_id' }
      ];

      const fieldExtractor = new FieldExtractor(fieldExtractions);
      const extractedData = rawLogData.map(item => 
        fieldExtractor.applyToQueryResult(item, item.value)
      );

      // Verify field extraction worked
      expect(extractedData[0].labels?.user_id).toBe('user1');
      expect(extractedData[0].labels?.method).toBe('GET');
      expect(extractedData[0].labels?.status).toBe(200);

      // 3. Data Filtering: Filter out error responses
      const filters: DataFilter[] = [
        {
          field: 'labels.status',
          pattern: '500',
          mode: 'exclude',
          type: 'exact'
        }
      ];

      const filterService = new DataFilterService(filters);
      const filteredData = filterService.filterResults(extractedData);

      // Verify filtering worked
      expect(filteredData).toHaveLength(3); // One item with status 500 should be filtered out
      expect(filteredData.every(item => Number(item.labels?.status) !== 500)).toBe(true);

      // 4. Data Aggregation: Group by service and calculate metrics
      const aggregationConfig: AggregationConfig = {
        groupBy: ['service', 'method'],
        metrics: [
          { name: 'request_count', function: 'count' },
          { name: 'avg_duration', field: 'duration', function: 'avg' },
          { name: 'max_duration', field: 'duration', function: 'max' },
          { name: 'last_span_id', field: 'span_id', function: 'last' }
        ]
      };

      const aggregator = new DataAggregator();
      const aggregatedData = aggregator.aggregate(filteredData, aggregationConfig);

      // Verify aggregation worked
      expect(aggregatedData.length).toBeGreaterThan(0);
      
      const apiGetGroup = aggregatedData.find(
        item => item.labels?.service === 'api' && item.labels?.method === 'GET'
      );
      const apiPostGroup = aggregatedData.find(
        item => item.labels?.service === 'api' && item.labels?.method === 'POST'
      );
      const webPostGroup = aggregatedData.find(
        item => item.labels?.service === 'web' && item.labels?.method === 'POST'
      );

      expect(apiGetGroup?.value).toEqual({
        request_count: 1,
        avg_duration: 150,
        max_duration: 150,
        last_span_id: 'abc123'
      });

      expect(apiPostGroup?.value).toEqual({
        request_count: 1,
        avg_duration: 250,
        max_duration: 250,
        last_span_id: 'def456'
      });

      expect(webPostGroup?.value).toEqual({
        request_count: 1,
        avg_duration: 300,
        max_duration: 300,
        last_span_id: 'jkl012'
      });

      // 5. CSV Output: Write aggregated data to CSV
      const outputConfig: OutputConfig = {
        format: 'csv',
        filename: path.join(testOutputDir, 'integration-test-{timestamp}.csv'),
        columns: [
          { name: 'service', source: 'labels.service' },
          { name: 'method', source: 'labels.method' },
          { name: 'requests', source: 'value.request_count', format: 'number' },
          { name: 'avg_duration_ms', source: 'value.avg_duration', format: 'number' },
          { name: 'max_duration_ms', source: 'value.max_duration', format: 'number' },
          { name: 'last_span', source: 'value.last_span_id' },
          { name: 'timestamp', source: 'timestamp', format: 'date', dateFormat: 'yyyy-MM-dd HH:mm:ss' }
        ]
      };

      const csvWriter = new CsvWriter(outputConfig);
      const outputFile = await csvWriter.write({
        source: 'integration-test',
        data: aggregatedData
      });

      // Verify CSV file was created
      expect(fs.existsSync(outputFile)).toBe(true);

      // Read and verify CSV content
      const csvContent = fs.readFileSync(outputFile, 'utf-8');
      const lines = csvContent.trim().split('\n');
      
      // Should have header + 3 data rows
      expect(lines.length).toBe(4);
      
      // Verify header
      expect(lines[0]).toContain('service,method,requests,avg_duration_ms,max_duration_ms,last_span,timestamp');
      
      // Verify data rows contain expected values
      const dataLines = lines.slice(1);
      expect(dataLines.some(line => line.includes('api,GET,1,150,150,abc123'))).toBe(true);
      expect(dataLines.some(line => line.includes('api,POST,1,250,250,def456'))).toBe(true);
      expect(dataLines.some(line => line.includes('web,POST,1,300,300,jkl012'))).toBe(true);
    });
  });

  describe('Error Handling in Pipeline', () => {
    it('should handle malformed JSON in field extraction gracefully', () => {
      const malformedData: QueryResult[] = [
        {
          timestamp: 1705320000000,
          value: '{"invalid": json}', // Malformed JSON
          labels: { service: 'test' },
          metadata: { source: 'test' }
        },
        {
          timestamp: 1705320060000,
          value: '{"valid": "json"}',
          labels: { service: 'test' },
          metadata: { source: 'test' }
        }
      ];

      const fieldExtractions: FieldExtraction[] = [
        { name: 'field', path: 'valid' }
      ];

      const fieldExtractor = new FieldExtractor(fieldExtractions);
      
      // Should not throw error
      expect(() => {
        const result = malformedData.map(item => 
          fieldExtractor.applyToQueryResult(item, item.value)
        );
        
        // Valid JSON should have extracted field, malformed should not
        expect(result[0].labels?.field).toBeUndefined();
        expect(result[1].labels?.field).toBe('json');
      }).not.toThrow();
    });

    it('should handle empty data sets in aggregation', () => {
      const aggregationConfig: AggregationConfig = {
        groupBy: ['service'],
        function: 'count'
      };

      const aggregator = new DataAggregator();
      const result = aggregator.aggregate([], aggregationConfig);

      expect(result).toEqual([]);
    });

    it('should handle filters that match no data', () => {
      const data: QueryResult[] = [
        {
          timestamp: 1705320000000,
          value: 'test',
          labels: { level: 'info' },
          metadata: { source: 'test' }
        }
      ];

      const filters: DataFilter[] = [
        {
          field: 'labels.level',
          pattern: 'nonexistent',
          mode: 'include',
          type: 'exact'
        }
      ];

      const filterService = new DataFilterService(filters);
      const result = filterService.filterResults(data);

      expect(result).toEqual([]);
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle moderately large datasets efficiently', () => {
      // Generate 1000 sample records
      const largeDataset: QueryResult[] = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: 1705320000000 + i * 1000,
        value: `{"user_id": "user${i % 100}", "status": ${i % 2 === 0 ? 200 : 500}}`,
        labels: { service: `service${i % 10}` },
        metadata: { source: 'test' }
      }));

      const startTime = Date.now();

      // Field extraction
      const fieldExtractor = new FieldExtractor([
        { name: 'user_id', path: 'user_id' },
        { name: 'status', path: 'status', type: 'number' }
      ]);
      
      const extractedData = largeDataset.map(item => 
        fieldExtractor.applyToQueryResult(item, item.value)
      );

      // Aggregation
      const aggregator = new DataAggregator();
      const aggregated = aggregator.aggregate(extractedData, {
        groupBy: ['service'],
        metrics: [
          { name: 'count', function: 'count' },
          { name: 'avg_status', field: 'status', function: 'avg' }
        ]
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000); // 5 seconds
      
      // Should have 10 groups (service0 through service9)
      expect(aggregated).toHaveLength(10);
      
      // Each group should have 100 items
      aggregated.forEach(group => {
        expect(group.value).toHaveProperty('count', 100);
      });
    });
  });
});
