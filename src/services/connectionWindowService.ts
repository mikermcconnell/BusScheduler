/**
 * Connection Window Service
 * Calculates connection windows, opportunities, and satisfaction levels for different service types
 * Enhanced with core connection window calculation functionality
 */

import {
  ConnectionOpportunity,
  ConnectionWindow,
  GeorgianCollegeConfig,
  GOTrainConfig,
  HighSchoolConfig
} from '../types/connectionOptimization';
import { ConnectionType, Schedule, Trip } from '../types/schedule';
import { timeToMinutes, minutesToTime, addMinutes, timeDifference } from '../utils/timeUtils';

/**
 * Connection window calculation result
 */
export interface ConnectionWindowResult {
  /** Time gap between bus and connection in minutes (positive = bus arrives first) */
  timeGapMinutes: number;
  /** Connection satisfaction classification */
  classification: 'ideal' | 'partial' | 'missed';
  /** Connection score (0-1, higher is better) */
  score: number;
  /** Whether connection requirements are satisfied */
  isSatisfied: boolean;
  /** Recommended time adjustment in minutes (positive = later, negative = earlier) */
  recommendedAdjustment?: number;
  /** Additional details about the connection calculation */
  details: {
    /** Bus time at connection point */
    busTime: string;
    /** Target connection time */
    connectionTime: string;
    /** Connection type analyzed */
    connectionType: ConnectionType;
    /** Whether this is an arrival or departure connection */
    scenario: 'arrival' | 'departure';
    /** Applied connection window thresholds */
    appliedWindow: ConnectionWindow;
  };
}

/**
 * Bulk connection analysis result
 */
export interface BulkConnectionAnalysis {
  /** Overall connection success rate (0-1) */
  successRate: number;
  /** Average connection score across all connections */
  averageScore: number;
  /** Individual connection results */
  connections: ConnectionWindowResult[];
  /** Summary by connection type */
  summaryByType: Map<ConnectionType, {
    total: number;
    ideal: number;
    partial: number;
    missed: number;
    averageScore: number;
  }>;
  /** Optimization recommendations */
  recommendations: string[];
}

/**
 * Pre-defined connection windows for different service types
 * Updated with requirements-specific thresholds
 */
const DEFAULT_CONNECTION_WINDOWS: Map<ConnectionType, ConnectionWindow> = new Map([
  [ConnectionType.BUS_ROUTE, {
    type: ConnectionType.BUS_ROUTE,
    ideal: { min: 3, max: 8 },
    partial: { min: 1, max: 12 },
    multipliers: { ideal: 1.0, partial: 0.7, missed: 0.0 }
  }],
  [ConnectionType.GO_TRAIN, {
    type: ConnectionType.GO_TRAIN,
    ideal: { min: 10, max: 15 },
    partial: { min: 5, max: 10 }, // Updated: 5-10 partial, >15 missed
    multipliers: { ideal: 1.0, partial: 0.6, missed: 0.0 }
  }],
  [ConnectionType.SCHOOL_BELL, {
    type: ConnectionType.SCHOOL_BELL,
    ideal: { min: 10, max: 15 }, // 10-15 min before bell ideal
    partial: { min: 5, max: 10 }, // 5-10 partial 
    multipliers: { ideal: 1.0, partial: 0.5, missed: 0.0 }
  }]
]);

/**
 * Georgian College specific connection windows
 * 10-15 min ideal, 5-20 partial, >20 missed
 */
const GEORGIAN_COLLEGE_WINDOWS: ConnectionWindow = {
  type: ConnectionType.SCHOOL_BELL,
  ideal: { min: 10, max: 15 },
  partial: { min: 5, max: 20 },
  multipliers: { ideal: 1.0, partial: 0.5, missed: 0.0 }
};

/**
 * Connection Window Service for analyzing and calculating connection opportunities
 */
export class ConnectionWindowService {
  private connectionWindows: Map<ConnectionType, ConnectionWindow>;
  private georgianConfig?: GeorgianCollegeConfig;
  private goTrainConfig?: GOTrainConfig;
  private highSchoolConfig?: HighSchoolConfig;

  constructor() {
    this.connectionWindows = new Map(DEFAULT_CONNECTION_WINDOWS);
  }

  /**
   * Configure connection windows for specific service types
   */
  configureConnectionWindows(windows: Map<ConnectionType, ConnectionWindow>): void {
    windows.forEach((window, type) => {
      this.connectionWindows.set(type, window);
    });
  }

  /**
   * Configure Georgian College specific settings
   */
  configureGeorgianCollege(config: GeorgianCollegeConfig): void {
    this.georgianConfig = config;
  }

  /**
   * Configure GO Train specific settings
   */
  configureGOTrain(config: GOTrainConfig): void {
    this.goTrainConfig = config;
  }

  /**
   * Configure High School specific settings
   */
  configureHighSchool(config: HighSchoolConfig): void {
    this.highSchoolConfig = config;
  }

  /**
   * Analyze all connection opportunities in a schedule
   */
  analyzeConnectionOpportunities(
    schedule: Schedule,
    targetDate: Date = new Date()
  ): ConnectionOpportunity[] {
    const opportunities: ConnectionOpportunity[] = [];

    // Analyze Georgian College connections
    if (this.georgianConfig) {
      opportunities.push(...this.analyzeGeorgianConnections(schedule, targetDate));
    }

    // Analyze GO Train connections
    if (this.goTrainConfig) {
      opportunities.push(...this.analyzeGOTrainConnections(schedule, targetDate));
    }

    // Analyze High School connections
    if (this.highSchoolConfig) {
      opportunities.push(...this.analyzeHighSchoolConnections(schedule, targetDate));
    }

    return opportunities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyze Georgian College connection opportunities
   */
  private analyzeGeorgianConnections(
    schedule: Schedule,
    targetDate: Date
  ): ConnectionOpportunity[] {
    if (!this.georgianConfig) return [];

    const opportunities: ConnectionOpportunity[] = [];
    const dayOfWeek = this.getDayOfWeek(targetDate);

    // Check if date is within semester
    const isWithinSemester = targetDate >= this.georgianConfig.semesterSchedule.startDate &&
                            targetDate <= this.georgianConfig.semesterSchedule.endDate;

    if (!isWithinSemester) return opportunities;

    // Check for special dates
    const specialDate = this.georgianConfig.semesterSchedule.specialDates.find(
      sd => sd.date.toDateString() === targetDate.toDateString()
    );

    if (specialDate && !specialDate.alternate) {
      return opportunities; // No classes on this special date
    }

    // Analyze class start connections
    this.georgianConfig.classStartTimes.forEach(classTime => {
      const priority = this.georgianConfig!.classPriorities.get(classTime) || 5;
      
      this.georgianConfig!.campusStops.forEach(stopId => {
        const connectionOpp = this.createGeorgianConnectionOpportunity(
          stopId,
          classTime,
          'before',
          priority,
          schedule,
          dayOfWeek
        );
        
        if (connectionOpp) {
          opportunities.push(connectionOpp);
        }
      });
    });

    // Analyze class end connections
    this.georgianConfig.classEndTimes.forEach(classTime => {
      const priority = Math.max(1, (this.georgianConfig!.classPriorities.get(classTime) || 5) - 2);
      
      this.georgianConfig!.campusStops.forEach(stopId => {
        const connectionOpp = this.createGeorgianConnectionOpportunity(
          stopId,
          classTime,
          'after',
          priority,
          schedule,
          dayOfWeek
        );
        
        if (connectionOpp) {
          opportunities.push(connectionOpp);
        }
      });
    });

    return opportunities;
  }

  /**
   * Create Georgian College connection opportunity
   */
  private createGeorgianConnectionOpportunity(
    stopId: string,
    classTime: string,
    timing: 'before' | 'after',
    priority: number,
    schedule: Schedule,
    dayOfWeek: string
  ): ConnectionOpportunity | null {
    const window = this.connectionWindows.get(ConnectionType.SCHOOL_BELL);
    if (!window) return null;

    // Calculate ideal arrival times
    const classTimeMinutes = timeToMinutes(classTime);
    let idealArrivalStart: number;
    let idealArrivalEnd: number;

    if (timing === 'before') {
      idealArrivalStart = classTimeMinutes - window.ideal.max;
      idealArrivalEnd = classTimeMinutes - window.ideal.min;
    } else {
      idealArrivalStart = classTimeMinutes + window.ideal.min;
      idealArrivalEnd = classTimeMinutes + window.ideal.max;
    }

    // Find affected trips
    const affectedTrips = this.findTripsAtStop(schedule, stopId, idealArrivalStart, idealArrivalEnd);

    if (affectedTrips.length === 0) return null;

    // Determine current window type
    const currentBusTime = this.getCurrentBusTimeAtStop(schedule, stopId, classTimeMinutes);
    const windowType = this.classifyConnectionWindow(
      currentBusTime,
      classTimeMinutes,
      window,
      timing
    );

    return {
      id: `georgian_${stopId}_${classTime}_${timing}`,
      type: ConnectionType.SCHOOL_BELL,
      locationId: stopId,
      targetTime: classTime,
      priority,
      windowType,
      currentConnectionTime: currentBusTime ? Math.abs(currentBusTime - classTimeMinutes) : undefined,
      affectedTrips: affectedTrips.map(t => t.tripNumber.toString()),
      operatingDays: this.georgianConfig?.semesterSchedule.operatingDays || [dayOfWeek],
      metadata: {
        serviceName: 'Georgian College',
        description: `${timing === 'before' ? 'Class arrival' : 'Class departure'} at ${classTime}`,
        frequency: 1 // Once per class time
      }
    };
  }

  /**
   * Analyze GO Train connection opportunities
   */
  private analyzeGOTrainConnections(
    schedule: Schedule,
    targetDate: Date
  ): ConnectionOpportunity[] {
    if (!this.goTrainConfig) return [];

    const opportunities: ConnectionOpportunity[] = [];
    const dayOfWeek = this.getDayOfWeek(targetDate);

    this.goTrainConfig.trainSchedules.forEach(trainSchedule => {
      if (!trainSchedule.operatingDays.includes(dayOfWeek)) return;

      // Find corresponding bus stops for this train station
      const stationConfig = this.goTrainConfig!.stationStops.find(
        s => s.stationId === trainSchedule.stationId
      );

      if (!stationConfig) return;

      // Analyze departure connections (bus to train)
      trainSchedule.departureTimes.forEach(departureTime => {
        const connectionOpp = this.createGOTrainConnectionOpportunity(
          stationConfig,
          departureTime,
          'departure',
          8, // High priority for GO Train connections
          schedule,
          dayOfWeek,
          trainSchedule
        );

        if (connectionOpp) {
          opportunities.push(connectionOpp);
        }
      });

      // Analyze arrival connections (train to bus)
      trainSchedule.arrivalTimes.forEach(arrivalTime => {
        const connectionOpp = this.createGOTrainConnectionOpportunity(
          stationConfig,
          arrivalTime,
          'arrival',
          7, // Slightly lower priority for arrivals
          schedule,
          dayOfWeek,
          trainSchedule
        );

        if (connectionOpp) {
          opportunities.push(connectionOpp);
        }
      });
    });

    return opportunities;
  }

  /**
   * Create GO Train connection opportunity
   */
  private createGOTrainConnectionOpportunity(
    stationConfig: GOTrainConfig['stationStops'][0],
    trainTime: string,
    connectionType: 'departure' | 'arrival',
    priority: number,
    schedule: Schedule,
    dayOfWeek: string,
    trainSchedule: GOTrainConfig['trainSchedules'][0]
  ): ConnectionOpportunity | null {
    const window = this.connectionWindows.get(ConnectionType.GO_TRAIN);
    if (!window) return null;

    const trainTimeMinutes = timeToMinutes(trainTime);
    const walkingTime = stationConfig.walkingTime;

    let idealBusTimeStart: number;
    let idealBusTimeEnd: number;

    if (connectionType === 'departure') {
      // Bus should arrive before train departure, accounting for walking time
      idealBusTimeStart = trainTimeMinutes - walkingTime - window.ideal.max;
      idealBusTimeEnd = trainTimeMinutes - walkingTime - window.ideal.min;
    } else {
      // Bus should depart after train arrival, accounting for walking time
      idealBusTimeStart = trainTimeMinutes + walkingTime + window.ideal.min;
      idealBusTimeEnd = trainTimeMinutes + walkingTime + window.ideal.max;
    }

    // Find affected trips
    const affectedTrips = this.findTripsAtStop(schedule, stationConfig.busStopId, idealBusTimeStart, idealBusTimeEnd);

    if (affectedTrips.length === 0) return null;

    // Determine current window type
    const currentBusTime = this.getCurrentBusTimeAtStop(schedule, stationConfig.busStopId, trainTimeMinutes);
    const effectiveTrainTime = connectionType === 'departure' 
      ? trainTimeMinutes - walkingTime 
      : trainTimeMinutes + walkingTime;

    const windowType = this.classifyConnectionWindow(
      currentBusTime,
      effectiveTrainTime,
      window,
      connectionType === 'departure' ? 'before' : 'after'
    );

    return {
      id: `gotrain_${stationConfig.stationId}_${trainTime}_${connectionType}`,
      type: ConnectionType.GO_TRAIN,
      locationId: stationConfig.busStopId,
      targetTime: trainTime,
      priority,
      windowType,
      currentConnectionTime: currentBusTime ? Math.abs(currentBusTime - effectiveTrainTime) : undefined,
      affectedTrips: affectedTrips.map(t => t.tripNumber.toString()),
      operatingDays: trainSchedule.operatingDays,
      metadata: {
        serviceName: `GO Train ${trainSchedule.direction}`,
        description: `${connectionType === 'departure' ? 'Board' : 'Depart from'} train at ${trainTime}`,
        frequency: 1
      }
    };
  }

  /**
   * Analyze High School connection opportunities
   */
  private analyzeHighSchoolConnections(
    schedule: Schedule,
    targetDate: Date
  ): ConnectionOpportunity[] {
    if (!this.highSchoolConfig) return [];

    const opportunities: ConnectionOpportunity[] = [];
    const dayOfWeek = this.getDayOfWeek(targetDate);

    // Check for special schedule days
    const specialSchedule = this.highSchoolConfig.specialSchedules.find(
      ss => ss.date.toDateString() === targetDate.toDateString()
    );

    if (specialSchedule?.scheduleType === 'no_school') {
      return opportunities; // No connections needed
    }

    this.highSchoolConfig.schools.forEach(school => {
      const schedule_times = specialSchedule?.alternateSchedule || school.bellSchedule;

      school.busStopIds.forEach(stopId => {
        // Morning arrival connection
        const morningOpp = this.createHighSchoolConnectionOpportunity(
          stopId,
          school,
          schedule_times.startTime,
          'morning_arrival',
          school.priorityLevel,
          schedule,
          dayOfWeek
        );

        if (morningOpp) {
          opportunities.push(morningOpp);
        }

        // Afternoon departure connection
        const afternoonOpp = this.createHighSchoolConnectionOpportunity(
          stopId,
          school,
          schedule_times.endTime,
          'afternoon_departure',
          Math.max(1, school.priorityLevel - 1), // Slightly lower priority
          schedule,
          dayOfWeek
        );

        if (afternoonOpp) {
          opportunities.push(afternoonOpp);
        }

        // Lunch connections if applicable
        if (schedule_times.lunchStart && schedule_times.lunchEnd) {
          const lunchOutOpp = this.createHighSchoolConnectionOpportunity(
            stopId,
            school,
            schedule_times.lunchStart,
            'lunch_departure',
            Math.max(1, school.priorityLevel - 3),
            schedule,
            dayOfWeek
          );

          const lunchReturnOpp = this.createHighSchoolConnectionOpportunity(
            stopId,
            school,
            schedule_times.lunchEnd,
            'lunch_arrival',
            Math.max(1, school.priorityLevel - 3),
            schedule,
            dayOfWeek
          );

          if (lunchOutOpp) opportunities.push(lunchOutOpp);
          if (lunchReturnOpp) opportunities.push(lunchReturnOpp);
        }
      });
    });

    return opportunities;
  }

  /**
   * Create High School connection opportunity
   */
  private createHighSchoolConnectionOpportunity(
    stopId: string,
    school: HighSchoolConfig['schools'][0],
    bellTime: string,
    connectionType: 'morning_arrival' | 'afternoon_departure' | 'lunch_departure' | 'lunch_arrival',
    priority: number,
    schedule: Schedule,
    dayOfWeek: string
  ): ConnectionOpportunity | null {
    const window = this.connectionWindows.get(ConnectionType.SCHOOL_BELL);
    if (!window) return null;

    const bellTimeMinutes = timeToMinutes(bellTime);
    const isArrival = connectionType === 'morning_arrival' || connectionType === 'lunch_arrival';

    let idealBusTimeStart: number;
    let idealBusTimeEnd: number;

    if (isArrival) {
      // Bus should arrive before bell
      idealBusTimeStart = bellTimeMinutes - window.ideal.max;
      idealBusTimeEnd = bellTimeMinutes - window.ideal.min;
    } else {
      // Bus should depart after bell
      idealBusTimeStart = bellTimeMinutes + window.ideal.min;
      idealBusTimeEnd = bellTimeMinutes + window.ideal.max;
    }

    // Find affected trips
    const affectedTrips = this.findTripsAtStop(schedule, stopId, idealBusTimeStart, idealBusTimeEnd);

    if (affectedTrips.length === 0) return null;

    // Determine current window type
    const currentBusTime = this.getCurrentBusTimeAtStop(schedule, stopId, bellTimeMinutes);
    const windowType = this.classifyConnectionWindow(
      currentBusTime,
      bellTimeMinutes,
      window,
      isArrival ? 'before' : 'after'
    );

    return {
      id: `school_${school.schoolId}_${stopId}_${bellTime}_${connectionType}`,
      type: ConnectionType.SCHOOL_BELL,
      locationId: stopId,
      targetTime: bellTime,
      priority,
      windowType,
      currentConnectionTime: currentBusTime ? Math.abs(currentBusTime - bellTimeMinutes) : undefined,
      affectedTrips: affectedTrips.map(t => t.tripNumber.toString()),
      operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], // School days
      metadata: {
        serviceName: school.schoolName,
        description: `${connectionType.replace('_', ' ')} at ${bellTime}`,
        frequency: 1
      }
    };
  }

  /**
   * Find trips that pass through a stop within a time window
   */
  private findTripsAtStop(
    schedule: Schedule,
    stopId: string,
    startTimeMinutes: number,
    endTimeMinutes: number
  ): Trip[] {
    return schedule.trips.filter(trip => {
      const stopTime = trip.arrivalTimes[stopId] || trip.departureTimes[stopId];
      if (!stopTime) return false;

      const stopTimeMinutes = timeToMinutes(stopTime);
      return stopTimeMinutes >= startTimeMinutes && stopTimeMinutes <= endTimeMinutes;
    });
  }

  /**
   * Get current bus time at a specific stop (closest to target time)
   */
  private getCurrentBusTimeAtStop(
    schedule: Schedule,
    stopId: string,
    targetTimeMinutes: number
  ): number | null {
    let closestTime: number | null = null;
    let minDifference = Infinity;

    schedule.trips.forEach(trip => {
      const stopTime = trip.arrivalTimes[stopId] || trip.departureTimes[stopId];
      if (!stopTime) return;

      const stopTimeMinutes = timeToMinutes(stopTime);
      const difference = Math.abs(stopTimeMinutes - targetTimeMinutes);

      if (difference < minDifference) {
        minDifference = difference;
        closestTime = stopTimeMinutes;
      }
    });

    return closestTime;
  }

  /**
   * Classify connection window type based on current and target times
   */
  private classifyConnectionWindow(
    currentTime: number | null,
    targetTime: number,
    window: ConnectionWindow,
    timing: 'before' | 'after'
  ): 'ideal' | 'partial' | 'missed' {
    if (currentTime === null) return 'missed';

    const timeDifference = timing === 'before' 
      ? targetTime - currentTime 
      : currentTime - targetTime;

    if (timeDifference >= window.ideal.min && timeDifference <= window.ideal.max) {
      return 'ideal';
    } else if (timeDifference >= window.partial.min && timeDifference <= window.partial.max) {
      return 'partial';
    } else {
      return 'missed';
    }
  }

  /**
   * Get day of week string
   */
  private getDayOfWeek(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Calculate connection score for an opportunity
   */
  calculateConnectionScore(opportunity: ConnectionOpportunity): number {
    const window = this.connectionWindows.get(opportunity.type);
    if (!window) return 0;

    const baseScore = opportunity.priority / 10; // Normalize priority to 0-1
    const windowMultiplier = window.multipliers[opportunity.windowType];
    const frequencyFactor = opportunity.metadata.frequency ? Math.min(1, 1 / opportunity.metadata.frequency) : 1;

    return baseScore * windowMultiplier * frequencyFactor;
  }

  /**
   * Get connection windows configuration
   */
  getConnectionWindows(): Map<ConnectionType, ConnectionWindow> {
    return new Map(this.connectionWindows);
  }

  /**
   * Core method: Calculate connection window between bus arrival/departure and connection requirement
   * @param tripTime Bus time at connection point (HH:MM format)
   * @param connectionTime Target connection time (HH:MM format) 
   * @param connectionType Type of connection (Georgian College, GO Train, High School)
   * @param scenario Whether this is an 'arrival' or 'departure' connection
   * @param priority Priority level (1-10, affects scoring)
   * @returns Detailed connection window calculation result
   */
  calculateConnectionWindow(
    tripTime: string,
    connectionTime: string,
    connectionType: ConnectionType,
    scenario: 'arrival' | 'departure' = 'arrival',
    priority: number = 5
  ): ConnectionWindowResult {
    // Get appropriate connection window based on type
    let connectionWindow = this.connectionWindows.get(connectionType);
    
    // Special handling for Georgian College
    if (connectionType === ConnectionType.SCHOOL_BELL && this.georgianConfig) {
      connectionWindow = GEORGIAN_COLLEGE_WINDOWS;
    }
    
    if (!connectionWindow) {
      throw new Error(`No connection window configured for type: ${connectionType}`);
    }

    // Calculate time gap, handling midnight wraparound
    let timeGapMinutes: number;
    
    if (scenario === 'arrival') {
      // For arrivals: positive gap means bus arrives before connection time (good)
      timeGapMinutes = this.calculateTimeGap(connectionTime, tripTime);
    } else {
      // For departures: positive gap means bus departs after connection time (good)  
      timeGapMinutes = this.calculateTimeGap(tripTime, connectionTime);
    }

    // Classify connection window
    const classification = this.getWindowClassification(Math.abs(timeGapMinutes), connectionWindow);
    
    // Calculate connection score
    const score = this.getConnectionScore(classification, priority, connectionWindow);
    
    // Determine if connection is satisfied
    const isSatisfied = classification !== 'missed';
    
    // Calculate recommended adjustment if connection is not ideal
    let recommendedAdjustment: number | undefined;
    if (classification !== 'ideal') {
      recommendedAdjustment = this.calculateRecommendedAdjustment(
        timeGapMinutes, 
        connectionWindow, 
        scenario
      );
    }

    return {
      timeGapMinutes,
      classification,
      score,
      isSatisfied,
      recommendedAdjustment,
      details: {
        busTime: tripTime,
        connectionTime,
        connectionType,
        scenario,
        appliedWindow: connectionWindow
      }
    };
  }

  /**
   * Classify connection satisfaction level based on time gap and connection windows
   * @param gapMinutes Absolute time gap in minutes
   * @param windows Connection window thresholds
   * @returns Classification as 'ideal', 'partial', or 'missed'
   */
  getWindowClassification(
    gapMinutes: number, 
    windows: ConnectionWindow
  ): 'ideal' | 'partial' | 'missed' {
    const absGap = Math.abs(gapMinutes);
    
    // Check ideal window
    if (absGap >= windows.ideal.min && absGap <= windows.ideal.max) {
      return 'ideal';
    }
    
    // Check partial window  
    if (absGap >= windows.partial.min && absGap <= windows.partial.max) {
      return 'partial';
    }
    
    // Outside acceptable windows
    return 'missed';
  }

  /**
   * Calculate connection score based on classification and priority
   * @param classification Connection window classification
   * @param priority Priority level (1-10)
   * @param windows Connection window configuration
   * @returns Score from 0-1 (higher is better)
   */
  getConnectionScore(
    classification: 'ideal' | 'partial' | 'missed',
    priority: number,
    windows: ConnectionWindow
  ): number {
    // Normalize priority to 0-1 scale
    const priorityWeight = Math.min(Math.max(priority, 1), 10) / 10;
    
    // Get base score from window multiplier
    const baseScore = windows.multipliers[classification];
    
    // Return weighted score
    return baseScore * priorityWeight;
  }

  /**
   * Analyze all connections in a schedule against connection requirements
   * @param schedule The schedule to analyze
   * @param connections Array of connection requirements to check
   * @returns Bulk analysis results with recommendations
   */
  analyzeAllConnections(
    schedule: Schedule, 
    connections: Array<{
      locationId: string;
      connectionTime: string;
      connectionType: ConnectionType;
      scenario: 'arrival' | 'departure';
      priority: number;
    }>
  ): BulkConnectionAnalysis {
    const results: ConnectionWindowResult[] = [];
    const summaryByType = new Map<ConnectionType, {
      total: number;
      ideal: number;
      partial: number;
      missed: number;
      averageScore: number;
    }>();

    // Analyze each connection requirement
    connections.forEach(connection => {
      // Find trips that serve this location
      const relevantTrips = this.findTripsAtLocation(schedule, connection.locationId);
      
      relevantTrips.forEach(trip => {
        // Get trip time at this location
        const tripTime = this.getTripTimeAtLocation(trip, connection.locationId, connection.scenario);
        
        if (tripTime) {
          const result = this.calculateConnectionWindow(
            tripTime,
            connection.connectionTime,
            connection.connectionType,
            connection.scenario,
            connection.priority
          );
          
          results.push(result);
          
          // Update summary statistics
          this.updateSummaryStats(summaryByType, connection.connectionType, result);
        }
      });
    });

    // Calculate overall metrics
    const successfulConnections = results.filter(r => r.isSatisfied);
    const successRate = results.length > 0 ? successfulConnections.length / results.length : 0;
    const averageScore = results.length > 0 
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
      : 0;

    // Generate recommendations
    const recommendations = this.generateOptimizationRecommendations(results, summaryByType);

    return {
      successRate,
      averageScore,
      connections: results,
      summaryByType,
      recommendations
    };
  }

  /**
   * Calculate time gap between two times, handling midnight wraparound
   * @param laterTime The time that should be later
   * @param earlierTime The time that should be earlier  
   * @returns Time difference in minutes (positive if laterTime is after earlierTime)
   */
  private calculateTimeGap(laterTime: string, earlierTime: string): number {
    const laterMinutes = timeToMinutes(laterTime);
    const earlierMinutes = timeToMinutes(earlierTime);
    
    let gap = laterMinutes - earlierMinutes;
    
    // Handle midnight wraparound cases
    if (gap < -12 * 60) { // If gap is more than 12 hours negative, assume next day
      gap += 24 * 60;
    } else if (gap > 12 * 60) { // If gap is more than 12 hours positive, assume previous day
      gap -= 24 * 60;
    }
    
    return gap;
  }

  /**
   * Calculate recommended time adjustment to achieve ideal connection
   * @param currentGap Current time gap in minutes
   * @param windows Connection window configuration  
   * @param scenario Connection scenario
   * @returns Recommended adjustment in minutes (positive = later, negative = earlier)
   */
  private calculateRecommendedAdjustment(
    currentGap: number,
    windows: ConnectionWindow,
    scenario: 'arrival' | 'departure'
  ): number {
    const absGap = Math.abs(currentGap);
    const idealTarget = (windows.ideal.min + windows.ideal.max) / 2;
    
    // Calculate adjustment needed to reach ideal window center
    if (scenario === 'arrival') {
      // For arrivals, we want bus to arrive before connection
      if (currentGap < 0) {
        // Bus arrives after connection - need to move earlier
        return -(absGap + idealTarget);
      } else if (absGap < windows.ideal.min) {
        // Too early - move later
        return windows.ideal.min - absGap;
      } else if (absGap > windows.ideal.max) {
        // Too late - move earlier  
        return -(absGap - idealTarget);
      }
    } else {
      // For departures, we want bus to depart after connection
      if (currentGap < 0) {
        // Bus departs before connection - need to move later
        return absGap + idealTarget;
      } else if (absGap < windows.ideal.min) {
        // Too soon after - move later
        return windows.ideal.min - absGap;
      } else if (absGap > windows.ideal.max) {
        // Too late after - move earlier
        return -(absGap - idealTarget);
      }
    }
    
    return 0; // Already in acceptable range
  }

  /**
   * Find trips that serve a specific location
   * @param schedule Schedule to search
   * @param locationId Location/stop ID to find
   * @returns Array of trips serving this location
   */
  private findTripsAtLocation(schedule: Schedule, locationId: string): Trip[] {
    return schedule.trips.filter(trip => 
      trip.arrivalTimes[locationId] || trip.departureTimes[locationId]
    );
  }

  /**
   * Get trip time at a specific location based on scenario
   * @param trip Trip to examine
   * @param locationId Location ID
   * @param scenario Whether to get arrival or departure time
   * @returns Time string or null if not found
   */
  private getTripTimeAtLocation(
    trip: Trip, 
    locationId: string, 
    scenario: 'arrival' | 'departure'
  ): string | null {
    if (scenario === 'arrival') {
      return trip.arrivalTimes[locationId] || null;
    } else {
      return trip.departureTimes[locationId] || null;
    }
  }

  /**
   * Update summary statistics for connection analysis
   * @param summaryMap Summary statistics map to update
   * @param connectionType Connection type
   * @param result Connection result to add
   */
  private updateSummaryStats(
    summaryMap: Map<ConnectionType, any>,
    connectionType: ConnectionType,
    result: ConnectionWindowResult
  ): void {
    if (!summaryMap.has(connectionType)) {
      summaryMap.set(connectionType, {
        total: 0,
        ideal: 0,
        partial: 0,
        missed: 0,
        averageScore: 0
      });
    }
    
    const stats = summaryMap.get(connectionType)!;
    stats.total++;
    stats[result.classification]++;
    
    // Update running average score
    const oldAverage = stats.averageScore;
    stats.averageScore = ((oldAverage * (stats.total - 1)) + result.score) / stats.total;
  }

  /**
   * Generate optimization recommendations based on analysis results
   * @param results Connection analysis results
   * @param summaryByType Summary statistics by connection type
   * @returns Array of recommendation strings
   */
  private generateOptimizationRecommendations(
    results: ConnectionWindowResult[],
    summaryByType: Map<ConnectionType, any>
  ): string[] {
    const recommendations: string[] = [];
    
    // Overall success rate recommendations
    const successRate = results.filter(r => r.isSatisfied).length / Math.max(results.length, 1);
    if (successRate < 0.7) {
      recommendations.push('Overall connection success rate is low (<70%). Consider schedule adjustments.');
    }
    
    // Connection type specific recommendations
    summaryByType.forEach((stats, type) => {
      const typeSuccessRate = (stats.ideal + stats.partial) / stats.total;
      
      if (typeSuccessRate < 0.6) {
        const typeName = this.getConnectionTypeName(type);
        recommendations.push(`${typeName} connections need improvement (${Math.round(typeSuccessRate * 100)}% success rate).`);
      }
      
      if (stats.missed > stats.total * 0.3) {
        const typeName = this.getConnectionTypeName(type);
        recommendations.push(`High number of missed ${typeName} connections. Review schedule timing.`);
      }
    });
    
    // Specific time adjustment recommendations
    const needsAdjustment = results.filter(r => r.recommendedAdjustment !== undefined);
    if (needsAdjustment.length > 0) {
      const avgAdjustment = needsAdjustment.reduce((sum, r) => sum + Math.abs(r.recommendedAdjustment!), 0) / needsAdjustment.length;
      recommendations.push(`Average recommended time adjustment: ${Math.round(avgAdjustment)} minutes.`);
    }
    
    return recommendations;
  }

  /**
   * Get user-friendly name for connection type
   * @param type Connection type enum value
   * @returns Human-readable name
   */
  private getConnectionTypeName(type: ConnectionType): string {
    switch (type) {
      case ConnectionType.GO_TRAIN:
        return 'GO Train';
      case ConnectionType.SCHOOL_BELL:
        return 'School';
      case ConnectionType.BUS_ROUTE:
        return 'Bus Route';
      default:
        return 'Unknown';
    }
  }
}

// Singleton instance
export const connectionWindowService = new ConnectionWindowService();