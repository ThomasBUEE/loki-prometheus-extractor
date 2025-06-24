import { extractNestedValue, tryParseJSON, isPlainObject, deepClone } from '../src/utils/json-utils';

describe('JSON Utils', () => {
  describe('extractNestedValue', () => {
    const testObj = {
      user: {
        profile: {
          name: 'John Doe',
          age: 30
        },
        settings: {
          theme: 'dark'
        }
      },
      tags: ['admin', 'user'],
      active: true
    };

    it('should extract simple values', () => {
      expect(extractNestedValue(testObj, 'active')).toBe(true);
    });

    it('should extract nested values', () => {
      expect(extractNestedValue(testObj, 'user.profile.name')).toBe('John Doe');
      expect(extractNestedValue(testObj, 'user.profile.age')).toBe(30);
    });

    it('should extract from arrays', () => {
      expect(extractNestedValue(testObj, 'tags.0')).toBe('admin');
      expect(extractNestedValue(testObj, 'tags.1')).toBe('user');
    });

    it('should return undefined for non-existent paths', () => {
      expect(extractNestedValue(testObj, 'nonexistent')).toBeUndefined();
      expect(extractNestedValue(testObj, 'user.profile.email')).toBeUndefined();
      expect(extractNestedValue(testObj, 'user.invalid.path')).toBeUndefined();
    });

    it('should handle null/undefined objects', () => {
      expect(extractNestedValue(null, 'any.path')).toBeUndefined();
      expect(extractNestedValue(undefined, 'any.path')).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(extractNestedValue('string', 'path')).toBeUndefined();
      expect(extractNestedValue(123, 'path')).toBeUndefined();
    });
  });

  describe('tryParseJSON', () => {
    it('should parse valid JSON strings', () => {
      const jsonString = '{"name": "test", "value": 123}';
      const result = tryParseJSON(jsonString);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should parse JSON arrays', () => {
      const jsonString = '[1, 2, 3]';
      const result = tryParseJSON(jsonString);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return null for invalid JSON', () => {
      expect(tryParseJSON('invalid json')).toBeNull();
      expect(tryParseJSON('{')).toBeNull();
      expect(tryParseJSON('')).toBeNull();
    });

    it('should handle primitive JSON values', () => {
      expect(tryParseJSON('"string"')).toBe('string');
      expect(tryParseJSON('123')).toBe(123);
      expect(tryParseJSON('true')).toBe(true);
      expect(tryParseJSON('null')).toBe(null);
    });
  });

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
      expect(isPlainObject({ nested: { value: true } })).toBe(true);
    });

    it('should return false for non-plain objects', () => {
      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject(new Date())).toBe(false);
      expect(isPlainObject('string')).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(123)).toBe(123);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('should clone simple objects', () => {
      const obj = { a: 1, b: 'test' };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('should clone nested objects', () => {
      const obj = {
        level1: {
          level2: {
            value: 'deep'
          }
        }
      };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.level1).not.toBe(obj.level1);
      expect(cloned.level1.level2).not.toBe(obj.level1.level2);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { nested: true }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should clone dates', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const cloned = deepClone(date);
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
      expect(cloned.getTime()).toBe(date.getTime());
    });

    it('should handle circular references gracefully', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      
      // This should not throw, but might not handle circular refs perfectly
      expect(() => deepClone(obj)).not.toThrow();
    });
  });
});
