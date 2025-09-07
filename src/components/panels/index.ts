/**
 * Panel Components Index
 * Export all panel components for the Schedule Command Center workspace
 */

export { default as UploadPanel } from './UploadPanel';
export { default as ExportPanel } from './ExportPanel';

// Export the panel props interface for typing
export interface PanelProps {
  panelId: string;
  data?: any;
  onClose?: () => void;
  onMinimize?: () => void;
}