/**
 * Branded types for enhanced type safety
 * Prevents mixing up similar primitive types
 */

/**
 * Minutes as a branded number type
 * Ensures minute values aren't confused with other numbers
 */
export type Minutes = number & { __brand: 'Minutes' };

/**
 * Time string in HH:MM format
 * Ensures proper time string format
 */
export type TimeString = string & { __brand: 'TimeString' };

/**
 * Trip number as a branded type
 * Prevents confusion with other numeric IDs
 */
export type TripNumber = number & { __brand: 'TripNumber' };

/**
 * Block number as a branded type
 */
export type BlockNumber = number & { __brand: 'BlockNumber' };

/**
 * Percentage value (0-100)
 */
export type Percentage = number & { __brand: 'Percentage' };

/**
 * Type guards for branded types
 */
export function isTimeString(value: string): value is TimeString {
  return /^\d{1,2}:\d{2}$/.test(value);
}

export function isMinutes(value: number): value is Minutes {
  return Number.isInteger(value) && value >= 0;
}

export function isPercentage(value: number): value is Percentage {
  return value >= 0 && value <= 100;
}

/**
 * Conversion functions with validation
 */
export function toMinutes(value: number): Minutes {
  if (!isMinutes(value)) {
    throw new Error(`Invalid minutes value: ${value}`);
  }
  return value as Minutes;
}

export function toTimeString(value: string): TimeString {
  if (!isTimeString(value)) {
    throw new Error(`Invalid time string format: ${value}`);
  }
  return value as TimeString;
}

export function toPercentage(value: number): Percentage {
  if (!isPercentage(value)) {
    throw new Error(`Invalid percentage value: ${value}`);
  }
  return value as Percentage;
}

export function toTripNumber(value: number): TripNumber {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid trip number: ${value}`);
  }
  return value as TripNumber;
}

export function toBlockNumber(value: number): BlockNumber {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid block number: ${value}`);
  }
  return value as BlockNumber;
}

/**
 * Safe arithmetic operations for branded types
 */
export function addMinutes(a: Minutes, b: Minutes): Minutes {
  return toMinutes(a + b);
}

export function subtractMinutes(a: Minutes, b: Minutes): Minutes {
  return toMinutes(Math.max(0, a - b));
}

export function minutesToHours(minutes: Minutes): number {
  return minutes / 60;
}

/**
 * Time string operations
 */
export function addMinutesToTimeString(time: TimeString, minutes: Minutes): TimeString {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24; // Handle day wraparound
  const newMins = totalMinutes % 60;
  return toTimeString(`${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`);
}

export function timeStringToMinutes(time: TimeString): Minutes {
  const [hours, minutes] = time.split(':').map(Number);
  return toMinutes(hours * 60 + minutes);
}

export function minutesToTimeString(minutes: Minutes): TimeString {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return toTimeString(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
}