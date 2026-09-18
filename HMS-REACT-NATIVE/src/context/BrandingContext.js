import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/Constants';
import { buildTheme } from '../Theme';
import { logKbEvent } from '../utils/kbDebug';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadBranding = async (hospitalId) => {
    if (!hospitalId) return;
    setLoading(true);
    logKbEvent('BRANDING_LOADING_TRUE', { brandingLoading: true });
    console.log(`[KB-DEBUG] [BrandingContext] loadBranding called with hospitalId: ${hospitalId}`);
    try {
      const apiUrl = `${API_BASE_URL}/api/public/branding?tenantId=${hospitalId}`;
      console.log(`[BrandingContext] Calling API URL: ${apiUrl}`);
      const response = await axios.get(apiUrl);
      console.log(`[BrandingContext] API Response data:`, JSON.stringify(response.data, null, 2));
      
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
        setBranding(brandingData);
        logKbEvent('BRANDING_SET');
      }
    } catch (error) {
      console.log('[BrandingContext] FULL ERROR MESSAGE:', error.message);
      if (error.response) {
         console.log('[BrandingContext] ERROR RESPONSE:', JSON.stringify(error.response.data, null, 2));
      }
      console.warn('[BrandingContext] Failed to load branding:', error.message);
    } finally {
      setLoading(false);
      logKbEvent('BRANDING_LOADING_FALSE', { brandingLoading: false });
    }
  };

  useEffect(() => {
    const initBranding = async () => {
      const injectedTenantId = process.env.EXPO_PUBLIC_TENANT_ID;
      console.log('--- DEBUG STARTUP ---');
      console.log('EXPO_PUBLIC_TENANT_ID evaluates to:', injectedTenantId);
      
      if (injectedTenantId) {
        await loadBranding(injectedTenantId);
      } else {
        const savedId = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID);
        console.log('No injected tenant ID, using savedId:', savedId);
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

  const getTheme = () => buildTheme(branding || null);

  const contextValue = React.useMemo(() => ({
    branding,
    loading,
    loadBranding,
    resetBranding,
    getTheme,
  }), [branding, loading]);

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