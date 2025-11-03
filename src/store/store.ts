import { configureStore } from '@reduxjs/toolkit';
import shiftManagementReducer from '../TodShifts/store/shiftManagementSlice';

export const store = configureStore({
  reducer: {
    shiftManagement: shiftManagementReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
