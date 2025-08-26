/**
 * Development seed data generators
 * Use these to quickly create test schedules for development
 */

import { Trip, TimePoint, ServiceBand, Schedule } from '../types/schedule';

/**
 * Generate test timepoints
 */
export function generateTimePoints(count: number = 5): TimePoint[] {
  const timePointNames = [
    'Downtown Terminal',
    'Johnson at Napier',
    'RVH Entrance',
    'Georgian College',
    'Georgian Mall',
    'Bayfield Mall',
    'North Terminal',
    'East Station',
    'West Plaza',
    'South Hub'
  ];
  
  return Array.from({ length: Math.min(count, timePointNames.length) }, (_, i) => ({
    id: `tp_${i + 1}`,
    name: timePointNames[i],
    sequence: i + 1
  }));
}

/**
 * Generate service bands
 */
export function generateServiceBands(): ServiceBand[] {
  return [
    {
      name: 'Fastest Service',
      color: '#10b981',
      totalMinutes: 35,
      segmentTimes: [6, 5, 7, 6, 5, 6]
    },
    {
      name: 'Fast Service',
      color: '#34d399',
      totalMinutes: 38,
      segmentTimes: [7, 6, 7, 6, 6, 6]
    },
    {
      name: 'Standard Service',
      color: '#fb923c',
      totalMinutes: 40,
      segmentTimes: [7, 7, 8, 7, 6, 5]
    },
    {
      name: 'Slow Service',
      color: '#f97316',
      totalMinutes: 42,
      segmentTimes: [8, 7, 8, 7, 7, 5]
    },
    {
      name: 'Slowest Service',
      color: '#ef4444',
      totalMinutes: 45,
      segmentTimes: [8, 8, 9, 8, 7, 5]
    }
  ];
}

/**
 * Generate a single trip
 */
export function generateTrip(
  tripNumber: number,
  blockNumber: number,
  startTime: string,
  timePoints: TimePoint[],
  serviceBand: ServiceBand
): Trip {
  const trip: Trip = {
    tripNumber,
    blockNumber,
    departureTime: startTime,
    serviceBand: serviceBand.name,
    serviceBandInfo: {
      name: serviceBand.name,
      color: serviceBand.color,
      totalMinutes: serviceBand.totalMinutes
    },
    arrivalTimes: {},
    departureTimes: {},
    recoveryTimes: {},
    recoveryMinutes: 0
  };
  
  let currentTime = timeStringToMinutes(startTime);
  const recoveryTemplate = [0, 1, 1, 2, 3]; // Default recovery times
  
  timePoints.forEach((tp, index) => {
    if (index === 0) {
      // First stop - only departure
      trip.departureTimes[tp.id] = startTime;
      trip.recoveryTimes[tp.id] = recoveryTemplate[index] || 0;
    } else {
      // Add travel time
      const travelTime = serviceBand.segmentTimes[index - 1] || 6;
      currentTime += travelTime;
      trip.arrivalTimes[tp.id] = minutesToTime(currentTime);
      
      // Add recovery time
      const recoveryTime = recoveryTemplate[index] || 0;
      trip.recoveryTimes[tp.id] = recoveryTime;
      trip.departureTimes[tp.id] = minutesToTime(currentTime + recoveryTime);
      currentTime += recoveryTime;
    }
  });
  
  trip.recoveryMinutes = recoveryTemplate.reduce((sum, r) => sum + r, 0);
  
  return trip;
}

/**
 * Generate a complete test schedule
 */
export function generateTestSchedule(
  tripCount: number = 50,
  timePointCount: number = 5,
  blocksCount: number = 5
): Schedule {
  const timePoints = generateTimePoints(timePointCount);
  const serviceBands = generateServiceBands();
  const trips: Trip[] = [];
  
  const tripsPerBlock = Math.ceil(tripCount / blocksCount);
  let tripNumber = 1;
  
  for (let blockNum = 1; blockNum <= blocksCount; blockNum++) {
    let blockStartTime = addMinutes('07:00', (blockNum - 1) * 10); // Stagger block starts
    
    for (let i = 0; i < tripsPerBlock && tripNumber <= tripCount; i++) {
      // Determine service band based on time of day
      const hour = parseInt(blockStartTime.split(':')[0]);
      let serviceBand: ServiceBand;
      
      if (hour < 7) {
        serviceBand = serviceBands[0]; // Fastest
      } else if (hour < 9) {
        serviceBand = serviceBands[2]; // Standard (morning rush)
      } else if (hour < 15) {
        serviceBand = serviceBands[1]; // Fast (midday)
      } else if (hour < 18) {
        serviceBand = serviceBands[3]; // Slow (afternoon rush)
      } else {
        serviceBand = serviceBands[1]; // Fast (evening)
      }
      
      const trip = generateTrip(
        tripNumber,
        blockNum,
        blockStartTime,
        timePoints,
        serviceBand
      );
      
      trips.push(trip);
      
      // Next trip starts after cycle time
      const cycleTime = serviceBand.totalMinutes + trip.recoveryMinutes;
      blockStartTime = addMinutes(blockStartTime, cycleTime);
      tripNumber++;
    }
  }
  
  return {
    id: `test_schedule_${Date.now()}`,
    name: `Test Schedule (${tripCount} trips)`,
    routeId: 'test_route',
    routeName: 'Test Route',
    direction: 'Outbound',
    dayType: 'weekday',
    timePoints,
    serviceBands,
    trips,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Generate edge case schedules
 */
export const edgeCaseSchedules = {
  // Single trip schedule
  singleTrip: () => generateTestSchedule(1, 5, 1),
  
  // All trips in one block
  singleBlock: () => generateTestSchedule(20, 5, 1),
  
  // Each trip in its own block
  manyBlocks: () => generateTestSchedule(20, 5, 20),
  
  // Large schedule
  largeSchedule: () => generateTestSchedule(500, 10, 50),
  
  // Very large schedule (performance test)
  veryLargeSchedule: () => generateTestSchedule(1000, 15, 100),
  
  // Schedule with many timepoints
  manyTimepoints: () => generateTestSchedule(50, 20, 5),
  
  // Early morning schedule
  earlyMorning: () => {
    const schedule = generateTestSchedule(10, 5, 2);
    schedule.trips = schedule.trips.map(trip => ({
      ...trip,
      departureTime: addMinutes('05:00', trip.tripNumber * 15)
    }));
    return schedule;
  },
  
  // Late night schedule (crossing midnight)
  lateNight: () => {
    const schedule = generateTestSchedule(10, 5, 2);
    schedule.trips = schedule.trips.map(trip => ({
      ...trip,
      departureTime: addMinutes('23:00', trip.tripNumber * 15)
    }));
    return schedule;
  }
};

// Helper functions
function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function addMinutes(time: string, minutes: number): string {
  const totalMinutes = timeStringToMinutes(time) + minutes;
  return minutesToTime(totalMinutes);
}

/**
 * Console helper to generate and log test data
 */
export function logTestSchedule(tripCount: number = 10) {
  const schedule = generateTestSchedule(tripCount);
  console.log('Generated Test Schedule:', schedule);
  console.log('Trip Count:', schedule.trips.length);
  console.log('TimePoints:', schedule.timePoints.length);
  console.log('Service Bands:', schedule.serviceBands.length);
  console.log('First Trip:', schedule.trips[0]);
  console.log('Last Trip:', schedule.trips[schedule.trips.length - 1]);
  return schedule;
}

// Make available in development console
if (process.env.NODE_ENV === 'development') {
  (window as any).testSeeds = {
    generateTestSchedule,
    generateTimePoints,
    generateServiceBands,
    generateTrip,
    edgeCaseSchedules,
    logTestSchedule
  };
  console.log('Test seeds available at window.testSeeds');
}