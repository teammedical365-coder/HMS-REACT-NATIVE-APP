/**
 * Design token system — replaces all CSS custom properties (--brand-500, etc.)
 * The BrandingContext overrides these at runtime for white-label support.
 */

export const DEFAULT_COLORS = {
    primary: '#14b8a6',
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
    brand50: 'rgba(20,184,166,0.08)',
    brand100: 'rgba(20,184,166,0.14)',
    brand500: '#14b8a6',
    brand600: '#0d9488',
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
    brand: ['#14b8a6', '#0a2647'],
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
    brand: (primaryColor = '#14b8a6') => ({
        shadowColor: primaryColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 8,
    }),
};

/**
 * Build a full theme object from a branding config (BrandingContext).
 * Components call `useTheme()` to get the current theme.
 */
export const buildTheme = (branding = {}) => {
    const primary = branding.primaryColor || DEFAULT_COLORS.primary;
    const secondary = branding.secondaryColor || DEFAULT_COLORS.secondary;
    const success = branding.successColor || DEFAULT_COLORS.success;
    const bg = branding.backgroundColor || DEFAULT_COLORS.background;
    const text = branding.textColor || DEFAULT_COLORS.text;

    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };

    const { r, g, b } = hexToRgb(primary.startsWith('#') ? primary : '#14b8a6');

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
        brand600: primary,
        brand700: secondary,
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