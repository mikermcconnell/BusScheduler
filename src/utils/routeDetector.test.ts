import { RouteDetector } from './routeDetector';
import { ParsedCsvData } from './csvParser';

// Test with mock CSV data that resembles the example_schedule/Raw_Data.csv
const mockCsvData: ParsedCsvData = {
  segments: [
    {
      fromLocation: 'Downtown Barrie Terminal',
      toLocation: 'Johnson at Napier',
      timeSlot: '07:00 - 07:29',
      percentile25: 6.6,
      percentile50: 7.11,
      percentile80: 8.58,
      percentile90: 8.59
    },
    {
      fromLocation: 'Johnson at Napier',
      toLocation: 'RVH Atrium Entrance', 
      timeSlot: '07:00 - 07:29',
      percentile25: 6.44,
      percentile50: 6.81,
      percentile80: 7.2,
      percentile90: 7.29
    }
  ],
  timePoints: [
    'Downtown Barrie Terminal',
    'Johnson at Napier', 
    'RVH Atrium Entrance',
    'Georgian College',
    'Georgian Mall',
    'Bayfield Mall'
  ],
  validationSummary: {
    totalSegments: 2,
    validSegments: 2,
    invalidSegments: 0,
    timeSlots: 1
  }
};

// Mock data with route number pattern
const mockCsvDataWithRoute: ParsedCsvData = {
  ...mockCsvData,
  segments: [
    {
      fromLocation: '101 CCW Downtown Barrie Terminal',
      toLocation: '101 CCW Johnson at Napier',
      timeSlot: '07:00 - 07:29', 
      percentile25: 6.6,
      percentile50: 7.11,
      percentile80: 8.58,
      percentile90: 8.59
    }
  ]
};

describe('RouteDetector', () => {
  test('should detect route with high confidence from route number pattern', () => {
    const result = RouteDetector.detect(mockCsvDataWithRoute);
    
    expect(result.confidence).toBe('high');
    expect(result.routeNumber).toBe('101');
    expect(result.direction).toBe('Counter-Clockwise');
    expect(result.suggestedName).toBe('Route 101 Counter-Clockwise');
    expect(result.detectionMethod).toBe('Route number with direction pattern');
  });

  test('should generate alternative names', () => {
    const result = RouteDetector.detect(mockCsvDataWithRoute);
    const alternatives = RouteDetector.generateAlternativeNames(result);
    
    expect(alternatives).toContain('Route 101 Counter-Clockwise');
    expect(alternatives).toContain('Route 101');
    expect(alternatives).toContain('Line 101');
    expect(alternatives).toContain('Bus 101');
    expect(alternatives).toContain('101 Counter');
  });

  test('should detect route from major destinations with low confidence', () => {
    const result = RouteDetector.detect(mockCsvData);
    
    expect(result.confidence).toBe('low');
    expect(result.detectionMethod).toBe('Major destination analysis');
    expect(result.suggestedName).toContain('Terminal');
    expect(result.suggestedName).toContain('Route');
  });

  test('should handle empty data gracefully', () => {
    const emptyData: ParsedCsvData = {
      segments: [],
      timePoints: [],
      validationSummary: {
        totalSegments: 0,
        validSegments: 0,
        invalidSegments: 0,
        timeSlots: 0
      }
    };

    const result = RouteDetector.detect(emptyData);
    
    expect(result.confidence).toBe('low');
    expect(result.detectionMethod).toBe('Generic fallback');
    expect(result.suggestedName).toBe('New Route Schedule');
  });
});

// Quick manual test function
export function testRouteDetection() {
  console.log('🧪 Testing Route Detection...');
  
  // Test 1: Route with number and direction
  const result1 = RouteDetector.detect(mockCsvDataWithRoute);
  console.log('✅ Route 101 CCW Detection:', result1);
  
  // Test 2: Generate alternatives
  const alternatives = RouteDetector.generateAlternativeNames(result1);
  console.log('✅ Alternative Names:', alternatives);
  
  // Test 3: Basic destination detection
  const result2 = RouteDetector.detect(mockCsvData);
  console.log('✅ Destination-based Detection:', result2);
  
  console.log('🎉 Route Detection Tests Complete!');
}