// Store reference for use in non-React contexts (like API interceptors)
let storeRef = null;
let logoutThunkRef = null;

export const setStoreRef = (store) => {
  storeRef = store;
};

export const getStoreRef = () => storeRef;

export const setLogoutThunk = (thunk) => {
  logoutThunkRef = thunk;
};

export const getLogoutThunk = () => logoutThunkRef;

/**
 * Safely dispatches the logout thunk if registered, or falls back to plain action.
 * Completely eliminates circular dependencies between api.js, authSlice.js, and store.js.
 */
export const dispatchLogout = () => {
  if (storeRef) {
    if (typeof logoutThunkRef === 'function') {
      storeRef.dispatch(logoutThunkRef());
    } else {
      storeRef.dispatch({ type: 'auth/logout' });
    }
  }
};