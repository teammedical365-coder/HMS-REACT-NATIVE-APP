import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, adminAPI, hospitalAdminAPI } from '../../utils/api';
import { STORAGE_KEYS } from '../../utils/Constants';

// ── OTP-Based Login Thunks ────────────────────────────────────────────────────

export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async ({ email, password, hospitalId, hospitalSlug, loginType }, { rejectWithValue }) => {
    try {
      const response = await authAPI.sendOtp(email, password, hospitalId, hospitalSlug, loginType);
      if (response.success) {
        if (response.otpBypassed && !response.activeSessionExists && response.token) {
          await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        }
        return response;
      }
      return rejectWithValue(response.message || 'Failed to send OTP');
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || 'Failed to send OTP';
      const networkCode = error.code ? ` (${error.code})` : '';
      return rejectWithValue(errMsg + networkCode);
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ preAuthToken, otp }, { rejectWithValue }) => {
    try {
      const response = await authAPI.verifyOtp(preAuthToken, otp);
      if (response.success) {
        if (!response.activeSessionExists && response.token) {
          await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        }
        return response;
      }
      return rejectWithValue(response.message || 'OTP verification failed');
    } catch (error) {
      const data = error.response?.data;
      return rejectWithValue({
        message: data?.message || 'OTP verification failed',
        otpExpired: data?.otpExpired || false,
        attemptsRemaining: data?.attemptsRemaining,
      });
    }
  }
);

export const resendOtp = createAsyncThunk(
  'auth/resendOtp',
  async ({ preAuthToken }, { rejectWithValue }) => {
    try {
      const response = await authAPI.resendOtp(preAuthToken);
      if (response.success) return response;
      return rejectWithValue(response.message || 'Failed to resend OTP');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to resend OTP');
    }
  }
);

export const forceLogin = createAsyncThunk(
  'auth/forceLogin',
  async ({ preAuthToken }, { rejectWithValue }) => {
    try {
      const response = await authAPI.forceLogin(preAuthToken);
      if (response.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        return response;
      }
      return rejectWithValue(response.message || 'Failed to complete login');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to complete login');
    }
  }
);

// ── Legacy Thunks ─────────────────────────────────────────────────────────────

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password, hospitalId }, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(email, password, hospitalId);
      if (response.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        return response;
      }
      return rejectWithValue(response.message || 'Login failed');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const signupUser = createAsyncThunk(
  'auth/signupUser',
  async ({ name, email, password, phone }, { rejectWithValue }) => {
    try {
      const response = await authAPI.signup(name, email, password, phone);
      if (response.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        return response;
      }
      return rejectWithValue(response.message || 'Signup failed');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Signup failed');
    }
  }
);

export const loginAdmin = createAsyncThunk(
  'auth/loginAdmin',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await adminAPI.login(email, password);
      if (response.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        return response;
      }
      return rejectWithValue(response.message || 'Login failed');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const loginHospitalAdmin = createAsyncThunk(
  'auth/loginHospitalAdmin',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await hospitalAdminAPI.login(email, password);
      if (response.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        return response;
      }
      return rejectWithValue(response.message || 'Login failed');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const signupAdmin = createAsyncThunk(
  'auth/signupAdmin',
  async ({ name, email, password, phone }, { rejectWithValue }) => {
    try {
      const response = await adminAPI.signup(name, email, password, phone);
      if (response.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
        return response;
      }
      return rejectWithValue(response.message || 'Signup failed');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Signup failed');
    }
  }
);

// ── Initial State ─────────────────────────────────────────────────────────────
// Note: redux-persist rehydrates user/token/isAuthenticated from AsyncStorage automatically.
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  otpStep: null,
  preAuthToken: null,
  otpEmail: null,
  activeSession: null,
  otpSuccessMsg: null,
  sessionExpiredMessage: null,
};

// ── Slice ─────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.otpStep = null;
      state.preAuthToken = null;
      state.otpEmail = null;
      state.activeSession = null;
      state.otpSuccessMsg = null;
      state.sessionExpiredMessage = null;
      // AsyncStorage cleanup happens via redux-persist on next rehydrate.
      // Manually clear as well for immediate effect:
      AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
    },
    clearError: (state) => {
      state.error = null;
      state.otpSuccessMsg = null;
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
    },
    resetOtpFlow: (state) => {
      state.otpStep = null;
      state.preAuthToken = null;
      state.otpEmail = null;
      state.activeSession = null;
      state.error = null;
      state.otpSuccessMsg = null;
    },
    clearSessionExpiredMessage: (state) => {
      state.sessionExpiredMessage = null;
    },
    setSessionExpiredMessage: (state, action) => {
      state.sessionExpiredMessage = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Send OTP
    builder
      .addCase(sendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.otpSuccessMsg = null;
      })
      .addCase(sendOtp.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.otpBypassed) {
          if (action.payload.activeSessionExists) {
            state.otpStep = 'session_check';
            state.preAuthToken = action.payload.preAuthToken;
            state.activeSession = action.payload.activeSessions || action.payload.activeSession;
          } else {
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.isAuthenticated = true;
            state.otpStep = null;
            state.preAuthToken = null;
            state.otpEmail = null;
            state.activeSession = null;
          }
        } else {
          state.otpStep = 'otp';
          state.preAuthToken = action.payload.preAuthToken;
          state.otpEmail = action.payload.email;
        }
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Verify OTP
    builder
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.otpSuccessMsg = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.activeSessionExists) {
          state.otpStep = 'session_check';
          state.activeSession = action.payload.activeSessions || action.payload.activeSession;
        } else {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.isAuthenticated = true;
          state.otpStep = null;
          state.preAuthToken = null;
          state.otpEmail = null;
          state.activeSession = null;
        }
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        if (typeof payload === 'object' && payload !== null) {
          state.error = payload.message || 'OTP verification failed';
          if (payload.otpExpired) {
            state.otpStep = null;
            state.preAuthToken = null;
            state.otpEmail = null;
          }
        } else {
          state.error = payload || 'OTP verification failed';
        }
      });

    // Resend OTP
    builder
      .addCase(resendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.otpSuccessMsg = null;
      })
      .addCase(resendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.otpSuccessMsg = action.payload.message || 'New OTP sent successfully';
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Force Login
    builder
      .addCase(forceLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forceLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.otpStep = null;
        state.preAuthToken = null;
        state.otpEmail = null;
        state.activeSession = null;
      })
      .addCase(forceLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Legacy Login User
    builder
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Signup User
    builder
      .addCase(signupUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Login Admin
    builder
      .addCase(loginAdmin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Signup Admin
    builder
      .addCase(signupAdmin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(signupAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(signupAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Login Hospital Admin
    builder
      .addCase(loginHospitalAdmin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginHospitalAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginHospitalAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  logout,
  clearError,
  updateUser,
  resetOtpFlow,
  clearSessionExpiredMessage,
  setSessionExpiredMessage,
} = authSlice.actions;

export default authSlice.reducer;