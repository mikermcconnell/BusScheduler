/**
 * Custom hook for schedule statistics
 * Memoizes expensive calculations for performance
 */

import { useMemo, useState, useEffect } from 'react';
import { Trip, TimePoint } from '../../types/schedule';
import { calculateScheduleSummary, ScheduleSummaryStats } from '../../domain/schedule/calculations';

interface Schedule {
  trips: Trip[];
  timePoints: TimePoint[];
}

/**
 * Calculate and memoize schedule statistics
 * Only recalculates when trips or timepoints change
 */
export function useScheduleStatistics(schedule: Schedule): ScheduleSummaryStats {
  return useMemo(() => {
    if (!schedule.trips || !Array.isArray(schedule.trips) || schedule.trips.length === 0) {
      return {
        totalTripTime: '0:00',
        totalTravelTime: '0:00',
        totalRecoveryTime: '0:00',
        averageRecoveryPercent: '0.0',
        tripCount: 0
      };
    }
    
    return calculateScheduleSummary(schedule.trips, schedule.timePoints);
  }, [schedule.trips, schedule.timePoints]);
}

/**
 * Hook for real-time statistics updates
 * Provides loading state while calculating
 */
export function useScheduleStatisticsWithLoading(schedule: Schedule) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [stats, setStats] = useState<ScheduleSummaryStats | null>(null);
  
  useEffect(() => {
    setIsCalculating(true);
    
    // Use setTimeout to defer calculation and show loading state
    const timer = setTimeout(() => {
      const calculated = calculateScheduleSummary(schedule.trips, schedule.timePoints);
      setStats(calculated);
      setIsCalculating(false);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [schedule.trips, schedule.timePoints]);
  
  return { stats, isCalculating };
}