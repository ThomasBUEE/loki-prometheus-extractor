import { FieldExtraction, QueryResult } from '../types/config.types';
import { tryParseJSON, extractNestedValue } from '../utils/json-utils';
import { formatFieldValue } from '../utils/field-formatter';

export class FieldExtractor {
  private fields: FieldExtraction[];

  constructor(fields: FieldExtraction[] = []) {
    this.fields = fields;
  }

  /**
   * Extract and format fields from a value
   * @param value - The value to extract fields from (can be string, object, or any type)
   * @param existingLabels - Existing labels to merge with
   * @returns Object containing extracted fields
   */
  extractFields(value: any, existingLabels: Record<string, string> = {}): Record<string, any> {
    if (!this.fields || this.fields.length === 0) {
      return {};
    }

    const extractedFields: Record<string, any> = {};
    
    // Try to parse as JSON if it's a string
    let data = value;
    if (typeof value === 'string') {
      const parsed = tryParseJSON(value);
      if (parsed) {
        data = parsed;
      }
    }

    // For objects, we can extract directly
    if (typeof data === 'object' && data !== null) {
      for (const field of this.fields) {
        const extractedValue = this.extractValue(data, field, existingLabels);
        if (extractedValue !== undefined) {
          extractedFields[field.name] = extractedValue;
        }
      }
    }

    return extractedFields;
  }

  /**
   * Extract value from data using field configuration
   */
  private extractValue(data: any, field: FieldExtraction, existingLabels: Record<string, string>): any {
    let value: any;

    // Special handling for label references (e.g., "labels.foo")
    if (field.path.startsWith('labels.') && existingLabels) {
      const labelKey = field.path.substring(7);
      value = existingLabels[labelKey];
    } else if (field.path === 'value') {
      // Direct value reference - if data has a value property, use it, otherwise use data itself
      value = data && typeof data === 'object' && 'value' in data ? data.value : data;
    } else if (field.path === 'timestamp') {
      // Special handling for timestamp field
      value = data.timestamp;
    } else {
      // Extract from nested path
      value = extractNestedValue(data, field.path);
    }

    // Apply formatting if value exists
    if (value !== undefined) {
      return formatFieldValue(value, field);
    }

    return undefined;
  }

  /**
   * Apply field extraction to a QueryResult
   */
  applyToQueryResult(result: QueryResult, rawValue?: any): QueryResult {
    const extractedFields = this.extractFields(rawValue || result.value, result.labels);
    
    if (Object.keys(extractedFields).length > 0) {
      return {
        ...result,
        labels: { ...result.labels, ...extractedFields },
        metadata: {
          ...result.metadata,
          extractedFields: extractedFields,
        },
      };
    }

    return result;
  }
}