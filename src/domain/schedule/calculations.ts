/**
 * Domain logic for schedule calculations
 * Pure functions for trip time, recovery percentage, and other metrics
 */

import { Trip, TimePoint } from '../../types/schedule';

/**
 * Calculate total trip time from first departure to last departure
 */
export function calculateTripTime(
  trip: Trip,
  timePoints: TimePoint[]
): number {
  const firstTimepointId = timePoints[0]?.id;
  const lastActiveIndex = trip.tripEndIndex !== undefined 
    ? trip.tripEndIndex 
    : timePoints.length - 1;
  const lastActiveTimepointId = timePoints[lastActiveIndex]?.id;
  
  const firstDepartureTime = firstTimepointId 
    ? (trip.departureTimes[firstTimepointId] || trip.arrivalTimes[firstTimepointId]) 
    : '';
  const lastDepartureTime = lastActiveTimepointId 
    ? (trip.departureTimes[lastActiveTimepointId] || trip.arrivalTimes[lastActiveTimepointId]) 
    : '';
  
  if (!firstDepartureTime || !lastDepartureTime) return 0;
  
  return timeStringToMinutes(lastDepartureTime) - timeStringToMinutes(firstDepartureTime);
}

/**
 * Calculate total recovery time for a trip
 */
export function calculateTripRecoveryTime(
  trip: Trip,
  timePoints: TimePoint[]
): number {
  if (!trip.recoveryTimes) return 0;
  
  let totalRecovery = 0;
  timePoints.forEach((tp, index) => {
    if (trip.tripEndIndex === undefined || index <= trip.tripEndIndex) {
      totalRecovery += trip.recoveryTimes[tp.id] || 0;
    }
  });
  
  return totalRecovery;
}

/**
 * Calculate travel time (trip time minus recovery time)
 */
export function calculateTravelTime(tripTime: number, recoveryTime: number): number {
  return Math.max(0, tripTime - recoveryTime);
}

/**
 * Calculate recovery percentage
 * Formula: (Recovery Time / Travel Time) * 100
 */
export function calculateRecoveryPercentage(
  recoveryTime: number,
  travelTime: number
): number {
  if (travelTime === 0) return 0;
  return (recoveryTime / travelTime) * 100;
}

/**
 * Format minutes to hours:minutes string
 */
export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
}

/**
 * Convert time string (HH:MM) to minutes
 */
export function timeStringToMinutes(time: string): number {
  if (!time || !time.includes(':')) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string (HH:MM)
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = timeStringToMinutes(time) + minutes;
  return minutesToTimeString(totalMinutes);
}

/**
 * Calculate summary statistics for all trips
 */
export interface ScheduleSummaryStats {
  totalTripTime: string;
  totalTravelTime: string;
  totalRecoveryTime: string;
  averageRecoveryPercent: string;
  tripCount: number;
}

export function calculateScheduleSummary(
  trips: Trip[],
  timePoints: TimePoint[]
): ScheduleSummaryStats {
  let totalTripMinutes = 0;
  let totalRecoveryMinutes = 0;
  let totalTravelMinutes = 0;
  let validTripCount = 0;

  trips.forEach(trip => {
    const isActive = trip.tripEndIndex === undefined || trip.tripEndIndex !== undefined;
    
    if (isActive) {
      const tripTime = calculateTripTime(trip, timePoints);
      const recoveryTime = calculateTripRecoveryTime(trip, timePoints);
      const travelTime = calculateTravelTime(tripTime, recoveryTime);
      
      if (tripTime > 0) {
        totalTripMinutes += tripTime;
        totalRecoveryMinutes += recoveryTime;
        totalTravelMinutes += travelTime;
        validTripCount++;
      }
    }
  });

  const averageRecoveryPercent = calculateRecoveryPercentage(
    totalRecoveryMinutes,
    totalTravelMinutes
  );

  return {
    totalTripTime: formatMinutesToHours(totalTripMinutes),
    totalTravelTime: formatMinutesToHours(totalTravelMinutes),
    totalRecoveryTime: formatMinutesToHours(totalRecoveryMinutes),
    averageRecoveryPercent: averageRecoveryPercent.toFixed(1),
    tripCount: validTripCount
  };
}