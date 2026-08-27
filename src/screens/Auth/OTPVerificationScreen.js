import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    TextInput,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { verifyOtp, resendOtp, forceLogin, resetOtpFlow } from '../../store/slices/authSlice';

const OTPVerificationScreen = ({ route, navigation }) => {
    const dispatch = useAppDispatch();
    const { preAuthToken } = route.params || {};
    const { loading, error, otpEmail, otpSuccessMsg, otpStep, activeSession } = useAuth();
    const [otp, setOtp] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendDisabled, setResendDisabled] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    // Timer for resend button
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
        if (resendTimer === 0 && resendDisabled) {
            setResendDisabled(false);
        }
    }, [resendTimer, resendDisabled]);

    // Show errors and success messages
    useEffect(() => {
        if (error) {
            Toast.show({
                type: 'error',
                text1: 'OTP Verification Failed',
                text2: typeof error === 'string' ? error : error.message || 'Please try again',
            });
        }
    }, [error]);

    useEffect(() => {
        if (otpSuccessMsg) {
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: otpSuccessMsg,
            });
        }
    }, [otpSuccessMsg]);

    // If session conflict, show session dialog
    useEffect(() => {
        if (otpStep === 'session_check' && activeSession) {
            // In a real app, show a modal here asking user to choose device or force login
            // For now, automatically force login
            setTimeout(() => {
                handleForceLogin();
            }, 1500);
        }
    }, [otpStep, activeSession]);

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 4) {
            Toast.show({ type: 'error', text1: 'Please enter a valid OTP' });
            return;
        }
        if (!preAuthToken) {
            Toast.show({ type: 'error', text1: 'Session expired. Please login again.' });
            return;
        }
        dispatch(verifyOtp({ preAuthToken, otp }));
    };

    const handleResendOtp = async () => {
        if (!preAuthToken) return;
        setResendLoading(true);
        dispatch(resendOtp({ preAuthToken }))
            .then(() => {
                setResendDisabled(true);
                setResendTimer(60);
            })
            .finally(() => setResendLoading(false));
    };

    const handleForceLogin = () => {
        if (!preAuthToken) return;
        dispatch(forceLogin({ preAuthToken }));
    };

    const handleBackToLogin = () => {
        dispatch(resetOtpFlow());
        navigation.goBack();
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>Verify OTP</Text>
                    <Text style={styles.subtitle}>
                        {otpEmail ? `Enter the OTP sent to ${otpEmail}` : 'Check your email for the verification code'}
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>One-Time Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 6-digit OTP"
                            placeholderTextColor="#cbd5e1"
                            value={otp}
                            onChangeText={setOtp}
                            editable={!loading}
                            keyboardType="number-pad"
                            maxLength={6}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleVerifyOtp}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={styles.buttonText}>Verify</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.resendContainer}>
                    <Text style={styles.resendLabel}>Didn't receive OTP?</Text>
                    <TouchableOpacity
                        onPress={handleResendOtp}
                        disabled={resendDisabled || resendLoading}
                        style={resendDisabled && styles.resendButtonDisabled}
                    >
                        <Text style={[styles.resendButton, resendDisabled && styles.resendButtonTextDisabled]}>
                            {resendLoading ? 'Sending...' : resendDisabled ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back to Login</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: 24, paddingHorizontal: 16 },
    header: { marginBottom: 48 },
    title: { fontSize: 28, fontWeight: '700', color: '#0a2647', marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b' },
    form: { marginBottom: 32 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        letterSpacing: 2,
    },
    button: {
        backgroundColor: '#14b8a6',
        borderRadius: 10,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
    resendContainer: { alignItems: 'center', marginBottom: 32 },
    resendLabel: { fontSize: 13, color: '#64748b', marginBottom: 8 },
    resendButton: { fontSize: 13, color: '#14b8a6', fontWeight: '600' },
    resendButtonDisabled: { opacity: 0.5 },
    resendButtonTextDisabled: { color: '#cbd5e1' },
    backButton: { paddingVertical: 8, alignItems: 'center' },
    backButtonText: { fontSize: 13, color: '#14b8a6', fontWeight: '600' },
});

export default OTPVerificationScreen;