/**
 * Schedule Template Service
 * Manages saving, loading, and applying schedule templates
 */

import { ScheduleTemplate, TemplateLibrary, TemplateApplyOptions } from '../types/scheduleTemplate';
interface Schedule {
  id?: string;
  name?: string;
  trips: Array<{
    tripNumber: number;
    blockNumber: number;
    departureTime: string;
    serviceBand?: string;
    arrivalTimes: { [timepointId: string]: string };
    recoveryTimes?: { [timepointId: string]: number };
  }>;
  timePoints: Array<{ id: string; name: string }>;
  serviceBands?: any[];
  blockConfigurations?: any[];
  numberOfBuses?: number;
  cycleTimeMinutes?: number;
}

const TEMPLATE_STORAGE_KEY = 'scheduleTemplates';

class ScheduleTemplateService {
  /**
   * Load all templates from localStorage
   */
  getTemplateLibrary(): TemplateLibrary {
    try {
      const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading template library:', error);
    }
    
    return {
      templates: this.getDefaultTemplates(),
      lastModified: new Date().toISOString()
    };
  }

  /**
   * Save a schedule as a template
   */
  saveAsTemplate(schedule: Schedule, templateName: string, description?: string): ScheduleTemplate {
    const template: ScheduleTemplate = {
      id: `template_${Date.now()}`,
      name: templateName,
      description,
      numberOfBuses: schedule.blockConfigurations?.length || 0,
      cycleTimeMinutes: schedule.cycleTimeMinutes || 60,
      serviceBands: schedule.serviceBands || [],
      blockConfigurations: schedule.blockConfigurations || [],
      recoveryTemplates: this.extractRecoveryTemplates(schedule),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    const library = this.getTemplateLibrary();
    library.templates.push(template);
    library.lastModified = new Date().toISOString();
    
    this.saveTemplateLibrary(library);
    return template;
  }

  /**
   * Apply a template to current schedule
   */
  applyTemplate(
    currentSchedule: Schedule, 
    templateId: string, 
    options: TemplateApplyOptions
  ): Schedule {
    const library = this.getTemplateLibrary();
    const template = library.templates.find(t => t.id === templateId);
    
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let updatedSchedule = { ...currentSchedule };

    if (options.applyServiceBands) {
      updatedSchedule.serviceBands = [...template.serviceBands];
    }

    if (options.applyBlockConfig) {
      updatedSchedule.blockConfigurations = [...template.blockConfigurations];
      updatedSchedule.numberOfBuses = template.numberOfBuses;
      updatedSchedule.cycleTimeMinutes = template.cycleTimeMinutes;
    }

    if (options.applyRecoveryTimes) {
      // Apply recovery templates to trips
      updatedSchedule.trips = updatedSchedule.trips.map(trip => {
        const serviceBandName = trip.serviceBand || '';
        const recoveryTemplate = template.recoveryTemplates[serviceBandName];
        
        if (recoveryTemplate) {
          const updatedRecoveryTimes = { ...trip.recoveryTimes };
          
          currentSchedule.timePoints.forEach((tp, index) => {
            if (index < recoveryTemplate.length) {
              updatedRecoveryTimes[tp.id] = recoveryTemplate[index];
            }
          });
          
          return {
            ...trip,
            recoveryTimes: updatedRecoveryTimes
          };
        }
        
        return trip;
      });
    }

    // Update usage count
    template.usageCount++;
    template.updatedAt = new Date().toISOString();
    this.saveTemplateLibrary(library);

    return updatedSchedule;
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId: string): void {
    const library = this.getTemplateLibrary();
    library.templates = library.templates.filter(t => t.id !== templateId);
    library.lastModified = new Date().toISOString();
    this.saveTemplateLibrary(library);
  }

  /**
   * Update template metadata
   */
  updateTemplate(templateId: string, updates: Partial<ScheduleTemplate>): void {
    const library = this.getTemplateLibrary();
    const templateIndex = library.templates.findIndex(t => t.id === templateId);
    
    if (templateIndex !== -1) {
      library.templates[templateIndex] = {
        ...library.templates[templateIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      library.lastModified = new Date().toISOString();
      this.saveTemplateLibrary(library);
    }
  }

  /**
   * Extract recovery templates from schedule
   */
  private extractRecoveryTemplates(schedule: Schedule): { [serviceBandName: string]: number[] } {
    const templates: { [serviceBandName: string]: number[] } = {};
    
    // Group trips by service band and extract common recovery patterns
    const tripsByServiceBand = new Map<string, typeof schedule.trips>();
    
    schedule.trips.forEach(trip => {
      const band = trip.serviceBand || 'default';
      if (!tripsByServiceBand.has(band)) {
        tripsByServiceBand.set(band, []);
      }
      tripsByServiceBand.get(band)!.push(trip);
    });

    // Extract the most common recovery pattern for each service band
    tripsByServiceBand.forEach((trips, serviceBand) => {
      if (trips.length > 0 && schedule.timePoints) {
        const firstTrip = trips[0];
        const pattern: number[] = [];
        
        schedule.timePoints.forEach(tp => {
          pattern.push(firstTrip.recoveryTimes?.[tp.id] || 0);
        });
        
        templates[serviceBand] = pattern;
      }
    });

    return templates;
  }

  /**
   * Save template library to localStorage
   */
  private saveTemplateLibrary(library: TemplateLibrary): void {
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(library));
    } catch (error) {
      console.error('Error saving template library:', error);
    }
  }

  /**
   * Get default templates
   */
  private getDefaultTemplates(): ScheduleTemplate[] {
    return [
      {
        id: 'default_urban',
        name: 'Urban Route Template',
        description: 'Standard urban route with 15-minute frequency',
        routeType: 'urban',
        numberOfBuses: 4,
        cycleTimeMinutes: 60,
        serviceBands: [],
        blockConfigurations: [],
        recoveryTemplates: {
          'Fastest Service': [0, 1, 1, 2, 3],
          'Fast Service': [0, 1, 2, 2, 4],
          'Standard Service': [0, 2, 2, 3, 5],
          'Slow Service': [0, 2, 3, 3, 6],
          'Slowest Service': [0, 3, 3, 4, 7]
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        tags: ['urban', '15-min', 'standard']
      },
      {
        id: 'default_express',
        name: 'Express Route Template',
        description: 'Express service with limited stops',
        routeType: 'express',
        numberOfBuses: 2,
        cycleTimeMinutes: 90,
        serviceBands: [],
        blockConfigurations: [],
        recoveryTemplates: {
          'Express Service': [0, 0, 0, 5]
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        tags: ['express', 'limited-stop']
      }
    ];
  }
}

export const scheduleTemplateService = new ScheduleTemplateService();