import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from '@reduxjs/toolkit';

import authReducer from './slices/authSlice';
import appointmentReducer from './slices/appointmentSlice';
import doctorReducer from './slices/doctorSlice';
import serviceReducer from './slices/serviceSlice';
import publicDataReducer from './slices/publicDataSlice';
import adminEntitiesReducer from './slices/adminEntitiesSlice';
import labReducer from './slices/labSlice';
import notificationReducer from './slices/notificationSlice';
import { setStoreRef } from './storeRef';

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
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

setStoreRef(store);

export default store;