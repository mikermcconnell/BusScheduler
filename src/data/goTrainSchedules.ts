/**
 * GO Train schedules for Allandale Waterfront GO Station
 * Stop Code: 7320
 * Data extracted from GO Transit Barrie Line Schedule
 */

import { GOTrainSchedule } from '../types/schedule';

/**
 * Weekday GO Train schedules at Allandale Waterfront GO
 */
export const weekdayGOTrainSchedules: GOTrainSchedule[] = [
  // Southbound trains (to Toronto)
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '06:51',
    dayTypes: ['weekday'],
    trainNumber: 'BR802',
    notes: 'Morning rush service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '07:30',
    dayTypes: ['weekday'],
    trainNumber: 'BR806',
    notes: 'Morning rush service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '08:35',
    dayTypes: ['weekday'],
    trainNumber: 'BR810',
    notes: 'Morning rush service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '17:07',
    dayTypes: ['weekday'],
    trainNumber: 'BR670',
    notes: 'Evening service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '17:30',
    dayTypes: ['weekday'],
    trainNumber: 'BR760',
    notes: 'Evening service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '18:00',
    dayTypes: ['weekday'],
    trainNumber: 'BR770',
    notes: 'Evening service with hold for bus connection'
  },

  // Northbound trains (from Toronto)
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '07:38',
    dayTypes: ['weekday'],
    trainNumber: 'BR805',
    notes: 'Morning arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '08:55',
    dayTypes: ['weekday'],
    trainNumber: 'BR809',
    notes: 'Morning arrival - Georgian College 9am classes'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '09:43',
    dayTypes: ['weekday'],
    trainNumber: 'BR811',
    notes: 'Morning arrival - Georgian College 10am classes'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '18:40',
    dayTypes: ['weekday'],
    trainNumber: 'BR680',
    notes: 'Evening rush arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '19:23',
    dayTypes: ['weekday'],
    trainNumber: 'BR825',
    notes: 'Evening rush arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '20:23',
    dayTypes: ['weekday'],
    trainNumber: 'BR831',
    notes: 'Evening arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '21:23',
    dayTypes: ['weekday'],
    trainNumber: 'BR835',
    notes: 'Late evening arrival'
  }
];

/**
 * Weekend GO Train schedules at Allandale Waterfront GO
 */
export const weekendGOTrainSchedules: GOTrainSchedule[] = [
  // Saturday/Sunday Southbound
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '07:09',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR808',
    notes: 'Weekend morning service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '09:10',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR814',
    notes: 'Weekend morning service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '12:10',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR680',
    notes: 'Weekend midday service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '15:10',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR640',
    notes: 'Weekend afternoon service'
  },
  {
    direction: 'southbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    departureTime: '18:10',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR790',
    notes: 'Weekend evening service'
  },

  // Saturday/Sunday Northbound
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '10:23',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR311',
    notes: 'Weekend morning arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '13:23',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR317',
    notes: 'Weekend afternoon arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '16:23',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR325',
    notes: 'Weekend afternoon arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '19:23',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR327',
    notes: 'Weekend evening arrival'
  },
  {
    direction: 'northbound',
    stopCode: '7320',
    stationName: 'Allandale Waterfront GO',
    arrivalTime: '22:31',
    dayTypes: ['saturday', 'sunday'],
    trainNumber: 'BR337',
    notes: 'Weekend late evening arrival'
  }
];

/**
 * Georgian College class schedule times
 */
export const georgianCollegeBellTimes = {
  classStart: ['08:00', '09:00', '10:00', '11:00', '13:00'],
  classEnd: ['12:50', '13:50', '14:50', '15:50', '16:50', '17:50']
};

/**
 * Get all GO Train schedules for a specific day type
 */
export function getGOTrainSchedulesByDay(dayType: 'weekday' | 'saturday' | 'sunday'): GOTrainSchedule[] {
  const allSchedules = [...weekdayGOTrainSchedules, ...weekendGOTrainSchedules];
  return allSchedules.filter(schedule => schedule.dayTypes.includes(dayType));
}

/**
 * Get GO Train schedules within a time range
 */
export function getGOTrainSchedulesInTimeRange(
  startTime: string,
  endTime: string,
  dayType: 'weekday' | 'saturday' | 'sunday'
): GOTrainSchedule[] {
  const daySchedules = getGOTrainSchedulesByDay(dayType);
  return daySchedules.filter(schedule => {
    const time = schedule.departureTime || schedule.arrivalTime;
    if (!time) return false;
    return time >= startTime && time <= endTime;
  });
}

/**
 * Get next GO Train from current time
 */
export function getNextGOTrain(
  currentTime: string,
  direction: 'northbound' | 'southbound',
  dayType: 'weekday' | 'saturday' | 'sunday'
): GOTrainSchedule | null {
  const daySchedules = getGOTrainSchedulesByDay(dayType);
  const directionSchedules = daySchedules.filter(s => s.direction === direction);
  
  for (const schedule of directionSchedules) {
    const time = schedule.departureTime || schedule.arrivalTime;
    if (time && time > currentTime) {
      return schedule;
    }
  }
  
  return null;
}