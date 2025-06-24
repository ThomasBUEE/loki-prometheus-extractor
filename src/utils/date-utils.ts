import { format, subHours, subDays, subMinutes, subWeeks, startOfWeek, startOfDay, startOfHour, startOfMinute } from 'date-fns';
import { APP_CONFIG, TIME_CONSTANTS } from '../constants/app.constants';

export function parseTimeExpression(expr: string, referenceTime: Date = new Date()): Date {
  if (expr === 'now') {
    return referenceTime;
  }

  // Handle relative time with optional truncation (e.g., now-1w/w, now-2d/d)
  const relativeTruncateMatch = expr.match(/^now-(\d+)([hdmw])\/([hdmw])$/);
  if (relativeTruncateMatch) {
    const amount = parseInt(relativeTruncateMatch[1], 10);
    const unit = relativeTruncateMatch[2];
    const truncateUnit = relativeTruncateMatch[3];

    let date = referenceTime;
    
    // Subtract the time
    switch (unit) {
      case 'h':
        date = subHours(date, amount);
        break;
      case 'd':
        date = subDays(date, amount);
        break;
      case 'm':
        date = subMinutes(date, amount);
        break;
      case 'w':
        date = subWeeks(date, amount);
        break;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }

    // Apply truncation
    switch (truncateUnit) {
      case 'h':
        return startOfHour(date);
      case 'd':
        return startOfDay(date);
      case 'm':
        return startOfMinute(date);
      case 'w':
        return startOfWeek(date, { weekStartsOn: 1 }); // Monday as start of week
      default:
        throw new Error(`Unknown truncation unit: ${truncateUnit}`);
    }
  }

  // Handle simple relative time (e.g., now-1h, now-2d, now-1w)
  const relativeMatch = expr.match(/^now-(\d+)([hdmw])$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];

    switch (unit) {
      case 'h':
        return subHours(referenceTime, amount);
      case 'd':
        return subDays(referenceTime, amount);
      case 'm':
        return subMinutes(referenceTime, amount);
      case 'w':
        return subWeeks(referenceTime, amount);
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  // Handle Unix timestamps (string or number)
  if (/^\d{9,10}$/.test(expr)) {
    // Unix timestamp in seconds
    const timestamp = parseInt(expr, 10);
    return new Date(timestamp * 1000);
  }

  // Try to parse as ISO string or other date format
  const parsedDate = new Date(expr);
  if (isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid time expression: ${expr}`);
  }
  
  return parsedDate;
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / TIME_CONSTANTS.MS_TO_S_DIVISOR);
}

export function toNanoseconds(date: Date): string {
  return `${date.getTime()}${TIME_CONSTANTS.NS_PADDING}`;
}

export function formatDate(date: Date, formatString: string = APP_CONFIG.DEFAULT_DATE_FORMAT): string {
  return format(date, formatString);
}