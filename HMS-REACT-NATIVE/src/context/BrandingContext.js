import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hospitalAPI } from '../utils/api';
import { STORAGE_KEYS } from '../utils/Constants';
import { buildTheme } from '../Theme';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadBranding = async (hospitalId) => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const response = await hospitalAPI.getBranding(hospitalId);
      if (response.success && response.branding) {
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING, JSON.stringify(response.branding));
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING_NAME, response.branding.hospitalName || '');
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID, hospitalId);
        setBranding(response.branding);
      }
    } catch (error) {
      console.warn('[BrandingContext] Failed to load branding:', error.message);
    } finally {
      setLoading(false);
    }
  };

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