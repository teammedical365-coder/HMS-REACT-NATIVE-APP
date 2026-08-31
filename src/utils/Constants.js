// Central constants — replaces import.meta.env (Vite) for React Native

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const APP_NAME = 'Medical 365';

// Storage keys
export const STORAGE_KEYS = {
    TOKEN: 'token',
    USER: 'user',
    PATIENT_TOKEN: 'patientToken',
    PATIENT_USER: 'patientUser',
    HOSPITAL_BRANDING: 'hospitalBranding',
    HOSPITAL_BRANDING_NAME: 'hospitalBrandingName',
    HOSPITAL_BRANDING_ID: 'hospitalBrandingId',
    SESSION_EXPIRED_MESSAGE: 'sessionExpiredMessage',
};