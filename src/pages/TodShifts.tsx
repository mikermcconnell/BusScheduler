import React from 'react';
import ShiftManagementPage from '../TodShifts/ShiftManagementPage';

/**
 * TOD Shifts route: mounts the fully featured shift management experience.
 * Keeping this wrapper maintains compatibility with existing routing imports.
 */
const TodShifts: React.FC = () => {
  return <ShiftManagementPage />;
};

export default TodShifts;
