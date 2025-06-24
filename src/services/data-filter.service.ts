import { DataFilter, QueryResult } from '../types/config.types';
import { extractNestedValue } from '../utils/json-utils';

export class DataFilterService {
  private filters: DataFilter[];

  constructor(filters: DataFilter[] = []) {
    this.filters = filters;
  }

  /**
   * Filter query results based on configured filters
   * @param results - Array of query results to filter
   * @returns Filtered array of query results
   */
  filterResults(results: QueryResult[]): QueryResult[] {
    if (!this.filters || this.filters.length === 0) {
      return results;
    }

    return results.filter(result => this.shouldIncludeResult(result));
  }

  /**
   * Determine if a result should be included based on all filters
   * @param result - The query result to evaluate
   * @returns true if the result should be included, false otherwise
   */
  private shouldIncludeResult(result: QueryResult): boolean {
    for (const filter of this.filters) {
      const fieldValue = this.extractFieldValue(result, filter.field);
      const matches = this.evaluateFilter(fieldValue, filter);

      if (filter.mode === 'include' && !matches) {
        return false; // Include mode: exclude if doesn't match
      } else if (filter.mode === 'exclude' && matches) {
        return false; // Exclude mode: exclude if matches
      }
    }

    return true; // Include if all filters pass
  }

  /**
   * Extract field value from query result
   * @param result - The query result
   * @param fieldPath - The field path (e.g., "labels.alertname", "value", "timestamp")
   * @returns The extracted field value
   */
  private extractFieldValue(result: QueryResult, fieldPath: string): any {
    if (fieldPath === 'value') {
      return result.value;
    } else if (fieldPath === 'timestamp') {
      return result.timestamp;
    } else if (fieldPath.startsWith('labels.')) {
      const labelKey = fieldPath.substring(7);
      return result.labels?.[labelKey];
    } else if (fieldPath.startsWith('metadata.')) {
      const metadataKey = fieldPath.substring(9);
      return result.metadata?.[metadataKey];
    } else {
      // Try to extract from nested path in value
      if (typeof result.value === 'object' && result.value !== null) {
        return extractNestedValue(result.value, fieldPath);
      }
    }

    return undefined;
  }

  /**
   * Evaluate if a field value matches the filter
   * @param fieldValue - The field value to evaluate
   * @param filter - The filter configuration
   * @returns true if the value matches the filter pattern
   */
  private evaluateFilter(fieldValue: any, filter: DataFilter): boolean {
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    const stringValue = String(fieldValue);
    const pattern = filter.caseSensitive ? filter.pattern : filter.pattern.toLowerCase();
    const value = filter.caseSensitive ? stringValue : stringValue.toLowerCase();

    switch (filter.type) {
      case 'exact':
        return value === pattern;

      case 'contains':
        return value.includes(pattern);

      case 'startsWith':
        return value.startsWith(pattern);

      case 'endsWith':
        return value.endsWith(pattern);

      case 'regex':
        try {
          const flags = filter.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(pattern, flags);
          return regex.test(stringValue);
        } catch (error) {
          console.warn(`Invalid regex pattern '${pattern}':`, error);
          return false;
        }

      default:
        console.warn(`Unknown filter type: ${filter.type}`);
        return false;
    }
  }

  /**
   * Get statistics about filtered results
   * @param originalCount - Original number of results
   * @param filteredCount - Number of results after filtering
   * @returns Filter statistics
   */
  getFilterStats(originalCount: number, filteredCount: number) {
    const filtered = originalCount - filteredCount;
    const percentage = originalCount > 0 ? ((filtered / originalCount) * 100).toFixed(1) : '0';

    return {
      original: originalCount,
      filtered: filteredCount,
      excluded: filtered,
      excludedPercentage: percentage,
    };
  }
}
