import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🌐 Get Base URL from .env (Fallback to local IP just in case)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.38.171:3000';

// 🚀 Create Axios Instance
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 🔒 Request Interceptor: Automatically attach the Auth Token to every request
api.interceptors.request.use(
    async (config) => {
        try {
            // Fetch tokens from secure mobile storage precisely like web client uses localStorage
            const token = await AsyncStorage.getItem('token');
            const patientToken = await AsyncStorage.getItem('patientToken');
            
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            } else if (patientToken) {
                config.headers.Authorization = `Bearer ${patientToken}`;
            }
        } catch (error) {
            console.error("Token fetch error: ", error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 🛑 Response Interceptor: Global Error Handling (e.g., Session Expiry)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response) {
            // If 401 (Unauthorized), the token is likely expired or invalid
            if (error.response.status === 401) {
                console.warn("Session expired! User needs to login again.");
                // Clear the invalid token to prevent infinite error loops
                await AsyncStorage.removeItem('authToken');
            }
        }
        return Promise.reject(error);
    }
);

export default api;