import React from 'react';

// Module-level singleton state surviving component remounts
export const kbDebugState = {
  lastEvent: 'INIT',
  emailFocusCount: 0,
  emailBlurCount: 0,
  emailMountCount: 0,
  emailUnmountCount: 0,
  neuralMountCount: 0,
  neuralUnmountCount: 0,
  keyboardShowCount: 0,
  keyboardHideCount: 0,
  loginMountCount: 0,
  loginUnmountCount: 0,
  brandingLoading: false,
  appNavLoading: false,
  currentRoute: 'Login',
  lastEventTime: '--:--:--',
  history: []
};

const listeners = new Set();

export const subscribeKbDebug = (listener) => {
  listeners.add(listener);
  listener({ ...kbDebugState });
  return () => {
    listeners.delete(listener);
  };
};

export const logKbEvent = (event, updates = {}) => {
  const d = new Date();
  const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  
  kbDebugState.lastEvent = event;
  kbDebugState.lastEventTime = timeStr;

  if (updates) {
    Object.assign(kbDebugState, updates);
  }

  kbDebugState.history = [
    `${timeStr} ${event}`,
    ...kbDebugState.history.slice(0, 9)
  ];

  const snap = { ...kbDebugState };
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch (e) {}
  });
};
