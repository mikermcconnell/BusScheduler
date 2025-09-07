# Schedule Command Center Integration Guide

This directory contains the foundational components for the Schedule Command Center, a unified workspace that transforms the linear wizard workflow into a flexible, panel-based interface.

## Architecture Overview

The Schedule Command Center consists of three main architectural layers:

### 1. Foundation Layer
- **Feature Flag System** (`src/utils/featureFlags.ts`) - Gradual rollout control
- **Event Bus Architecture** (`src/services/workspaceEventBus.ts`) - Type-safe cross-panel communication
- **Centralized State Management** (`src/contexts/WorkspaceContext.tsx`) - React 19 concurrent features

### 2. Component Layer
- **ScheduleCommandCenter** - Main container component
- **WorkspaceLayout** - CSS Grid-based 3-zone layout system
- **PanelContainer** - Floating/dockable panels with drag & drop
- **WorkspaceSidebar** - Navigation and control panel
- **WorkspaceStatusBar** - Real-time status and performance metrics

### 3. Integration Layer
- **Hooks** (`src/hooks/useWorkspaceState.ts`) - Optimized state selectors
- **Security Integration** - Uses existing `inputSanitizer` and validation
- **Firebase Sync** - Integrates with `draftService` for cloud storage

## Integration with Existing Application

### 1. Adding to App.tsx

```tsx
import { FeatureFlagProvider } from './contexts/FeatureFlagContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ScheduleCommandCenter } from './components/workspace';
import { useFeatureFlags } from './contexts/FeatureFlagContext';

function App() {
  return (
    <AuthProvider>
      <FeatureFlagProvider>
        <WorkspaceProvider>
          <MainAppContent />
        </WorkspaceProvider>
      </FeatureFlagProvider>
    </AuthProvider>
  );
}

function MainAppContent() {
  const { isCommandCenter } = useFeatureFlags();
  
  return (
    <Router>
      <Routes>
        {isCommandCenter ? (
          <Route path="/*" element={<ScheduleCommandCenter />} />
        ) : (
          // Existing wizard routes
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadSchedule />} />
            <Route path="/timepoints" element={<TimePoints />} />
            {/* ... other routes */}
          </>
        )}
      </Routes>
    </Router>
  );
}
```

### 2. Feature Flag Control

Users can switch between modes via:
- Settings panel in the sidebar
- Feature flag toggles
- URL parameters (for testing)

```tsx
const { toggleCommandCenter } = useFeatureFlags();

// Toggle between wizard and command center
const handleModeSwitch = async () => {
  const newMode = await toggleCommandCenter();
  // Mode switch is automatic via context
};
```

### 3. Panel Integration

Existing page components can be wrapped as panels:

```tsx
// Example: Convert TimePoints page to panel
import { TimePoints } from '../pages/TimePoints';

const TimepointsPanel: React.FC<{ panel: PanelState }> = ({ panel }) => {
  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <TimePoints />
    </Box>
  );
};
```

## Key Features

### Security Hardening Integration
- All event payloads are sanitized using existing `inputSanitizer`
- Feature flags integrate with Firebase user preferences
- Draft operations use existing validation systems
- Memory limits and processing timeouts are preserved

### Performance Optimizations
- React 19 concurrent features for responsive UI
- Event bus with debouncing and throttling
- Panel virtualization for large datasets
- Memory usage monitoring and cleanup

### Accessibility & UX
- Keyboard shortcuts for all major actions
- Screen reader support for panel management
- High contrast mode compatibility
- Responsive design for all screen sizes

## Migration Strategy

### Phase 1: Foundation (Completed)
- ✅ Feature flag system implemented
- ✅ Event bus architecture created
- ✅ Workspace context established
- ✅ Basic UI components built
- ✅ Security integration verified

### Phase 2: Panel Implementation
- Wrap existing pages as panels
- Implement panel-specific features
- Add drag & drop functionality
- Create panel templates

### Phase 3: Advanced Features
- Real-time collaboration
- Advanced analytics
- Connection scheduling
- Draft library enhancements

## Usage Examples

### Opening Panels Programmatically
```tsx
const { openPanel } = useWorkspace();

// Open upload panel with specific data
openPanel('upload-123', 'upload', {
  prefillData: someData
});

// Open timepoints analysis
openPanel('timepoints-456', 'timepoints');
```

### Event Bus Communication
```tsx
import { emit, subscribe } from '../services/workspaceEventBus';

// Emit data update event
emit({
  type: 'schedule-data',
  source: 'timepoints-panel',
  priority: 1,
  payload: {
    dataType: 'service-bands',
    action: 'update',
    data: newServiceBands
  }
});

// Subscribe to events
const subscription = subscribe('schedule-data', (event) => {
  if (event.payload.dataType === 'service-bands') {
    // Update UI with new service bands
    updateServiceBands(event.payload.data);
  }
});
```

### Feature Flag Usage
```tsx
import { useFeature, FeatureFlag } from '../contexts/FeatureFlagContext';

const MyComponent = () => {
  const isAnalyticsEnabled = useFeature(FeatureFlag.ADVANCED_ANALYTICS);
  const isDraftLibraryEnabled = useFeature(FeatureFlag.DRAFT_LIBRARY);
  
  return (
    <Box>
      {isAnalyticsEnabled && <AnalyticsPanel />}
      {isDraftLibraryEnabled && <DraftLibraryPanel />}
    </Box>
  );
};
```

## Configuration

### Feature Flag Configuration
Feature flags can be configured in `src/utils/featureFlags.ts`:
- Rollout percentages
- Environment restrictions
- User group targeting
- A/B testing support

### Event Bus Configuration
Event bus settings in `src/services/workspaceEventBus.ts`:
- History size limits
- Debug logging
- Performance monitoring
- Metric collection

## Testing

### Manual Testing
1. Enable Command Center mode in settings
2. Open multiple panels
3. Test drag & drop functionality
4. Verify keyboard shortcuts work
5. Check responsive behavior

### Automated Testing
```tsx
import { render, fireEvent } from '@testing-library/react';
import { ScheduleCommandCenter } from './ScheduleCommandCenter';

test('opens panel when clicking toolbar button', () => {
  const { getByLabelText } = render(<ScheduleCommandCenter />);
  const uploadButton = getByLabelText(/upload/i);
  
  fireEvent.click(uploadButton);
  
  expect(getByText('File Upload Panel')).toBeInTheDocument();
});
```

## Troubleshooting

### Common Issues

1. **Panels not opening**
   - Check feature flags are enabled
   - Verify workspace context is provided
   - Check console for event bus errors

2. **Performance issues**
   - Monitor memory usage in status bar
   - Check event bus metrics
   - Ensure panel virtualization is working

3. **State synchronization problems**
   - Verify event bus subscriptions
   - Check Firebase connection status
   - Review draft service logs

### Debug Tools

- Event bus statistics in performance metrics
- Workspace state inspector in React DevTools
- Feature flag debugging in browser console

## Next Steps

1. **Integrate with existing pages** - Convert wizard pages to panels
2. **Enhance drag & drop** - Add more docking zones and layouts
3. **Add collaboration features** - Real-time multi-user editing
4. **Performance optimization** - Bundle splitting and lazy loading
5. **Analytics integration** - User behavior tracking and insights

The foundation is now complete and ready for gradual rollout and enhancement.