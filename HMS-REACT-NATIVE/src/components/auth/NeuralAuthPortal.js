import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, TextInput, TouchableOpacity, Image, 
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, 
    Dimensions, Animated, useWindowDimensions, Keyboard 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

const TrackedTextInput = React.forwardRef(({ fieldName, onFocus, onBlur, ...props }, ref) => {
    useEffect(() => {
        console.log(`[INSTRUMENTATION][TextInput:${fieldName}] MOUNTED at ${Date.now()}`);
        return () => {
            console.log(`[INSTRUMENTATION][TextInput:${fieldName}] UNMOUNTED at ${Date.now()}`);
        };
    }, [fieldName]);

    return (
        <TextInput
            ref={ref}
            {...props}
            onFocus={(e) => {
                console.log(`[INSTRUMENTATION][TextInput:${fieldName}] onFocus at ${Date.now()}`);
                if (onFocus) onFocus(e);
            }}
            onBlur={(e) => {
                console.log(`[INSTRUMENTATION][TextInput:${fieldName}] onBlur at ${Date.now()}`);
                if (onBlur) onBlur(e);
            }}
        />
    );
});

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
    const isDesktop = windowWidth >= 1100;
    const isTablet = windowWidth >= 768 && windowWidth < 1100;
    const isMobile = windowWidth < 768;

    const portalRenderCount = useRef(0);
    portalRenderCount.current += 1;
    console.log(`[INSTRUMENTATION][NeuralAuthPortal] Render #${portalRenderCount.current} at ${Date.now()}`, {
        focusedInput,
        showPassword,
        brandingName: branding?.hospitalName,
        hasBrandingLogo: !!branding?.logoUrl,
        loading,
        error: !!error,
        windowHeight,
        windowWidth
    });

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                console.log(`[INSTRUMENTATION][Keyboard] SHOW event at ${Date.now()}:`, {
                    keyboardHeight: e.endCoordinates?.height,
                    screenY: e.endCoordinates?.screenY,
                });
            }
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                console.log(`[INSTRUMENTATION][Keyboard] HIDE event at ${Date.now()}`);
            }
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const [credentials, setCredentials] = useState({ id: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(30);
    const [focusedInput, setFocusedInput] = useState(null);
    const [focusedOtpIndex, setFocusedOtpIndex] = useState(null);

    const passwordInputRef = useRef(null);
    const otpInputRefs = useRef([]);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;
    const ecgAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(spinAnim, { toValue: 1, duration: 30000, useNativeDriver: true })
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true })
            ])
        ).start();

        Animated.loop(
            Animated.timing(ecgAnim, { toValue: 1, duration: 3200, useNativeDriver: true })
        ).start();
    }, []);

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
    const logoSrc = branding?.logoUrl ? { uri: branding.logoUrl } : require('../../../assets/medical365-logo.png');

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            onLayout={(e) => console.log(`[INSTRUMENTATION][KeyboardAvoidingView] onLayout at ${Date.now()}:`, e.nativeEvent.layout)}
        >
            {/* Ambient Light Healthcare Gradient Background */}
            <LinearGradient
                colors={['#f0f9ff', '#f0fdfa', '#f8fafc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                bounces={false}
                keyboardShouldPersistTaps="handled"
                onLayout={(e) => console.log(`[INSTRUMENTATION][ScrollView] onLayout at ${Date.now()}:`, e.nativeEvent.layout)}
            >
                <View style={[styles.mainWrapper, isDesktop && styles.mainWrapperDesktop, isTablet && styles.mainWrapperTablet]}>
                    
                    {/* ─── LEFT SECTION: BRAND + HERO + FEATURES + ECG ─── */}
                    {!isMobile && (
                        <View style={[styles.leftPane, isTablet && { width: 310 }]}>
                            {/* Brand Logo */}
                            <View style={styles.brandRow}>
                                <Image source={logoSrc} style={styles.brandLogo} resizeMode="contain" />
                            </View>

                            {/* Headline */}
                            <View style={styles.heroTextContainer}>
                                <Text style={styles.heroText}>Smarter Healthcare</Text>
                                <Text style={styles.heroTextTeal}>Better Tomorrow</Text>
                            </View>

                            {/* Feature Cards Stack */}
                            <View style={styles.featureList}>
                                {/* Feature 1 */}
                                <View style={styles.featureCard}>
                                    <View style={[styles.featureIconBox, { backgroundColor: '#f0fdfa' }]}>
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
                                    <View style={[styles.featureIconBox, { backgroundColor: '#f5f3ff' }]}>
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
                                    <View style={[styles.featureIconBox, { backgroundColor: '#eff6ff' }]}>
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

                            {/* Bottom Live Moving ECG Bar */}
                            <View style={styles.ecgBar}>
                                <View style={styles.trustedBadge}>
                                    <FontAwesome5 name="hospital" size={12} color="#0d9488" />
                                    <Text style={styles.trustedText}>Trusted by 1000+ Healthcare Professionals</Text>
                                </View>
                                <View style={styles.ecgSvgContainer}>
                                    <Animated.View style={{ transform: [{ translateX: ecgTranslateX }], width: 800 }}>
                                        <Svg viewBox="0 0 800 48" height="32" width="800">
                                            <Path 
                                                d="M0 24 L60 24 L75 24 L85 10 L95 38 L105 4 L115 44 L125 24 L140 24 L200 24 L215 24 L225 10 L235 38 L245 4 L255 44 L265 24 L280 24 L340 24 L355 24 L365 10 L375 38 L385 4 L395 44 L405 24 L420 24 L480 24 L495 24 L505 10 L515 38 L525 4 L535 44 L545 24 L560 24 L620 24 L635 24 L645 10 L655 38 L665 4 L675 44 L685 24 L700 24 L800 24"
                                                stroke="#0ea5e9" 
                                                strokeWidth="2.5" 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                                fill="none" 
                                            />
                                        </Svg>
                                    </Animated.View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ─── CENTER SECTION: HOLOGRAPHIC SURGEON STAGE (Desktop Only) ─── */}
                    {isDesktop && (
                        <View style={styles.centerPane}>
                            <View style={styles.hologramContainer}>
                                <Animated.View style={[styles.haloRing, { transform: [{ rotate: spin }] }]} />
                                <Animated.View style={[styles.haloRingInner, { transform: [{ rotate: spinReverse }] }]} />
                                <View style={styles.haloGlow} />
                                <Image 
                                    source={require('../../../assets/hologram_surgeon_feathered.png')} 
                                    style={styles.doctorImg} 
                                    resizeMode="contain" 
                                />
                            </View>
                        </View>
                    )}

                    {/* ─── RIGHT SECTION: PRISTINE GLASS AUTH CARD ─── */}
                    <View style={[styles.rightPane, isMobile && { maxWidth: '100%' }]}>
                        {isMobile && (
                            <>
                                <View style={styles.mobileBrandHeader}>
                                    <Image source={logoSrc} style={styles.mobileBrandLogo} resizeMode="contain" />
                                </View>
                                <View style={styles.mobileDoctorStage}>
                                    <View style={styles.mobileDoctorContainer}>
                                        <Animated.View style={[styles.mobileHaloRing, { transform: [{ rotate: spin }] }]} />
                                        <Animated.View style={[styles.mobileHaloRingInner, { transform: [{ rotate: spinReverse }] }]} />
                                        <Image 
                                            source={require('../../../assets/hologram_surgeon_feathered.png')} 
                                            style={styles.mobileDoctorImg} 
                                            resizeMode="contain" 
                                        />
                                    </View>
                                </View>
                            </>
                        )}

                        <View style={styles.glassCard}>
                            {/* Card Header Title */}
                            <View style={styles.cardHeader}>
                                <Text style={styles.portalTitle}>{title}</Text>
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
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                                            style={styles.btnTerminate} 
                                            onPress={onForceLogin} 
                                            disabled={loading}
                                            activeOpacity={0.8}
                                        >
                                            <LinearGradient
                                                colors={['#0284c7', '#0ea5e9', '#0d9488', '#10b981']}
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
                                        style={[styles.btnPrimaryWrapper, (loading || otpValues.join('').length !== 6) && styles.btnDisabled]} 
                                        onPress={handleOtpSubmit} 
                                        disabled={loading || otpValues.join('').length !== 6}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={['#0284c7', '#0ea5e9', '#0d9488', '#10b981']}
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
                                            focusedInput === 'id' && styles.inputWrapperFocused
                                        ]}>
                                            <Feather 
                                                name={portalType === 'patient' ? "phone" : "user"} 
                                                size={16} 
                                                color={focusedInput === 'id' ? "#7c3aed" : "#a78bfa"} 
                                                style={styles.inputIcon} 
                                            />
                                            <TrackedTextInput
                                                key="login-email-input"
                                                fieldName="Email"
                                                style={styles.input}
                                                placeholder={idPlaceholder}
                                                placeholderTextColor="#94a3b8"
                                                keyboardType={idType}
                                                autoCapitalize="none"
                                                value={credentials.id}
                                                onFocus={() => {
                                                    console.log(`[INSTRUMENTATION][NeuralAuthPortal] setting focusedInput to 'id' at ${Date.now()}`);
                                                    setFocusedInput('id');
                                                }}
                                                onBlur={() => {
                                                    console.log(`[INSTRUMENTATION][NeuralAuthPortal] setting focusedInput to null (blur 'id') at ${Date.now()}`);
                                                    setFocusedInput(null);
                                                }}
                                                onChangeText={v => handleCredentialChange('id', v)}
                                            />
                                        </View>
                                    </View>

                                    {/* Password Input */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>{passkeyLabel}</Text>
                                        <View style={[
                                            styles.inputWrapper, 
                                            focusedInput === 'password' && styles.inputWrapperFocused
                                        ]}>
                                            <Feather 
                                                name="lock" 
                                                size={16} 
                                                color={focusedInput === 'password' ? "#7c3aed" : "#a78bfa"} 
                                                style={styles.inputIcon} 
                                            />
                                            <TrackedTextInput
                                                ref={passwordInputRef}
                                                key="login-password-input"
                                                fieldName="Password"
                                                style={styles.input}
                                                placeholder={passkeyPlaceholder}
                                                placeholderTextColor="#94a3b8"
                                                secureTextEntry={!showPassword}
                                                value={credentials.password}
                                                onFocus={() => {
                                                    console.log(`[INSTRUMENTATION][NeuralAuthPortal] setting focusedInput to 'password' at ${Date.now()}`);
                                                    setFocusedInput('password');
                                                }}
                                                onBlur={() => {
                                                    console.log(`[INSTRUMENTATION][NeuralAuthPortal] setting focusedInput to null (blur 'password') at ${Date.now()}`);
                                                    setFocusedInput(null);
                                                }}
                                                onChangeText={v => handleCredentialChange('password', v)}
                                            />
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    const wasFocused = focusedInput === 'password';
                                                    console.log(`[INSTRUMENTATION][NeuralAuthPortal] Toggling showPassword from ${showPassword} to ${!showPassword} at ${Date.now()}`);
                                                    setShowPassword(!showPassword);
                                                    if (wasFocused && passwordInputRef.current) {
                                                        passwordInputRef.current.focus();
                                                    }
                                                }}
                                                style={styles.eyeBtn}
                                            >
                                                <Feather 
                                                    name={showPassword ? "eye-off" : "eye"} 
                                                    size={16} 
                                                    color="#a78bfa" 
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

                                    {/* Sign In Button with Cyan & Teal Gradient */}
                                    <TouchableOpacity 
                                        style={[
                                            styles.btnPrimaryWrapper, 
                                            (!credentials.id || !credentials.password || loading) && styles.btnDisabled
                                        ]} 
                                        onPress={handleLoginSubmit} 
                                        disabled={loading || !credentials.id || !credentials.password}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={['#0284c7', '#0ea5e9', '#0d9488', '#10b981']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.gradientBtnFull}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="#fff" size="small" />
                                            ) : (
                                                <>
                                                    <Text style={styles.btnPrimaryText}>Sign In</Text>
                                                    <Feather name="arrow-right" size={16} color="#fff" />
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

                {/* Footer */}
                <View style={styles.footerRow}>
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
    scrollContent: { 
        flexGrow: 1, 
        justifyContent: 'space-between',
        paddingVertical: 20
    },
    mainWrapper: { 
        width: '100%', 
        maxWidth: 1440, 
        alignSelf: 'center', 
        paddingHorizontal: 24,
        flexDirection: 'column',
        gap: 20
    },
    mainWrapperDesktop: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        minHeight: 650
    },
    mainWrapperTablet: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
    },

    // Left Section
    leftPane: { 
        width: 345, 
        justifyContent: 'space-between' 
    },
    brandRow: { 
        marginBottom: 10 
    },
    brandLogo: { 
        height: 48, 
        width: 210 
    },
    heroTextContainer: { 
        marginBottom: 18 
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
        gap: 12, 
        marginBottom: 20 
    },
    featureCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#ffffff', 
        paddingVertical: 10,
        paddingHorizontal: 14, 
        borderRadius: 14, 
        borderWidth: 1, 
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1
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
        fontSize: 14, 
        fontWeight: '700', 
        color: '#0f172a' 
    },
    featureDesc: { 
        fontSize: 11.5, 
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
    trustedBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 8
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
        paddingHorizontal: 10
    },
    hologramContainer: { 
        width: '100%', 
        height: 480, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    haloRing: { 
        position: 'absolute', 
        width: 340, 
        height: 340, 
        borderRadius: 170, 
        borderWidth: 1.5, 
        borderColor: 'rgba(14, 165, 233, 0.35)', 
        borderStyle: 'dashed' 
    },
    haloRingInner: { 
        position: 'absolute', 
        width: 260, 
        height: 260, 
        borderRadius: 130, 
        borderWidth: 1, 
        borderColor: 'rgba(124, 58, 237, 0.3)' 
    },
    haloGlow: { 
        position: 'absolute', 
        width: 200, 
        height: 200, 
        borderRadius: 100, 
        backgroundColor: 'rgba(14, 165, 233, 0.08)'
    },
    doctorImg: { 
        width: 340, 
        height: 480, 
        zIndex: 2 
    },

    // Right Section (Floating Glass Card)
    rightPane: { 
        width: 480, 
        maxWidth: '100%', 
        alignSelf: 'center' 
    },
    mobileBrandHeader: {
        alignItems: 'center',
        marginBottom: 8
    },
    mobileBrandLogo: {
        height: 42,
        width: 190
    },
    mobileDoctorStage: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginVertical: 6,
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
        top: 20,
        width: 210,
        height: 210,
        borderRadius: 105,
        borderWidth: 1.5,
        borderColor: 'rgba(14, 165, 233, 0.4)',
        borderStyle: 'dashed',
    },
    mobileHaloRingInner: {
        position: 'absolute',
        top: 35,
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.35)',
    },
    mobileDoctorImg: {
        width: 240,
        height: 220,
        zIndex: 2,
    },
    glassCard: { 
        backgroundColor: '#ffffff',
        borderRadius: 28, 
        padding: 36, 
        borderWidth: 1.5, 
        borderColor: 'rgba(224, 210, 254, 0.65)',
        shadowColor: '#7c3aed', 
        shadowOffset: { width: 0, height: 16 }, 
        shadowOpacity: 0.12, 
        shadowRadius: 36, 
        elevation: 10 
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 24
    },
    portalTitle: { 
        fontSize: 26, 
        fontWeight: '800', 
        color: '#0ea5e9', 
        letterSpacing: -0.4,
        textAlign: 'center'
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
        height: 50 
    },
    inputWrapperFocused: {
        borderColor: '#8b5cf6',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 2
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
        marginTop: 6,
        shadowColor: '#0ea5e9', 
        shadowOffset: { width: 0, height: 8 }, 
        shadowOpacity: 0.35, 
        shadowRadius: 16, 
        elevation: 4 
    },
    gradientBtnFull: {
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 20
    },
    btnDisabled: { 
        opacity: 0.5 
    },
    btnPrimaryText: { 
        color: '#ffffff', 
        fontSize: 15, 
        fontWeight: '800',
        letterSpacing: 0.3
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
        gap: 6 
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
        paddingVertical: 10, 
        borderRadius: 12, 
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center' 
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
        shadowRadius: 6,
        elevation: 2
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
        marginTop: 16
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
