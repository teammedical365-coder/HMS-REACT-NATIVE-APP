import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/Constants';
import { buildTheme } from '../Theme';

const isCleanUrl = (u) => Boolean(u && typeof u === 'string' && u.trim() && !u.includes('gemini.google.com'));

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
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
          logoUrl: isCleanUrl(rawBranding.logoUrl) ? rawBranding.logoUrl : null,
          faviconUrl: isCleanUrl(rawBranding.faviconUrl) ? rawBranding.faviconUrl : null,
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
    let isMounted = true;
    const initBranding = async () => {
      try {
        // 1. Immediately hydrate cached branding from AsyncStorage (0ms local read)
        const cachedRaw = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING);
        if (cachedRaw) {
          try {
            const cachedData = JSON.parse(cachedRaw);
            if (cachedData && (cachedData.logoUrl || cachedData.hospitalName)) {
              if (isMounted) {
                setBranding(cachedData);
                brandingRef.current = cachedData;
              }
            }
          } catch (e) { }
        }

        // 2. Identify target tenant (injected env, cached ID, or hardcoded tenant / app slug)
        const injectedTenantId = process.env.EXPO_PUBLIC_TENANT_ID;
        const savedId = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID);
        const targetId = injectedTenantId || savedId;

        if (targetId) {
          await loadBranding(targetId);
        } else {
          // If no hospital ID stored, check fallback tenant slug (e.g. sharma-clinic)
          try {
            const tenantModule = await import('../tenant.js').catch(() => null);
            const slug = tenantModule?.HARDCODED_TENANT?.slug || 'sharma-clinic';
            if (slug) {
              const res = await axios.get(`${API_BASE_URL}/api/public/branding?slug=${encodeURIComponent(slug)}`);
              if (res.data && res.data.hospitalId) {
                await loadBranding(res.data.hospitalId);
              }
            }
          } catch (e) { }
        }
      } catch (err) {
        console.warn('[BrandingContext] initBranding error:', err);
      } finally {
        if (isMounted) setIsHydrated(true);
      }
    };
    initBranding();
    return () => { isMounted = false; };
  }, [loadBranding]);

  const resetBranding = useCallback(async () => {
    // Preserves tenant branding context unless explicitly purged
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
    isHydrated,
    loading,
    loadBranding,
    resetBranding,
    getTheme,
  }), [branding, isHydrated, loading, loadBranding, resetBranding]);

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