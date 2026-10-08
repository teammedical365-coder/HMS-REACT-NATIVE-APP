import { useWindowDimensions } from 'react-native';

/**
 * OT Module Responsive Architecture
 * Senior Production-Grade Responsive Tokens & Helpers
 *
 * Breakpoints:
 * - Small Phone:   < 375dp  (320dp, 360dp)
 * - Standard Phone: 375 - 479dp (375dp, 390dp, 412dp, 414dp, 430dp)
 * - Large Phone:   480 - 599dp (480dp, 540dp)
 * - Compact Tablet: 600 - 767dp (Foldables, small tablets)
 * - Standard Tablet: 768 - 1023dp (iPad mini, iPad 10.2", Galaxy Tab)
 * - Large Tablet / Desktop: >= 1024dp (iPad Pro 12.9", Desktop)
 */

export const BREAKPOINTS = {
    SMALL_PHONE: 375,
    COMPACT_PHONE: 600,
    TABLET: 768,
    DESKTOP: 1024,
};

export const useOTResponsive = () => {
    const { width, height } = useWindowDimensions();

    const shortestDimension = Math.min(width, height);
    const longestDimension = Math.max(width, height);
    const isLandscape = width > height;
    const isPortrait = !isLandscape;

    // Landscape Phone: Rotated phone with wide width (>=600 or >=768) but constrained vertical height (<500dp)
    // e.g., iPhone 14 Pro Max landscape is 932w x 430h, Galaxy S23 landscape is 915w x 412h
    const isLandscapePhone = isLandscape && shortestDimension < 500;

    // Physical tablet check: any physical tablet (iPad Mini, Galaxy Tab) has shortestDimension >= 600dp
    const isPhysicalTablet = shortestDimension >= 600;

    // Tablet layout decision: A screen only receives tablet multi-column table/grid layout if:
    // it has sufficient vertical estate (height >= 500dp) AND width >= 768dp, OR is a physical tablet
    // This prevents rotated phones with 390-430dp height from prematurely rendering dense desktop tables
    const isTablet = (width >= BREAKPOINTS.TABLET && height >= 500) || (isPhysicalTablet && width >= BREAKPOINTS.TABLET);
    const isLargeTablet = (width >= BREAKPOINTS.DESKTOP && height >= 600) || (isPhysicalTablet && width >= BREAKPOINTS.DESKTOP);

    // Any device that is not a tablet (including phones in portrait and phones in landscape) uses phone layout
    const isPhone = !isTablet;
    const isSmallPhone = width < BREAKPOINTS.SMALL_PHONE && !isLandscape;
    const isCompactPhone = width < BREAKPOINTS.COMPACT_PHONE && !isLandscape;

    // Responsive padding (strictly monotonic and orientation-conscious)
    const pagePadding = isLandscapePhone
        ? 12
        : isSmallPhone
            ? 10
            : isCompactPhone
                ? 14
                : !isTablet
                    ? 16
                    : !isLargeTablet
                        ? 18
                        : 24;

    const cardPadding = isLandscapePhone
        ? 12
        : isSmallPhone
            ? 12
            : isCompactPhone
                ? 14
                : !isTablet
                    ? 16
                    : !isLargeTablet
                        ? 18
                        : 20;

    const gap = isLandscapePhone ? 10 : isSmallPhone ? 10 : isCompactPhone ? 12 : 16;
    const modalPadding = isLandscapePhone ? 12 : isSmallPhone ? 12 : isCompactPhone ? 16 : 22;

    // Modal sizing (constrained by both width and height)
    const modalMaxWidth = Math.min(width - (isSmallPhone ? 16 : 32), isPhone ? 500 : 640);
    const modalMaxHeight = Math.floor(height * (isLandscapePhone ? 0.94 : 0.88));

    // Grid column calculation based on available width and desired item width
    const getGridColumns = (minItemWidth = 260) => {
        const availableWidth = width - pagePadding * 2;
        const cols = Math.floor(availableWidth / minItemWidth);
        return Math.max(1, cols);
    };

    // Card width percentage helper for flexWrap layouts (safe on both Native & Web)
    const getCardWidth = (columns = 1) => {
        if (columns <= 1) return '100%';
        if (columns === 2) return '48.5%';
        if (columns === 3) return '31.5%';
        return '23.5%';
    };

    // Calculate numeric card width based on screen width and padding
    const getNumericCardWidth = (columns = 1, itemGap = gap) => {
        const availableWidth = width - (pagePadding * 2);
        if (columns <= 1) return availableWidth;
        const totalGap = itemGap * (columns - 1);
        return Math.floor((availableWidth - totalGap) / columns);
    };

    return {
        width,
        height,
        shortestDimension,
        longestDimension,
        isPortrait,
        isLandscape,
        isLandscapePhone,
        isPhysicalTablet,
        isSmallPhone,
        isCompactPhone,
        isPhone,
        isTablet,
        isLargeTablet,
        pagePadding,
        cardPadding,
        gap,
        modalPadding,
        modalMaxWidth,
        modalMaxHeight,
        getGridColumns,
        getCardWidth,
        getNumericCardWidth,
    };
};

export default useOTResponsive;
