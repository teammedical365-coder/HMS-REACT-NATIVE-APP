import { Platform } from 'react-native';

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
