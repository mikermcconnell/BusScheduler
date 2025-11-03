import { MasterScheduleRequirement } from '../types/shift.types';

/**
 * Parse a CSV file containing master schedule requirements
 */
export async function parseMasterSchedule(file: File): Promise<MasterScheduleRequirement[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const requirements: MasterScheduleRequirement[] = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const columns = line.split(',');
          if (columns.length >= 4) {
            const requirement: MasterScheduleRequirement = {
              scheduleType: columns[0].trim() as 'weekday' | 'saturday' | 'sunday',
              timeSlot: columns[1].trim(),
              zone: columns[2].trim() as 'North' | 'South' | 'Floater',
              requiredBuses: parseInt(columns[3].trim()),
              effectiveDate: columns[4]?.trim()
            };
            
            requirements.push(requirement);
          }
        }
        
        resolve(requirements);
      } catch (error) {
        reject(new Error(`Failed to parse master schedule: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Validate master schedule data
 */
export function validateMasterSchedule(requirements: MasterScheduleRequirement[]): string[] {
  const errors: string[] = [];
  
  requirements.forEach((req, index) => {
    if (!['weekday', 'saturday', 'sunday'].includes(req.scheduleType)) {
      errors.push(`Row ${index + 1}: Invalid schedule type "${req.scheduleType}"`);
    }
    
    if (!req.timeSlot.match(/^\d{2}:\d{2}$/)) {
      errors.push(`Row ${index + 1}: Invalid time format "${req.timeSlot}". Use HH:MM format`);
    }
    
    if (!['North', 'South', 'Floater'].includes(req.zone)) {
      errors.push(`Row ${index + 1}: Invalid zone "${req.zone}"`);
    }
    
    if (req.requiredBuses < 0 || isNaN(req.requiredBuses)) {
      errors.push(`Row ${index + 1}: Invalid required buses value "${req.requiredBuses}"`);
    }
  });
  
  return errors;
}