import axios, { AxiosInstance } from 'axios';
import { DataSource, QueryResult } from '../types/config.types';
import { parseTimeExpression, toNanoseconds } from '../utils/date-utils';
import { FieldExtractor } from '../services/field-extractor';
import { DataFilterService } from '../services/data-filter.service';
import { APP_CONFIG, API_ENDPOINTS, TIME_CONSTANTS } from '../constants/app.constants';
import { APIError, normalizeError } from '../utils/errors';

interface LokiStreamValue {
  stream: Record<string, string>;
  values: Array<[string, string]>;
}

interface LokiQueryResponse {
  status: string;
  data: {
    resultType: string;
    result: LokiStreamValue[];
  };
}

export class LokiClient {
  private client: AxiosInstance;
  private source: DataSource;
  private fieldExtractor: FieldExtractor;
  private dataFilterService: DataFilterService;

  constructor(source: DataSource) {
    this.source = source;
    this.client = axios.create({
      baseURL: source.url,
      timeout: source.timeout || APP_CONFIG.DEFAULT_TIMEOUT,
      headers: source.headers || {},
    });
    this.fieldExtractor = new FieldExtractor(source.extractFields || []);
    this.dataFilterService = new DataFilterService(source.filters || []);
  }

  async query(): Promise<QueryResult[]> {
    const fromDate = parseTimeExpression(this.source.timeRange.from);
    const toDate = parseTimeExpression(this.source.timeRange.to);

    console.log(`    Resolved time range: ${fromDate.toISOString()} to ${toDate.toISOString()}`);

    const params = {
      query: this.source.query,
      start: toNanoseconds(fromDate),
      end: toNanoseconds(toDate),
      limit: APP_CONFIG.DEFAULT_LOKI_LIMIT,
      direction: APP_CONFIG.DEFAULT_DIRECTION,
    };

    try {
      const response = await this.client.get<LokiQueryResponse>(API_ENDPOINTS.LOKI_QUERY_RANGE, {
        params,
      });

      if (response.data.status !== 'success') {
        throw new APIError(`Loki query failed: ${response.data.status}`);
      }

      return this.parseResults(response.data.data.result);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new APIError(`Loki API error: ${error.message}`, error.response?.status, error.response?.data);
      }
      throw normalizeError(error, 'Loki query execution');
    }
  }

  private parseResults(streams: LokiStreamValue[]): QueryResult[] {
    const results: QueryResult[] = [];

    for (const stream of streams) {
      const labels = stream.stream;

      for (const [timestamp, value] of stream.values) {
        // Loki returns timestamps as strings in nanoseconds
        // Convert to milliseconds for JavaScript Date compatibility
        const timestampNs = parseInt(timestamp, 10);
        const timestampMs = Math.floor(timestampNs / TIME_CONSTANTS.NS_TO_MS_DIVISOR);

        const result: QueryResult = {
          timestamp: timestampMs,
          value: value,
          labels: labels,
          metadata: {
            source: this.source.name,
            type: 'loki',
          },
        };
        
        // Apply field extraction if configured
        const processedResult = this.fieldExtractor.applyToQueryResult(result, value);
        results.push(processedResult);
      }
    }

    // Apply data filtering
    const filteredResults = this.dataFilterService.filterResults(results);
    
    // Log filter statistics if filters are configured
    if (this.source.filters && this.source.filters.length > 0 && results.length !== filteredResults.length) {
      const stats = this.dataFilterService.getFilterStats(results.length, filteredResults.length);
      console.log(`  Applied ${this.source.filters.length} filter(s): ${stats.excluded} rows excluded (${stats.excludedPercentage}%)`);
    }

    return filteredResults;
  }
}