/**
 * offlineSlice.js — Redux state for Offline-First React Native HMS
 *
 * Exposes offline/online status, sync progress, and pending SQLite queue count
 * to all React Native components via Redux. Driven by events from
 * networkStatus.js, offlineQueue.js, and offlineReduxBridge.js.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isOnline: typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true,
  syncStatus: 'idle', // 'idle' | 'syncing' | 'error' | 'complete'
  pendingCount: 0,
  lastSyncAt: null,
  syncProgress: null, // { processed, total, succeeded, failed }
  syncErrors: [],
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus(state, action) {
      state.isOnline = Boolean(action.payload);
      if (action.payload && state.syncStatus === 'error') {
        state.syncStatus = 'idle';
      }
    },

    setSyncStatus(state, action) {
      state.syncStatus = action.payload;
    },

    setPendingCount(state, action) {
      state.pendingCount = Math.max(0, Number(action.payload) || 0);
    },

    setSyncProgress(state, action) {
      state.syncProgress = action.payload;
    },

    setSyncComplete(state, action) {
      const { succeeded = 0, failed = 0, errors = [], remainingCount = 0 } = action.payload || {};
      state.syncStatus = errors.length > 0 ? 'error' : 'complete';
      state.pendingCount = Math.max(0, Number(remainingCount) || 0);
      state.lastSyncAt = Date.now();
      state.syncProgress = null;
      state.syncErrors = (errors || []).map((e) => ({
        message: e?.error || e?.message || 'Synchronization failure',
        operationId: e?.operationId || '',
        timestamp: Date.now(),
      }));
    },

    setSyncError(state, action) {
      state.syncStatus = 'error';
      const errMsg = action.payload?.message || String(action.payload || 'Sync failed');
      state.syncErrors = [
        {
          message: errMsg,
          operationId: action.payload?.operationId || '',
          timestamp: Date.now(),
        },
      ];
    },

    clearSyncErrors(state) {
      state.syncErrors = [];
      if (state.syncStatus === 'error') {
        state.syncStatus = 'idle';
      }
    },

    resetSyncStatus(state) {
      state.syncStatus = 'idle';
      state.syncProgress = null;
    },

    // Clean reset on user logout or tenant change to avoid leaking sync info
    resetOfflineState(state) {
      state.syncStatus = 'idle';
      state.pendingCount = 0;
      state.syncProgress = null;
      state.syncErrors = [];
    },
  },
});

export const {
  setOnlineStatus,
  setSyncStatus,
  setPendingCount,
  setSyncProgress,
  setSyncComplete,
  setSyncError,
  clearSyncErrors,
  resetSyncStatus,
  resetOfflineState,
} = offlineSlice.actions;

export default offlineSlice.reducer;
