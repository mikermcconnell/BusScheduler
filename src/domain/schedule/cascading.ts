/**
 * Domain logic for cascading schedule updates
 * Handles recovery time changes and their propagation
 */

import { Trip, TimePoint } from '../../types/schedule';

/**
 * Update subsequent stops within a trip when recovery time changes
 */
export function updateTripAfterRecoveryChange(
  trip: Trip,
  changedTimePointId: string,
  newRecoveryTime: number,
  timePoints: TimePoint[]
): Trip {
  const oldRecoveryTime = trip.recoveryTimes[changedTimePointId] || 0;
  const recoveryDifference = newRecoveryTime - oldRecoveryTime;
  
  if (recoveryDifference === 0) return trip;
  
  const updatedTrip = { ...trip };
  const changedIndex = timePoints.findIndex(tp => tp.id === changedTimePointId);
  
  // Update recovery time for the changed stop
  updatedTrip.recoveryTimes = {
    ...trip.recoveryTimes,
    [changedTimePointId]: newRecoveryTime
  };
  
  // Update departure time for the changed stop
  if (updatedTrip.arrivalTimes[changedTimePointId]) {
    updatedTrip.departureTimes = {
      ...updatedTrip.departureTimes,
      [changedTimePointId]: addMinutesToTime(
        updatedTrip.arrivalTimes[changedTimePointId],
        newRecoveryTime
      )
    };
  }
  
  // Cascade to subsequent stops in the same trip
  for (let i = changedIndex + 1; i < timePoints.length; i++) {
    const tp = timePoints[i];
    
    // Skip if trip ends before this point
    if (trip.tripEndIndex !== undefined && i > trip.tripEndIndex) break;
    
    // Shift arrival and departure times
    if (updatedTrip.arrivalTimes[tp.id]) {
      updatedTrip.arrivalTimes[tp.id] = addMinutesToTime(
        trip.arrivalTimes[tp.id],
        recoveryDifference
      );
    }
    
    if (updatedTrip.departureTimes[tp.id]) {
      updatedTrip.departureTimes[tp.id] = addMinutesToTime(
        trip.departureTimes[tp.id],
        recoveryDifference
      );
    }
  }
  
  return updatedTrip;
}

/**
 * Update all subsequent trips in a block after a recovery change
 */
export function cascadeToSubsequentTripsInBlock(
  trips: Trip[],
  blockNumber: number,
  startingTripNumber: number,
  timeDifference: number,
  timePoints: TimePoint[]
): Trip[] {
  return trips.map(trip => {
    // Only update trips in the same block that come after the changed trip
    if (trip.blockNumber !== blockNumber || trip.tripNumber <= startingTripNumber) {
      return trip;
    }
    
    // Shift all times for this trip
    const updatedTrip = { ...trip };
    
    // Update departure time (start of trip)
    updatedTrip.departureTime = addMinutesToTime(trip.departureTime, timeDifference);
    
    // Update all arrival and departure times
    timePoints.forEach(tp => {
      if (updatedTrip.arrivalTimes[tp.id]) {
        updatedTrip.arrivalTimes[tp.id] = addMinutesToTime(
          trip.arrivalTimes[tp.id],
          timeDifference
        );
      }
      
      if (updatedTrip.departureTimes[tp.id]) {
        updatedTrip.departureTimes[tp.id] = addMinutesToTime(
          trip.departureTimes[tp.id],
          timeDifference
        );
      }
    });
    
    return updatedTrip;
  });
}

/**
 * Calculate the time shift needed for subsequent trips
 */
export function calculateTimeShift(
  previousTrip: Trip,
  currentTrip: Trip,
  finalTimePointId: string
): number {
  const prevTripFinalDeparture = previousTrip.departureTimes[finalTimePointId] || 
    addMinutesToTime(
      previousTrip.arrivalTimes[finalTimePointId],
      previousTrip.recoveryTimes[finalTimePointId] || 0
    );
  
  const currentTripStart = currentTrip.departureTime;
  
  return timeStringToMinutes(prevTripFinalDeparture) - timeStringToMinutes(currentTripStart);
}

/**
 * Helper function to convert time string to minutes
 */
function timeStringToMinutes(time: string): number {
  if (!time || !time.includes(':')) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Helper function to add minutes to time string
 */
function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = timeStringToMinutes(time) + minutes;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}