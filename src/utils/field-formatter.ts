import { format } from 'date-fns';
import { FieldExtraction } from '../types/config.types';
import { TIME_CONSTANTS } from '../constants/app.constants';

export function formatFieldValue(value: any, field: FieldExtraction): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Apply transformation first
  let transformedValue = value;
  if (field.transform) {
    switch (field.transform) {
      case 'date':
        // Convert to date if it's a timestamp
        if (typeof value === 'number') {
          // Handle both seconds and milliseconds timestamps
          const timestamp = value > TIME_CONSTANTS.TIMESTAMP_THRESHOLD ? value : value * TIME_CONSTANTS.S_TO_MS_MULTIPLIER;
          transformedValue = new Date(timestamp);
        } else if (typeof value === 'string') {
          transformedValue = new Date(value);
        }
        break;
      case 'uppercase':
        transformedValue = String(value).toUpperCase();
        break;
      case 'lowercase':
        transformedValue = String(value).toLowerCase();
        break;
      case 'trim':
        transformedValue = String(value).trim();
        break;
    }
  }

  // Apply formatting
  if (field.format) {
    if (field.transform === 'date' || transformedValue instanceof Date) {
      // Date formatting
      try {
        return format(transformedValue, field.format);
      } catch (error) {
        console.warn(`Failed to format date with pattern ${field.format}:`, error);
        return transformedValue;
      }
    } else if (typeof transformedValue === 'number') {
      // Number formatting (basic implementation)
      if (field.format.includes('.')) {
        const decimals = field.format.split('.')[1].length;
        return transformedValue.toFixed(decimals);
      }
    }
  }

  // Type conversion if specified
  if (field.type) {
    switch (field.type) {
      case 'number':
        const numValue = Number(transformedValue);
        return isNaN(numValue) ? NaN : numValue;
      case 'string':
        return String(transformedValue);
      case 'boolean':
        if (typeof transformedValue === 'string') {
          const lower = transformedValue.toLowerCase();
          return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on';
        }
        return Boolean(transformedValue);
    }
  }

  return transformedValue;
}