import { parseTimeExpression, formatDate, toNanoseconds, toUnixTimestamp } from '../src/utils/date-utils';

describe('Date Utils', () => {
  const fixedDate = new Date('2024-01-15T10:30:00.000Z');

  describe('parseTimeExpression', () => {
    it('should handle "now" expression', () => {
      const result = parseTimeExpression('now', fixedDate);
      expect(result).toEqual(fixedDate);
    });

    it('should handle relative time expressions', () => {
      const result = parseTimeExpression('now-1h', fixedDate);
      const expected = new Date('2024-01-15T09:30:00.000Z');
      expect(result).toEqual(expected);
    });

    it('should handle relative time with truncation', () => {
      const result = parseTimeExpression('now-1d/d', fixedDate);
      // startOfDay uses local timezone, so the result could be 2024-01-13 or 2024-01-14
      // depending on the timezone
      const resultDate = result.toISOString();
      const isValidDate = resultDate.startsWith('2024-01-13') || resultDate.startsWith('2024-01-14');
      expect(isValidDate).toBe(true);
    });

    it('should handle ISO timestamp strings', () => {
      const isoString = '2024-01-15T12:00:00.000Z';
      const result = parseTimeExpression(isoString, fixedDate);
      expect(result).toEqual(new Date(isoString));
    });

    it('should handle Unix timestamps', () => {
      const unixTimestamp = '1705320000'; // 2024-01-15T12:00:00.000Z
      const result = parseTimeExpression(unixTimestamp, fixedDate);
      expect(result).toEqual(new Date(1705320000 * 1000));
    });

    it('should throw error for invalid expressions', () => {
      expect(() => parseTimeExpression('invalid', fixedDate)).toThrow();
    });
  });

  describe('formatDate', () => {
    it('should format date with default format', () => {
      const result = formatDate(fixedDate);
      // Account for timezone offset - the result will be in local time
      expect(result).toMatch(/2024-01-15 \d{2}:30:00/);
    });

    it('should format date with custom format', () => {
      const result = formatDate(fixedDate, 'yyyy-MM-dd');
      expect(result).toBe('2024-01-15');
    });

    it('should handle different date formats', () => {
      const result = formatDate(fixedDate, 'HH:mm:ss');
      // Account for timezone offset
      expect(result).toMatch(/\d{2}:30:00/);
    });
  });

  describe('toNanoseconds', () => {
    it('should convert milliseconds to nanoseconds', () => {
      const result = toNanoseconds(fixedDate);
      const expected = fixedDate.getTime() * 1_000_000;
      expect(result).toBe(expected.toString());
    });
  });

  describe('toUnixTimestamp', () => {
    it('should convert to unix timestamp', () => {
      const result = toUnixTimestamp(fixedDate);
      const expected = Math.floor(fixedDate.getTime() / 1000);
      expect(result).toBe(expected);
    });
  });
});
