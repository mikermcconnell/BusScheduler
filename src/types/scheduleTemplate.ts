/**
 * Schedule Template Types
 * Allows saving and reusing common schedule patterns
 */

import { ServiceBand } from './schedule';

export interface BlockConfiguration {
  blockNumber: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description?: string;
  routeType?: string; // e.g., "urban", "suburban", "express"
  
  // Template configuration
  numberOfBuses: number;
  cycleTimeMinutes: number;
  
  // Service bands configuration
  serviceBands: ServiceBand[];
  
  // Block configurations
  blockConfigurations: BlockConfiguration[];
  
  // Recovery time templates by service band
  recoveryTemplates: {
    [serviceBandName: string]: number[];
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  tags?: string[];
}

export interface TemplateLibrary {
  templates: ScheduleTemplate[];
  lastModified: string;
}

export interface TemplateApplyOptions {
  applyServiceBands: boolean;
  applyBlockConfig: boolean;
  applyRecoveryTimes: boolean;
  adjustForTimepoints?: boolean; // Adjust template to match current route's timepoints
}