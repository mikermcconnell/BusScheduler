import { ServiceBand, TimePointData } from '../types/schedule';

/**
 * Determines which service band a given time falls into
 */
export const getServiceBandForTime = (
  timeStr: string,
  serviceBands: ServiceBand[]
): ServiceBand | null => {
  const timeMinutes = timeToMinutes(timeStr);
  
  for (const band of serviceBands) {
    if (!band.startTime || !band.endTime) continue;
    const startMinutes = timeToMinutes(band.startTime);
    const endMinutes = timeToMinutes(band.endTime);
    
    // Handle time ranges that cross midnight
    if (startMinutes <= endMinutes) {
      // Normal range (e.g., 06:00 - 22:00)
      if (timeMinutes >= startMinutes && timeMinutes <= endMinutes) {
        return band;
      }
    } else {
      // Range crosses midnight (e.g., 22:00 - 06:00)
      if (timeMinutes >= startMinutes || timeMinutes <= endMinutes) {
        return band;
      }
    }
  }
  
  return null;
};

/**
 * Gets travel time data filtered by time periods that belong to a specific service band
 */
export const getTravelTimeDataForServiceBand = (
  travelTimeData: TimePointData[],
  serviceBands: ServiceBand[],
  serviceBandId: string
): TimePointData[] => {
  const serviceBand = serviceBands.find(band => band.id === serviceBandId);
  if (!serviceBand) return [];

  return travelTimeData.filter(data => {
    // Extract start time from time period (e.g., "07:00 - 07:29" -> "07:00")
    const periodStartTime = data.timePeriod.split(' - ')[0];
    const matchingBand = getServiceBandForTime(periodStartTime, serviceBands);
    return matchingBand?.id === serviceBandId;
  });
};

/**
 * Calculates average travel time between two timepoints for a specific service band
 */
export const getAverageTravelTimeForServiceBand = (
  fromTimePoint: string,
  toTimePoint: string,
  travelTimeData: TimePointData[],
  serviceBands: ServiceBand[],
  serviceBandId: string,
  usePercentile80: boolean = false
): number => {
  const serviceBandData = getTravelTimeDataForServiceBand(travelTimeData, serviceBands, serviceBandId);
  
  // Find matching segments
  const matchingSegments = serviceBandData.filter(data =>
    data.fromTimePoint === fromTimePoint && data.toTimePoint === toTimePoint
  );
  
  if (matchingSegments.length === 0) {
    // Return a default travel time if no data available
    return 10; // 10 minutes default
  }
  
  // Calculate average travel time
  const travelTimes = matchingSegments.map(segment => 
    usePercentile80 ? segment.percentile80 : segment.percentile50
  );
  
  const average = travelTimes.reduce((sum, time) => sum + time, 0) / travelTimes.length;
  return Math.round(average);
};

/**
 * Creates service bands from travel time data using percentile-based distribution
 */
export const createServiceBandsFromData = (
  travelTimeData: TimePointData[]
): ServiceBand[] => {
  if (travelTimeData.length === 0) return [];

  // Group data by time period and calculate total travel times
  const timePeriodsMap = new Map<string, number>();
  travelTimeData.forEach(row => {
    const currentSum = timePeriodsMap.get(row.timePeriod) || 0;
    timePeriodsMap.set(row.timePeriod, currentSum + row.percentile50);
  });

  // Convert to array and sort by travel time
  const sortedPeriods = Array.from(timePeriodsMap.entries())
    .map(([timePeriod, totalTravelTime]) => ({
      timePeriod,
      totalTravelTime: Math.round(totalTravelTime)
    }))
    .sort((a, b) => a.totalTravelTime - b.totalTravelTime);

  if (sortedPeriods.length === 0) return [];

  // Calculate percentile-based bands from travel time distribution
  const travelTimes = sortedPeriods.map(p => p.totalTravelTime);
  const bands: ServiceBand[] = [];
  const bandNames = ['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'];
  const bandColors = ['#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#F44336'];

  // Define percentile ranges for each band
  const percentileRanges = [
    { min: 0, max: 20 },     // Very Fast Service: 0-20th percentile
    { min: 20, max: 40 },    // Fast Service: 20-40th percentile  
    { min: 40, max: 60 },    // Standard Service: 40-60th percentile
    { min: 60, max: 80 },    // Slow Service: 60-80th percentile
    { min: 80, max: 100 }    // Very Slow Service: 80-100th percentile
  ];

  for (let i = 0; i < 5; i++) {
    const range = percentileRanges[i];
    const minThreshold = getPercentile(travelTimes, range.min);
    const maxThreshold = getPercentile(travelTimes, range.max);
    
    // Find periods that fall within this percentile range
    const bandPeriods = sortedPeriods.filter(p => 
      p.totalTravelTime >= minThreshold && 
      (i === 4 ? p.totalTravelTime <= maxThreshold : p.totalTravelTime < maxThreshold)
    );
    
    if (bandPeriods.length === 0) continue;

    // Find time range for this band
    const allTimes = bandPeriods.map(p => p.timePeriod);
    const startTimes = allTimes.map(t => t.split(' - ')[0]);
    const endTimes = allTimes.map(t => t.split(' - ')[1]);
    
    // Find earliest start and latest end
    const earliestStart = startTimes.sort()[0];
    const latestEnd = endTimes.sort()[endTimes.length - 1];

    bands.push({
      id: `band_${i + 1}`,
      name: bandNames[i],
      startTime: earliestStart,
      endTime: latestEnd,
      travelTimeMultiplier: 1.0,
      color: bandColors[i],
      description: `${bandPeriods.length} time periods`
    });
  }

  return bands;
};

/**
 * Converts time string (HH:MM) to minutes since midnight
 */
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Calculates percentile value from an array of numbers
 */
const getPercentile = (arr: number[], percentile: number): number => {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

/**
 * Validates if a time string is in valid HH:MM format
 */
export const isValidTimeFormat = (timeStr: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
};

/**
 * Formats minutes to HH:MM string
 */
export const minutesToTimeString = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Calculates the duration between two time points in minutes
 */
export const calculateTimeDifference = (startTime: string, endTime: string): number => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // Handle times that cross midnight
  if (endMinutes < startMinutes) {
    return (24 * 60) - startMinutes + endMinutes;
  }
  
  return endMinutes - startMinutes;
};