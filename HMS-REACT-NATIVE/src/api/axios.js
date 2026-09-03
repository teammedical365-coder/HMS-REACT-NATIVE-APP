import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { navigate } from './navigationRef'; // Import your global navigation reference

const apiClient = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://your-production-url.onrender.com',
    timeout: 10000,
});

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('TOKEN') || await AsyncStorage.getItem('token');
            if (token) {
                const cleanToken = String(token).replace(/^"(.*)"$/, '$1').trim();
                config.headers.Authorization = `Bearer ${cleanToken}`;
            }
        } catch (error) {
            console.error('[API Setup] Storage read failed:', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Expiration
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Intercept 401 responses, ensure we don't infinitely retry
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Flush the invalid token
                await AsyncStorage.removeItem('TOKEN');
                await AsyncStorage.removeItem('token');

                // Force unauthenticated state (e.g., redirect to Auth stack)
                // navigate('LoginScreen'); 

                /* 
                // Optional: If implementing a Refresh Token flow, place it here:
                const newToken = await refreshAccessToken();
                if (newToken) {
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  return apiClient(originalRequest);
                }
                */
            } catch (storageError) {
                console.error('[API Setup] Token flush failed:', storageError);
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
