import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, TextInput, TouchableOpacity, Image, 
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, 
    Dimensions, Animated, useWindowDimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { useBranding } from '../../context/BrandingContext';

const isSafeLogo = (u) => Boolean(u && typeof u === 'string' && u.trim() && !u.includes('gemini.google.com'));

const NeuralAuthPortal = ({
    portalType = 'hospital',
    title = 'Hospital Portal',
    subtitle = 'Access dedicated hospital administrator workspace.',
    idLabel = 'Hospital Admin Email',
    idPlaceholder = 'admin@yourhospital.com',
    idType = 'email-address',
    passkeyLabel = 'Password',
    passkeyPlaceholder = '••••••••',
    branding = null,
    onLoginSubmit,
    onVerifyOtp,
    onResendOtp,
    onAbortOtp,
    onForceLogin,
    onCancelSession,
    otpStep = null,
    otpEmail = null,
    activeSession = null,
    loading = false,
    error = null,
    successMsg = null,
    sessionBanner = null,
    extraFooter = null,
}) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isDesktop = windowWidth >= 1200;
    const isTablet = windowWidth >= 769 && windowWidth < 1200;
    const isMobile = windowWidth <= 768;
    const isSmallScreen = isMobile || windowHeight < 720;

    const [credentials, setCredentials] = useState({ id: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(30);
    const [focusedOtpIndex, setFocusedOtpIndex] = useState(null);
    const [isBtnHovered, setIsBtnHovered] = useState(false);
    const [isOtpHovered, setIsOtpHovered] = useState(false);
    const [isTerminateHovered, setIsTerminateHovered] = useState(false);
    const [isIdFocused, setIsIdFocused] = useState(false);
    const [isPassFocused, setIsPassFocused] = useState(false);

    const otpInputRefs = useRef([]);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;
    const ecgAnim = useRef(new Animated.Value(0)).current;

    // Web CSS Keyframe Animations for 100% smooth GPU-accelerated motion matching live web
    useEffect(() => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const styleId = 'neural-auth-web-animations';
            let style = document.getElementById(styleId);
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            style.innerHTML = `
                @keyframes rotateClockwise {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes rotateCounterClockwise {
                    0% { transform: rotate(360deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes haloPulse {
                    0% { transform: scale(0.95); opacity: 0.7; }
                    100% { transform: scale(1.08); opacity: 1; }
                }
                @keyframes heartPulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(14, 165, 233, 0.35); }
                    15% { transform: scale(1.15); box-shadow: 0 0 22px rgba(14, 165, 233, 0.7); color: #0284c7; }
                    30% { transform: scale(1.04); }
                    45% { transform: scale(1.2); box-shadow: 0 0 28px rgba(16, 185, 129, 0.8); color: #10b981; }
                    60% { transform: scale(1); }
                }
                @keyframes ecgConveyor {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                #med-signin-btn, #med-otp-btn, #med-terminate-btn {
                    transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    cursor: pointer !important;
                }
                #med-signin-btn:hover:not([aria-disabled="true"]):not(:disabled),
                #med-otp-btn:hover:not([aria-disabled="true"]):not(:disabled),
                #med-terminate-btn:hover:not([aria-disabled="true"]):not(:disabled) {
                    transform: translateY(-2.5px) !important;
                    box-shadow: 0 14px 32px -4px rgba(14, 165, 233, 0.65), 0 6px 18px -2px rgba(13, 148, 136, 0.45) !important;
                    filter: brightness(1.06) !important;
                }
                #med-signin-btn:active, #med-otp-btn:active {
                    transform: translateY(0px) !important;
                }
            `;
        }
    }, []);

    useEffect(() => {
        // Decorative hologram/halo/ECG animations are strictly for desktop web viewports
        // where centerPane / leftPane are rendered.
        // On native Android/iOS and mobile viewports, these views are omitted, so running
        // native animation loops at 60fps causes thread contention and native focus dismissal.
        if (Platform.OS !== 'web' || !isDesktop) {
            return;
        }

        const spinLoop = Animated.loop(
            Animated.timing(spinAnim, { toValue: 1, duration: 16000, useNativeDriver: false })
        );
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: false }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false })
            ])
        );
        const ecgLoop = Animated.loop(
            Animated.timing(ecgAnim, { toValue: 1, duration: 3200, useNativeDriver: false })
        );

        spinLoop.start();
        pulseLoop.start();
        ecgLoop.start();

        return () => {
            spinLoop.stop();
            pulseLoop.stop();
            ecgLoop.stop();
        };
    }, [isDesktop]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });
    const spinReverse = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['360deg', '0deg']
    });

    const ecgTranslateX = ecgAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -200]
    });

    // OTP Timer
    useEffect(() => {
        let timer;
        if (otpStep === 'otp' && resendTimer > 0) {
            timer = setInterval(() => {
                setResendTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [otpStep, resendTimer]);

    const handleCredentialChange = (name, value) => {
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    const handleLoginSubmit = () => {
        if (onLoginSubmit) onLoginSubmit(credentials);
    };

    const handleOtpChange = (index, value) => {
        const digit = value.replace(/\D/g, '');
        const newOtp = [...otpValues];
        newOtp[index] = digit;
        setOtpValues(newOtp);

        if (digit && index < 5 && otpInputRefs.current[index + 1]) {
            otpInputRefs.current[index + 1].focus();
        }
    };

    const handleOtpKeyPress = (index, e) => {
        if (e.nativeEvent.key === 'Backspace' && !otpValues[index] && index > 0) {
            otpInputRefs.current[index - 1].focus();
        }
    };

    const handleOtpSubmit = () => {
        const fullOtp = otpValues.join('');
        if (fullOtp.length === 6 && onVerifyOtp) {
            onVerifyOtp(fullOtp);
        }
    };

    const handleResendClick = () => {
        if (resendTimer === 0 && onResendOtp) {
            onResendOtp();
            setResendTimer(30);
        }
    };

    const formatSessionTime = (dateVal) => {
        if (!dateVal) return 'Just now';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return 'Recently';
            const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
            if (diffSec < 45) return 'Just now';
            if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
            if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch {
            return 'Active';
        }
    };

    const getDeviceIcon = (osName) => {
        const s = String(osName || '').toLowerCase();
        if (s.includes('android') || s.includes('ios') || s.includes('iphone') || s.includes('mobile')) return 'smartphone';
        return 'monitor';
    };

    const primarySession = Array.isArray(activeSession) ? activeSession[0] : typeof activeSession === 'object' ? activeSession : null;

    const isSuperAdminPortal = (portalType === 'admin' && (title === 'Supreme Portal' || title === 'Super Admin Portal')) || title === 'Supreme Portal';

    let contextBranding = null;
    let isResolvingBranding = false;
    try {
        const brandingCtx = useBranding();
        contextBranding = brandingCtx?.branding;
        isResolvingBranding = Boolean(brandingCtx && (!brandingCtx.isHydrated || brandingCtx.loading) && !contextBranding);
    } catch (e) { }

    // Super Admin portal MUST ALWAYS use the official Medical365 logo — never hospital branding
    const effectiveBranding = isSuperAdminPortal ? null : (branding || contextBranding);
    const hasHospitalLogo = !isSuperAdminPortal && isSafeLogo(effectiveBranding?.logoUrl);
    const hospitalName = isSuperAdminPortal ? '' : (effectiveBranding?.hospitalName || effectiveBranding?.appName || '');

    // White-label branding priority:
    // 1. Super Admin Portal -> ALWAYS official Medical365 logo
    // 2. Hospital Portal with hospital logo -> display hospital logo
    // 3. Branding resolving -> show placeholder, do NOT flash wrong logo
    // 4. Fallback -> official Medical365 logo
    const logoSrc = isSuperAdminPortal
        ? require('../../../assets/medical365-logo.png')
        : (hasHospitalLogo 
            ? { uri: effectiveBranding.logoUrl } 
            : (isResolvingBranding 
                ? null 
                : require('../../../assets/medical365-logo.png')));

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Ambient Light Healthcare Gradient Background */}
            <LinearGradient
                colors={['#f0f9ff', '#f0fdfa', '#f8fafc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Cyan Healthcare Dots Grid Pattern Overlay */}
            <View style={[StyleSheet.absoluteFillObject, styles.particlesGrid]} pointerEvents="none">
                <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                        <Pattern id="medGridDots" width="32" height="32" patternUnits="userSpaceOnUse">
                            <Circle cx="16" cy="16" r="1.5" fill="rgba(14, 165, 233, 0.18)" />
                        </Pattern>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#medGridDots)" />
                </Svg>
            </View>

            <ScrollView 
                contentContainerStyle={[
                    styles.scrollContent, 
                    isSmallScreen && styles.scrollContentSmall
                ]} 
                bounces={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[
                    styles.centerSection,
                    isSmallScreen && styles.centerSectionSmall
                ]}>
                    <View style={[
                        styles.mainWrapper, 
                        isDesktop && styles.mainWrapperDesktop, 
                        isTablet && styles.mainWrapperTablet,
                        isMobile && styles.mainWrapperSmall
                    ]}>
                        
                        {/* ─── LEFT SECTION: BRAND + HERO + FEATURES + ECG (Desktop / Tablet) ─── */}
                        {!isMobile && (
                            <View style={[
                                styles.leftPane, 
                                isTablet && styles.leftPaneTablet
                            ]}>
                                {/* Brand Logo pinned at Top-Left */}
                                <View style={styles.brandRow}>
                                    {logoSrc ? (
                                        <Image 
                                            source={logoSrc} 
                                            style={[
                                                styles.brandLogo,
                                                isTablet && styles.brandLogoTablet
                                            ]} 
                                            resizeMode="contain" 
                                        />
                                    ) : (
                                        <View style={styles.mobileBrandPlaceholder}>
                                            <View style={styles.mobileBrandSkeletonIcon}>
                                                <Feather name="activity" size={20} color="#0d9488" />
                                            </View>
                                            {hospitalName ? (
                                                <Text style={styles.mobileBrandTitleText}>{hospitalName}</Text>
                                            ) : (
                                                <View style={styles.mobileBrandSkeletonBar} />
                                            )}
                                        </View>
                                    )}
                                </View>

                                {/* Middle Stack: Headline + Feature Cards */}
                                <View style={styles.featureStack}>
                                    {/* Headline */}
                                    <View style={styles.heroTextContainer}>
                                        <Text style={styles.heroText}>Smarter Healthcare</Text>
                                        <Text style={styles.heroTextTeal}>Better Tomorrow</Text>
                                    </View>

                                    {/* Feature Cards Stack */}
                                    <View style={styles.featureList}>
                                        {/* Feature 1 */}
                                        <View style={styles.featureCard}>
                                            <View style={[styles.featureIconBox, { backgroundColor: '#ccfbf1' }]}>
                                                <Feather name="shield" size={17} color="#0d9488" />
                                            </View>
                                            <View style={styles.featureInfo}>
                                                <Text style={styles.featureTitle}>Secure & Compliant</Text>
                                                <Text style={styles.featureDesc}>256-bit encryption & HIPAA compliant</Text>
                                            </View>
                                            <View style={styles.statusPulseWrap}>
                                                <Animated.View style={[styles.statusDot, { backgroundColor: '#0d9488', transform: [{ scale: pulseAnim }] }]} />
                                            </View>
                                        </View>

                                        {/* Feature 2 */}
                                        <View style={styles.featureCard}>
                                            <View style={[styles.featureIconBox, { backgroundColor: '#f3e8ff' }]}>
                                                <Feather name="users" size={17} color="#7c3aed" />
                                            </View>
                                            <View style={styles.featureInfo}>
                                                <Text style={styles.featureTitle}>Smart Management</Text>
                                                <Text style={styles.featureDesc}>Streamline operations and save time</Text>
                                            </View>
                                            <View style={styles.statusPulseWrap}>
                                                <Animated.View style={[styles.statusDot, { backgroundColor: '#7c3aed', transform: [{ scale: pulseAnim }] }]} />
                                            </View>
                                        </View>

                                        {/* Feature 3 */}
                                        <View style={styles.featureCard}>
                                            <View style={[styles.featureIconBox, { backgroundColor: '#e0f2fe' }]}>
                                                <Feather name="trending-up" size={17} color="#0284c7" />
                                            </View>
                                            <View style={styles.featureInfo}>
                                                <Text style={styles.featureTitle}>Better Insights</Text>
                                                <Text style={styles.featureDesc}>Data-driven decisions for better care</Text>
                                            </View>
                                            <View style={styles.statusPulseWrap}>
                                                <Animated.View style={[styles.statusDot, { backgroundColor: '#0284c7', transform: [{ scale: pulseAnim }] }]} />
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Bottom Live Moving ECG Bar + Heart Pulse Badge */}
                                <View style={styles.ecgBar}>
                                    <View style={styles.ecgTopRow}>
                                        <Animated.View style={[
                                            styles.heartBadgeCircle,
                                            Platform.OS === 'web' ? { animation: 'heartPulse 1.4s ease-in-out infinite' } : { transform: [{ scale: pulseAnim }] }
                                        ]}>
                                            <FontAwesome5 name="heartbeat" size={17} color="#0ea5e9" />
                                        </Animated.View>
                                        <View style={styles.trustedBadge}>
                                            <FontAwesome5 name="hospital" size={12} color="#0d9488" />
                                            <Text style={styles.trustedText}>Trusted by 1000+ Healthcare Professionals</Text>
                                        </View>
                                    </View>
                                    <View style={styles.ecgSvgContainer}>
                                        <Animated.View style={[
                                            { width: 800 },
                                            Platform.OS === 'web' ? { animation: 'ecgConveyor 3.2s linear infinite' } : { transform: [{ translateX: ecgTranslateX }] }
                                        ]}>
                                            <Svg viewBox="0 0 800 48" height="32" width="800">
                                                <Path 
                                                    d="M0 24 L60 24 L75 24 L85 10 L95 38 L105 4 L115 44 L125 24 L140 24 L200 24 L215 24 L225 10 L235 38 L245 4 L255 44 L265 24 L280 24 L340 24 L355 24 L365 10 L375 38 L385 4 L395 44 L405 24 L420 24 L480 24 L495 24 L505 10 L515 38 L525 4 L535 44 L545 24 L560 24 L620 24 L635 24 L645 10 L655 38 L665 4 L675 44 L685 24 L700 24 L800 24"
                                                    stroke="#0ea5e9" 
                                                    strokeWidth="2.5" 
                                                    strokeLinecap="round" 
                                                    strokeLinejoin="round" 
                                                    fill="none" 
                                                />
                                                <Path 
                                                    d="M0 24 L60 24 L75 24 L85 10 L95 38 L105 4 L115 44 L125 24 L140 24 L200 24 L215 24 L225 10 L235 38 L245 4 L255 44 L265 24 L280 24 L340 24 L355 24 L365 10 L375 38 L385 4 L395 44 L405 24 L420 24 L480 24 L495 24 L505 10 L515 38 L525 4 L535 44 L545 24 L560 24 L620 24 L635 24 L645 10 L655 38 L665 4 L675 44 L685 24 L700 24 L800 24"
                                                    stroke="#10b981" 
                                                    strokeWidth="1.2" 
                                                    strokeLinecap="round" 
                                                    strokeLinejoin="round" 
                                                    opacity={0.8}
                                                    fill="none" 
                                                />
                                            </Svg>
                                        </Animated.View>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* ─── CENTER SECTION: HOLOGRAPHIC SURGEON STAGE (Desktop Web) ─── */}
                        {(Platform.OS === 'web' && isDesktop) && (
                            <View style={styles.centerPane}>
                                <View style={styles.hologramContainer}>
                                    <Animated.View style={[
                                        styles.haloRing, 
                                        Platform.OS === 'web' ? { animation: 'rotateClockwise 16s linear infinite' } : { transform: [{ rotate: spin }] }
                                    ]} />
                                    <Animated.View style={[
                                        styles.haloRingInner, 
                                        Platform.OS === 'web' ? { animation: 'rotateCounterClockwise 10s linear infinite' } : { transform: [{ rotate: spinReverse }] }
                                    ]} />
                                    <Animated.View style={[
                                        styles.haloGlow,
                                        Platform.OS === 'web' ? { animation: 'haloPulse 3s ease-in-out infinite alternate' } : { transform: [{ scale: pulseAnim }] }
                                    ]} />
                                    <Image 
                                        source={require('../../../assets/hologram_surgeon_feathered.png')} 
                                        style={styles.doctorImg} 
                                        resizeMode="contain" 
                                    />
                                </View>
                            </View>
                        )}

                        {/* ─── RIGHT SECTION: PRISTINE GLASS AUTH CARD ─── */}
                        <View style={[
                            styles.rightPane, 
                            isTablet && styles.rightPaneTablet,
                            isMobile && styles.rightPaneSmall
                        ]}>
                            {isMobile && (
                                <View style={styles.mobileBrandHeader}>
                                    {logoSrc ? (
                                        <Image 
                                            source={logoSrc} 
                                            style={styles.mobileBrandLogo} 
                                            resizeMode="contain" 
                                        />
                                    ) : (
                                        <View style={styles.mobileBrandPlaceholder}>
                                            <View style={styles.mobileBrandSkeletonIcon}>
                                                <Feather name="activity" size={20} color="#0d9488" />
                                            </View>
                                            {hospitalName ? (
                                                <Text style={styles.mobileBrandTitleText}>{hospitalName}</Text>
                                            ) : (
                                                <View style={styles.mobileBrandSkeletonBar} />
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={[
                                styles.glassCard,
                                isMobile && styles.glassCardSmall
                            ]}>
                                {/* Card Header Title */}
                                <View style={styles.cardHeader}>
                                    <Text style={styles.portalTitle}>
                                        {title === 'Supreme Portal' ? (
                                            Platform.OS === 'web' ? (
                                                <Text style={styles.webGradientTitle}>{title}</Text>
                                            ) : (
                                                <>
                                                    <Text style={{ color: '#0ea5e9' }}>Supreme </Text>
                                                    <Text style={{ color: '#7c3aed' }}>Portal</Text>
                                                </>
                                            )
                                        ) : (
                                            title
                                        )}
                                    </Text>
                                    <Text style={styles.portalSubtitle}>{subtitle}</Text>
                                </View>

                            {/* Alerts */}
                            {sessionBanner && (
                                <View style={[styles.alertBox, styles.alertWarning]}>
                                    <Feather name="alert-circle" size={15} color="#b45309" />
                                    <Text style={styles.alertTextWarn}>{sessionBanner}</Text>
                                </View>
                            )}
                            {error && (
                                <View style={[styles.alertBox, styles.alertError]}>
                                    <Feather name="alert-triangle" size={15} color="#b91c1c" />
                                    <Text style={styles.alertTextErr}>{error}</Text>
                                </View>
                            )}
                            {successMsg && (
                                <View style={[styles.alertBox, styles.alertSuccess]}>
                                    <Feather name="check-circle" size={15} color="#15803d" />
                                    <Text style={styles.alertTextSucc}>{successMsg}</Text>
                                </View>
                            )}

                            {/* ── ACTIVE SESSION SECURITY MODAL ── */}
                            {activeSession ? (
                                <View style={styles.sessionConflictBox}>
                                    <View style={styles.sessionTopAccentBar} />
                                    
                                    <View style={styles.sessionBadgeRow}>
                                        <View style={styles.sessionStatusBadge}>
                                            <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
                                            <Text style={styles.sessionBadgeText}>CONCURRENT SESSION ACTIVE</Text>
                                        </View>
                                        <View style={styles.shieldTag}>
                                            <Feather name="shield" size={10} color="#0f766e" />
                                            <Text style={styles.shieldText}>HIPAA Security</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.conflictTitle}>
                                        Account Active On Another Device
                                    </Text>
                                    <Text style={styles.conflictDesc}>
                                        This account is currently logged in on another device. For security and compliance, only one active session is allowed.
                                    </Text>
                                    
                                    <View style={styles.deviceMetaBox}>
                                        <View style={styles.deviceIconCircle}>
                                            <Feather name={getDeviceIcon(primarySession?.os)} size={18} color="#0284c7" />
                                        </View>
                                        <View style={styles.deviceMetaRight}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <Text style={styles.deviceName}>{primarySession?.os || 'Windows PC Workstation'}</Text>
                                                <View style={styles.browserTag}>
                                                    <Text style={styles.browserTagText}>{primarySession?.browser || 'Chrome'}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.deviceSubMeta}>
                                                {primarySession?.ipAddress && primarySession.ipAddress !== '::1' && primarySession.ipAddress !== '127.0.0.1'
                                                    ? primarySession.ipAddress
                                                    : '192.168.1.45 (Active Host)'} • {formatSessionTime(primarySession?.lastActive || primarySession?.loginTime)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.sessionActions}>
                                        <TouchableOpacity 
                                            nativeID="med-terminate-btn"
                                            style={[
                                                styles.btnTerminate,
                                                isTerminateHovered && styles.btnPrimaryHovered
                                            ]} 
                                            onPress={onForceLogin} 
                                            onMouseEnter={() => setIsTerminateHovered(true)}
                                            onMouseLeave={() => setIsTerminateHovered(false)}
                                            disabled={loading}
                                            activeOpacity={0.85}
                                        >
                                            <LinearGradient
                                                colors={isTerminateHovered 
                                                    ? ['#0369a1', '#0284c7', '#0f766e', '#0d9488'] 
                                                    : ['#0284c7', '#0ea5e9', '#0d9488', '#10b981']
                                                }
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.gradientBtnFull}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#fff" size="small" />
                                                ) : (
                                                    <>
                                                        <Feather name="power" size={14} color="#fff" />
                                                        <Text style={styles.btnPrimaryText}>Terminate & Login</Text>
                                                    </>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            style={styles.btnCancelSession} 
                                            onPress={onCancelSession} 
                                            disabled={loading}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.btnCancelSessionText}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : otpStep === 'otp' ? (
                                /* ── STEP 2: TWO-FACTOR AUTHENTICATION (OTP) ── */
                                <View style={styles.otpBox}>
                                    <Feather name="shield" size={38} color="#0ea5e9" style={styles.otpIcon} />
                                    <Text style={styles.otpTitle}>Two-Factor Authentication</Text>
                                    
                                    <View style={styles.otpBadge}>
                                        <Feather name="mail" size={12} color="#0369a1" />
                                        <Text style={styles.otpBadgeText}>Code sent to {otpEmail || 'your registered email'}</Text>
                                    </View>

                                    {/* 6 Monospace OTP Input Cells */}
                                    <View style={styles.otpGrid}>
                                        {otpValues.map((val, idx) => (
                                            <TextInput
                                                key={idx}
                                                ref={el => (otpInputRefs.current[idx] = el)}
                                                style={[
                                                    styles.otpInput,
                                                    focusedOtpIndex === idx && styles.otpInputFocused,
                                                    val && styles.otpInputFilled
                                                ]}
                                                keyboardType="numeric"
                                                maxLength={1}
                                                value={val}
                                                onFocus={() => setFocusedOtpIndex(idx)}
                                                onBlur={() => setFocusedOtpIndex(null)}
                                                onChangeText={v => handleOtpChange(idx, v)}
                                                onKeyPress={e => handleOtpKeyPress(idx, e)}
                                                autoFocus={idx === 0}
                                            />
                                        ))}
                                    </View>

                                    {/* Verify Button with Web Cyan-Teal Gradient */}
                                    <TouchableOpacity 
                                        nativeID="med-otp-btn"
                                        style={[
                                            styles.btnPrimaryWrapper, 
                                            isOtpHovered && styles.btnPrimaryHovered,
                                            (loading || otpValues.join('').length !== 6) && styles.btnDisabled
                                        ]} 
                                        onPress={handleOtpSubmit} 
                                        onMouseEnter={() => setIsOtpHovered(true)}
                                        onMouseLeave={() => setIsOtpHovered(false)}
                                        disabled={loading || otpValues.join('').length !== 6}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={isOtpHovered 
                                                ? ['#0369a1', '#0284c7', '#0f766e', '#0d9488'] 
                                                : ['#0284c7', '#0ea5e9', '#0d9488', '#10b981']
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.gradientBtnFull}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="#fff" size="small" />
                                            ) : (
                                                <>
                                                    <Text style={styles.btnPrimaryText}>Verify & Continue</Text>
                                                    <Feather name="arrow-right" size={16} color="#fff" />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    {/* Resend Row */}
                                    <View style={styles.resendRow}>
                                        <Text style={styles.resendText}>Didn't receive code?</Text>
                                        <TouchableOpacity onPress={handleResendClick} disabled={resendTimer > 0}>
                                            <Text style={[styles.resendBtnText, resendTimer > 0 && styles.textDisabled]}>
                                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Back to Login Button */}
                                    <TouchableOpacity style={styles.btnBack} onPress={onAbortOtp}>
                                        <Feather name="arrow-left" size={14} color="#64748b" />
                                        <Text style={styles.btnBackText}>Back to Login</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                /* ── STEP 1: CREDENTIALS (LOGIN) ── */
                                <View style={styles.loginForm}>
                                    {/* Identifier Input */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>{idLabel}</Text>
                                        <View style={[
                                            styles.inputWrapper,
                                            isIdFocused && styles.inputWrapperFocused
                                        ]}>
                                            <Feather 
                                                name={portalType === 'patient' ? "phone" : "user"} 
                                                size={16} 
                                                color={isIdFocused ? "#7c3aed" : "#a78bfa"} 
                                                style={styles.inputIcon} 
                                            />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={idPlaceholder}
                                                placeholderTextColor="#94a3b8"
                                                keyboardType={idType}
                                                autoCapitalize="none"
                                                value={credentials.id}
                                                onChangeText={v => handleCredentialChange('id', v)}
                                                onFocus={() => setIsIdFocused(true)}
                                                onBlur={() => setIsIdFocused(false)}
                                            />
                                        </View>
                                    </View>

                                    {/* Password Input */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>{passkeyLabel}</Text>
                                        <View style={[
                                            styles.inputWrapper,
                                            isPassFocused && styles.inputWrapperFocused
                                        ]}>
                                            <Feather 
                                                name="lock" 
                                                size={16} 
                                                color={isPassFocused ? "#7c3aed" : "#a78bfa"} 
                                                style={styles.inputIcon} 
                                            />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={passkeyPlaceholder}
                                                placeholderTextColor="#94a3b8"
                                                secureTextEntry={!showPassword}
                                                value={credentials.password}
                                                onChangeText={v => handleCredentialChange('password', v)}
                                                onFocus={() => setIsPassFocused(true)}
                                                onBlur={() => setIsPassFocused(false)}
                                            />
                                            <TouchableOpacity 
                                                onPress={() => setShowPassword(!showPassword)}
                                                style={styles.eyeBtn}
                                            >
                                                <Feather 
                                                    name={showPassword ? "eye-off" : "eye"} 
                                                    size={16} 
                                                    color={showPassword ? "#7c3aed" : "#a78bfa"} 
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Remember Me Option */}
                                    <View style={styles.optionsRow}>
                                        <TouchableOpacity 
                                            style={styles.checkboxRow} 
                                            onPress={() => setRememberMe(!rememberMe)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                                                {rememberMe && <Feather name="check" size={11} color="#fff" />}
                                            </View>
                                            <Text style={styles.checkboxText}>Remember me</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Sign In Button with Cyan & Ocean Teal Gradient matching web */}
                                    <TouchableOpacity 
                                        nativeID="med-signin-btn"
                                        style={[
                                            styles.btnPrimaryWrapper, 
                                            isBtnHovered && styles.btnPrimaryHovered,
                                            (!credentials.id || !credentials.password || loading) && styles.btnDisabled
                                        ]} 
                                        onPress={handleLoginSubmit} 
                                        onMouseEnter={() => setIsBtnHovered(true)}
                                        onMouseLeave={() => setIsBtnHovered(false)}
                                        disabled={loading || !credentials.id || !credentials.password}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={isBtnHovered 
                                                ? ['#0369a1', '#0284c7', '#0f766e', '#0d9488'] 
                                                : ['#0284c7', '#0ea5e9', '#0d9488', '#10b981']
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.gradientBtnFull}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="#fff" size="small" />
                                            ) : (
                                                <>
                                                    <Text style={styles.btnPrimaryText}>Sign In</Text>
                                                    <Feather name="arrow-right" size={17} color="#fff" />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    {/* Security Disclaimer Banner */}
                                    <View style={styles.securityBanner}>
                                        <Feather name="shield" size={16} color="#8b5cf6" />
                                        <Text style={styles.securityText}>
                                            Your security is our priority.{"\n"}All data is encrypted and securely protected.
                                        </Text>
                                    </View>

                                    {extraFooter}
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>

            {/* Footer */}
            <View style={[styles.footerRow, isMobile && styles.footerRowSmall]}>
                <Text style={styles.footerText}>© 2026 Medical365. All rights reserved.</Text>
                <View style={styles.securePill}>
                    <Feather name="lock" size={10} color="#059669" />
                    <Text style={styles.securePillText}>256-bit SSL Encrypted</Text>
                </View>
            </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1 
    },
    particlesGrid: {
        ...(Platform.OS === 'web' ? {
            backgroundImage: 'radial-gradient(rgba(14, 165, 233, 0.18) 1.5px, transparent 1.5px)',
            backgroundSize: '32px 32px',
        } : {})
    },
    scrollContent: { 
        flexGrow: 1, 
        justifyContent: 'space-between',
        ...(Platform.OS === 'web' ? {
            minHeight: '100vh',
            height: '100vh',
            overflowY: 'hidden',
            overflowX: 'hidden',
        } : {
            paddingVertical: 14,
        })
    },
    scrollContentSmall: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        paddingTop: 16,
        paddingBottom: 24,
        ...(Platform.OS === 'web' ? {
            height: 'auto',
            minHeight: '100vh',
            overflowY: 'auto',
            overflowX: 'hidden',
        } : {}),
    },
    centerSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    centerSectionSmall: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 0,
        ...(Platform.OS === 'web' ? {
            height: 'auto',
            minHeight: 'auto',
        } : {}),
    },
    mainWrapper: { 
        width: '100%', 
        maxWidth: 1480, 
        alignSelf: 'center', 
        paddingHorizontal: 24,
        flexDirection: 'column',
        gap: 20
    },
    mainWrapperDesktop: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flex: 1,
        height: '100%',
        minHeight: 'calc(100vh - 40px)',
        maxHeight: '100vh',
        paddingHorizontal: 40,
        paddingTop: 16,
        paddingBottom: 8,
        gap: 16
    },
    mainWrapperTablet: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 1100,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        flex: 1,
        minHeight: 'calc(100vh - 40px)',
    },
    mainWrapperSmall: {
        maxWidth: 440,
        paddingHorizontal: 16,
        paddingTop: 0,
        paddingBottom: 0,
        gap: 0,
        alignSelf: 'center',
        justifyContent: 'flex-start',
        alignItems: 'center',
        flexDirection: 'column',
    },

    // Left Section
    leftPane: { 
        width: 345, 
        flex: 1,
        height: '100%',
        maxHeight: '94%',
        justifyContent: 'space-between',
        zIndex: 5,
        paddingVertical: 8
    },
    leftPaneTablet: {
        width: 260,
        height: '100%',
        maxHeight: '94%',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    brandRow: { 
        marginBottom: 8,
        alignSelf: 'flex-start'
    },
    brandLogo: { 
        height: 48, 
        width: 220,
        alignSelf: 'flex-start'
    },
    brandLogoTablet: {
        height: 40,
        width: 190,
        alignSelf: 'flex-start'
    },
    featureStack: {
        gap: 16
    },
    heroTextContainer: { 
        marginBottom: 4 
    },
    heroText: { 
        fontSize: 26, 
        fontWeight: '800', 
        color: '#0f172a', 
        letterSpacing: -0.4,
        lineHeight: 32
    },
    heroTextTeal: { 
        fontSize: 26, 
        fontWeight: '800', 
        color: '#0d9488', 
        letterSpacing: -0.4,
        lineHeight: 32
    },
    featureList: { 
        gap: 12 
    },
    featureCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#ffffff', 
        paddingVertical: 11,
        paddingHorizontal: 16, 
        borderRadius: 14, 
        borderWidth: 1, 
        borderColor: '#e2e8f0',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 2
    },
    featureIconBox: { 
        width: 38, 
        height: 38, 
        borderRadius: 10, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 12 
    },
    featureInfo: { 
        flex: 1 
    },
    featureTitle: { 
        fontSize: 13, 
        fontWeight: '750', 
        color: '#0f172a' 
    },
    featureDesc: { 
        fontSize: 11, 
        color: '#64748b', 
        marginTop: 2 
    },
    statusPulseWrap: {
        paddingLeft: 6
    },
    statusDot: { 
        width: 7, 
        height: 7, 
        borderRadius: 3.5 
    },
    ecgBar: { 
        marginTop: 6 
    },
    ecgTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8
    },
    heartBadgeCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#e0f2fe',
        borderWidth: 2,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3
    },
    trustedBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 12,
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 1
    },
    trustedText: { 
        fontSize: 11, 
        color: '#334155', 
        fontWeight: '700' 
    },
    ecgSvgContainer: { 
        height: 34,
        overflow: 'hidden',
        opacity: 0.85
    },

    // Center Section (Surgeon Hologram)
    centerPane: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        paddingHorizontal: 10,
        minHeight: 520,
        zIndex: 4
    },
    hologramContainer: { 
        width: 520, 
        height: 540, 
        justifyContent: 'center', 
        alignItems: 'center',
        position: 'relative'
    },
    haloRing: { 
        position: 'absolute', 
        width: 480, 
        height: 480, 
        borderRadius: 240, 
        borderWidth: 2, 
        borderColor: 'rgba(14, 165, 233, 0.6)', 
        borderStyle: 'dashed',
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 0 32px rgba(14, 165, 233, 0.25)',
        } : {})
    },
    haloRingInner: { 
        position: 'absolute', 
        width: 420, 
        height: 420, 
        borderRadius: 210, 
        borderWidth: 2, 
        borderColor: 'transparent',
        borderTopColor: '#0ea5e9', 
        borderBottomColor: '#10b981',
        ...(Platform.OS === 'web' ? {
            filter: 'drop-shadow(0 0 10px rgba(14, 165, 233, 0.7))',
        } : {})
    },
    haloGlow: { 
        position: 'absolute', 
        width: 360, 
        height: 360, 
        borderRadius: 180, 
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
        ...(Platform.OS === 'web' ? {
            backgroundImage: 'radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, rgba(13, 148, 136, 0.06) 60%, transparent 80%)',
        } : {})
    },
    doctorImg: { 
        width: 520, 
        height: 530, 
        zIndex: 2,
        ...(Platform.OS === 'web' ? {
            filter: 'drop-shadow(0 15px 35px rgba(14, 165, 233, 0.35))',
            transform: 'scaleX(1.22) scaleY(1.04)'
        } : {
            transform: [{ scaleX: 1.22 }, { scaleY: 1.04 }]
        })
    },

    // Right Section (Floating Glass Card)
    rightPane: { 
        width: 500, 
        maxWidth: '100%', 
        alignSelf: 'center',
        zIndex: 10
    },
    rightPaneTablet: {
        width: 440,
        maxWidth: '52%',
    },
    rightPaneSmall: {
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
    },
    mobileBrandHeader: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingTop: 14,
        paddingBottom: 14,
        paddingHorizontal: 16,
    },
    mobileBrandLogo: {
        height: 42,
        width: 200,
        maxWidth: '85%',
    },
    mobileBrandPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        paddingVertical: 4,
    },
    mobileBrandSkeletonIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e0f2fe',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    mobileBrandTitleText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    mobileBrandSkeletonBar: {
        width: 140,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
    },
    mobileDoctorStage: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginVertical: 4,
    },
    mobileDoctorContainer: {
        position: 'relative',
        width: 240,
        height: 220,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    mobileHaloRing: {
        position: 'absolute',
        top: 5,
        width: 210,
        height: 210,
        borderRadius: 105,
        borderWidth: 1.5,
        borderColor: 'rgba(14, 165, 233, 0.55)',
        borderStyle: 'dashed',
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 0 20px rgba(14, 165, 233, 0.25)',
        } : {})
    },
    mobileHaloRingInner: {
        position: 'absolute',
        top: 20,
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 1.8,
        borderColor: 'transparent',
        borderTopColor: '#0ea5e9', 
        borderBottomColor: '#10b981',
        ...(Platform.OS === 'web' ? {
            filter: 'drop-shadow(0 0 8px rgba(14, 165, 233, 0.7))',
        } : {})
    },
    mobileDoctorImg: {
        width: 240,
        height: 220,
        zIndex: 2,
    },
    glassCard: { 
        backgroundColor: '#ffffff',
        borderRadius: 28, 
        paddingVertical: 44, 
        paddingHorizontal: 38,
        borderWidth: 1.5, 
        borderColor: 'rgba(224, 210, 254, 0.65)',
        shadowColor: '#7c3aed', 
        shadowOffset: { width: 0, height: 18 }, 
        shadowOpacity: 0.14, 
        shadowRadius: 36, 
        elevation: 10,
        ...(Platform.OS === 'web' ? {
            backgroundImage: 'linear-gradient(160deg, #ffffff 0%, #fdfaff 45%, #f7f0ff 100%)',
            boxShadow: '0 25px 60px -12px rgba(139, 92, 246, 0.16), 0 10px 28px -10px rgba(14, 165, 233, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.95)',
        } : {})
    },
    glassCardSmall: {
        paddingVertical: 26,
        paddingHorizontal: 20,
        borderRadius: 22,
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 10px 30px rgba(14, 165, 233, 0.12)',
        } : {})
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 24
    },
    portalTitle: { 
        fontSize: 28, 
        fontWeight: '800', 
        color: '#0ea5e9', 
        letterSpacing: -0.5,
        textAlign: 'center'
    },
    webGradientTitle: {
        ...(Platform.OS === 'web' ? {
            backgroundImage: 'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 55%, #0d9488 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block',
        } : {})
    },
    portalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 4,
        textAlign: 'center'
    },

    // Alerts
    alertBox: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 14, 
        paddingVertical: 10,
        borderRadius: 10, 
        marginBottom: 16, 
        gap: 8, 
        borderWidth: 1 
    },
    alertWarning: { 
        backgroundColor: '#fffbeb', 
        borderColor: '#fde68a' 
    },
    alertError: { 
        backgroundColor: '#fef2f2', 
        borderColor: '#fecaca' 
    },
    alertSuccess: { 
        backgroundColor: '#f0fdf4', 
        borderColor: '#bbf7d0' 
    },
    alertTextWarn: { 
        color: '#b45309', 
        fontSize: 12.5, 
        fontWeight: '600',
        flex: 1 
    },
    alertTextErr: { 
        color: '#b91c1c', 
        fontSize: 12.5, 
        fontWeight: '600',
        flex: 1 
    },
    alertTextSucc: { 
        color: '#15803d', 
        fontSize: 12.5, 
        fontWeight: '600',
        flex: 1 
    },

    // Form
    loginForm: { 
        gap: 16 
    },
    inputGroup: { 
        gap: 6 
    },
    label: { 
        fontSize: 11.5, 
        fontWeight: '750', 
        color: '#334155', 
        textTransform: 'uppercase',
        letterSpacing: 0.6
    },
    inputWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#ffffff', 
        borderWidth: 1.5, 
        borderColor: '#e9d5ff', 
        borderRadius: 14, 
        paddingHorizontal: 14, 
        height: 52,
        ...(Platform.OS === 'web' ? {
            transition: 'all 0.2s ease',
        } : {})
    },
    inputWrapperFocused: {
        borderColor: '#8b5cf6',
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 0 0 3.5px rgba(139, 92, 246, 0.18)',
        } : {
            borderColor: '#7c3aed',
            borderWidth: 2,
        })
    },
    inputIcon: { 
        marginRight: 10 
    },
    input: { 
        flex: 1, 
        fontSize: 14.5, 
        color: '#0f172a', 
        height: '100%',
        fontWeight: '600'
    },
    eyeBtn: {
        padding: 4
    },
    optionsRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginVertical: 4
    },
    checkboxRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 8 
    },
    checkbox: { 
        width: 17, 
        height: 17, 
        borderRadius: 4, 
        borderWidth: 1.5, 
        borderColor: '#cbd5e1', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    checkboxChecked: { 
        backgroundColor: '#8b5cf6', 
        borderColor: '#8b5cf6' 
    },
    checkboxText: { 
        fontSize: 13, 
        color: '#334155',
        fontWeight: '600'
    },

    // Primary Button
    btnPrimaryWrapper: { 
        borderRadius: 14, 
        overflow: 'hidden',
        marginTop: 8,
        shadowColor: '#0ea5e9', 
        shadowOffset: { width: 0, height: 10 }, 
        shadowOpacity: 0.45, 
        shadowRadius: 26, 
        elevation: 6,
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 10px 24px -4px rgba(14, 165, 233, 0.52), 0 4px 14px -2px rgba(13, 148, 136, 0.35)',
            cursor: 'pointer',
            transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        } : {})
    },
    btnPrimaryHovered: {
        transform: [{ translateY: -2.5 }],
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.65,
        shadowRadius: 32,
        elevation: 10,
        ...(Platform.OS === 'web' ? {
            transform: 'translateY(-2.5px)',
            boxShadow: '0 14px 32px -4px rgba(14, 165, 233, 0.65), 0 6px 18px -2px rgba(13, 148, 136, 0.45)',
            filter: 'brightness(1.06)',
        } : {})
    },
    gradientBtnFull: {
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 8,
        paddingVertical: 15.5,
        paddingHorizontal: 20
    },
    btnDisabled: { 
        opacity: 0.5 
    },
    btnPrimaryText: { 
        color: '#ffffff', 
        fontSize: 16, 
        fontWeight: '800',
        letterSpacing: 0.4
    },

    // Security Banner
    securityBanner: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#faf5ff', 
        borderWidth: 1,
        borderColor: '#f3e8ff',
        padding: 12, 
        borderRadius: 12, 
        marginTop: 6, 
        gap: 10 
    },
    securityText: { 
        fontSize: 11, 
        color: '#6b21a8', 
        flex: 1, 
        lineHeight: 16,
        fontWeight: '600'
    },

    // Active Session Conflict UI
    sessionConflictBox: { 
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#fde68a',
        borderRadius: 18,
        padding: 18,
        position: 'relative',
        overflow: 'hidden'
    },
    sessionTopAccentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: '#f59e0b'
    },
    sessionBadgeRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
        marginTop: 4
    },
    sessionStatusBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#fffbeb', 
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 20, 
        gap: 6,
        flexShrink: 1
    },
    pulseDot: { 
        width: 7, 
        height: 7, 
        borderRadius: 3.5, 
        backgroundColor: '#ef4444' 
    },
    sessionBadgeText: { 
        fontSize: 10, 
        fontWeight: '800', 
        color: '#b45309' 
    },
    shieldTag: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 4 
    },
    shieldText: { 
        fontSize: 10.5, 
        fontWeight: '700', 
        color: '#64748b' 
    },
    conflictTitle: { 
        fontSize: 16, 
        fontWeight: '800', 
        color: '#0f172a', 
        marginBottom: 6 
    },
    conflictDesc: { 
        fontSize: 12, 
        color: '#64748b', 
        marginBottom: 16, 
        lineHeight: 17 
    },
    deviceMetaBox: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#f8fafc', 
        padding: 12, 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: '#e2e8f0', 
        marginBottom: 16, 
        gap: 12 
    },
    deviceIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center'
    },
    deviceMetaRight: { 
        flex: 1 
    },
    deviceName: { 
        fontSize: 13, 
        fontWeight: '750', 
        color: '#0f172a' 
    },
    browserTag: {
        backgroundColor: '#e0f2fe',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    browserTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0369a1'
    },
    deviceSubMeta: { 
        fontSize: 11, 
        color: '#64748b', 
        marginTop: 3,
        fontWeight: '600'
    },
    sessionActions: { 
        gap: 8 
    },
    btnTerminate: { 
        borderRadius: 12, 
        overflow: 'hidden' 
    },
    btnCancelSession: { 
        paddingVertical: 12, 
        borderRadius: 12, 
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44
    },
    btnCancelSessionText: { 
        color: '#475569', 
        fontSize: 13, 
        fontWeight: '700' 
    },

    // OTP UI
    otpBox: { 
        alignItems: 'center' 
    },
    otpIcon: { 
        marginBottom: 6 
    },
    otpTitle: { 
        fontSize: 19, 
        fontWeight: '800', 
        color: '#0f172a', 
        marginBottom: 6 
    },
    otpBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#e0f2fe', 
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingHorizontal: 12, 
        paddingVertical: 5, 
        borderRadius: 14, 
        gap: 6, 
        marginBottom: 20 
    },
    otpBadgeText: { 
        fontSize: 11.5, 
        color: '#0369a1', 
        fontWeight: '600' 
    },
    otpGrid: { 
        flexDirection: 'row', 
        gap: 8, 
        marginBottom: 20 
    },
    otpInput: { 
        width: 44, 
        height: 50, 
        borderWidth: 1.5, 
        borderColor: '#e2e8f0', 
        borderRadius: 10, 
        fontSize: 22, 
        fontWeight: '800', 
        textAlign: 'center', 
        color: '#0d9488', 
        backgroundColor: '#ffffff' 
    },
    otpInputFocused: {
        borderColor: '#0ea5e9',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 6
    },
    otpInputFilled: { 
        borderColor: '#0d9488', 
        backgroundColor: '#f0fdf4' 
    },
    resendRow: { 
        flexDirection: 'row', 
        gap: 6, 
        marginTop: 14, 
        marginBottom: 10 
    },
    resendText: { 
        color: '#64748b', 
        fontSize: 13,
        fontWeight: '600' 
    },
    resendBtnText: { 
        color: '#0284c7', 
        fontSize: 13, 
        fontWeight: '700' 
    },
    textDisabled: { 
        color: '#94a3b8' 
    },
    btnBack: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6,
        paddingVertical: 6
    },
    btnBackText: { 
        color: '#64748b', 
        fontSize: 13, 
        fontWeight: '700' 
    },

    // Footer
    footerRow: { 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(226, 232, 240, 0.6)',
        backgroundColor: 'rgba(255, 255, 255, 0.82)',
        marginTop: 'auto'
    },
    footerRowSmall: {
        flexDirection: 'column',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderTopColor: 'rgba(226, 232, 240, 0.8)',
    },
    footerText: { 
        color: '#64748b', 
        fontSize: 11.5,
        fontWeight: '600'
    },
    securePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8
    },
    securePillText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669'
    }
});

export default NeuralAuthPortal;
