import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/Constants';
import { buildTheme } from '../Theme';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastLoadedIdRef = useRef(null);
  const inFlightRef = useRef(null);
  const brandingRef = useRef(null);

  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  const loadBranding = useCallback(async (hospitalId) => {
    if (!hospitalId) return;
    // Guard against duplicate / concurrent fetches for the same hospital
    if (inFlightRef.current === hospitalId) return;
    if (lastLoadedIdRef.current === hospitalId && brandingRef.current) return;

    inFlightRef.current = hospitalId;
    setLoading(true);
    try {
      const apiUrl = `${API_BASE_URL}/api/public/branding?tenantId=${hospitalId}`;
      const response = await axios.get(apiUrl);
      
      if (response.data && response.data.branding) {
        const rawBranding = response.data.branding;
        const customTheme = rawBranding.themeColors || {};
        
        const brandingData = {
          ...rawBranding,
          primaryColor: customTheme.primary || rawBranding.primaryColor,
          secondaryColor: customTheme.secondary || rawBranding.secondaryColor,
          backgroundColor: customTheme.background || rawBranding.backgroundColor,
          hospitalName: rawBranding.appName || rawBranding.hospitalName,
        };

        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING, JSON.stringify(brandingData));
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING_NAME, brandingData.hospitalName || '');
        await AsyncStorage.setItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID, hospitalId);
        lastLoadedIdRef.current = hospitalId;
        setBranding(brandingData);
      }
    } catch (error) {
      console.warn('[BrandingContext] Failed to load branding:', error.message);
    } finally {
      inFlightRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initBranding = async () => {
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
  }, [loadBranding]);

  const resetBranding = useCallback(async () => {
    lastLoadedIdRef.current = null;
    inFlightRef.current = null;
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.HOSPITAL_BRANDING,
      STORAGE_KEYS.HOSPITAL_BRANDING_NAME,
      STORAGE_KEYS.HOSPITAL_BRANDING_ID,
    ]);
    setBranding(null);
  }, []);

  const getTheme = () => buildTheme(branding || null);

  const contextValue = React.useMemo(() => ({
    branding,
    loading,
    loadBranding,
    resetBranding,
    getTheme,
  }), [branding, loading, loadBranding, resetBranding]);

  return (
    <BrandingContext.Provider value={contextValue}>
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