import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../utils/api';

export const fetchDoctorAppointments = createAsyncThunk(
  'doctors/fetchAppointments',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/api/doctor/appointments');
      if (response.data.success) return response.data.appointments || [];
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch');
    }
  }
);

export const fetchPatients = createAsyncThunk(
  'doctors/fetchPatients',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/api/doctor/patients');
      if (response.data.success) return response.data.patients || [];
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch patients');
    }
  }
);

export const fetchPatientHistory = createAsyncThunk(
  'doctors/fetchPatientHistory',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/api/doctor/patients/${patientId}/history`);
      if (response.data.success) return response.data.history;
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch history');
    }
  }
);

export const cancelAppointment = createAsyncThunk(
  'doctors/cancelAppointment',
  async (appointmentId, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch(
        `/api/doctor/appointments/${appointmentId}/cancel`
      );
      if (response.data.success) return { appointmentId, status: 'cancelled' };
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel');
    }
  }
);

export const updateAvailability = createAsyncThunk(
  'doctors/updateAvailability',
  async (availabilityData, { rejectWithValue }) => {
    try {
      const response = await apiClient.put('/api/doctor/availability', {
        availability: availabilityData,
      });
      if (response.data.success) return response.data.availability;
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Update failed');
    }
  }
);

export const updatePrescription = createAsyncThunk(
  'doctors/updatePrescription',
  async ({ appointmentId, formData }, { rejectWithValue }) => {
    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      const response = await apiClient.patch(
        `/api/doctor/appointments/${appointmentId}/prescription`,
        formData,
        config
      );
      if (response.data.success) return response.data.appointment;
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update prescription'
      );
    }
  }
);

export const deletePrescription = createAsyncThunk(
  'doctors/deletePrescription',
  async ({ appointmentId, prescriptionId }, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete(
        `/api/doctor/appointments/${appointmentId}/prescriptions/${prescriptionId}`
      );
      if (response.data.success) return response.data.appointment;
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to delete prescription'
      );
    }
  }
);

const doctorSlice = createSlice({
  name: 'doctors',
  initialState: {
    appointments: [],
    patients: [],
    patientHistory: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearAppointments: (state) => { state.appointments = []; },
    clearError: (state) => { state.error = null; },
    clearHistory: (state) => { state.patientHistory = []; },
    clearPatients: (state) => { state.patients = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDoctorAppointments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDoctorAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments = action.payload;
        state.error = null;
      })
      .addCase(fetchDoctorAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchPatients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.patients = action.payload;
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchPatientHistory.pending, (state) => { state.loading = true; })
      .addCase(fetchPatientHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.patientHistory = action.payload;
      })
      .addCase(fetchPatientHistory.rejected, (state) => { state.loading = false; })
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(
          (app) => app._id === action.payload.appointmentId
        );
        if (index !== -1) state.appointments[index].status = 'cancelled';
      })
      .addCase(updatePrescription.fulfilled, (state, action) => {
        const index = state.appointments.findIndex((app) => app._id === action.payload._id);
        if (index !== -1) state.appointments[index] = action.payload;
      })
      .addCase(deletePrescription.fulfilled, (state, action) => {
        const index = state.appointments.findIndex((app) => app._id === action.payload._id);
        if (index !== -1) state.appointments[index] = action.payload;
      });
  },
});

export const { clearAppointments, clearError, clearHistory, clearPatients } =
  doctorSlice.actions;
export default doctorSlice.reducer;