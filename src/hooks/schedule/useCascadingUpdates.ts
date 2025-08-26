/**
 * Custom hook for managing cascading schedule updates
 * Handles recovery time changes and their propagation
 */

import { useCallback } from 'react';
import { Trip, TimePoint } from '../../types/schedule';
import { 
  updateTripAfterRecoveryChange,
  cascadeToSubsequentTripsInBlock,
  calculateTimeShift
} from '../../domain/schedule/cascading';

interface CascadingUpdateParams {
  trips: Trip[];
  timePoints: TimePoint[];
  onUpdate: (trips: Trip[]) => void;
}

/**
 * Hook for handling cascading updates when recovery times change
 */
export function useCascadingUpdates({ 
  trips, 
  timePoints, 
  onUpdate 
}: CascadingUpdateParams) {
  
  /**
   * Handle recovery time change with cascading updates
   */
  const handleRecoveryChange = useCallback((
    tripNumber: number,
    timePointId: string,
    newRecoveryTime: number
  ) => {
    const targetTrip = trips.find(t => t.tripNumber === tripNumber);
    if (!targetTrip) return;
    
    // Update the current trip
    const updatedTrip = updateTripAfterRecoveryChange(
      targetTrip,
      timePointId,
      newRecoveryTime,
      timePoints
    );
    
    // Calculate time shift for subsequent trips
    const changedIndex = timePoints.findIndex(tp => tp.id === timePointId);
    const isLastStop = changedIndex === timePoints.length - 1 || 
                       changedIndex === targetTrip.tripEndIndex;
    
    let updatedTrips = trips.map(trip => 
      trip.tripNumber === tripNumber ? updatedTrip : trip
    );
    
    // If last stop changed, cascade to subsequent trips in block
    if (isLastStop) {
      const finalTimePointId = timePoints[timePoints.length - 1].id;
      const nextTripInBlock = trips.find(
        t => t.blockNumber === targetTrip.blockNumber && 
             t.tripNumber === tripNumber + 1
      );
      
      if (nextTripInBlock) {
        const timeShift = calculateTimeShift(
          updatedTrip,
          nextTripInBlock,
          finalTimePointId
        );
        
        updatedTrips = cascadeToSubsequentTripsInBlock(
          updatedTrips,
          targetTrip.blockNumber,
          tripNumber,
          timeShift,
          timePoints
        );
      }
    }
    
    // Sort trips and update
    updatedTrips.sort((a, b) => a.tripNumber - b.tripNumber);
    onUpdate(updatedTrips);
  }, [trips, timePoints, onUpdate]);
  
  /**
   * Batch update recovery times for multiple trips
   */
  const batchUpdateRecoveryTimes = useCallback((
    updates: Array<{ tripNumber: number; timePointId: string; recoveryTime: number }>
  ) => {
    let updatedTrips = [...trips];
    
    updates.forEach(({ tripNumber, timePointId, recoveryTime }) => {
      const targetTrip = updatedTrips.find(t => t.tripNumber === tripNumber);
      if (!targetTrip) return;
      
      const updatedTrip = updateTripAfterRecoveryChange(
        targetTrip,
        timePointId,
        recoveryTime,
        timePoints
      );
      
      updatedTrips = updatedTrips.map(trip => 
        trip.tripNumber === tripNumber ? updatedTrip : trip
      );
    });
    
    onUpdate(updatedTrips);
  }, [trips, timePoints, onUpdate]);
  
  return {
    handleRecoveryChange,
    batchUpdateRecoveryTimes
  };
}