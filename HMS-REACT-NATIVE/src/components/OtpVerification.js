import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';

const OtpVerification = ({ email, onVerify, onResend, onBack, loading, error, successMsg }) => {
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(30);
    const [hasError, setHasError] = useState(false);
    const inputRefs = useRef([]);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const timer = setInterval(() => {
            setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendTimer]);

    useEffect(() => {
        if (error) {
            setHasError(true);
            const timeout = setTimeout(() => setHasError(false), 500);
            return () => clearTimeout(timeout);
        }
    }, [error]);

    const handleChange = useCallback((index, value) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const newValues = [...otpValues];
        newValues[index] = digit;
        setOtpValues(newValues);

        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        if (digit && index === 5) {
            const fullOtp = newValues.join('');
            if (fullOtp.length === 6) {
                Keyboard.dismiss();
                onVerify(fullOtp);
            }
        }
    }, [otpValues, onVerify]);

    const handleKeyPress = useCallback((index, e) => {
        if (e.nativeEvent.key === 'Backspace') {
            if (!otpValues[index] && index > 0) {
                inputRefs.current[index - 1]?.focus();
                const newValues = [...otpValues];
                newValues[index - 1] = '';
                setOtpValues(newValues);
            } else {
                const newValues = [...otpValues];
                newValues[index] = '';
                setOtpValues(newValues);
            }
        }
    }, [otpValues]);

    const handleVerifyClick = () => {
        const fullOtp = otpValues.join('');
        if (fullOtp.length === 6) {
            Keyboard.dismiss();
            onVerify(fullOtp);
        }
    };

    const handleResendClick = () => {
        setResendTimer(30);
        setOtpValues(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        onResend();
    };

    const isComplete = otpValues.every((v) => v !== '');

    return (
        <View style={styles.container}>
            {onBack && (
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Feather name="arrow-left" size={20} color="#3b82f6" />
                    <Text style={styles.backText}>Back to Login</Text>
                </TouchableOpacity>
            )}

            <View style={styles.iconWrapper}>
                <Feather name="shield" size={40} color="#10b981" />
            </View>

            <View style={styles.header}>
                <Text style={styles.title}>Verify Your Identity</Text>
                <Text style={styles.subtitle}>We've sent a 6-digit verification code to your registered email.</Text>
                {email && (
                    <View style={styles.emailBadge}>
                        <Feather name="mail" size={16} color="#0f172a" />
                        <Text style={styles.emailText}>{email}</Text>
                    </View>
                )}
            </View>

            {error && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
            
            {successMsg && (
                <View style={styles.successBox}>
                    <Text style={styles.successText}>{successMsg}</Text>
                </View>
            )}

            <View style={styles.inputContainer}>
                {otpValues.map((value, index) => (
                    <TextInput
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        style={[
                            styles.inputBox,
                            value ? styles.inputBoxHasValue : null,
                            hasError ? styles.inputBoxError : null
                        ]}
                        keyboardType="number-pad"
                        maxLength={1}
                        value={value}
                        onChangeText={(text) => handleChange(index, text)}
                        onKeyPress={(e) => handleKeyPress(index, e)}
                        autoComplete="one-time-code"
                    />
                ))}
            </View>

            <TouchableOpacity
                style={[styles.verifyBtn, (!isComplete || loading) && styles.verifyBtnDisabled]}
                onPress={handleVerifyClick}
                disabled={!isComplete || loading}
            >
                {loading ? (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator color="white" size="small" />
                        <Text style={styles.verifyBtnText}> Verifying...</Text>
                    </View>
                ) : (
                    <Text style={styles.verifyBtnText}>Verify OTP</Text>
                )}
            </TouchableOpacity>

            <View style={styles.resendSection}>
                {resendTimer > 0 ? (
                    <Text style={styles.resendTimerText}>Resend OTP in {resendTimer}s</Text>
                ) : (
                    <View style={styles.resendRow}>
                        <Text style={styles.resendPromptText}>Didn't receive the code? </Text>
                        <TouchableOpacity onPress={handleResendClick} disabled={loading}>
                            <Text style={styles.resendBtnText}>Resend OTP</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', padding: 20, backgroundColor: 'white', borderRadius: 12 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backText: { color: '#3b82f6', fontSize: 16, marginLeft: 8, fontWeight: '500' },
    iconWrapper: { alignItems: 'center', marginBottom: 20 },
    header: { alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 12 },
    emailBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    emailText: { color: '#0f172a', fontWeight: '500', marginLeft: 6 },
    errorBox: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16 },
    errorText: { color: '#ef4444', textAlign: 'center', fontSize: 14 },
    successBox: { backgroundColor: '#f0fdf4', padding: 12, borderRadius: 8, marginBottom: 16 },
    successText: { color: '#10b981', textAlign: 'center', fontSize: 14 },
    inputContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    inputBox: { width: 45, height: 55, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8, fontSize: 24, textAlign: 'center', color: '#0f172a', backgroundColor: '#f8fafc' },
    inputBoxHasValue: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
    inputBoxError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
    verifyBtn: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
    verifyBtnDisabled: { backgroundColor: '#93c5fd' },
    verifyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    loadingRow: { flexDirection: 'row', alignItems: 'center' },
    resendSection: { alignItems: 'center' },
    resendTimerText: { color: '#64748b', fontSize: 14 },
    resendRow: { flexDirection: 'row', alignItems: 'center' },
    resendPromptText: { color: '#64748b', fontSize: 14 },
    resendBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 }
});

export default OtpVerification;
