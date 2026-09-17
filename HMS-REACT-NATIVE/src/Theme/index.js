/**
 * Design token system — replaces all CSS custom properties (--brand-500, etc.)
 * The BrandingContext overrides these at runtime for white-label support.
 */

// Helper: darken a hex color by a given factor (0.85 = 15% darker) for shade separation
const darkenHex = (hex, factor = 0.85) => {
    if (!hex || typeof hex !== 'string') return '#0d9488';
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return '#0d9488';
    const num = parseInt(clean, 16);
    if (isNaN(num)) return '#0d9488';
    const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 255) * factor)));
    const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 255) * factor)));
    const b = Math.max(0, Math.min(255, Math.round((num & 255) * factor)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

// Returns the existing default shade for Medical 365 or dynamically darkens a custom theme color.
const getBrand600 = (color) => {
    if (!color || typeof color !== 'string') return '#0d9488';
    const normalized = color.trim().toLowerCase();
    if (normalized === '#14b8a6') return '#0d9488';
    return darkenHex(normalized, 0.85);
};

const hexToRgb = (hex) => {
    if (!hex || typeof hex !== 'string') return { r: 20, g: 184, b: 166 };
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (clean.length !== 6) return { r: 20, g: 184, b: 166 };
    const num = parseInt(clean, 16);
    if (isNaN(num)) return { r: 20, g: 184, b: 166 };
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
};

const envThemeColor = process.env.EXPO_PUBLIC_THEME_COLOR;
const defaultPrimary = envThemeColor || '#14b8a6';
const defaultBrand600 = getBrand600(defaultPrimary);
const defaultRgb = hexToRgb(defaultPrimary);

export const DEFAULT_BRANDING = {
    appName: 'Medical 365',
    tagline: 'Healthcare Suite',
    logoUrl: '/assets/logo.png',
    faviconUrl: '/assets/logo.png',
    primaryColor: defaultPrimary,
    secondaryColor: '#0a2647',
    accentColor: '#6366f1',
    successColor: '#10b981',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    supportEmail: '',
    supportPhone: '',
    address: '',
    websiteUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    twitterUrl: '',
    footerText: '',
};

export const DEFAULT_COLORS = {
    primary: defaultPrimary,
    secondary: '#0a2647',
    accent: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',

    // Brand scale
    brand50: `rgba(${defaultRgb.r},${defaultRgb.g},${defaultRgb.b},0.08)`,
    brand100: `rgba(${defaultRgb.r},${defaultRgb.g},${defaultRgb.b},0.14)`,
    brand500: defaultPrimary,
    brand600: defaultBrand600,
    brand700: '#0f766e',

    // Navy scale
    navy700: '#0a2647',
    navy800: '#0a2647',
    navy900: '#0a2647',

    // Grays
    gray50: '#f8fafc',
    gray100: '#f1f5f9',
    gray200: '#e2e8f0',
    gray300: '#cbd5e1',
    gray400: '#94a3b8',
    gray500: '#64748b',
    gray600: '#475569',
    gray700: '#334155',
    gray800: '#1e293b',
    gray900: '#0f172a',

    // Status colors
    statusPending: '#f59e0b',
    statusConfirmed: '#10b981',
    statusCancelled: '#ef4444',
    statusCompleted: '#6366f1',
};

export const GRADIENTS = {
    brand: [defaultPrimary, '#0a2647'],
    navy: ['#0a2647', '#1a3a6b'],
    success: ['#10b981', '#059669'],
    danger: ['#ef4444', '#dc2626'],
};

export const TYPOGRAPHY = {
    fontSizeXs: 11,
    fontSizeSm: 13,
    fontSizeMd: 15,
    fontSizeLg: 17,
    fontSizeXl: 20,
    fontSize2xl: 24,
    fontSize3xl: 30,

    fontWeightNormal: '400',
    fontWeightMedium: '500',
    fontWeightSemiBold: '600',
    fontWeightBold: '700',
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const RADIUS = {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    brand: (primaryColor = defaultPrimary) => ({
        shadowColor: primaryColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 8,
    }),
};

export const buildTheme = (branding) => {
    const safeBranding = branding || DEFAULT_BRANDING;

    const primary = safeBranding?.primaryColor || defaultPrimary;
    const secondary = safeBranding?.secondaryColor || DEFAULT_COLORS.secondary;
    const success = safeBranding?.successColor || DEFAULT_COLORS.success;
    const bg = safeBranding?.backgroundColor || DEFAULT_COLORS.background;
    const text = safeBranding?.textColor || DEFAULT_COLORS.text;

    const { r, g, b } = hexToRgb(primary);
    const brand600 = getBrand600(primary);

    return {
        ...DEFAULT_COLORS,
        primary,
        secondary,
        success,
        background: bg,
        text,
        brand50: `rgba(${r},${g},${b},0.08)`,
        brand100: `rgba(${r},${g},${b},0.14)`,
        brand500: primary,
        brand600,
        // Preserve the existing token semantic instead of mapping brand700 to the secondary color.
        brand700: DEFAULT_COLORS.brand700,
        navy700: secondary,
        navy800: secondary,
        navy900: secondary,
        gradientBrand: [primary, secondary],
        gradientSuccess: [success, success + 'dd'],
        TYPOGRAPHY,
        SPACING,
        RADIUS,
        SHADOWS,
    };
};

export default buildTheme;
