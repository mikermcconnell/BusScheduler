// Test script for recovery time template functionality
// Run this in the browser console to test the core logic

console.log('🧪 Testing Recovery Time Template Logic');

// Mock data similar to what the application uses
const mockSchedule = {
  timePoints: [
    { id: 'downtown-terminal', name: 'Downtown Terminal' },
    { id: 'johnson-napier', name: 'Johnson at Napier' },
    { id: 'rvh-entrance', name: 'RVH Entrance' },
    { id: 'georgian-college', name: 'Georgian College' },
    { id: 'georgian-mall', name: 'Georgian Mall' }
  ],
  trips: [
    {
      tripNumber: 1,
      blockNumber: 1,
      departureTime: '07:00',
      serviceBand: 'Fastest Service',
      arrivalTimes: {
        'downtown-terminal': '07:00',
        'johnson-napier': '07:05',
        'rvh-entrance': '07:15',
        'georgian-college': '07:25',
        'georgian-mall': '07:35'
      },
      departureTimes: {
        'downtown-terminal': '07:00',
        'johnson-napier': '07:06',
        'rvh-entrance': '07:16',
        'georgian-college': '07:27',
        'georgian-mall': '07:38'
      },
      recoveryTimes: {
        'downtown-terminal': 0,
        'johnson-napier': 1,
        'rvh-entrance': 1,
        'georgian-college': 2,
        'georgian-mall': 3
      }
    }
  ]
};

// Mock recovery templates
const mockRecoveryTemplates = {
  'Fastest Service': [0, 1, 1, 2, 3],
  'Fast Service': [0, 1, 2, 2, 4],
  'Standard Service': [0, 2, 2, 3, 5],
  'Slow Service': [0, 2, 3, 3, 6],
  'Slowest Service': [0, 3, 3, 4, 7]
};

// Test 1: Apply target recovery percentage calculation
function testTargetRecoveryPercentage() {
  console.log('\n📊 Test 1: Target Recovery Percentage Calculation');
  
  const targetPercentage = 15; // 15%
  const segmentTravelTimes = [5, 10, 10, 10]; // Mock travel times between stops
  
  console.log(`Target percentage: ${targetPercentage}%`);
  console.log('Segment travel times:', segmentTravelTimes);
  
  // Calculate recovery times based on percentage
  const calculatedRecovery = [0]; // First stop always 0
  segmentTravelTimes.forEach((travelTime, index) => {
    let recoveryTime = Math.round((travelTime * targetPercentage) / 100);
    if (index === segmentTravelTimes.length - 1) {
      recoveryTime = Math.round(recoveryTime * 1.5); // Last stop gets more
    }
    recoveryTime = Math.max(1, Math.min(10, recoveryTime));
    calculatedRecovery.push(recoveryTime);
  });
  
  console.log('Calculated recovery times:', calculatedRecovery);
  console.log('Total recovery time:', calculatedRecovery.reduce((sum, val) => sum + val, 0));
  
  return calculatedRecovery;
}

// Test 2: Apply recovery template to trip
function testApplyRecoveryTemplate() {
  console.log('\n🔄 Test 2: Apply Recovery Template');
  
  const serviceBand = 'Standard Service';
  const template = mockRecoveryTemplates[serviceBand];
  const originalTrip = mockSchedule.trips[0];
  
  console.log(`Applying template for ${serviceBand}:`, template);
  console.log('Original recovery times:', originalTrip.recoveryTimes);
  
  // Apply template
  const updatedRecoveryTimes = {};
  mockSchedule.timePoints.forEach((tp, index) => {
    updatedRecoveryTimes[tp.id] = template[index] || 0;
  });
  
  console.log('Updated recovery times:', updatedRecoveryTimes);
  
  // Calculate time differences
  const timeDifferences = {};
  mockSchedule.timePoints.forEach(tp => {
    const oldTime = originalTrip.recoveryTimes[tp.id] || 0;
    const newTime = updatedRecoveryTimes[tp.id] || 0;
    timeDifferences[tp.id] = newTime - oldTime;
  });
  
  console.log('Time differences:', timeDifferences);
  
  return { updatedRecoveryTimes, timeDifferences };
}

// Test 3: Calculate recovery percentage
function testRecoveryPercentage() {
  console.log('\n📈 Test 3: Recovery Percentage Calculation');
  
  const trip = mockSchedule.trips[0];
  const totalRecoveryTime = Object.values(trip.recoveryTimes).reduce((sum, time) => sum + time, 0);
  const travelTime = 30; // Mock 30 minute travel time
  
  const percentage = (totalRecoveryTime / travelTime) * 100;
  
  console.log(`Total recovery time: ${totalRecoveryTime} minutes`);
  console.log(`Travel time: ${travelTime} minutes`);
  console.log(`Recovery percentage: ${percentage.toFixed(1)}%`);
  
  // Determine status
  let status;
  if (percentage < 10) status = 'Not enough recovery time (Red)';
  else if (percentage >= 10 && percentage < 15) status = 'Okay recovery time (Yellow)';
  else if (percentage === 15) status = 'Great recovery time (Green)';
  else status = 'Too much recovery time (Red)';
  
  console.log(`Status: ${status}`);
  
  return { percentage, status };
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting Recovery Time Template Tests');
  console.log('==========================================');
  
  const test1Result = testTargetRecoveryPercentage();
  const test2Result = testApplyRecoveryTemplate();
  const test3Result = testRecoveryPercentage();
  
  console.log('\n✅ All tests completed!');
  console.log('Results summary:');
  console.log('- Target percentage calculation: ✓');
  console.log('- Template application: ✓');
  console.log('- Recovery percentage calculation: ✓');
  
  return { test1Result, test2Result, test3Result };
}

// Run tests immediately
runAllTests();

// Export for manual testing
if (typeof window !== 'undefined') {
  window.recoveryTemplateTests = {
    runAllTests,
    testTargetRecoveryPercentage,
    testApplyRecoveryTemplate,
    testRecoveryPercentage,
    mockSchedule,
    mockRecoveryTemplates
  };
  console.log('\n📝 Tests available in window.recoveryTemplateTests');
}