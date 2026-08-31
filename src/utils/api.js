import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, STORAGE_KEYS } from './Constants';

export const baseURL = API_BASE_URL;

// ─── Navigation ref for redirects from interceptors ────────────────────────
// Set by AppNavigator via navigationRef.current
let _navigationDispatch = null;
export const setNavigationDispatch = (fn) => { _navigationDispatch = fn; };

// ─── Main API Client ────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

export const setAuthHeader = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Check if the failing request is the OTP verification route
    const isOtpVerifyRoute = error.config?.url?.includes('/otp/verify');

    // Only clear storage and trigger session expiry if it's NOT the OTP route
    if (error.response?.status === 401 && !isOtpVerifyRoute) {
      const isSessionExpired = error.response?.data?.sessionExpired;
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      
      if (isSessionExpired) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SESSION_EXPIRED_MESSAGE,
          error.response?.data?.message ||
            'Your account has been logged in from another device. Please login again.'
        );
      }
    }
    
    return Promise.reject(error);
  }
);

// ─── Auth API ───────────────────────────────────────────────────────────────
export const authAPI = {
  login: async (email, password, hospitalId) => {
    const payload = { email, password };
    if (hospitalId) payload.hospitalId = hospitalId;
    const response = await apiClient.post('/api/auth/login', payload);
    return response.data;
  },
  signup: async (name, email, password, phone = '') => {
    const response = await apiClient.post('/api/auth/signup', { name, email, password, phone });
    return response.data;
  },
  sendOtp: async (email, password, hospitalId, hospitalSlug, loginType) => {
    try {
      const payload = { email, password, loginType };
      if (hospitalId) payload.hospitalId = hospitalId;
      if (hospitalSlug) payload.hospitalSlug = hospitalSlug;
      const response = await apiClient.post('/api/auth/otp/send', payload);
      return response.data;
    } catch (error) {
      console.error('[Axios Network Error in sendOtp]:', {
        code: error.code,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  },
  
  verifyOtp: async (preAuthToken, otp) => {
    console.log("🚀 LATEST CODE RUNNING NOW!");
  const cleanOtp = String(otp).trim();
  const response = await apiClient.post(
    '/api/auth/otp/verify', 
    { preAuthToken, otp: cleanOtp },
    { headers: { Authorization: `Bearer ${preAuthToken}` } }
  );
  return response.data;
},
  resendOtp: async (preAuthToken) => {
    console.log("🔥 [api.js] resendOtp sending preAuthToken:", preAuthToken);
    const response = await apiClient.post(
      '/api/auth/otp/resend', 
      { preAuthToken },
      { headers: { Authorization: `Bearer ${preAuthToken}` } }
    );
    return response.data;
  },
  forceLogin: async (preAuthToken) => {
    console.log("🔥 [api.js] forceLogin sending preAuthToken:", preAuthToken);
    const response = await apiClient.post(
      '/api/auth/otp/force-login', 
      { preAuthToken },
      { headers: { Authorization: `Bearer ${preAuthToken}` } }
    );
    return response.data;
  },
  getAuthConfig: async () => {
    const response = await apiClient.get('/api/public/auth-config');
    return response.data;
  },
};

// ─── Doctor API ─────────────────────────────────────────────────────────────
export const doctorAPI = {
  getAppointments: async () => (await apiClient.get('/api/doctor/appointments')).data,
  getAllAppointments: async () => (await apiClient.get('/api/doctor/all-appointments')).data,
  getAppointmentDetails: async (id) => (await apiClient.get(`/api/doctor/appointments/${id}`)).data,
  getPatients: async () => (await apiClient.get('/api/doctor/patients')).data,
  getPatientHistory: async (patientId, department) => {
    let url = `/api/doctor/patients/${patientId}/history`;
    if (department) url += `?department=${encodeURIComponent(department)}`;
    return (await apiClient.get(url)).data;
  },
  getFullPatientProfile: async (patientId) =>
    (await apiClient.get(`/api/doctor/patients/${patientId}/full-profile`)).data,
  getClinicPatientReports: async (clinicPatientId) =>
    (await apiClient.get(`/api/doctor/clinic-patients/${clinicPatientId}/reports`)).data,
  startSession: async (patientId) =>
    (await apiClient.post('/api/doctor/session/start', { patientId })).data,
  updatePatientProfile: async (patientId, profileData) =>
    (await apiClient.put(`/api/doctor/patients/${patientId}/profile`, profileData)).data,
  updateSession: async (id, formData) =>
    (await apiClient.patch(`/api/doctor/appointments/${id}/prescription`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  getLabs: async () => (await apiClient.get('/api/doctor/labs-list')).data,
  getMedicines: async () => (await apiClient.get('/api/doctor/medicines-list')).data,
  getBookedSlots: async (doctorId, date) =>
    (await apiClient.get(`/api/doctor/${doctorId}/booked-slots?date=${date}`)).data,
  getDoctors: async (hospitalId = null) => {
    let url = '/api/doctor';
    if (hospitalId) url += `?hospitalId=${encodeURIComponent(hospitalId)}`;
    return (await apiClient.get(url)).data;
  },
};

// ─── Reception API ──────────────────────────────────────────────────────────
export const receptionAPI = {
  getAllAppointments: async (params = {}) =>
    (await apiClient.get('/api/reception/appointments', { params })).data,
  getAllPatients: async () => (await apiClient.get('/api/reception/patients')).data,
  registerPatient: async (data) => (await apiClient.post('/api/reception/register', data)).data,
  getTransactions: async () => (await apiClient.get('/api/reception/transactions')).data,
  searchPatients: async (query) =>
    (await apiClient.get(`/api/reception/search-patients?query=${query}`)).data,
  updateIntake: async (userId, data) =>
    (await apiClient.put(`/api/reception/intake/${userId}`, data)).data,
  getFollowupStatus: async (patientId, department, date = '') => {
    let url =
      department === 'auto'
        ? `/api/reception/patients/${patientId}/followup-status?auto=true`
        : department
        ? `/api/reception/patients/${patientId}/followup-status?department=${encodeURIComponent(department)}`
        : `/api/reception/patients/${patientId}/followup-status`;
    if (date) url += (url.includes('?') ? '&' : '?') + `date=${date}`;
    return (await apiClient.get(url)).data;
  },
  bookAppointment: async (data) =>
    (await apiClient.post('/api/reception/book-appointment', data)).data,
  getBookedSlots: async (doctorId, date, hospitalId = '') => {
    let url = `/api/doctor/${doctorId}/booked-slots?date=${date}`;
    if (hospitalId) url += `&hospitalId=${hospitalId}`;
    return (await apiClient.get(url)).data;
  },
  rescheduleAppointment: async (id, date, time) =>
    (await apiClient.patch(`/api/reception/appointments/${id}/reschedule`, { date, time })).data,
  cancelAppointment: async (id) =>
    (await apiClient.patch(`/api/reception/appointments/${id}/cancel`)).data,
  confirmPayment: async (id, paymentMethod, amount, data = {}) =>
    (await apiClient.patch(`/api/reception/appointments/${id}/confirm-payment`, {
      paymentMethod,
      amount,
      ...data,
    })).data,
  sendAadhaarOTP: async (aadhaarNumber) =>
    (await apiClient.post('/api/reception/send-aadhaar-otp', { aadhaarNumber })).data,
  verifyAadhaarOTP: async (aadhaarNumber, otp) =>
    (await apiClient.post('/api/reception/verify-aadhaar-otp', { aadhaarNumber, otp })).data,
};

// ─── Admin API ───────────────────────────────────────────────────────────────
export const adminAPI = {
  login: async (email, password) =>
    (await apiClient.post('/api/admin/login', { email, password })).data,
  signup: async (name, email, password, phone) =>
    (await apiClient.post('/api/admin/signup', { name, email, password, phone })).data,
  getUsers: async (plan, hospitalId) => {
    let url = '/api/admin/users?';
    if (plan) url += `plan=${encodeURIComponent(plan)}&`;
    if (hospitalId) url += `hospitalId=${encodeURIComponent(hospitalId)}&`;
    return (await apiClient.get(url)).data;
  },
  createUser: async (data) => (await apiClient.post('/api/admin/users', data)).data,
  deleteUser: async (id) => (await apiClient.delete(`/api/admin/users/${id}`)).data,
  updateUser: async (id, data) => (await apiClient.put(`/api/admin/users/${id}`, data)).data,
  getRoles: async (plan) => {
    let url = '/api/admin/roles';
    if (plan) url += `?plan=${encodeURIComponent(plan)}`;
    return (await apiClient.get(url)).data;
  },
  createRole: async (data) => (await apiClient.post('/api/admin/roles', data)).data,
  updateRole: async (id, data) => (await apiClient.put(`/api/admin/roles/${id}`, data)).data,
  deleteRole: async (id) => (await apiClient.delete(`/api/admin/roles/${id}`)).data,
};

// ─── Admin Entities API ──────────────────────────────────────────────────────
export const adminEntitiesAPI = {
  getDoctors: async () => (await apiClient.get('/api/admin-entities/doctors')).data,
  getDoctor: async (id) => (await apiClient.get(`/api/admin-entities/doctors/${id}`)).data,
  createDoctor: async (data) => (await apiClient.post('/api/admin-entities/doctors', data)).data,
  updateDoctor: async (id, data) =>
    (await apiClient.put(`/api/admin-entities/doctors/${id}`, data)).data,
  deleteDoctor: async (id) => (await apiClient.delete(`/api/admin-entities/doctors/${id}`)).data,
  getLabs: async () => (await apiClient.get('/api/admin-entities/labs')).data,
  createLab: async (data) => (await apiClient.post('/api/admin-entities/labs', data)).data,
  deleteLab: async (id) => (await apiClient.delete(`/api/admin-entities/labs/${id}`)).data,
  getPharmacies: async () => (await apiClient.get('/api/admin-entities/pharmacies')).data,
  createPharmacy: async (data) =>
    (await apiClient.post('/api/admin-entities/pharmacies', data)).data,
  deletePharmacy: async (id) =>
    (await apiClient.delete(`/api/admin-entities/pharmacies/${id}`)).data,
  getReceptions: async () => (await apiClient.get('/api/admin-entities/receptions')).data,
  createReception: async (data) =>
    (await apiClient.post('/api/admin-entities/receptions', data)).data,
  deleteReception: async (id) =>
    (await apiClient.delete(`/api/admin-entities/receptions/${id}`)).data,
  getServices: async () => (await apiClient.get('/api/admin-entities/services')).data,
  createService: async (data) =>
    (await apiClient.post('/api/admin-entities/services', data)).data,
  deleteService: async (id) =>
    (await apiClient.delete(`/api/admin-entities/services/${id}`)).data,
};

// ─── Public API ──────────────────────────────────────────────────────────────
export const publicAPI = {
  getServices: async () => (await apiClient.get('/api/public/services')).data,
  getDoctors: async (serviceId = null, hospitalId = null) => {
    let url = '/api/doctor';
    const params = [];
    if (serviceId) params.push(`serviceId=${encodeURIComponent(serviceId)}`);
    if (hospitalId) params.push(`hospitalId=${encodeURIComponent(hospitalId)}`);
    if (params.length) url += '?' + params.join('&');
    return (await apiClient.get(url)).data;
  },
  getTenantConfig: async (domain) =>
    (await apiClient.get(`/api/public/tenant-config?domain=${encodeURIComponent(domain)}`)).data,
  getBookedSlots: async (doctorId, date, hospitalId = '') => {
    let url = `/api/doctor/${doctorId}/booked-slots?date=${date}`;
    if (hospitalId) url += `&hospitalId=${encodeURIComponent(hospitalId)}`;
    return (await apiClient.get(url)).data;
  },
};

// ─── Report API ───────────────────────────────────────────────────────────────
export const reportAPI = {
  uploadReport: async (formData) =>
    (await apiClient.post('/api/reports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  getReportsByAppointment: async (appointmentId) =>
    (await apiClient.get(`/api/reports/${appointmentId}`)).data,
  generateAISummary: async (fileUrl, mimeType) =>
    (await apiClient.post('/api/reports/summary', { fileUrl, mimeType })).data,
  searchReports: async (patientId, keyword) =>
    (await apiClient.post('/api/reports/search', { patientId, keyword })).data,
  compareReports: async (latestFileUrl, latestMimeType, previousFileUrl, previousMimeType) =>
    (await apiClient.post('/api/reports/compare', {
      latestFileUrl,
      latestMimeType,
      previousFileUrl,
      previousMimeType,
    })).data,
  chatWithAssistant: async (messages) =>
    (await apiClient.post('/api/reports/chat', { messages })).data,
  getAIUsageStats: async () => (await apiClient.get('/api/reports/ai-usage/stats')).data,
  getAIUsageHistory: async (limit = 30) =>
    (await apiClient.get(`/api/reports/ai-usage/history?limit=${limit}`)).data,
};

// ─── Upload API ───────────────────────────────────────────────────────────────
export const uploadAPI = {
  uploadImages: async (formData) =>
    (await apiClient.post('/api/upload/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
};

// ─── Lab API ──────────────────────────────────────────────────────────────────
export const labAPI = {
  getStats: async () => (await apiClient.get('/api/lab/stats')).data,
  getMyReports: async () => (await apiClient.get('/api/lab/my-reports')).data,
  getRequests: async (status) =>
    (await apiClient.get(`/api/lab/requests?status=${status || ''}`)).data,
  updatePayment: async (id, paymentData) =>
    (await apiClient.patch(`/api/lab/update-payment/${id}`, paymentData)).data,
  uploadReport: async (id, formData) =>
    (await apiClient.post(`/api/lab/upload-report/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
};

// ─── Pharmacy API ─────────────────────────────────────────────────────────────
export const pharmacyAPI = {
  getDashboardSummary: async (hospitalId) =>
    (await apiClient.get(`/api/pharmacy/orders/dashboard-summary?hospitalId=${hospitalId}`)).data,
  getVendorReturns: async () => (await apiClient.get('/api/pharmacy/vendor-returns')).data,
  createVendorReturn: async (data) =>
    (await apiClient.post('/api/pharmacy/vendor-returns', data)).data,
  getInventory: async () => (await apiClient.get('/api/pharmacy/inventory')).data,
  addMedicine: async (data) => (await apiClient.post('/api/pharmacy/inventory', data)).data,
  updateMedicine: async (id, data) =>
    (await apiClient.put(`/api/pharmacy/inventory/${id}`, data)).data,
  deleteMedicine: async (id) =>
    (await apiClient.delete(`/api/pharmacy/inventory/${id}`)).data,
  getVendors: async () => (await apiClient.get('/api/pharmacy/vendors')).data,
  addVendor: async (data) => (await apiClient.post('/api/pharmacy/vendors', data)).data,
  updateVendor: async (id, data) =>
    (await apiClient.put(`/api/pharmacy/vendors/${id}`, data)).data,
  getCollectionsAnalytics: async (startDate, endDate) => {
    let url = '/api/pharmacy/analytics/collections';
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return (await apiClient.get(url)).data;
  },
  uploadPurchaseInvoice: async (formData) =>
    (await apiClient.post('/api/pharmacy/purchase-invoice/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  processPurchaseInvoice: async (id) =>
    (await apiClient.post(`/api/pharmacy/purchase-invoice/${id}/process`)).data,
  getPurchaseInvoices: async () =>
    (await apiClient.get('/api/pharmacy/purchase-invoice')).data,
  getPurchaseInvoiceById: async (id) =>
    (await apiClient.get(`/api/pharmacy/purchase-invoice/${id}`)).data,
  deletePurchaseInvoice: async (id) =>
    (await apiClient.delete(`/api/pharmacy/purchase-invoice/${id}`)).data,
  recordConsumption: async (data) =>
    (await apiClient.post('/api/pharmacy/consumption', data)).data,
  getDepartments: async () => (await apiClient.get('/api/pharmacy/departments')).data,
  createDepartment: async (data) =>
    (await apiClient.post('/api/pharmacy/departments', data)).data,
  getDepartmentStocks: async (departmentId = '') => {
    let url = '/api/pharmacy/department-stocks';
    if (departmentId) url += `?departmentId=${departmentId}`;
    return (await apiClient.get(url)).data;
  },
  transferToDepartment: async (data) =>
    (await apiClient.post('/api/pharmacy/departments/transfer', data)).data,
  recordDepartmentUsage: async (data) =>
    (await apiClient.post('/api/pharmacy/departments/usage', data)).data,
};

// ─── Pharmacy Order API ───────────────────────────────────────────────────────
export const pharmacyOrderAPI = {
  getOrders: async () => (await apiClient.get('/api/pharmacy/orders')).data,
  createOrder: async (data) => (await apiClient.post('/api/pharmacy/orders', data)).data,
  completeOrder: async (id, payload = {}) =>
    (await apiClient.patch(`/api/pharmacy/orders/${id}/complete`, payload)).data,
  searchBills: async (query) =>
    (await apiClient.get(`/api/pharmacy/orders/search-bill?query=${query}`)).data,
  processReturn: async (data) =>
    (await apiClient.post('/api/pharmacy/orders/process-return', data)).data,
};

// ─── Clinical API ─────────────────────────────────────────────────────────────
export const clinicalAPI = {
  intake: async (data) => (await apiClient.post('/api/clinical/intake', data)).data,
  getHistory: async (patientId) =>
    (await apiClient.get(`/api/clinical/history/${patientId}`)).data,
  diagnose: async (visitId, data) =>
    (await apiClient.post(`/api/clinical/diagnose/${visitId}`, data)).data,
};

// ─── Patient API ──────────────────────────────────────────────────────────────
export const patientAPI = {
  search: async (term) => (await apiClient.get(`/api/patients/search?term=${term}`)).data,
  getFullHistory: async (id, department) => {
    let url = `/api/patients/${id}/full-history`;
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (params.toString()) url += `?${params.toString()}`;
    return (await apiClient.get(url)).data;
  },
  uploadConsent: async (id, formData) =>
    (await apiClient.post(`/api/patients/${id}/consent`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  getConsent: async (id) => (await apiClient.get(`/api/patients/${id}/consent`)).data,
  deleteConsent: async (id, index, fileId) =>
    (await apiClient.delete(`/api/patients/${id}/consent/${index}`, { data: { fileId } })).data,
  uploadDocument: async (id, formData) =>
    (await apiClient.post(`/api/patients/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  getDocuments: async (id, department) => {
    let url = `/api/patients/${id}/documents`;
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (params.toString()) url += `?${params.toString()}`;
    return (await apiClient.get(url)).data;
  },
  deleteDocument: async (id, index, fileId, url, fileName) =>
    (await apiClient.delete(`/api/patients/${id}/documents/${index}`, {
      data: { fileId, url, fileName },
    })).data,
  updateProfile: async (id, data) =>
    (await apiClient.put(`/api/reception/intake/${id}`, data)).data,
};

// ─── Notification API ─────────────────────────────────────────────────────────
export const notificationAPI = {
  getNotifications: async () => (await apiClient.get('/api/notifications')).data,
  markAsRead: async (id) => (await apiClient.patch(`/api/notifications/${id}/read`)).data,
  markAllAsRead: async () => (await apiClient.patch('/api/notifications/read-all')).data,
};

// ─── Lab Test API ─────────────────────────────────────────────────────────────
export const labTestAPI = {
  getLabTests: async (hospitalId = '') => {
    const url = hospitalId ? `/api/lab-tests?hospitalId=${hospitalId}` : '/api/lab-tests';
    return (await apiClient.get(url)).data;
  },
  createLabTest: async (data) => (await apiClient.post('/api/lab-tests', data)).data,
  updateLabTest: async (id, data) => (await apiClient.put(`/api/lab-tests/${id}`, data)).data,
  setHospitalPrice: async (id, hospitalId, price) =>
    (await apiClient.put(`/api/lab-tests/${id}/hospital-price`, { hospitalId, price })).data,
  deleteLabTest: async (id) => (await apiClient.delete(`/api/lab-tests/${id}`)).data,
};

// ─── Medicine API ─────────────────────────────────────────────────────────────
export const medicineAPI = {
  getMedicines: async () => (await apiClient.get('/api/medicines')).data,
  createMedicine: async (data) => (await apiClient.post('/api/medicines', data)).data,
  updateMedicine: async (id, data) => (await apiClient.put(`/api/medicines/${id}`, data)).data,
  deleteMedicine: async (id) => (await apiClient.delete(`/api/medicines/${id}`)).data,
};

// ─── Question Library API ─────────────────────────────────────────────────────
export const questionLibraryAPI = {
  getLibrary: async () => (await apiClient.get('/api/question-library')).data,
  updateLibrary: async (data) =>
    (await apiClient.post('/api/question-library', { data })).data,
};

// ─── Test Package API ─────────────────────────────────────────────────────────
export const testPackageAPI = {
  getPackages: async () => (await apiClient.get('/api/test-packages')).data,
  getPackage: async (id) => (await apiClient.get(`/api/test-packages/${id}`)).data,
  createPackage: async (data) => (await apiClient.post('/api/test-packages', data)).data,
  updatePackage: async (id, data) =>
    (await apiClient.put(`/api/test-packages/${id}`, data)).data,
  deletePackage: async (id) => (await apiClient.delete(`/api/test-packages/${id}`)).data,
};

// ─── Hospital API ─────────────────────────────────────────────────────────────
export const hospitalAPI = {
  resolveHospital: async (slug) =>
    (await apiClient.get(`/api/hospitals/resolve/${slug}`)).data,
  getHospitals: async (plan) => {
    let url = '/api/hospitals';
    if (plan) url += `?plan=${encodeURIComponent(plan)}`;
    return (await apiClient.get(url)).data;
  },
  createHospital: async (data) => (await apiClient.post('/api/hospitals', data)).data,
  updateHospital: async (id, data) =>
    (await apiClient.put(`/api/hospitals/${id}`, data)).data,
  deleteHospital: async (id) => (await apiClient.delete(`/api/hospitals/${id}`)).data,
  getMyHospital: async () => (await apiClient.get('/api/hospitals/my-hospital')).data,
  getUpiIds: async () =>
    (await apiClient.get('/api/hospitals/my-hospital/upi-ids')).data,
  updateUpiIds: async (upiIds) =>
    (await apiClient.put('/api/hospitals/my-hospital/upi-ids', { upiIds })).data,
  getDepartmentUpis: async () =>
    (await apiClient.get('/api/hospitals/my-hospital/department-upi')).data,
  createDepartmentUpi: async (data) =>
    (await apiClient.post('/api/hospitals/my-hospital/department-upi', data)).data,
  updateDepartmentUpi: async (id, data) =>
    (await apiClient.put(`/api/hospitals/my-hospital/department-upi/${id}`, data)).data,
  deleteDepartmentUpi: async (id) =>
    (await apiClient.delete(`/api/hospitals/my-hospital/department-upi/${id}`)).data,
  getStaffForUpi: async () =>
    (await apiClient.get('/api/hospitals/my-hospital/staff-for-upi')).data,
  getDepartmentUpiByRole: async (roleName) =>
    (await apiClient.get(
      `/api/hospitals/my-hospital/department-upi/by-role/${encodeURIComponent(roleName)}`
    )).data,
  updateFacilities: async (data) =>
    (await apiClient.put('/api/hospitals/my-hospital/facilities', data)).data,
  updateDepartmentFees: async (data) =>
    (await apiClient.put('/api/hospitals/my-hospital/department-fees', data)).data,
  getInventory: async () =>
    (await apiClient.get('/api/hospitals/my-hospital/inventory')).data,
  addInventory: async (data) =>
    (await apiClient.post('/api/hospitals/my-hospital/inventory', data)).data,
  updateInventory: async (id, data) =>
    (await apiClient.put(`/api/hospitals/my-hospital/inventory/${id}`, data)).data,
  deleteInventory: async (id) =>
    (await apiClient.delete(`/api/hospitals/my-hospital/inventory/${id}`)).data,
  getHospitalLabTests: async () =>
    (await apiClient.get('/api/hospitals/my-hospital/lab-tests')).data,
  setLabTestPrice: async (testId, price) =>
    (await apiClient.put(`/api/hospitals/my-hospital/lab-tests/${testId}/price`, { price })).data,
  createLabTest: async (data) => (await apiClient.post('/api/lab-tests', data)).data,
  deleteLabTest: async (id) => (await apiClient.delete(`/api/lab-tests/${id}`)).data,
  getHospitalStats: async (id, startDate, endDate) => {
    let url = `/api/hospitals/${id}/stats`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return (await apiClient.get(url)).data;
  },
  getBranding: async (id) => (await apiClient.get(`/api/hospitals/${id}/branding`)).data,
  updateBranding: async (id, data) =>
    (await apiClient.put(`/api/hospitals/${id}/branding`, data)).data,
  updateAppointmentMode: async (id, appointmentMode) =>
    (await apiClient.put(`/api/hospitals/${id}`, { appointmentMode })).data,
  getNextToken: async (hospitalId, doctorId, date) =>
    (await apiClient.get(
      `/api/hospitals/${hospitalId}/next-token?doctorId=${doctorId}&date=${date}`
    )).data,
};

// ─── Hospital Admin API ───────────────────────────────────────────────────────
export const hospitalAdminAPI = {
  login: async (email, password) =>
    (await apiClient.post('/api/hospitals/admin/login', { email, password })).data,
  createHospitalAdmin: async (data) =>
    (await apiClient.post('/api/hospitals/admin/signup', data)).data,
};

// ─── Finance API ──────────────────────────────────────────────────────────────
export const financeAPI = {
  getDashboardStats: async (startDate, endDate) => {
    let url = '/api/finance/dashboard';
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return (await apiClient.get(url)).data;
  },
};

// ─── Billing API ──────────────────────────────────────────────────────────────
export const billingAPI = {
  getPatients: async () => (await apiClient.get('/api/billing/patients')).data,
  getPatientBills: async (identifier) =>
    (await apiClient.get(`/api/billing/patient/${identifier}`)).data,
  addFacilityCharge: async (data) =>
    (await apiClient.post('/api/billing/facility-charge', data)).data,
  processPayment: async (data) => (await apiClient.put('/api/billing/pay', data)).data,
  searchPatients: async (query) =>
    (await apiClient.get(`/api/reception/search-patients?query=${query}`)).data,
  searchPatient: async (query) =>
    (await apiClient.get(`/api/reception/search-patients?query=${query}`)).data,
};

// ─── Admission API ────────────────────────────────────────────────────────────
export const admissionAPI = {
  transferBed: async (id, data) =>
    (await apiClient.put(`/api/admissions/${id}/transfer`, data)).data,
  createAdmission: async (data) => (await apiClient.post('/api/admissions', data)).data,
  getActiveAdmissions: async (params = {}) =>
    (await apiClient.get('/api/admissions/active', { params })).data,
  getPatientAdmissions: async (patientId) =>
    (await apiClient.get(`/api/admissions/patient/${patientId}`)).data,
  dischargePatient: async (id, data = {}) =>
    (await apiClient.put(`/api/admissions/${id}/discharge`, data)).data,
  markAdmissionPaid: async (id) =>
    (await apiClient.put(`/api/admissions/${id}/pay`, {})).data,
};

// ─── Clinic API ───────────────────────────────────────────────────────────────
export const clinicAPI = {
  getStats: async () => (await apiClient.get('/api/clinic/stats')).data,
  getPatients: async (search = '') =>
    (await apiClient.get(
      `/api/clinic/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`
    )).data,
  registerPatient: async (data) => (await apiClient.post('/api/clinic/patients', data)).data,
  updatePatient: async (id, data) =>
    (await apiClient.put(`/api/clinic/patients/${id}`, data)).data,
  getPatientHistory: async (patientId) =>
    (await apiClient.get(`/api/clinic/patients/${patientId}/history`)).data,
  checkFeeWaiver: async (patientId, date) =>
    (await apiClient.get(
      `/api/clinic/patients/${patientId}/check-fee-waiver${date ? `?date=${date}` : ''}`
    )).data,
  uploadPatientReport: async (patientId, formData) =>
    (await apiClient.post(`/api/clinic/patients/${patientId}/reports`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  deletePatientReport: async (patientId, reportId) =>
    (await apiClient.delete(`/api/clinic/patients/${patientId}/reports/${reportId}`)).data,
  getAppointments: async (date = '', status = '') => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (status) params.append('status', status);
    const qs = params.toString();
    return (await apiClient.get(`/api/clinic/appointments${qs ? '?' + qs : ''}`)).data;
  },
  getConfig: async () => (await apiClient.get('/api/clinic/config')).data,
  updateConfig: async (data) => (await apiClient.put('/api/clinic/config', data)).data,
  getStaff: async () => (await apiClient.get('/api/clinic/staff')).data,
  bookAppointment: async (data) =>
    (await apiClient.post('/api/clinic/appointments', data)).data,
  completeAppointment: async (id, data) =>
    (await apiClient.put(`/api/clinic/appointments/${id}/complete`, data)).data,
  updateConsultation: async (id, data) =>
    (await apiClient.put(`/api/clinic/appointments/${id}/update-consultation`, data)).data,
  payAppointment: async (id, paymentMethod = 'Cash') =>
    (await apiClient.put(`/api/clinic/appointments/${id}/pay`, { paymentMethod })).data,
  cancelAppointment: async (id) =>
    (await apiClient.put(`/api/clinic/appointments/${id}/cancel`, {})).data,
  getInventory: async () => (await apiClient.get('/api/clinic/inventory')).data,
  addInventory: async (data) => (await apiClient.post('/api/clinic/inventory', data)).data,
  getPharmacyOrders: async () => (await apiClient.get('/api/clinic/pharmacy-orders')).data,
  dispenseOrder: async (id) =>
    (await apiClient.put(`/api/clinic/pharmacy-orders/${id}/dispense`, {})).data,
  getTreatmentPlans: async () => (await apiClient.get('/api/clinic/treatment-plans')).data,
  createTreatmentPlan: async (data) =>
    (await apiClient.post('/api/clinic/treatment-plans', data)).data,
  getTreatmentPlan: async (id) =>
    (await apiClient.get(`/api/clinic/treatment-plans/${id}`)).data,
  getTodayDuePlans: async () =>
    (await apiClient.get('/api/clinic/treatment-plans/today-due')).data,
  payVisit: async (planId, visitId, data) =>
    (await apiClient.put(`/api/clinic/treatment-plans/${planId}/visits/${visitId}/pay`, data)).data,
  completeVisit: async (planId, visitId, data) =>
    (await apiClient.put(
      `/api/clinic/treatment-plans/${planId}/visits/${visitId}/complete`,
      data
    )).data,
  missVisit: async (planId, visitId) =>
    (await apiClient.put(
      `/api/clinic/treatment-plans/${planId}/visits/${visitId}/miss`,
      {}
    )).data,
  rescheduleVisit: async (planId, visitId, data) =>
    (await apiClient.put(
      `/api/clinic/treatment-plans/${planId}/visits/${visitId}/reschedule`,
      data
    )).data,
  cancelTreatmentPlan: async (id) =>
    (await apiClient.put(`/api/clinic/treatment-plans/${id}/cancel`, {})).data,
};

// ─── Simple Clinic API ────────────────────────────────────────────────────────
export const simpleClinicAPI = {
  getClinics: async (plan) => {
    let url = '/api/simple-clinics';
    if (plan) url += `?plan=${encodeURIComponent(plan)}`;
    return (await apiClient.get(url)).data;
  },
  createClinic: async (data) => (await apiClient.post('/api/simple-clinics', data)).data,
  updateClinic: async (id, data) =>
    (await apiClient.put(`/api/simple-clinics/${id}`, data)).data,
  deleteClinic: async (id) => (await apiClient.delete(`/api/simple-clinics/${id}`)).data,
  getStats: async (id, startDate, endDate) => {
    let url = `/api/simple-clinics/${id}/stats`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return (await apiClient.get(url)).data;
  },
  createManager: async (id, data) =>
    (await apiClient.post(`/api/simple-clinics/${id}/manager`, data)).data,
  getStaff: async (id) => (await apiClient.get(`/api/simple-clinics/${id}/staff`)).data,
  createStaff: async (id, data) =>
    (await apiClient.post(`/api/simple-clinics/${id}/staff`, data)).data,
  deleteStaff: async (clinicId, userId) =>
    (await apiClient.delete(`/api/simple-clinics/${clinicId}/staff/${userId}`)).data,
  updateTier: async (id, data) =>
    (await apiClient.put(`/api/simple-clinics/${id}`, data)).data,
  getSubscriptions: async (id) =>
    (await apiClient.get(`/api/simple-clinics/${id}/subscriptions`)).data,
  setRate: async (id, data) =>
    (await apiClient.put(`/api/simple-clinics/${id}/subscriptions/rate`, data)).data,
  updateSubscription: async (clinicId, subId, data) =>
    (await apiClient.put(`/api/simple-clinics/${clinicId}/subscriptions/${subId}`, data)).data,
  updateAppointmentMode: async (id, appointmentMode) =>
    (await apiClient.put(`/api/simple-clinics/${id}`, { appointmentMode })).data,
};

// ─── Revenue API ──────────────────────────────────────────────────────────────
export const revenueAPI = {
  getSystemAnalytics: async () => (await apiClient.get('/api/revenue/system')).data,
  getHospitalsRevenue: async () => (await apiClient.get('/api/revenue/hospitals')).data,
  setHospitalPlan: async (id, data) =>
    (await apiClient.put(`/api/revenue/hospital/${id}`, data)).data,
};

// ─── Patient Auth API (separate client) ──────────────────────────────────────
const patientApiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

patientApiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.PATIENT_TOKEN);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

patientApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem(STORAGE_KEYS.PATIENT_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.PATIENT_USER);
    }
    return Promise.reject(error);
  }
);

export const patientAuthAPI = {
  register: async (name, email, mobile, password, hospitalId, age, aadhaarNumber) =>
    (await patientApiClient.post('/api/patient-auth/register', {
      name, email, mobile, password, hospitalId, age, aadhaarNumber,
    })).data,
  login: async (loginId, password, hospitalId) =>
    (await patientApiClient.post('/api/patient-auth/login', { loginId, password, hospitalId })).data,
  forgotPassword: async (email, hospitalId) =>
    (await patientApiClient.post('/api/patient-auth/forgot-password', { email, hospitalId })).data,
  resetPassword: async (token, password) =>
    (await patientApiClient.post('/api/patient-auth/reset-password', { token, password })).data,
  getMe: async () => (await patientApiClient.get('/api/patient-auth/me')).data,
  getPatientAppointments: async () =>
    (await patientApiClient.get('/api/patient-auth/appointments')).data,
  getPatientProfile: async () =>
    (await patientApiClient.get('/api/patient-auth/profile')).data,
  updatePatientProfile: async (data) =>
    (await patientApiClient.put('/api/patient-auth/profile', data)).data,
  cancelAppointment: async (id) =>
    (await patientApiClient.put(`/api/patient-auth/appointments/${id}/cancel`)).data,
  getPatientDocuments: async () =>
    (await patientApiClient.get('/api/patient-auth/documents')).data,
  getPatientBills: async () =>
    (await patientApiClient.get('/api/patient-auth/bills')).data,
  payPatientBills: async (data) =>
    (await patientApiClient.post('/api/patient-auth/bills/pay', data)).data,
  getFollowupStatus: async (department, date = '') => {
    let url =
      department === 'auto'
        ? '/api/patient-auth/followup-status?auto=true'
        : department
        ? `/api/patient-auth/followup-status?department=${encodeURIComponent(department)}`
        : '/api/patient-auth/followup-status';
    if (date) url += (url.includes('?') ? '&' : '?') + `date=${date}`;
    return (await patientApiClient.get(url)).data;
  },
  bookAppointment: async (data) =>
    (await patientApiClient.post('/api/patient-auth/book-appointment', data)).data,
  getDepartmentUpiByRole: async (roleName) =>
    (await patientApiClient.get(
      `/api/patient-auth/department-upi/${encodeURIComponent(roleName)}`
    )).data,
};

// ─── Bed API ──────────────────────────────────────────────────────────────────
export const bedAPI = {
  getBeds: async (params) => (await apiClient.get('/api/beds', { params })).data,
  createBed: async (data) => (await apiClient.post('/api/beds', data)).data,
  updateBed: async (id, data) => (await apiClient.put(`/api/beds/${id}`, data)).data,
  deleteBed: async (id) => (await apiClient.delete(`/api/beds/${id}`)).data,
};

// ─── OT API ───────────────────────────────────────────────────────────────────
export const otAPI = {
  updateSurgeryWorkflow: async (id, data) =>
    (await apiClient.put(`/api/ot/surgery-plans/${id}/workflow`, data)).data,
  getDashboardStats: async () => (await apiClient.get('/api/ot/dashboard-stats')).data,
  getRooms: async () => (await apiClient.get('/api/ot/rooms')).data,
  createSurgeryPlan: async (data) => (await apiClient.post('/api/ot/surgery-plans', data)).data,
  getPatientSurgeryPlans: async (patientId) =>
    (await apiClient.get(`/api/ot/surgery-plans/patient/${patientId}`)).data,
  scheduleSurgery: async (id, data) =>
    (await apiClient.post(`/api/ot/surgery-plans/${id}/schedule`, data)).data,
  updateScheduledSurgery: async (id, data) =>
    (await apiClient.put(`/api/ot/surgery-plans/${id}/schedule`, data)).data,
  cancelSurgery: async (id) =>
    (await apiClient.put(`/api/ot/surgery-plans/${id}/cancel`)).data,
  getScheduledSurgeries: async (date) =>
    (await apiClient.get('/api/ot/surgery-plans/scheduled', { params: { date } })).data,
  getTodaySchedule: async (date) =>
    (await apiClient.get('/api/ot/today-schedule', { params: { date } })).data,
  getRoomStatus: async (date) =>
    (await apiClient.get('/api/ot/room-status', { params: { date } })).data,
  getWorkflowAlerts: async (date) =>
    (await apiClient.get('/api/ot/workflow-alerts', { params: { date } })).data,
  getPlannedSurgeries: async () =>
    (await apiClient.get('/api/ot/surgery-plans/planned')).data,
  getMySurgeryPlans: async () =>
    (await apiClient.get('/api/ot/surgery-plans/surgeon/my')).data,
  getSurgeryPlanById: async (id) =>
    (await apiClient.get(`/api/ot/surgery-plans/${id}`)).data,
};

// ─── Referral API ─────────────────────────────────────────────────────────────
export const referralAPI = {
  create: async (data) => (await apiClient.post('/api/referrals', data)).data,
  getMyReferrals: async () => (await apiClient.get('/api/referrals/my-referrals')).data,
  getMySent: async () => (await apiClient.get('/api/referrals/my-sent')).data,
  getPatientReferrals: async (patientId) =>
    (await apiClient.get(`/api/referrals/patient/${patientId}`)).data,
  getById: async (id) => (await apiClient.get(`/api/referrals/${id}`)).data,
  review: async (id, data) => (await apiClient.put(`/api/referrals/${id}/review`, data)).data,
};

// ─── Consent API ──────────────────────────────────────────────────────────────
export const consentAPI = {
  getStats: async () => (await apiClient.get('/api/consent/stats')).data,
  getCategories: async () => (await apiClient.get('/api/consent/categories')).data,
  createCategory: async (data) =>
    (await apiClient.post('/api/consent/categories', data)).data,
  updateCategory: async (id, data) =>
    (await apiClient.put('/api/consent/categories/' + id, data)).data,
  toggleCategory: async (id) =>
    (await apiClient.patch('/api/consent/categories/' + id + '/toggle')).data,
  deleteCategory: async (id) =>
    (await apiClient.delete('/api/consent/categories/' + id)).data,
  getTemplates: async (params) =>
    (await apiClient.get('/api/consent/templates', { params })).data,
  getTemplateById: async (id) =>
    (await apiClient.get('/api/consent/templates/' + id)).data,
  createTemplate: async (formData) =>
    (await apiClient.post('/api/consent/templates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  updateTemplate: async (id, formData) =>
    (await apiClient.put('/api/consent/templates/' + id, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  deleteTemplate: async (id) =>
    (await apiClient.delete('/api/consent/templates/' + id)).data,
};

export default apiClient;