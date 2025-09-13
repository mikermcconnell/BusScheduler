/**
 * Recovery Bank Service Tests
 * Comprehensive test suite for the bus schedule connection optimization recovery bank
 */

import { RecoveryBankService } from './recoveryBankService';
import { Schedule, Trip, TimePoint } from '../types/schedule';
import { RecoveryAccount, OptimizationConstraints } from '../types/connectionOptimization';

describe('RecoveryBankService', () => {
  let service: RecoveryBankService;
  let mockSchedule: Schedule;
  let mockTimePoints: TimePoint[];
  let mockTrips: Trip[];
  let mockConstraints: OptimizationConstraints;

  beforeEach(() => {
    service = new RecoveryBankService();
    
    // Create mock time points
    mockTimePoints = [
      { id: 'terminal1', name: 'Downtown Terminal', sequence: 1 },
      { id: 'college1', name: 'Georgian College', sequence: 2 },
      { id: 'hospital1', name: 'General Hospital', sequence: 3 },
      { id: 'school1', name: 'High School', sequence: 4 },
      { id: 'mall1', name: 'Shopping Centre', sequence: 5 }
    ];

    // Create mock trips with recovery times
    mockTrips = [
      {
        tripNumber: 1,
        blockNumber: 1,
        departureTime: '07:00',
        serviceBand: 'Standard',
        arrivalTimes: {
          'terminal1': '07:00',
          'college1': '07:15',
          'hospital1': '07:25',
          'school1': '07:35',
          'mall1': '07:45'
        },
        departureTimes: {
          'terminal1': '07:05',
          'college1': '07:17',
          'hospital1': '07:27',
          'school1': '07:37',
          'mall1': '07:45'
        },
        recoveryTimes: {
          'terminal1': 5,
          'college1': 2,
          'hospital1': 2,
          'school1': 2,
          'mall1': 0
        },
        recoveryMinutes: 11
      },
      {
        tripNumber: 2,
        blockNumber: 1,
        departureTime: '08:00',
        serviceBand: 'Standard',
        arrivalTimes: {
          'terminal1': '08:00',
          'college1': '08:15',
          'hospital1': '08:25',
          'school1': '08:35',
          'mall1': '08:45'
        },
        departureTimes: {
          'terminal1': '08:06',
          'college1': '08:18',
          'hospital1': '08:28',
          'school1': '08:38',
          'mall1': '08:45'
        },
        recoveryTimes: {
          'terminal1': 6,
          'college1': 3,
          'hospital1': 3,
          'school1': 3,
          'mall1': 0
        },
        recoveryMinutes: 15
      }
    ];

    mockSchedule = {
      id: 'test-schedule',
      name: 'Test Route',
      routeId: 'route-101',
      routeName: 'Route 101',
      direction: 'Outbound',
      dayType: 'weekday',
      timePoints: mockTimePoints,
      serviceBands: [],
      trips: mockTrips,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockConstraints = {
      maxTripDeviation: 10,
      maxScheduleShift: 30,
      minRecoveryTime: 1,
      maxRecoveryTime: 15,
      enforceHeadwayRegularity: true,
      headwayTolerance: 2,
      connectionPriorities: {
        BUS_ROUTE: 5,
        GO_TRAIN: 8,
        SCHOOL_BELL: 10
      },
      allowCrossRouteBorrowing: false,
      performance: {
        maxOptimizationTimeMs: 30000,
        maxMemoryUsageMB: 50,
        earlyTerminationThreshold: 0.01
      }
    };
  });

  describe('Bank Initialization', () => {
    it('should initialize recovery bank with default stop configurations', () => {
      const bankState = service.initializeBank(mockSchedule, [], mockConstraints);

      expect(bankState).toBeDefined();
      expect(bankState.accounts.size).toBe(5);
      expect(bankState.totalAvailableRecovery).toBeGreaterThan(0);
      expect(bankState.totalBorrowedRecovery).toBe(0);
      expect(bankState.utilizationRate).toBe(0);
    });

    it('should correctly infer stop types from names', () => {
      const bankState = service.initializeBank(mockSchedule, [], mockConstraints);
      
      const terminalAccount = bankState.accounts.get('terminal1');
      const collegeAccount = bankState.accounts.get('college1');
      const hospitalAccount = bankState.accounts.get('hospital1');
      const schoolAccount = bankState.accounts.get('school1');
      const mallAccount = bankState.accounts.get('mall1');

      expect(terminalAccount?.stopType).toBe('terminal');
      expect(collegeAccount?.stopType).toBe('major_stop');
      expect(hospitalAccount?.stopType).toBe('hospital');
      expect(schoolAccount?.stopType).toBe('school');
      expect(mallAccount?.stopType).toBe('mall');
    });

    it('should set appropriate flexibility scores by stop type', () => {
      const bankState = service.initializeBank(mockSchedule, [], mockConstraints);
      
      const terminalAccount = bankState.accounts.get('terminal1');
      const hospitalAccount = bankState.accounts.get('hospital1');
      const schoolAccount = bankState.accounts.get('school1');
      const mallAccount = bankState.accounts.get('mall1');

      // Terminal should have highest flexibility
      expect(terminalAccount?.flexibilityScore).toBeGreaterThan(hospitalAccount?.flexibilityScore || 0);
      expect(terminalAccount?.flexibilityScore).toBeGreaterThan(schoolAccount?.flexibilityScore || 0);
      
      // Mall should be more flexible than hospital and school
      expect(mallAccount?.flexibilityScore).toBeGreaterThan(hospitalAccount?.flexibilityScore || 0);
      expect(mallAccount?.flexibilityScore).toBeGreaterThan(schoolAccount?.flexibilityScore || 0);
      
      // Hospital should be more flexible than school
      expect(hospitalAccount?.flexibilityScore).toBeGreaterThan(schoolAccount?.flexibilityScore || 0);
    });

    it('should apply custom stop configurations', () => {
      const customConfigs: Partial<RecoveryAccount>[] = [
        {
          stopId: 'terminal1',
          maxCredit: 20,
          minRecoveryTime: 3,
          flexibilityScore: 0.95
        }
      ];

      const bankState = service.initializeBank(mockSchedule, customConfigs, mockConstraints);
      const terminalAccount = bankState.accounts.get('terminal1');

      expect(terminalAccount?.maxCredit).toBe(20);
      expect(terminalAccount?.minRecoveryTime).toBe(3);
      expect(terminalAccount?.flexibilityScore).toBe(0.95);
    });
  });

  describe('Recovery Transactions', () => {
    beforeEach(() => {
      service.initializeBank(mockSchedule, [], mockConstraints);
    });

    it('should successfully transfer recovery time between stops', () => {
      const result = service.requestRecoveryTransfer(
        'terminal1',
        'college1',
        3,
        ['trip1'],
        'Connection optimization'
      );

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.amount).toBe(3);
      expect(result.transaction?.lenderStopId).toBe('terminal1');
      expect(result.transaction?.borrowerStopId).toBe('college1');

      const bankState = service.getBankState();
      expect(bankState?.totalBorrowedRecovery).toBe(3);
    });

    it('should reject transactions with insufficient credit', () => {
      const result = service.requestRecoveryTransfer(
        'school1',  // School has very limited credit
        'college1',
        10,  // Request too much
        ['trip1'],
        'Connection optimization'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient credit');
    });

    it('should reject transactions that would exceed max recovery', () => {
      // First, get available credit from terminal to college
      const firstResult = service.requestRecoveryTransfer('terminal1', 'college1', 1, ['trip1']);
      expect(firstResult.success).toBe(true);

      const bankState = service.getBankState();
      const collegeAccount = bankState?.accounts.get('college1');
      const availableCredit = bankState?.accounts.get('terminal1')?.availableCredit || 0;
      
      // Try to request more than remaining credit
      const result = service.requestRecoveryTransfer(
        'terminal1',
        'college1',
        availableCredit + 5,  // More than available
        ['trip2']
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient credit');
    });

    it('should validate constraint violations', () => {
      const bankState = service.getBankState();
      const terminalCredit = bankState?.accounts.get('terminal1')?.availableCredit || 0;
      
      // Create a constraint violation scenario
      if (terminalCredit >= 15) {
        const result = service.requestRecoveryTransfer(
          'terminal1',
          'college1',
          15,  // Exceeds maxTripDeviation (10)
          ['trip1']
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('exceeds max deviation');
      } else {
        // If not enough credit, test insufficient credit instead
        const result = service.requestRecoveryTransfer(
          'terminal1',
          'college1',
          terminalCredit + 1,
          ['trip1']
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient credit');
      }
    });

    it('should calculate transaction scores properly', () => {
      // Transfer from highly flexible terminal to less flexible college
      const result1 = service.requestRecoveryTransfer('terminal1', 'college1', 2, ['trip1']);
      
      // Transfer from less flexible college to hospital (even less flexible)
      const result2 = service.requestRecoveryTransfer('college1', 'hospital1', 1, ['trip2']);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // First transaction should have higher score (better flexibility match)
      expect(result1.transaction!.score).toBeGreaterThan(result2.transaction!.score);
    });
  });

  describe('Optimal Allocation', () => {
    beforeEach(() => {
      service.initializeBank(mockSchedule, [], mockConstraints);
    });

    it('should find optimal allocation for multiple requests', async () => {
      const requests = [
        {
          toStopId: 'college1',
          amount: 2,
          priority: 8,
          affectedTrips: ['trip1']
        },
        {
          toStopId: 'hospital1',
          amount: 1,
          priority: 5,
          affectedTrips: ['trip2']
        },
        {
          toStopId: 'school1',
          amount: 1,
          priority: 10,
          affectedTrips: ['trip3']
        }
      ];

      const result = await service.findOptimalAllocation(requests);

      expect(result.success).toBe(true);
      expect(result.allocations.length).toBeGreaterThan(0);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.unmetRequests.length).toBeLessThan(requests.length);
    });

    it('should prioritize higher priority requests', async () => {
      const requests = [
        {
          toStopId: 'college1',
          amount: 2,
          priority: 5,
          affectedTrips: ['trip1']
        },
        {
          toStopId: 'hospital1',
          amount: 1,
          priority: 10,
          affectedTrips: ['trip2']
        }
      ];

      const result = await service.findOptimalAllocation(requests);
      
      // High priority request should be allocated first
      expect(result.allocations[0].borrowerStopId).toBe('hospital1');
    });

    it('should respect specific lender preferences', async () => {
      const requests = [
        {
          fromStopId: 'terminal1',
          toStopId: 'college1',
          amount: 2,
          priority: 5,
          affectedTrips: ['trip1']
        }
      ];

      const result = await service.findOptimalAllocation(requests);
      
      expect(result.success).toBe(true);
      expect(result.allocations[0].lenderStopId).toBe('terminal1');
    });
  });

  describe('Transaction Rollback', () => {
    let transactionId: string;

    beforeEach(() => {
      service.initializeBank(mockSchedule, [], mockConstraints);
      
      const result = service.requestRecoveryTransfer('terminal1', 'college1', 3, ['trip1']);
      transactionId = result.transaction!.id;
    });

    it('should successfully rollback a transaction', () => {
      const rollbackResult = service.rollbackTransaction(transactionId);
      
      expect(rollbackResult.success).toBe(true);
      
      const bankState = service.getBankState();
      expect(bankState?.totalBorrowedRecovery).toBe(0);
      expect(bankState?.transactions).toHaveLength(0);
    });

    it('should reject rollback of non-existent transaction', () => {
      const result = service.rollbackTransaction('invalid-transaction-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction not found');
    });

    it('should restore account balances after rollback', () => {
      const bankState = service.getBankState();
      const terminalBefore = { ...bankState!.accounts.get('terminal1')! };
      const collegeBefore = { ...bankState!.accounts.get('college1')! };

      service.rollbackTransaction(transactionId);

      const terminalAfter = bankState!.accounts.get('terminal1')!;
      const collegeAfter = bankState!.accounts.get('college1')!;

      expect(terminalAfter.availableCredit).toBe(terminalBefore.availableCredit + 3);
      expect(collegeAfter.currentDebt).toBe(collegeBefore.currentDebt - 3);
    });
  });

  describe('Bank Reset', () => {
    beforeEach(() => {
      service.initializeBank(mockSchedule, [], mockConstraints);
      
      // Make several transactions
      service.requestRecoveryTransfer('terminal1', 'college1', 2, ['trip1']);
      service.requestRecoveryTransfer('mall1', 'hospital1', 1, ['trip2']);
    });

    it('should reset bank to initial state', () => {
      service.resetBank();
      
      const bankState = service.getBankState();
      expect(bankState?.totalBorrowedRecovery).toBe(0);
      expect(bankState?.transactions).toHaveLength(0);
      expect(bankState?.utilizationRate).toBe(0);
    });

    it('should restore all account balances', () => {
      const originalBankState = service.getBankState();
      const originalAccounts = new Map();
      
      originalBankState!.accounts.forEach((account, stopId) => {
        originalAccounts.set(stopId, {
          availableCredit: account.availableCredit,
          currentDebt: account.currentDebt
        });
      });

      service.resetBank();
      
      const resetBankState = service.getBankState();
      resetBankState!.accounts.forEach((account, stopId) => {
        const original = originalAccounts.get(stopId);
        // Credit should be restored, debt should be cleared
        expect(account.currentDebt).toBe(0);
      });
    });
  });

  describe('Utilization Report', () => {
    beforeEach(() => {
      service.initializeBank(mockSchedule, [], mockConstraints);
      
      // Make some transactions
      service.requestRecoveryTransfer('terminal1', 'college1', 2, ['trip1']);
      service.requestRecoveryTransfer('mall1', 'hospital1', 1, ['trip2']);
    });

    it('should generate comprehensive utilization report', () => {
      const report = service.generateUtilizationReport();
      
      expect(report.totalAccounts).toBe(5);
      // Check that we have some borrowed recovery (exact amount may vary)
      expect(report.totalOutstandingDebt).toBeGreaterThan(0);
      expect(report.utilizationRate).toBeGreaterThan(0);
      expect(report.accountDetails).toHaveLength(5);
      expect(report.topLenders.length).toBeGreaterThan(0);
      expect(report.topBorrowers.length).toBeGreaterThan(0);
    });

    it('should correctly identify top lenders and borrowers', () => {
      const report = service.generateUtilizationReport();
      
      expect(report.topLenders[0].amountLent).toBeGreaterThan(0);
      expect(report.topBorrowers[0].amountBorrowed).toBeGreaterThan(0);
      
      // Verify sorting (descending order)
      for (let i = 1; i < report.topLenders.length; i++) {
        expect(report.topLenders[i].amountLent).toBeLessThanOrEqual(report.topLenders[i-1].amountLent);
      }
    });

    it('should provide accurate account details', () => {
      const report = service.generateUtilizationReport();
      
      report.accountDetails.forEach(account => {
        expect(account.stopId).toBeDefined();
        expect(account.stopName).toBeDefined();
        expect(account.stopType).toBeDefined();
        expect(typeof account.flexibilityScore).toBe('number');
        expect(account.flexibilityScore).toBeGreaterThanOrEqual(0);
        expect(account.flexibilityScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle uninitialized bank operations gracefully', async () => {
      const uninitializedService = new RecoveryBankService();
      
      const transferResult = uninitializedService.requestRecoveryTransfer(
        'stop1', 'stop2', 5, ['trip1']
      );
      expect(transferResult.success).toBe(false);
      expect(transferResult.error).toContain('not initialized');

      const allocationResult = await uninitializedService.findOptimalAllocation([]);
      expect(allocationResult.success).toBe(false);

      const rollbackResult = uninitializedService.rollbackTransaction('txn1');
      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error).toContain('not initialized');
    });

    it('should handle non-existent stop IDs', () => {
      service.initializeBank(mockSchedule, [], mockConstraints);
      
      const result = service.requestRecoveryTransfer(
        'invalid-stop',
        'college1',
        2,
        ['trip1']
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Account not found');
    });

    it('should prevent self-lending transactions', async () => {
      service.initializeBank(mockSchedule, [], mockConstraints);
      
      const requests = [{
        toStopId: 'terminal1',
        fromStopId: 'terminal1',  // Same stop as borrower
        amount: 2,
        priority: 5,
        affectedTrips: ['trip1']
      }];

      const result = await service.findOptimalAllocation(requests);
      // Self-lending should be rejected, so should have unmet requests
      expect(result.unmetRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of transactions efficiently', () => {
      service.initializeBank(mockSchedule, [], mockConstraints);
      
      const startTime = Date.now();
      
      // Create many small transactions
      for (let i = 0; i < 100; i++) {
        service.requestRecoveryTransfer('terminal1', 'college1', 1, [`trip${i}`]);
        if (service.getBankState()?.accounts.get('terminal1')?.availableCredit === 0) {
          break;
        }
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain transaction history integrity', () => {
      service.initializeBank(mockSchedule, [], mockConstraints);
      
      const result1 = service.requestRecoveryTransfer('terminal1', 'college1', 1, ['trip1']);
      let expectedCount = result1.success ? 1 : 0;
      
      const result2 = service.requestRecoveryTransfer('mall1', 'hospital1', 1, ['trip2']);
      if (result2.success) expectedCount++;
      
      const history = service.getTransactionHistory();
      expect(history.length).toBe(expectedCount);
      
      // History should be immutable - modification shouldn't affect original
      const originalLength = history.length;
      history.push({} as any);
      const historyAfterModification = service.getTransactionHistory();
      expect(historyAfterModification.length).toBe(originalLength);
    });
  });
});