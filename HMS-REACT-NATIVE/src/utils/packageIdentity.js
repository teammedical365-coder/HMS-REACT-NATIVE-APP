/**
 * packageIdentity.js
 * 
 * Pure JavaScript utility for package-ID validation, cache scoping, and baseline branding derivation.
 * Free of JSX and native binary dependencies so it can be imported directly in both runtime code
 * and automated offline test suites.
 */

const STORAGE_KEYS_HOSPITAL_BRANDING = 'hospitalBranding';

/**
 * Validates whether an applicationId represents a dedicated white-label hospital package.
 * Excludes generic platform package ('com.medical365.app'), malformed strings, and foreign domains.
 * 
 * @param {string} appId 
 * @returns {boolean}
 */
export const isHospitalPackageId = (appId) => {
  if (!appId || typeof appId !== 'string') return false;
  const clean = appId.trim();
  return /^com\.medical365\.[a-z][a-z0-9_]*$/.test(clean) && clean !== 'com.medical365.app';
};

/**
 * Tenant and package-scoped AsyncStorage keys
 */
export const getTenantCacheKey = (tenantId) => tenantId ? `${STORAGE_KEYS_HOSPITAL_BRANDING}_${tenantId}` : null;
export const getSlugCacheKey = (slug) => slug ? `${STORAGE_KEYS_HOSPITAL_BRANDING}_slug_${slug}` : null;
export const getPackageCacheKey = (packageId) => packageId ? `${STORAGE_KEYS_HOSPITAL_BRANDING}_pkg_${packageId}` : null;

/**
 * Cache validator: ensures cached branding belongs strictly to the requested tenant / native package.
 * Prevents cross-tenant branding contamination (e.g. Hospital B cache reused for Hospital A).
 */
export const isCacheValidForTarget = (cachedData, savedId, targetId, targetSlug, targetName, targetPackageId) => {
  if (!cachedData || typeof cachedData !== 'object') return false;

  // 0. Dedicated Native White-Label Hardware Anchor:
  if (targetPackageId) {
    const cachedPkg = cachedData.packageId || cachedData._tenantPackageId;
    if (!cachedPkg || String(cachedPkg).toLowerCase() !== String(targetPackageId).toLowerCase()) {
      return false; // Missing or mismatched native package ID!
    }
  }

  // 1. Target tenant ID match
  if (targetId) {
    const cachedId = cachedData._tenantId || cachedData.hospitalId || cachedData._id || savedId;
    if (cachedId && String(cachedId) !== String(targetId)) {
      return false;
    }
  }

  // 2. Target slug match
  if (targetSlug) {
    const cachedSlug = cachedData._tenantSlug || cachedData.slug;
    if (cachedSlug && String(cachedSlug).toLowerCase() !== String(targetSlug).toLowerCase()) {
      return false;
    }
  }

  // 3. Target hospital name match
  if (targetName) {
    const cachedName = cachedData.hospitalName || cachedData.appName;
    if (cachedName && cachedName.trim().toLowerCase() !== targetName.trim().toLowerCase()) {
      return false;
    }
  }

  return true;
};

/**
 * Derives initial baseline branding.
 * 
 * CRITICAL TENANT ISOLATION RULE (F-04):
 * For dedicated native hospital packages (isHospitalPackageId === true), UNVERIFIED bundle
 * constants (BUILD_TENANT_ID, BUILD_TENANT_SLUG, BUILD_HOSPITAL_NAME) must NOT enter baseline
 * branding state. Identity must remain null/neutral until verified by live backend response
 * or package-scoped validated cache.
 */
export const createBaselineBranding = (hospitalName, tenantId, tenantSlug, packageId) => {
  const isDedicated = isHospitalPackageId(packageId);

  if (isDedicated) {
    return {
      hospitalName: 'Hospital Portal',
      appName: 'Hospital Portal',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#0d9488',
      secondaryColor: '#0f766e',
      backgroundColor: '#ffffff',
      hospitalId: null,
      slug: null,
      _tenantId: null,
      _tenantSlug: null,
      _tenantPackageId: packageId,
      packageId: packageId,
      _isBaseline: true,
    };
  }

  if (!hospitalName && !tenantId && !tenantSlug && !packageId) return null;
  const name = hospitalName || 'Medical 365';
  return {
    hospitalName: name,
    appName: name,
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#0d9488',
    secondaryColor: '#0f766e',
    backgroundColor: '#ffffff',
    hospitalId: tenantId || null,
    slug: tenantSlug || null,
    _tenantId: tenantId || null,
    _tenantSlug: tenantSlug || null,
    _tenantPackageId: packageId || null,
    packageId: packageId || null,
    _isBaseline: true,
  };
};
