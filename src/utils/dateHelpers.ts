/**
 * Date utility functions for formatting and displaying dates/times
 */

/**
 * Formats a date string or Date object as a readable date and time
 */
export const formatDateTime = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Formats a date string or Date object as just the date
 */
export const formatDate = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Gets a human-readable time ago string (e.g., "2 hours ago")
 */
export const getTimeAgo = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      // For older dates, just show the formatted date
      return formatDate(date);
    }
  } catch (error) {
    console.error('Error calculating time ago:', error);
    return 'Invalid date';
  }
};

/**
 * Checks if a date is today
 */
export const isToday = (dateInput: string | Date): boolean => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const today = new Date();
    
    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

/**
 * Checks if a date is within the last 24 hours
 */
export const isRecent = (dateInput: string | Date): boolean => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    return diffMs <= 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  } catch (error) {
    return false;
  }
};

/**
 * Formats a duration in milliseconds to a human-readable string
 */
export const formatDuration = (durationMs: number): string => {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
};

/**
 * Converts time string (HH:MM) to minutes since midnight
 */
export const timeToMinutes = (timeString: string): number => {
  if (!timeString || timeString === '-') {
    return 0;
  }
  
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }
  
  return hours * 60 + minutes;
};

/**
 * Converts minutes since midnight to time string (HH:MM)
 */
export const minutesToTime = (minutes: number): string => {
  if (minutes < 0) {
    return '00:00';
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Calculates trip time between first and last timepoint departures
 * Returns formatted time duration (HH:MM) or '-' if invalid
 */
export const calculateTripTime = (
  firstDepartureTime: string,
  lastDepartureTime: string
): string => {
  if (!firstDepartureTime || !lastDepartureTime || 
      firstDepartureTime === '-' || lastDepartureTime === '-') {
    return '-';
  }

  try {
    const startMinutes = timeToMinutes(firstDepartureTime);
    const endMinutes = timeToMinutes(lastDepartureTime);
    
    let durationMinutes = endMinutes - startMinutes;
    
    // Handle trips that cross midnight
    if (durationMinutes < 0) {
      durationMinutes += 24 * 60; // Add 24 hours
    }
    
    // Convert to HH:MM format
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error calculating trip time:', error);
    return '-';
  }
};