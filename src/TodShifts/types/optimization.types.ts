import { DayType } from './shift.types';

export interface OptimizationReport {
  generatedAt: string;
  totalShifts: number;
  compliantShifts: number;
  warningShifts: number;
  deficitIntervals: number;
  deficitByDayType: Record<DayType, number>;
  warnings: string[];
  strategy?: 'heuristic' | 'solver';
  solverWarnings?: string[];
}
