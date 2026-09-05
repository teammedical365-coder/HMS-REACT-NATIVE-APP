import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/Constants';
import { buildTheme } from '../Theme';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadBranding = async (hospitalId) => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      // FIX: Use the public API endpoint for startup fetching (unauthenticated)
      const response = await axios.get(`${API_BASE_URL}/api/public/branding?tenantId=${hospitalId}`);
      if (response.data && response.data.branding) {
        const brandingData = response.data.branding;
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING, JSON.stringify(brandingData));
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING_NAME, brandingData.hospitalName || brandingData.appName || '');
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID, hospitalId);
        setBranding(brandingData);
      }
    } catch (error) {
      console.warn('[BrandingContext] Failed to load branding:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initBranding = async () => {
      // Use EXPO_PUBLIC_TENANT_ID if injected by GitHub Actions, else fallback to AsyncStorage
      const injectedTenantId = process.env.EXPO_PUBLIC_TENANT_ID;
      if (injectedTenantId) {
        await loadBranding(injectedTenantId);
      } else {
        const savedId = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID);
        if (savedId) {
          await loadBranding(savedId);
        }
      }
    };
    initBranding();
  }, []);

  const resetBranding = async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.HOSPITAL_BRANDING,
      STORAGE_KEYS.HOSPITAL_BRANDING_NAME,
      STORAGE_KEYS.HOSPITAL_BRANDING_ID,
    ]);
    setBranding(null);
  };

  const getTheme = () => buildTheme(branding);

  return (
    <BrandingContext.Provider value={{ branding, loading, loadBranding, resetBranding, getTheme }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding must be used inside BrandingProvider');
  return context;
};

export default BrandingContext;