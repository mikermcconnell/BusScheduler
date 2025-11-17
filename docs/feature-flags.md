# Feature Flags

This project already ships with a reusable feature flag system so we can keep unfinished areas hidden while still deploying production-ready work. The key pieces live in:

- `src/utils/featureFlags.ts` – defines each flag, default values, and any rollout/environment rules. The manager keeps a local cache backed by `localStorage` and (when the user is authenticated) mirrors the overrides in Firestore.
- `src/contexts/FeatureFlagContext.tsx` – exposes flag state and setters through React context + hooks (`useFeatureFlags`, `useFeature`, `useCommandCenter`). The provider wraps the workspace/router layer inside `src/App.tsx`, so hooks are safe to use anywhere in the tree.

## Adding or Editing Flags

1. Add a new entry to the `FeatureFlag` enum in `src/utils/featureFlags.ts`.
2. Append a configuration block to `FEATURE_FLAGS` with a `defaultValue` and optional rollout/environment restrictions.
3. If you need the flag to persist for authenticated users, no extra work is required—the manager automatically creates per-user documents in the `user_features` collection.
4. Re-export or document the flag where needed (e.g., update any admin UI that should toggle it).

## Gating UI or Logic

Use the hooks to hide unfinished UI:

```tsx
import { FeatureFlag, useFeature } from '../contexts/FeatureFlagContext';

const DraftLibraryPanel = () => {
  const draftLibraryEnabled = useFeature(FeatureFlag.DRAFT_LIBRARY);
  if (!draftLibraryEnabled) return null;

  return <DraftLibrary />;
};
```

For more complex flows you can pull multiple booleans at once:

```tsx
const { isAdvancedAnalytics, isWorkspacePanels } = useFeatureFlags();
```

Because the provider initializes asynchronously, components can also read `isLoading` to render skeletons until flag values are ready.

## Toggling Flags Locally

- The current values are stored in `localStorage.featureFlags`; editing that JSON manually or clearing local storage resets to defaults.
- During development you can call the context helpers from any component (e.g., wire a temporary button to `setFeatureFlag(FeatureFlag.REAL_TIME_COLLAB, true)`).
- Authenticated users persist overrides in Firestore, so the same toggles follow them across browsers. Anonymous/local usage just falls back to the defaults defined in the configuration.

## Deployment Safety

Only ship code that defaults unfinished features to `false`. When you are ready to expose a feature:

1. Flip `defaultValue` to `true`, or
2. Update `rolloutPercentage`/`environments` to control gradual exposure, or
3. Use an admin-only control panel to call `setFeatureFlag` for specific users.

By keeping under-construction work behind flags, we can deploy frequently without exposing incomplete UI. Document new toggles in this file so the team knows how to enable them. 

## Navigation Controls for Publication

To keep the production build focused on the ToD Shift Management workflow we added dedicated flags for each main navigation entry:

- `NAV_NEW_SCHEDULE`
- `NAV_EDIT_SCHEDULE`
- `NAV_BROWSE_SCHEDULES`
- `NAV_MANAGE_ROUTES`
- `NAV_BLOCK_CONFIGURATION`

These default to `true` in development/staging (so localhost keeps the whole toolbelt) but are automatically `false` in production. The top navigation (`src/components/Navigation.tsx`), sidebar (`src/components/SidebarNavigation.tsx`), and route protection inside `src/components/Layout.tsx` all read these flags, so users cannot reach those areas when they are disabled. Flip the `environments` array or `defaultValue` if you want to expose any of them publicly later. 
