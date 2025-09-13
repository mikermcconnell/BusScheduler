/**
 * Time Utilities
 * Helper functions for time manipulation and calculations
 */

/**
 * Convert time string (HH:MM or H:MM) to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0;
  }

  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) {
    return 0;
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }

  // Handle 24+ hours (next day)
  return (hours % 24) * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:MM format)
 */
export function minutesToTime(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return '00:00';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);

  // Handle overflow past 24 hours
  const displayHours = hours % 24;

  return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Add minutes to a time string
 */
export function addMinutes(timeStr: string, minutesToAdd: number): string {
  const currentMinutes = timeToMinutes(timeStr);
  const newMinutes = currentMinutes + minutesToAdd;
  return minutesToTime(newMinutes);
}

/**
 * Subtract minutes from a time string
 */
export function subtractMinutes(timeStr: string, minutesToSubtract: number): string {
  return addMinutes(timeStr, -minutesToSubtract);
}

/**
 * Calculate difference between two times in minutes
 */
export function timeDifference(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  let diff = endMinutes - startMinutes;
  
  // Handle next day scenarios
  if (diff < 0) {
    diff += 24 * 60; // Add 24 hours
  }
  
  return diff;
}

/**
 * Check if a time is within a time range
 */
export function isTimeInRange(time: string, startTime: string, endTime: string): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  if (startMinutes <= endMinutes) {
    // Same day range
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  } else {
    // Range crosses midnight
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  }
}

/**
 * Format time string to ensure consistent format
 */
export function formatTime(timeStr: string): string {
  const minutes = timeToMinutes(timeStr);
  return minutesToTime(minutes);
}

/**
 * Get current time as string in HH:MM format
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Parse time string with validation
 */
export function parseTime(timeStr: string): { hours: number; minutes: number; isValid: boolean } {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hours: 0, minutes: 0, isValid: false };
  }

  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) {
    return { hours: 0, minutes: 0, isValid: false };
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  const isValid = !isNaN(hours) && !isNaN(minutes) && 
                  hours >= 0 && hours < 24 && 
                  minutes >= 0 && minutes < 60;

  return { hours: hours || 0, minutes: minutes || 0, isValid };
}

/**
 * Round time to nearest interval (e.g., round to nearest 5 minutes)
 */
export function roundTimeToInterval(timeStr: string, intervalMinutes: number): string {
  const totalMinutes = timeToMinutes(timeStr);
  const rounded = Math.round(totalMinutes / intervalMinutes) * intervalMinutes;
  return minutesToTime(rounded);
}

/**
 * Get time period label (e.g., "Morning Peak", "Midday", etc.)
 */
export function getTimePeriodLabel(timeStr: string): string {
  const minutes = timeToMinutes(timeStr);
  const hour = Math.floor(minutes / 60);
  
  if (hour >= 6 && hour < 9) {
    return 'Morning Peak';
  } else if (hour >= 9 && hour < 15) {
    return 'Midday';
  } else if (hour >= 15 && hour < 18) {
    return 'Afternoon Peak';
  } else if (hour >= 18 && hour < 22) {
    return 'Evening';
  } else {
    return 'Late Night/Early Morning';
  }
}

/**
 * Calculate average time from array of time strings
 */
export function averageTime(times: string[]): string {
  if (!times || times.length === 0) {
    return '00:00';
  }

  const totalMinutes = times.reduce((sum, time) => sum + timeToMinutes(time), 0);
  const averageMinutes = totalMinutes / times.length;
  
  return minutesToTime(averageMinutes);
}

/**
 * Sort array of time strings
 */
export function sortTimes(times: string[], ascending: boolean = true): string[] {
  return [...times].sort((a, b) => {
    const aMinutes = timeToMinutes(a);
    const bMinutes = timeToMinutes(b);
    return ascending ? aMinutes - bMinutes : bMinutes - aMinutes;
  });
}

/**
 * Validate time string format
 */
export function isValidTimeFormat(timeStr: string): boolean {
  if (!timeStr || typeof timeStr !== 'string') {
    return false;
  }

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr.trim());
}

/**
 * Convert 12-hour format to 24-hour format
 */
export function convertTo24Hour(time12h: string): string {
  if (!time12h) return '00:00';

  const timePattern = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  const match = time12h.trim().match(timePattern);

  if (!match) {
    // Assume already 24-hour format
    return formatTime(time12h);
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'AM') {
    if (hours === 12) hours = 0;
  } else {
    if (hours !== 12) hours += 12;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert 24-hour format to 12-hour format
 */
export function convertTo12Hour(time24h: string): string {
  const parsed = parseTime(time24h);
  if (!parsed.isValid) return '12:00 AM';

  let hours = parsed.hours;
  const minutes = parsed.minutes;
  const period = hours >= 12 ? 'PM' : 'AM';

  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours -= 12;
  }

  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Get time zone offset in minutes
 */
export function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Convert time to different timezone (simplified)
 */
export function convertTimezone(timeStr: string, offsetMinutes: number): string {
  const totalMinutes = timeToMinutes(timeStr) + offsetMinutes;
  return minutesToTime(totalMinutes);
}