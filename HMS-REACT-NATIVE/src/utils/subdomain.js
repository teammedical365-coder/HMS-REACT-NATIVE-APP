import { Platform } from 'react-native';
import { HARDCODED_TENANT } from '../tenant';

// Synchronously resolve build/environment configured tenant
export const BUILD_TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID || HARDCODED_TENANT?.tenantId || null;
export const BUILD_TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG || HARDCODED_TENANT?.slug || null;
export const BUILD_TENANT_IDENTIFIER = BUILD_TENANT_SLUG || BUILD_TENANT_ID || null;

// A valid, explicitly configured hospital tenant in environment/build configuration:
// Excludes neutral platform identifiers ('medical365', 'admin') and empty strings.
export const HAS_EXPLICIT_HOSPITAL_TENANT_CONFIG = Boolean(
    BUILD_TENANT_IDENTIFIER &&
    BUILD_TENANT_IDENTIFIER !== 'medical365' &&
    BUILD_TENANT_IDENTIFIER !== 'admin'
);

// Fixed-tenant white-label builds apply strictly to native mobile APK contexts.
export const IS_FIXED_NATIVE_WHITE_LABEL_BUILD = Platform.OS !== 'web' && HAS_EXPLICIT_HOSPITAL_TENANT_CONFIG;

/**
 * Evaluates whether the application is currently operating within a configured hospital tenant context.
 * Returns true for:
 * 1. Fixed-tenant hospital APK.
 * 2. Local web or deployment running with an explicitly configured hospital Tenant ID or Slug (e.g. EXPO_PUBLIC_TENANT_ID).
 * 3. Web session opened using a tenant-specific URL (subdomain, custom hospital domain, or query params).
 * 4. Runtime context passed from caller (route params, branding context, or auth state).
 */
export const isHospitalTenantContext = (runtimeContext = {}) => {
    // 1. Authoritative build or environment configured hospital tenant (APK or Web)
    if (HAS_EXPLICIT_HOSPITAL_TENANT_CONFIG || IS_FIXED_NATIVE_WHITE_LABEL_BUILD) {
        return true;
    }

    // 2. Web URL subdomain or custom hospital domain
    if (Platform.OS === 'web') {
        const sub = getSubdomain();
        if (sub && sub !== 'admin' && sub !== 'www' && sub !== 'api' && sub !== 'medical365') {
            return true;
        }

        if (typeof window !== 'undefined') {
            const search = (window.location.search || '').toLowerCase();
            if (
                search.includes('tenant=') ||
                search.includes('slug=') ||
                search.includes('hospital=') ||
                search.includes('hospitalid=') ||
                search.includes('tenantid=')
            ) {
                const params = new URLSearchParams(search);
                const queryTenant =
                    params.get('tenant') ||
                    params.get('slug') ||
                    params.get('hospital') ||
                    params.get('hospitalid') ||
                    params.get('tenantid');
                if (queryTenant && queryTenant !== 'medical365' && queryTenant !== 'admin') {
                    return true;
                }
            }
        }
    }

    // 3. Runtime caller parameters (e.g. route params, branding context, auth state)
    const { routeParams, branding, tenant } = runtimeContext;

    if (routeParams) {
        const routeTenant =
            routeParams.slug ||
            routeParams.tenantId ||
            routeParams.tenant ||
            routeParams.hospitalId ||
            routeParams.hospitalSlug;
        if (routeTenant && routeTenant !== 'medical365' && routeTenant !== 'admin') {
            return true;
        }
    }

    if (branding) {
        const brandingTenant =
            branding.hospitalId ||
            branding._tenantId ||
            branding.tenantId ||
            branding.slug ||
            branding._tenantSlug ||
            branding._id;
        if (brandingTenant && brandingTenant !== 'medical365' && brandingTenant !== 'admin') {
            return true;
        }
    }

    if (tenant) {
        const authTenant =
            tenant.slug ||
            tenant.id ||
            tenant._id ||
            tenant.tenantId ||
            tenant.subdomain;
        if (authTenant && authTenant !== 'medical365' && authTenant !== 'admin') {
            return true;
        }
    }

    return false;
};

export const isCentralPlatformDomain = (hostname) => {
    if (!hostname || typeof hostname !== 'string') return false;
    const h = hostname.toLowerCase();
    return (
        h.endsWith('.vercel.app') ||
        h === 'medical365.in' ||
        h === 'www.medical365.in' ||
        h === 'admin.medical365.in' ||
        h.startsWith('admin.') ||
        h === 'localhost' ||
        h === '127.0.0.1' ||
        /^192\.168\./.test(h)
    );
};

export const isCentralPlatform = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    return isCentralPlatformDomain(window.location.hostname);
};

export const getSubdomain = () => {
    // 1. Check for explicit tenant override via query parameters (useful for Electron/Testing)
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    const tenantOverride =
        urlParams.get('tenant') ||
        urlParams.get('slug') ||
        urlParams.get('hospital') ||
        urlParams.get('hospitalId') ||
        urlParams.get('tenantId');
    if (tenantOverride) {
        return tenantOverride;
    }

    const hostname = window.location.hostname;

    // Direct IPs, naked localhost, or Vercel development domains
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === 'localhost' || hostname.endsWith('.vercel.app')) {
        return null;
    }

    const isBaseDomain = hostname === 'medical365.in' || hostname === 'www.medical365.in';

    // If it's not the base domain and not localhost, it's either a subdomain of base domain OR a completely custom domain.
    if (!isBaseDomain) {
        const parts = hostname.split('.');

        // Localhost Subdomain testing (e.g., citycare.localhost)
        if (hostname.endsWith('localhost') && parts.length >= 2) {
            return parts[0] === 'www' ? null : parts[0];
        }

        // It is a live domain. If it's a subdomain of medical365.in:
        if (hostname.endsWith('.medical365.in')) {
            const subdomain = hostname.replace('.medical365.in', '');
            return subdomain === 'www' ? null : subdomain;
        }

        // Otherwise, it is a custom domain (like portal.hospitalA.com or hospitalA.com)
        // We can just return the full hostname or a special flag. Returning the hostname
        // ensures it is truthy and not in RESERVED_SUBDOMAINS, triggering HospitalLogin.
        return hostname;
    }

    return null;
};
