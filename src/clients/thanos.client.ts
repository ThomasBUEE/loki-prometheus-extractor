import axios, { AxiosInstance } from 'axios';
import { DataSource, QueryResult } from '../types/config.types';
import { parseTimeExpression, toUnixTimestamp } from '../utils/date-utils';
import { FieldExtractor } from '../services/field-extractor';
import { DataFilterService } from '../services/data-filter.service';
import { APP_CONFIG, API_ENDPOINTS, TIME_CONSTANTS } from '../constants/app.constants';
import { APIError, normalizeError } from '../utils/errors';

interface PrometheusValue {
  metric: Record<string, string>;
  values?: Array<[number, string]>;
  value?: [number, string];
}

interface PrometheusQueryResponse {
  status: string;
  data: {
    resultType: 'matrix' | 'vector';
    result: PrometheusValue[];
  };
}

export class ThanosClient {
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
      start: toUnixTimestamp(fromDate),
      end: toUnixTimestamp(toDate),
      step: this.source.aggregation?.interval || APP_CONFIG.DEFAULT_THANOS_STEP,
    };

    try {
      const response = await this.client.get<PrometheusQueryResponse>(API_ENDPOINTS.THANOS_QUERY_RANGE, {
        params,
      });

      if (response.data.status !== 'success') {
        throw new APIError(`Thanos query failed: ${response.data.status}`);
      }

      return this.parseResults(response.data.data.result, response.data.data.resultType);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new APIError(`Thanos API error: ${error.message}`, error.response?.status, error.response?.data);
      }
      throw normalizeError(error, 'Thanos query execution');
    }
  }

  private parseResults(result: PrometheusValue[], resultType: string): QueryResult[] {
    const results: QueryResult[] = [];

    for (const series of result) {
      const labels = series.metric;

      if (resultType === 'matrix' && series.values) {
        for (const [timestamp, value] of series.values) {
          const result: QueryResult = {
            timestamp: timestamp * TIME_CONSTANTS.S_TO_MS_MULTIPLIER,
            value: parseFloat(value),
            labels: labels,
            metadata: {
              source: this.source.name,
              type: 'thanos',
            },
          };

          // Create extended data for field extraction including timestamp
          const extractionData = {
            ...series.metric,
            timestamp: timestamp * TIME_CONSTANTS.S_TO_MS_MULTIPLIER,
            value: parseFloat(value)
          };

          // Apply field extraction if configured
          const processedResult = this.fieldExtractor.applyToQueryResult(result, extractionData);
          results.push(processedResult);
        }
      } else if (resultType === 'vector' && series.value) {
        const [timestamp, value] = series.value;
        const result: QueryResult = {
          timestamp: timestamp * TIME_CONSTANTS.S_TO_MS_MULTIPLIER,
          value: parseFloat(value),
          labels: labels,
          metadata: {
            source: this.source.name,
            type: 'thanos',
          },
        };

        // Create extended data for field extraction including timestamp
        const extractionData = {
          ...series.metric,
          timestamp: timestamp * TIME_CONSTANTS.S_TO_MS_MULTIPLIER,
          value: parseFloat(value)
        };

        // Apply field extraction if configured
        const processedResult = this.fieldExtractor.applyToQueryResult(result, extractionData);
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