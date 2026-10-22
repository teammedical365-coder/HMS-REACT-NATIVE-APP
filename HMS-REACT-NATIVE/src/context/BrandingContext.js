import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/Constants';
import { buildTheme } from '../Theme';
import { HARDCODED_TENANT } from '../tenant.js';
import { getNativeApplicationId, isHospitalPackageId } from '../utils/subdomain';

const isCleanUrl = (u) => Boolean(u && typeof u === 'string' && u.trim() && !u.includes('gemini.google.com'));

const BrandingContext = createContext();

// Resolve build-time configured tenant identity
const BUILD_TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID || HARDCODED_TENANT?.tenantId || null;
const BUILD_TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG || HARDCODED_TENANT?.slug || null;
const BUILD_HOSPITAL_NAME = process.env.EXPO_PUBLIC_HOSPITAL_NAME || HARDCODED_TENANT?.name || null;

import {
  createBaselineBranding,
  isCacheValidForTarget,
  getTenantCacheKey,
  getSlugCacheKey,
  getPackageCacheKey,
} from '../utils/packageIdentity';

export const BrandingProvider = ({ children }) => {
  const nativeAppId = getNativeApplicationId();
  const isDedicatedWhiteLabel = isHospitalPackageId(nativeAppId);

  const [branding, setBranding] = useState(() =>
    createBaselineBranding(BUILD_HOSPITAL_NAME, BUILD_TENANT_ID, BUILD_TENANT_SLUG, nativeAppId)
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolutionError, setResolutionError] = useState(null);
  const lastLoadedIdRef = useRef(null);
  const inFlightRef = useRef(null);
  const brandingRef = useRef(branding);

  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  // Saves branding data in tenant-isolated cache, package-isolated cache, and standard keys
  const saveBrandingData = useCallback(async (brandingData, hospitalId, slug, packageId) => {
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
      if (packageId) {
        const pkgKey = getPackageCacheKey(packageId);
        if (pkgKey) itemsToSet.push([pkgKey, serialized]);
      }
      await AsyncStorage.multiSet(itemsToSet);
    } catch (err) {
      console.warn('[BrandingContext] Failed to cache branding data:', err.message);
    }
  }, []);

  // Loads branding using the canonical packageId query (Gate 1 & Gate 3)
  const loadBrandingByPackageId = useCallback(async (packageId) => {
    if (!packageId) return;
    const fetchKey = `pkg:${packageId}`;
    if (inFlightRef.current === fetchKey) return;

    inFlightRef.current = fetchKey;
    setLoading(true);

    try {
      // 1. Check package-isolated cache first for instant hydration
      const pkgKey = getPackageCacheKey(packageId);
      if (pkgKey) {
        const pkgCachedRaw = await AsyncStorage.getItem(pkgKey);
        if (pkgCachedRaw) {
          try {
            const pkgCached = JSON.parse(pkgCachedRaw);
            if (pkgCached && (pkgCached.hospitalName || pkgCached.logoUrl)) {
              setBranding(pkgCached);
              brandingRef.current = pkgCached;
            }
          } catch (e) {}
        }
      }

      // 2. Fetch live branding from backend using canonical packageId
      const apiUrl = `${API_BASE_URL}/api/public/branding?packageId=${encodeURIComponent(packageId)}`;
      const response = await axios.get(apiUrl);

      if (response.data && response.data.branding) {
        const rawBranding = response.data.branding;
        const customTheme = rawBranding.themeColors || {};

        const brandingData = {
          ...rawBranding,
          hospitalId: response.data.hospitalId || rawBranding.hospitalId || null,
          _tenantId: response.data.hospitalId || rawBranding.hospitalId || null,
          _tenantSlug: rawBranding.slug || null,
          _tenantPackageId: packageId,
          packageId: packageId,
          logoUrl: isCleanUrl(rawBranding.logoUrl) ? rawBranding.logoUrl : null,
          faviconUrl: isCleanUrl(rawBranding.faviconUrl) ? rawBranding.faviconUrl : null,
          primaryColor: customTheme.primary || rawBranding.primaryColor || '#0d9488',
          secondaryColor: customTheme.secondary || rawBranding.secondaryColor || '#0f766e',
          backgroundColor: customTheme.background || rawBranding.backgroundColor || '#ffffff',
          hospitalName: rawBranding.appName || response.data.hospitalName || rawBranding.hospitalName || 'Hospital Portal',
          appName: rawBranding.appName || response.data.hospitalName || rawBranding.hospitalName || 'Hospital Portal',
          _isBaseline: false,
        };

        await saveBrandingData(brandingData, brandingData.hospitalId, rawBranding.slug, packageId);
        lastLoadedIdRef.current = fetchKey;
        setBranding(brandingData);
        brandingRef.current = brandingData;
        setResolutionError(null);
        return brandingData;
      }
    } catch (error) {
      console.warn('[BrandingContext] Failed to load branding for package:', packageId, error.message);
      throw error;
    } finally {
      inFlightRef.current = null;
      setLoading(false);
    }
  }, [saveBrandingData]);

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
        const nativePackageId = getNativeApplicationId();
        const isWhiteLabel = isHospitalPackageId(nativePackageId);

        // ── PATH A: Dedicated Native White-Label APK ─────────────────────────────
        // Strictly bound to the native package ID. Immune to OTA bundle constant overwrites.
        if (isWhiteLabel) {
          const pkgKey = getPackageCacheKey(nativePackageId);
          let validatedCache = null;

          if (pkgKey) {
            const rawPkg = await AsyncStorage.getItem(pkgKey);
            if (rawPkg) {
              try {
                const parsed = JSON.parse(rawPkg);
                if (isCacheValidForTarget(parsed, null, null, null, null, nativePackageId)) {
                  validatedCache = parsed;
                }
              } catch (e) {}
            }
          }

          if (!validatedCache) {
            const standardRaw = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING);
            if (standardRaw) {
              try {
                const parsed = JSON.parse(standardRaw);
                if (isCacheValidForTarget(parsed, null, null, null, null, nativePackageId)) {
                  validatedCache = parsed;
                }
              } catch (e) {}
            }
          }

          // Instant cache hydration if valid for this package
          if (validatedCache && isMounted) {
            setBranding(validatedCache);
            brandingRef.current = validatedCache;
          }

          // Live fetch using canonical packageId
          try {
            await loadBrandingByPackageId(nativePackageId);
            if (isMounted) setResolutionError(null);
          } catch (fetchErr) {
            if (!validatedCache && isMounted) {
              setResolutionError(fetchErr.message || 'Unable to connect to hospital workspace');
            }
          }
          return;
        }

        // ── PATH B: Web / Generic Platform APK ────────────────────────────────────
        const targetId = BUILD_TENANT_ID;
        const targetSlug = BUILD_TENANT_SLUG;
        const targetName = BUILD_HOSPITAL_NAME;

        const cachedRaw = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING);
        const savedId = await AsyncStorage.getItem(STORAGE_KEYS.HOSPITAL_BRANDING_ID);

        let validatedCache = null;
        if (cachedRaw) {
          try {
            const parsed = JSON.parse(cachedRaw);
            if (isCacheValidForTarget(parsed, savedId, targetId, targetSlug, targetName, null)) {
              validatedCache = parsed;
            } else {
              console.log('[BrandingContext] Cache mismatch detected. Purging stale foreign cache.');
              await AsyncStorage.multiRemove([
                STORAGE_KEYS.HOSPITAL_BRANDING,
                STORAGE_KEYS.HOSPITAL_BRANDING_NAME,
                STORAGE_KEYS.HOSPITAL_BRANDING_ID,
              ]);
            }
          } catch (e) { }
        }

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

        if (validatedCache && isMounted) {
          setBranding(validatedCache);
          brandingRef.current = validatedCache;
        }

        if (targetId) {
          await loadBranding(targetId);
        } else if (targetSlug) {
          await loadBrandingBySlug(targetSlug);
        } else if (savedId && !targetName) {
          await loadBranding(savedId);
        } else if (!targetName) {
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
  }, [loadBranding, loadBrandingBySlug, loadBrandingByPackageId]);

  const retryResolution = useCallback(async () => {
    const nativePackageId = getNativeApplicationId();
    if (isHospitalPackageId(nativePackageId)) {
      setResolutionError(null);
      try {
        await loadBrandingByPackageId(nativePackageId);
      } catch (err) {
        setResolutionError(err.message || 'Unable to connect to hospital workspace');
      }
    }
  }, [loadBrandingByPackageId]);

  const resetBranding = useCallback(async () => {
    lastLoadedIdRef.current = null;
    inFlightRef.current = null;
    setResolutionError(null);

    const nativePackageId = getNativeApplicationId();
    if (isHospitalPackageId(nativePackageId)) {
      await loadBrandingByPackageId(nativePackageId);
    } else if (BUILD_HOSPITAL_NAME) {
      const baseline = createBaselineBranding(BUILD_HOSPITAL_NAME, BUILD_TENANT_ID, BUILD_TENANT_SLUG, nativePackageId);
      setBranding(baseline);
      brandingRef.current = baseline;
      if (BUILD_TENANT_ID) {
        loadBranding(BUILD_TENANT_ID);
      } else if (BUILD_TENANT_SLUG) {
        loadBrandingBySlug(BUILD_TENANT_SLUG);
      }
    } else {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.HOSPITAL_BRANDING,
        STORAGE_KEYS.HOSPITAL_BRANDING_NAME,
        STORAGE_KEYS.HOSPITAL_BRANDING_ID,
      ]);
      setBranding(null);
      brandingRef.current = null;
    }
  }, [loadBranding, loadBrandingBySlug, loadBrandingByPackageId]);

  const getTheme = () => buildTheme(branding || null);

  const contextValue = useMemo(() => ({
    branding,
    hospitalName: branding?.hospitalName || branding?.appName || (isDedicatedWhiteLabel ? 'Hospital Portal' : (BUILD_HOSPITAL_NAME || 'Medical 365')),
    tenantId: (branding && !branding._isBaseline && (branding.hospitalId || branding._tenantId)) || (isDedicatedWhiteLabel ? null : BUILD_TENANT_ID) || null,
    isHydrated,
    loading,
    resolutionError,
    loadBranding,
    loadBrandingBySlug,
    loadBrandingByPackageId,
    retryResolution,
    resetBranding,
    getTheme,
  }), [branding, isHydrated, loading, resolutionError, loadBranding, loadBrandingBySlug, loadBrandingByPackageId, retryResolution, resetBranding, isDedicatedWhiteLabel]);

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