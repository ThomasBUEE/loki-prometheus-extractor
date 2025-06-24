/**
 * Application constants
 */
export const APP_CONFIG = Object.freeze({
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_LOKI_LIMIT: 5000,
  DEFAULT_DIRECTION: 'forward' as const,
  DEFAULT_THANOS_STEP: '60s',
  DEFAULT_DATE_FORMAT: 'yyyy-MM-dd HH:mm:ss',
  VERSION: '1.0.0',
});

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  LOKI_QUERY_RANGE: '/loki/api/v1/query_range',
  THANOS_QUERY_RANGE: '/api/v1/query_range',
} as const;

/**
 * File system constants
 */
export const FS_CONFIG = {
  LOG_DIRECTORY: 'logs',
  CONFIG_DIRECTORY: 'config',
} as const;

/**
 * Timestamp conversion constants
 */
export const TIME_CONSTANTS = {
  NS_TO_MS_DIVISOR: 1_000_000,
  MS_TO_S_DIVISOR: 1000,
  S_TO_MS_MULTIPLIER: 1000,
  NS_PADDING: '000000',
  TIMESTAMP_THRESHOLD: 1e12, // To distinguish between seconds and milliseconds
} as const;

/**
 * Aggregation function names
 */
export const AGGREGATION_FUNCTIONS = Object.freeze([
  'sum', 'avg', 'min', 'max', 'count', 'percentile', 'last', 'first'
]);

export type AggregationFunction = typeof AGGREGATION_FUNCTIONS[number];

/**
 * Transform types
 */
export const TRANSFORM_TYPES = [
  'date', 'uppercase', 'lowercase', 'trim'
] as const;

export type TransformType = typeof TRANSFORM_TYPES[number];

/**
 * Filter types
 */
export const FILTER_TYPES = [
  'regex', 'exact', 'contains', 'startsWith', 'endsWith'
] as const;

export type FilterType = typeof FILTER_TYPES[number];

/**
 * Filter modes
 */
export const FILTER_MODES = ['include', 'exclude'] as const;

export type FilterMode = typeof FILTER_MODES[number];
