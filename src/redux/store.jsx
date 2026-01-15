import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import dashboardReducer from './slices/dashboardSlice';
import inboxReducer from './slices/inboxSlice';
import contactReducer from './slices/contactSlice';
import templateReducer from './slices/templateSlice';
import broadcastReducer from './slices/broadcastSlice';
import assistantReducer from './slices/assistantSlice';
import settingsReducer from './slices/settingsSlice';

const store = configureStore({
  reducer: {
    user: userReducer,
    dashboard: dashboardReducer,
    inbox: inboxReducer,
    contact: contactReducer,
    template: templateReducer,
    broadcast: broadcastReducer,
    assistant: assistantReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types if needed
        ignoredActions: ['your/action/type'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['items.dates'],
      },
    }),
});

export { store };
export default store;
   