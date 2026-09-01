// Central constants — replaces import.meta.env (Vite) for React Native

import { Platform } from 'react-native';

// 🎯 Render Live Backend URL (Eliminating Local Network & Firewall Issues)
const LIVE_API_URL = 'https://hms-n6nk.onrender.com';

const getBaseUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }
    return LIVE_API_URL;
};

export const API_BASE_URL = getBaseUrl();

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