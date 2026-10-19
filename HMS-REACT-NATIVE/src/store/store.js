import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from '@reduxjs/toolkit';

import authReducer, { logout, performLogoutCleanup } from './slices/authSlice';
import appointmentReducer from './slices/appointmentSlice';
import doctorReducer from './slices/doctorSlice';
import serviceReducer from './slices/serviceSlice';
import publicDataReducer from './slices/publicDataSlice';
import adminEntitiesReducer from './slices/adminEntitiesSlice';
import labReducer from './slices/labSlice';
import notificationReducer from './slices/notificationSlice';
import offlineReducer, { resetOfflineState } from './slices/offlineSlice';
import { setStoreRef, setLogoutThunk } from './storeRef';
import { initOfflineReduxBridge } from '../services/offline/offlineReduxBridge';

// Persist only the auth slice — keeps the user logged in across app restarts.
// All other slices are transient and refetch fresh data on mount.
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['user', 'token', 'isAuthenticated'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  appointments: appointmentReducer,
  doctors: doctorReducer,
  services: serviceReducer,
  publicData: publicDataReducer,
  adminEntities: adminEntitiesReducer,
  lab: labReducer,
  notifications: notificationReducer,
  offline: offlineReducer,
});

/**
 * Middleware safety net:
 * Intercepts any direct { type: 'auth/logout' } action dispatch, captures the
 * departing user before the reducer clears state, and executes safe cleanup.
 */
const authLogoutMiddleware = (storeApi) => (next) => (action) => {
  if (action?.type === 'auth/logout') {
    const currentUser = storeApi.getState()?.auth?.user || storeApi.getState()?.auth?.departingUser;
    storeApi.dispatch(resetOfflineState());
    if (currentUser) {
      performLogoutCleanup(currentUser).catch(() => {});
    }
  }
  return next(action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(authLogoutMiddleware),
});

export const persistor = persistStore(store);

setStoreRef(store);
setLogoutThunk(logout);
initOfflineReduxBridge(store);

export default store;