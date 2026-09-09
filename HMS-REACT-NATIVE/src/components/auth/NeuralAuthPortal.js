import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, TextInput, TouchableOpacity, Image, 
    ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Animated 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const NeuralAuthPortal = ({
    portalType = 'admin',
    title = 'Supreme Portal',
    subtitle = 'Access Medical365 central system administration core.',
    idLabel = 'ADMIN EMAIL OR ID',
    idPlaceholder = 'Enter admin email or ID',
    idType = 'email-address',
    passkeyLabel = 'PASSWORD',
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
    const [credentials, setCredentials] = useState({ id: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(30);
    const otpInputRefs = useRef([]);

    // Hover/Press animations could be complex, keeping it simple with TouchableOpacity
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(spinAnim, { toValue: 1, duration: 30000, useNativeDriver: true })
        ).start();
    }, [spinAnim]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });
    const spinReverse = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['360deg', '0deg']
    });

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
            ])
        ).start();
    }, [pulseAnim]);

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
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            return `${hours}:${mins}`;
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
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
            
            <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
                <View style={[styles.mainWrapper, isTablet && styles.mainWrapperTablet]}>
                    
                    {/* LEFT PANE */}
                    <View style={styles.leftPane}>
                        <Image source={logoSrc} style={styles.brandLogo} resizeMode="contain" />
                        
                        <View style={styles.heroTextContainer}>
                            <Text style={styles.heroText}>Smarter Healthcare</Text>
                            <Text style={styles.heroTextTeal}>Better Tomorrow</Text>
                        </View>

                        <View style={styles.featureList}>
                            <View style={styles.featureCard}>
                                <View style={[styles.featureIconBox, { backgroundColor: '#134e4a' }]}>
                                    <Feather name="shield" size={16} color="#14b8a6" />
                                </View>
                                <View style={styles.featureInfo}>
                                    <Text style={styles.featureTitle}>Secure & Compliant</Text>
                                    <Text style={styles.featureDesc}>256-bit encryption & HIPAA compliant</Text>
                                </View>
                            </View>
                            <View style={styles.featureCard}>
                                <View style={[styles.featureIconBox, { backgroundColor: '#4c1d95' }]}>
                                    <Feather name="users" size={16} color="#8b5cf6" />
                                </View>
                                <View style={styles.featureInfo}>
                                    <Text style={styles.featureTitle}>Smart Management</Text>
                                    <Text style={styles.featureDesc}>Streamline operations and save time</Text>
                                </View>
                            </View>
                            <View style={styles.featureCard}>
                                <View style={[styles.featureIconBox, { backgroundColor: '#1e3a8a' }]}>
                                    <Feather name="trending-up" size={16} color="#3b82f6" />
                                </View>
                                <View style={styles.featureInfo}>
                                    <Text style={styles.featureTitle}>Better Insights</Text>
                                    <Text style={styles.featureDesc}>Data-driven decisions for better care</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.ecgBar}>
                            <View style={styles.trustedBadge}>
                                <FontAwesome5 name="hospital" size={14} color="#14b8a6" />
                                <Text style={styles.trustedText}>Trusted by 1000+ Healthcare Professionals</Text>
                            </View>
                            <View style={styles.ecgSvgContainer}>
                                <Svg viewBox="0 0 800 48" height="30" width="100%">
                                    <Path d="M0 24 L60 24 L75 24 L85 10 L95 38 L105 4 L115 44 L125 24 L140 24 L200 24 L215 24 L225 10 L235 38 L245 4 L255 44 L265 24 L280 24 L340 24 L355 24 L365 10 L375 38 L385 4 L395 44 L405 24 L420 24 L480 24 L495 24 L505 10 L515 38 L525 4 L535 44 L545 24 L560 24 L620 24 L635 24 L645 10 L655 38 L665 4 L675 44 L685 24 L700 24 L800 24"
                                        stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </Svg>
                            </View>
                        </View>
                    </View>

                    {/* CENTER PANE (HOLOGRAM STAGE) */}
                    {isTablet && (
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

                    {/* RIGHT PANE (GLASSMORPHISM) */}
                    <View style={styles.rightPane}>
                        <View style={styles.glassCard}>
                            <Text style={styles.portalTitle}>{title}</Text>
                            
                            {sessionBanner && (
                                <View style={[styles.alertBox, styles.alertWarning]}>
                                    <Feather name="alert-circle" size={16} color="#d97706" />
                                    <Text style={styles.alertTextWarn}>{sessionBanner}</Text>
                                </View>
                            )}
                            {error && (
                                <View style={[styles.alertBox, styles.alertError]}>
                                    <Feather name="alert-triangle" size={16} color="#ef4444" />
                                    <Text style={styles.alertTextErr}>{error}</Text>
                                </View>
                            )}
                            {successMsg && (
                                <View style={[styles.alertBox, styles.alertSuccess]}>
                                    <Feather name="check-circle" size={16} color="#10b981" />
                                    <Text style={styles.alertTextSucc}>{successMsg}</Text>
                                </View>
                            )}

                            {/* ACTIVE SESSION MODAL / OVERLAY */}
                            {activeSession ? (
                                <View style={styles.sessionConflictBox}>
                                    <View style={styles.sessionBadgeRow}>
                                        <View style={styles.sessionStatusBadge}>
                                            <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
                                            <Text style={styles.sessionBadgeText}>CONCURRENT SESSION ACTIVE</Text>
                                        </View>
                                        <View style={styles.shieldTag}>
                                            <Feather name="shield" size={10} color="#14b8a6" />
                                            <Text style={styles.shieldText}>HIPAA Security</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.conflictTitle}>
                                        <Feather name="alert-triangle" size={18} color="#d97706" /> Account Active On Another Device
                                    </Text>
                                    <Text style={styles.conflictDesc}>This account is currently logged in on another device. For security and compliance, only one active session is allowed.</Text>
                                    
                                    <View style={styles.deviceMetaBox}>
                                        <Feather name={getDeviceIcon(primarySession?.os)} size={24} color="#64748b" />
                                        <View style={styles.deviceMetaRight}>
                                            <Text style={styles.deviceName}>{primarySession?.os || 'Windows PC Workstation'}</Text>
                                            <Text style={styles.deviceSubMeta}>{primarySession?.ipAddress || '192.168.1.45'} • {formatSessionTime(primarySession?.lastActive || primarySession?.loginTime)}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.sessionActions}>
                                        <TouchableOpacity style={styles.btnTerminate} onPress={onForceLogin} disabled={loading}>
                                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTerminateText}>Terminate & Login</Text>}
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.btnCancel} onPress={onCancelSession} disabled={loading}>
                                            <Text style={styles.btnCancelText}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : otpStep === 'otp' ? (
                                /* OTP VERIFICATION FLOW */
                                <View style={styles.otpBox}>
                                    <Feather name="shield" size={40} color="#3b82f6" style={styles.otpIcon} />
                                    <Text style={styles.otpTitle}>Two-Factor Authentication</Text>
                                    <View style={styles.otpBadge}>
                                        <Feather name="mail" size={14} color="#64748b" />
                                        <Text style={styles.otpBadgeText}>Code sent to {otpEmail || 'your email'}</Text>
                                    </View>

                                    <View style={styles.otpGrid}>
                                        {otpValues.map((val, idx) => (
                                            <TextInput
                                                key={idx}
                                                ref={el => otpInputRefs.current[idx] = el}
                                                style={[styles.otpInput, val && styles.otpInputFilled]}
                                                keyboardType="numeric"
                                                maxLength={1}
                                                value={val}
                                                onChangeText={v => handleOtpChange(idx, v)}
                                                onKeyPress={e => handleOtpKeyPress(idx, e)}
                                            />
                                        ))}
                                    </View>

                                    <TouchableOpacity style={[styles.btnPrimary, otpValues.join('').length !== 6 && styles.btnDisabled]} onPress={handleOtpSubmit} disabled={loading || otpValues.join('').length !== 6}>
                                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Verify & Continue</Text>}
                                    </TouchableOpacity>

                                    <View style={styles.resendRow}>
                                        <Text style={styles.resendText}>Didn't receive code?</Text>
                                        <TouchableOpacity onPress={handleResendClick} disabled={resendTimer > 0}>
                                            <Text style={[styles.resendBtnText, resendTimer > 0 && styles.textDisabled]}>{resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity style={styles.btnBack} onPress={onAbortOtp}>
                                        <Feather name="arrow-left" size={16} color="#64748b" />
                                        <Text style={styles.btnBackText}>Back to Login</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                /* STANDARD LOGIN FLOW */
                                <View style={styles.loginForm}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>{idLabel}</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name={portalType === 'patient' ? "phone" : "user"} size={18} color="#94a3b8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={idPlaceholder}
                                                placeholderTextColor="#94a3b8"
                                                keyboardType={idType}
                                                autoCapitalize="none"
                                                value={credentials.id}
                                                onChangeText={v => handleCredentialChange('id', v)}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>{passkeyLabel}</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="lock" size={18} color="#94a3b8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={passkeyPlaceholder}
                                                placeholderTextColor="#94a3b8"
                                                secureTextEntry={!showPassword}
                                                value={credentials.password}
                                                onChangeText={v => handleCredentialChange('password', v)}
                                            />
                                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#94a3b8" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.optionsRow}>
                                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)}>
                                            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                                                {rememberMe && <Feather name="check" size={12} color="#fff" />}
                                            </View>
                                            <Text style={styles.checkboxText}>Remember me</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity 
                                        style={[styles.btnPrimary, (!credentials.id || !credentials.password) && styles.btnDisabled]} 
                                        onPress={handleLoginSubmit} 
                                        disabled={loading || !credentials.id || !credentials.password}
                                    >
                                        {loading ? <ActivityIndicator color="#fff" /> : (
                                            <>
                                                <Text style={styles.btnPrimaryText}>Sign In</Text>
                                                <Feather name="arrow-right" size={18} color="#fff" />
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.securityBanner}>
                                        <Feather name="shield" size={16} color="#10b981" />
                                        <Text style={styles.securityText}>Your security is our priority.{"\n"}All data is encrypted and securely protected.</Text>
                                    </View>

                                    {extraFooter}
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.footerRow}>
                    <Text style={styles.footerText}>© 2026 Medical365. All rights reserved.</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 16, justifyContent: 'center' },
    mainWrapper: { flexDirection: 'column', gap: 24, maxWidth: 1200, alignSelf: 'center', width: '100%' },
    mainWrapperTablet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    leftPane: { flex: 1, paddingRight: isTablet ? 16 : 0, justifyContent: 'center' },
    centerPane: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    rightPane: { flex: 1, maxWidth: 450, width: '100%', alignSelf: 'center' },
    brandLogo: { height: 60, width: 200, marginBottom: 30 },
    heroTextContainer: { marginBottom: 24 },
    heroText: { fontSize: 28, fontWeight: '800', color: '#fff' },
    heroTextTeal: { fontSize: 28, fontWeight: '800', color: '#14b8a6' },
    featureList: { gap: 16, marginBottom: 32 },
    featureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    featureIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    featureInfo: { flex: 1 },
    featureTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
    featureDesc: { fontSize: 13, color: '#94a3b8' },
    ecgBar: { marginTop: 10 },
    trustedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    trustedText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
    ecgSvgContainer: { opacity: 0.6 },
    
    hologramContainer: { width: '100%', height: 450, justifyContent: 'center', alignItems: 'center' },
    haloRing: { position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: 1, borderColor: 'rgba(20, 184, 166, 0.3)', borderStyle: 'dashed' },
    haloRingInner: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.4)' },
    haloGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(20, 184, 166, 0.1)', shadowColor: '#14b8a6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 50, elevation: 10 },
    doctorImg: { width: 320, height: 450, zIndex: 2 },
    
    glassCard: { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 20, padding: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 15 },
    portalTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
    
    alertBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8, borderWidth: 1 },
    alertWarning: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
    alertError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
    alertSuccess: { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' },
    alertTextWarn: { color: '#b45309', fontSize: 14, flex: 1 },
    alertTextErr: { color: '#dc2626', fontSize: 14, flex: 1 },
    alertTextSucc: { color: '#059669', fontSize: 14, flex: 1 },

    loginForm: { gap: 16 },
    inputGroup: { gap: 6 },
    label: { fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, height: 50 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: '#0f172a', height: '100%' },
    
    optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    checkboxText: { fontSize: 14, color: '#475569' },

    btnPrimary: { backgroundColor: '#2563eb', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    btnDisabled: { opacity: 0.5 },
    btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    
    securityBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, marginTop: 8, gap: 10 },
    securityText: { fontSize: 12, color: '#166534', flex: 1, lineHeight: 18 },
    
    // Active Session UI
    sessionConflictBox: { alignItems: 'center' },
    sessionBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    sessionStatusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 6 },
    pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
    sessionBadgeText: { fontSize: 10, fontWeight: '800', color: '#b91c1c' },
    shieldTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdfa', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
    shieldText: { fontSize: 10, fontWeight: '700', color: '#0f766e' },
    conflictTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
    conflictDesc: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
    deviceMetaBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', width: '100%', marginBottom: 24, gap: 16 },
    deviceMetaRight: { flex: 1 },
    deviceName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    deviceSubMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
    sessionActions: { flexDirection: 'column', width: '100%', gap: 10 },
    btnTerminate: { backgroundColor: '#ef4444', height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    btnTerminateText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    btnCancel: { height: 48, justifyContent: 'center', alignItems: 'center' },
    btnCancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' },

    // OTP UI
    otpBox: { alignItems: 'center' },
    otpIcon: { marginBottom: 16 },
    otpTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
    otpBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, marginBottom: 24 },
    otpBadgeText: { fontSize: 13, color: '#475569', fontWeight: '500' },
    otpGrid: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    otpInput: { width: 45, height: 55, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#0f172a', backgroundColor: '#f8fafc' },
    otpInputFilled: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
    resendRow: { flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 16 },
    resendText: { color: '#64748b', fontSize: 14 },
    resendBtnText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
    textDisabled: { color: '#cbd5e1' },
    btnBack: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    btnBackText: { color: '#64748b', fontSize: 14, fontWeight: '600' },

    footerRow: { marginTop: 20, alignItems: 'center' },
    footerText: { color: '#94a3b8', fontSize: 12 }
});

export default NeuralAuthPortal;
