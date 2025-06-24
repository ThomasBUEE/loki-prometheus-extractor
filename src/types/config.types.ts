import { AggregationFunction, TransformType, FilterType, FilterMode } from '../constants/app.constants';

export interface TimeRange {
  from: string;
  to: string;
}

export interface MetricConfig {
  name: string;
  field?: string;
  function: AggregationFunction;
  percentile?: number;
}

export interface GroupByConfig {
  field: string;
  dateFormat?: string;
}

export interface AggregationConfig {
  groupBy?: (string | GroupByConfig)[];
  metrics?: (string | MetricConfig)[];
  function?: AggregationFunction;
  interval?: string;
  percentile?: number;
}

export interface FieldExtraction {
  name: string;
  path: string;
  type?: 'string' | 'number' | 'boolean';
  format?: string; // e.g., "yyyy-MM-dd" for dates, "0.00" for numbers
  transform?: TransformType;
}

export interface DataFilter {
  field: string; // Le chemin du champ à filtrer (ex: "labels.alertname", "value", "timestamp")
  pattern: string; // Le pattern à matcher (regex ou string exact)
  mode: FilterMode; // Inclure ou exclure les lignes qui matchent
  type: FilterType; // Type de matching
  caseSensitive?: boolean; // Sensibilité à la casse (défaut: false)
}

export interface DataSource {
  type: 'loki' | 'thanos';
  name: string;
  url: string;
  query: string;
  timeRange: TimeRange;
  aggregation?: AggregationConfig;
  headers?: Record<string, string>;
  timeout?: number;
  output?: OutputConfig;
  extractFields?: FieldExtraction[];
  filters?: DataFilter[]; // Nouveau champ pour les filtres
}

export interface OutputColumn {
  name: string;
  source: string;
  format?: 'json' | 'string' | 'number' | 'date';
  dateFormat?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string; // Default to 'Sheet1' if not specified
  credentials?: string; // Path to service account JSON file
  range?: string; // A1 notation range (e.g., 'A1:Z1000'), optional
  appendMode?: boolean; // If true, append to existing data, if false, overwrite
  includeHeadersOnAppend?: boolean; // If true, include headers when appending (default: false)
}

export interface OutputConfig {
  format: 'csv';
  filename: string;
  columns: OutputColumn[];
  delimiter?: string;
  includeHeaders?: boolean;
  googleSheets?: GoogleSheetsConfig; // Optional Google Sheets integration
}

export interface Config {
  sources: DataSource[];
  output?: OutputConfig;
}

export interface QueryResult {
  timestamp: number;
  value: number | string | Record<string, unknown>;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface AggregatedData {
  source: string;
  data: QueryResult[];
}

// Type guards
export function isMetricConfig(metric: string | MetricConfig): metric is MetricConfig {
  return typeof metric === 'object' && 'function' in metric;
}

export function isGroupByConfig(groupBy: string | GroupByConfig): groupBy is GroupByConfig {
  return typeof groupBy === 'object' && 'field' in groupBy;
}