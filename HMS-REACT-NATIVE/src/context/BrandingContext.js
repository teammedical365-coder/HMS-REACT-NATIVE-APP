import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/Constants';
import { buildTheme } from '../Theme';
import { HARDCODED_TENANT } from '../tenant.js';

const isCleanUrl = (u) => Boolean(u && typeof u === 'string' && u.trim() && !u.includes('gemini.google.com'));

const BrandingContext = createContext();

// Resolve build-time configured tenant identity
const BUILD_TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID || HARDCODED_TENANT?.tenantId || null;
const BUILD_TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG || HARDCODED_TENANT?.slug || null;
const BUILD_HOSPITAL_NAME = process.env.EXPO_PUBLIC_HOSPITAL_NAME || HARDCODED_TENANT?.name || null;

// Initial baseline branding derived from verified build configuration
const createBaselineBranding = (hospitalName, tenantId, tenantSlug) => {
  if (!hospitalName && !tenantId && !tenantSlug) return null;
  const name = hospitalName || 'Medical 365';
  return {
    hospitalName: name,
    appName: name,
    logoUrl: null,
    faviconUrl: null,
    primaryColor: process.env.EXPO_PUBLIC_THEME_COLOR || '#0d9488',
    secondaryColor: '#0f766e',
    backgroundColor: '#ffffff',
    hospitalId: tenantId || null,
    slug: tenantSlug || null,
    _tenantId: tenantId || null,
    _tenantSlug: tenantSlug || null,
    _isBaseline: true,
  };
};

// Tenant-scoped AsyncStorage keys
const getTenantCacheKey = (tenantId) => tenantId ? `${STORAGE_KEYS.HOSPITAL_BRANDING}_${tenantId}` : null;
const getSlugCacheKey = (slug) => slug ? `${STORAGE_KEYS.HOSPITAL_BRANDING}_slug_${slug}` : null;

// Cache validator: ensures cached branding belongs to the requested tenant
const isCacheValidForTarget = (cachedData, savedId, targetId, targetSlug, targetName) => {
  if (!cachedData || typeof cachedData !== 'object') return false;

  // 1. If targetId is specified, cache must match targetId
  if (targetId) {
    const cachedId = cachedData._tenantId || cachedData.hospitalId || cachedData._id || savedId;
    if (cachedId && String(cachedId) !== String(targetId)) {
      return false; // Mismatched tenant ID
    }
  }

  // 2. If targetSlug is specified, cache must match targetSlug
  if (targetSlug) {
    const cachedSlug = cachedData._tenantSlug || cachedData.slug;
    if (cachedSlug && String(cachedSlug).toLowerCase() !== String(targetSlug).toLowerCase()) {
      return false; // Mismatched tenant slug
    }
  }

  // 3. If targetName is specified, cached hospitalName must match
  if (targetName) {
    const cachedName = cachedData.hospitalName || cachedData.appName;
    if (cachedName && cachedName.trim().toLowerCase() !== targetName.trim().toLowerCase()) {
      return false; // Mismatched hospital name
    }
  }

  return true;
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(() => createBaselineBranding(BUILD_HOSPITAL_NAME, BUILD_TENANT_ID, BUILD_TENANT_SLUG));
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastLoadedIdRef = useRef(null);
  const inFlightRef = useRef(null);
  const brandingRef = useRef(branding);

  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  // Saves branding data in both tenant-isolated cache and standard keys
  const saveBrandingData = useCallback(async (brandingData, hospitalId, slug) => {
    try {
      const serialized = JSON.stringify(brandingData);
      const itemsToSet = [
        [STORAGE_KEYS.HOSPITAL_BRANDING, serialized],
        [STORAGE_KEYS.HOSPITAL_BRANDING_NAME, brandingData.hospitalName || ''],
      ];
      if (hospitalId) {
        itemsToSet.push([STORAGE_KEYS.HOSPITAL_BRANDING_ID, String(hospitalId)]);
        const tenantKey = getTenantCacheKey(hospitalId);
        if (tenantKey) itemsToSet.push([tenantKey, serialized]);
      }
      if (slug) {
        const slugKey = getSlugCacheKey(slug);
        if (slugKey) itemsToSet.push([slugKey, serialized]);
      }
      await AsyncStorage.multiSet(itemsToSet);
    } catch (err) {
      console.warn('[BrandingContext] Failed to cache branding data:', err.message);
    }
  }, []);

  const loadBranding = useCallback(async (hospitalId) => {
    if (!hospitalId) return;
    if (inFlightRef.current === hospitalId) return;
    if (lastLoadedIdRef.current === hospitalId && brandingRef.current && !brandingRef.current._isBaseline) return;

    inFlightRef.current = hospitalId;
    setLoading(true);

    try {
      // 1. Check tenant-isolated cache first for instant hydration
      const tenantKey = getTenantCacheKey(hospitalId);
      if (tenantKey) {
        const tenantCachedRaw = await AsyncStorage.getItem(tenantKey);
        if (tenantCachedRaw) {
          try {
            const tenantCached = JSON.parse(tenantCachedRaw);
            if (tenantCached && (tenantCached.hospitalName || tenantCached.logoUrl)) {
              setBranding(tenantCached);
              brandingRef.current = tenantCached;
            }
          } catch (e) { }
        }
      }

      // 2. Fetch live branding from backend
      const apiUrl = `${API_BASE_URL}/api/public/branding?tenantId=${encodeURIComponent(hospitalId)}`;
      const response = await axios.get(apiUrl);

      if (response.data && response.data.branding) {
        const rawBranding = response.data.branding;
        const customTheme = rawBranding.themeColors || {};

        const brandingData = {
          ...rawBranding,
          hospitalId: hospitalId,
          _tenantId: hospitalId,
          _tenantSlug: rawBranding.slug || null,
          logoUrl: isCleanUrl(rawBranding.logoUrl) ? rawBranding.logoUrl : null,
          faviconUrl: isCleanUrl(rawBranding.faviconUrl) ? rawBranding.faviconUrl : null,
          primaryColor: customTheme.primary || rawBranding.primaryColor || '#0d9488',
          secondaryColor: customTheme.secondary || rawBranding.secondaryColor || '#0f766e',
          backgroundColor: customTheme.background || rawBranding.backgroundColor || '#ffffff',
          hospitalName: rawBranding.appName || rawBranding.hospitalName || BUILD_HOSPITAL_NAME || 'Medical 365',
          appName: rawBranding.appName || rawBranding.hospitalName || BUILD_HOSPITAL_NAME || 'Medical 365',
          _isBaseline: false,
        };

        await saveBrandingData(brandingData, hospitalId, rawBranding.slug);
        lastLoadedIdRef.current = hospitalId;
        setBranding(brandingData);
        brandingRef.current = brandingData;
      }
    } catch (error) {
      console.warn('[BrandingContext] Failed to load branding for tenant:', hospitalId, error.message);
    } finally {
      inFlightRef.current = null;
      setLoading(false);
    }
  }, [saveBrandingData]);

  const loadBrandingBySlug = useCallback(async (slug) => {
    if (!slug) return;
    const fetchKey = `slug:${slug}`;
    if (inFlightRef.current === fetchKey) return;

    inFlightRef.current = fetchKey;
    setLoading(true);

    try {
      // 1. Check slug-isolated cache first
      const slugKey = getSlugCacheKey(slug);
      if (slugKey) {
        const slugCachedRaw = await AsyncStorage.getItem(slugKey);
        if (slugCachedRaw) {
          try {
            const slugCached = JSON.parse(slugCachedRaw);
            if (slugCached && (slugCached.hospitalName || slugCached.logoUrl)) {
              setBranding(slugCached);
              brandingRef.current = slugCached;
            }
          } catch (e) { }
        }
      }

      // 2. Query branding by slug
      const res = await axios.get(`${API_BASE_URL}/api/public/branding?slug=${encodeURIComponent(slug)}`);
      if (res.data) {
        if (res.data.hospitalId) {
          inFlightRef.current = null;
          await loadBranding(res.data.hospitalId);
          return;
        } else if (res.data.branding) {
          const rawBranding = res.data.branding;
          const customTheme = rawBranding.themeColors || {};
          const brandingData = {
            ...rawBranding,
            slug: slug,
            _tenantSlug: slug,
            logoUrl: isCleanUrl(rawBranding.logoUrl) ? rawBranding.logoUrl : null,
            faviconUrl: isCleanUrl(rawBranding.faviconUrl) ? rawBranding.faviconUrl : null,
            primaryColor: customTheme.primary || rawBranding.primaryColor || '#0d9488',
            secondaryColor: customTheme.secondary || rawBranding.secondaryColor || '#0f766e',
            backgroundColor: customTheme.background || rawBranding.backgroundColor || '#ffffff',
            hospitalName: rawBranding.appName || rawBranding.hospitalName || BUILD_HOSPITAL_NAME || 'Medical 365',
            appName: rawBranding.appName || rawBranding.hospitalName || BUILD_HOSPITAL_NAME || 'Medical 365',
            _isBaseline: false,
          };
          await saveBrandingData(brandingData, null, slug);
          setBranding(brandingData);
          brandingRef.current = brandingData;
        }
      }
    } catch (error) {
      console.warn('[BrandingContext] Failed to load branding by slug:', slug, error.message);
    } finally {
      inFlightRef.current = null;
      setLoading(false);
    }
  }, [loadBranding, saveBrandingData]);

  useEffect(() => {
    let isMounted = true;

    const initBranding = async () => {
      try {
        // 1. Identify target tenant from build configuration or previous session
        const targetId = BUILD_TENANT_ID;
        const targetSlug = BUILD_TENANT_SLUG;
        const targetName = BUILD_HOSPITAL_NAME;

        // 2. Read existing cache and validate against current target tenant
        const cachedRaw = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING);
        const savedId = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID);

        let validatedCache = null;
        if (cachedRaw) {
          try {
            const parsed = JSON.parse(cachedRaw);
            if (isCacheValidForTarget(parsed, savedId, targetId, targetSlug, targetName)) {
              validatedCache = parsed;
            } else {
              // Cache belongs to a DIFFERENT tenant! Purge global keys to prevent poisoning
              console.log('[BrandingContext] Cache mismatch detected. Purging stale foreign cache.');
              await AsyncStorage.multiRemove([
                STORAGE_KEYS.HOSPITAL_BRANDING,
                STORAGE_KEYS.HOSPITAL_BRANDING_NAME,
                STORAGE_KEYS.HOSPITAL_BRANDING_ID,
              ]);
            }
          } catch (e) { }
        }

        // 3. If targetId exists, also check tenant-isolated cache key
        if (!validatedCache && targetId) {
          const tenantKey = getTenantCacheKey(targetId);
          if (tenantKey) {
            const rawTenant = await AsyncStorage.getItem(tenantKey);
            if (rawTenant) {
              try {
                validatedCache = JSON.parse(rawTenant);
              } catch (e) { }
            }
          }
        }

        // 4. Hydrate validated cache if available
        if (validatedCache && isMounted) {
          setBranding(validatedCache);
          brandingRef.current = validatedCache;
        }

        // 5. Trigger live fetch for active tenant
        if (targetId) {
          await loadBranding(targetId);
        } else if (targetSlug) {
          await loadBrandingBySlug(targetSlug);
        } else if (savedId && !targetName) {
          // Only check savedId if no build-time hospital name was specified
          await loadBranding(savedId);
        } else if (!targetName) {
          // No build tenant and no saved tenant: set neutral Medical365 fallback
          const neutralBranding = {
            hospitalName: 'Medical 365',
            appName: 'Medical 365',
            logoUrl: null,
            primaryColor: '#0d9488',
            secondaryColor: '#0f766e',
            backgroundColor: '#ffffff',
            _isBaseline: true,
          };
          if (isMounted && !brandingRef.current) {
            setBranding(neutralBranding);
            brandingRef.current = neutralBranding;
          }
        }
      } catch (err) {
        console.warn('[BrandingContext] initBranding error:', err);
      } finally {
        if (isMounted) setIsHydrated(true);
      }
    };

    initBranding();
    return () => { isMounted = false; };
  }, [loadBranding, loadBrandingBySlug]);

  const resetBranding = useCallback(async () => {
    lastLoadedIdRef.current = null;
    inFlightRef.current = null;

    if (BUILD_HOSPITAL_NAME) {
      // Revert to configured build tenant identity
      const baseline = createBaselineBranding(BUILD_HOSPITAL_NAME, BUILD_TENANT_ID, BUILD_TENANT_SLUG);
      setBranding(baseline);
      brandingRef.current = baseline;
      if (BUILD_TENANT_ID) {
        loadBranding(BUILD_TENANT_ID);
      } else if (BUILD_TENANT_SLUG) {
        loadBrandingBySlug(BUILD_TENANT_SLUG);
      }
    } else {
      // Pure neutral reset
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.HOSPITAL_BRANDING,
        STORAGE_KEYS.HOSPITAL_BRANDING_NAME,
        STORAGE_KEYS.HOSPITAL_BRANDING_ID,
      ]);
      setBranding(null);
      brandingRef.current = null;
    }
  }, [loadBranding, loadBrandingBySlug]);

  const getTheme = () => buildTheme(branding || null);

  const contextValue = useMemo(() => ({
    branding,
    hospitalName: branding?.hospitalName || branding?.appName || BUILD_HOSPITAL_NAME || 'Medical 365',
    tenantId: branding?.hospitalId || branding?._tenantId || BUILD_TENANT_ID || null,
    isHydrated,
    loading,
    loadBranding,
    loadBrandingBySlug,
    resetBranding,
    getTheme,
  }), [branding, isHydrated, loading, loadBranding, loadBrandingBySlug, resetBranding]);

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