import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Async wrapper around AsyncStorage that mirrors the synchronous
 * localStorage / sessionStorage API used in the original web app.
 *
 * All methods are async — await them or chain .then().
 */

export const storage = {
    getItem: async (key) => {
        try {
            return await AsyncStorage.getItem(key);
        } catch {
            return null;
        }
    },

    setItem: async (key, value) => {
        try {
            await AsyncStorage.setItem(key, String(value));
        } catch (e) {
            console.warn('[storage] setItem failed:', e);
        }
    },

    removeItem: async (key) => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.warn('[storage] removeItem failed:', e);
        }
    },

    getJSON: async (key) => {
        try {
            const raw = await AsyncStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    setJSON: async (key, value) => {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('[storage] setJSON failed:', e);
        }
    },

    clear: async () => {
        try {
            await AsyncStorage.clear();
        } catch (e) {
            console.warn('[storage] clear failed:', e);
        }
    },

    multiRemove: async (keys) => {
        try {
            await AsyncStorage.multiRemove(keys);
        } catch (e) {
            console.warn('[storage] multiRemove failed:', e);
        }
    },
};

export default storage;