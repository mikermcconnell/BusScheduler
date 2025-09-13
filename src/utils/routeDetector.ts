import { ParsedCsvData } from './csvParser';
import { ParsedExcelData } from './excelParser';

export interface RouteDetectionResult {
  routeNumber?: string;
  routeName?: string;
  direction?: string;
  confidence: 'high' | 'medium' | 'low';
  detectionMethod: string;
  suggestedName: string;
}

export class RouteDetector {
  /**
   * Detects route information from CSV data
   */
  static detectFromCsv(csvData: ParsedCsvData): RouteDetectionResult {
    // Check segments for route information
    for (const segment of csvData.segments) {
      // Look for route patterns in segment data
      const routePattern = this.extractRouteFromSegment(segment.fromLocation + ' ' + segment.toLocation);
      if (routePattern) {
        return routePattern;
      }
    }

    // Fallback: analyze timepoint names for route clues
    return this.analyzeTimepointNames(csvData.timePoints);
  }

  /**
   * Detects route information from Excel data
   */
  static detectFromExcel(excelData: ParsedExcelData): RouteDetectionResult {
    // Check timepoints for route information
    for (const timePoint of excelData.timePoints) {
      const routePattern = this.extractRouteFromSegment(timePoint.name);
      if (routePattern) {
        return routePattern;
      }
    }

    // Check travel times for route clues
    for (const travelTime of excelData.travelTimes) {
      const combined = `${travelTime.fromTimePoint} ${travelTime.toTimePoint}`;
      const routePattern = this.extractRouteFromSegment(combined);
      if (routePattern) {
        return routePattern;
      }
    }

    return this.analyzeTimepointNames(excelData.timePoints.map(tp => tp.name));
  }

  /**
   * Extracts route information from text segments
   */
  private static extractRouteFromSegment(text: string): RouteDetectionResult | null {
    const normalizedText = text.toLowerCase();

    // Pattern 1: "101 CCW" style route numbers with direction
    const routeDirectionMatch = text.match(/(\d{1,3})\s+(ccw|cw|clockwise|counterclockwise|counter-clockwise)/i);
    if (routeDirectionMatch) {
      const routeNumber = routeDirectionMatch[1];
      const direction = routeDirectionMatch[2].toLowerCase();
      const directionText = direction === 'ccw' || direction.includes('counter') ? 'Counter-Clockwise' : 'Clockwise';
      
      return {
        routeNumber,
        direction: directionText,
        confidence: 'high',
        detectionMethod: 'Route number with direction pattern',
        suggestedName: `Route ${routeNumber} ${directionText}`
      };
    }

    // Pattern 2: Just route numbers "Route 101", "101", "Line 15"
    const routeNumberMatch = text.match(/(?:route\s+|line\s+)?(\d{1,3})(?:\s+route)?/i);
    if (routeNumberMatch) {
      const routeNumber = routeNumberMatch[1];
      
      return {
        routeNumber,
        confidence: 'medium',
        detectionMethod: 'Route number pattern',
        suggestedName: `Route ${routeNumber}`
      };
    }

    // Pattern 3: Named routes like "Blue Line", "Express Service"
    const namedRouteMatch = text.match(/(blue|red|green|yellow|orange|purple|express|rapid|local|downtown|university|college)\s+(line|route|service|express|rapid)/i);
    if (namedRouteMatch) {
      const routeName = namedRouteMatch[0];
      
      return {
        routeName,
        confidence: 'medium',
        detectionMethod: 'Named route pattern',
        suggestedName: routeName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      };
    }

    return null;
  }

  /**
   * Analyzes timepoint names to infer route information
   */
  private static analyzeTimepointNames(timePoints: string[]): RouteDetectionResult {
    const allText = timePoints.join(' ').toLowerCase();
    
    // Look for city/area names that might indicate route
    const cityPatterns = [
      'downtown', 'terminal', 'mall', 'college', 'university', 'hospital', 
      'station', 'centre', 'center', 'plaza', 'square', 'park'
    ];

    const foundPatterns = cityPatterns.filter(pattern => allText.includes(pattern));
    
    if (foundPatterns.length >= 2) {
      // Create a route name based on major destinations
      const majorDestinations = timePoints
        .filter(tp => cityPatterns.some(pattern => tp.toLowerCase().includes(pattern)))
        .slice(0, 2) // Take first two major destinations
        .map(dest => {
          // Clean up destination names
          return dest.replace(/\s+(at|to|from)\s+/gi, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        });

      if (majorDestinations.length >= 2) {
        return {
          confidence: 'low',
          detectionMethod: 'Major destination analysis',
          suggestedName: `${majorDestinations[0]} - ${majorDestinations[1]} Route`
        };
      }
    }

    // Fallback: generic route name
    return {
      confidence: 'low',
      detectionMethod: 'Generic fallback',
      suggestedName: 'New Route Schedule'
    };
  }

  /**
   * Main detection function that handles both CSV and Excel data
   */
  static detect(data: ParsedCsvData | ParsedExcelData): RouteDetectionResult {
    // Check if it's CSV data (has segments property)
    if ('segments' in data) {
      return this.detectFromCsv(data);
    } else {
      return this.detectFromExcel(data);
    }
  }

  /**
   * Generates additional route name suggestions based on detection result
   */
  static generateAlternativeNames(detection: RouteDetectionResult): string[] {
    const alternatives: string[] = [];
    
    if (detection.routeNumber) {
      alternatives.push(`Route ${detection.routeNumber}`);
      alternatives.push(`Line ${detection.routeNumber}`);
      alternatives.push(`Bus ${detection.routeNumber}`);
      
      if (detection.direction) {
        alternatives.push(`${detection.routeNumber} ${detection.direction.split('-')[0]}`); // CCW or CW
        alternatives.push(`Route ${detection.routeNumber} - ${detection.direction}`);
      }
    }

    if (detection.routeName) {
      alternatives.push(detection.routeName);
      alternatives.push(`${detection.routeName} Service`);
    }

    // Remove duplicates and return
    return Array.from(new Set([detection.suggestedName, ...alternatives]));
  }
}