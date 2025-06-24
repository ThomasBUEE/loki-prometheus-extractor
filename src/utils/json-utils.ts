/**
 * Utility functions for JSON and object manipulation
 */

/**
 * Extract a nested value from an object using a dot notation path
 * @param obj - The object to extract from
 * @param path - The dot notation path (e.g., "user.profile.name", "tags.0")
 * @returns The extracted value or undefined if not found
 */
export function extractNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && value !== null) {
      // Handle array access with numeric indices
      if (Array.isArray(value) && /^\d+$/.test(key)) {
        const index = parseInt(key, 10);
        value = value[index];
      } else if (key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Safely parse a JSON string
 * @param str - The string to parse
 * @returns Parsed object or null if parsing fails
 */
export function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Check if a value is a plain object (not array, null, date, etc.)
 * @param value - The value to check
 * @returns True if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && 
         typeof value === 'object' && 
         !Array.isArray(value) && 
         !(value instanceof Date);
}

/**
 * Deep clone an object
 * @param obj - The object to clone
 * @param visited - Set to track visited objects (prevents circular references)
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T, visited = new WeakSet()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle circular references
  if (visited.has(obj as object)) {
    return {} as T; // Return empty object for circular reference
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  visited.add(obj as object);
  
  if (Array.isArray(obj)) {
    const result = obj.map(item => deepClone(item, visited)) as T;
    visited.delete(obj as object);
    return result;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key], visited);
    }
  }
  
  visited.delete(obj as object);
  return cloned;
}