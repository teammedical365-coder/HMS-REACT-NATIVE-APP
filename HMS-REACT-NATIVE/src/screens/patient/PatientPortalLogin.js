import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBranding } from '../../context/BrandingContext';
import { publicAPI, patientAuthAPI } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NeuralAuthPortal from '../../components/auth/NeuralAuthPortal';

const PatientPortalLogin = () => {
    const { loadBranding } = useBranding();
    const navigation = useNavigation();
    
    const [hospital, setHospital] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const resolveHospital = async () => {
            try {
                setLoading(true);
                // For native, window.location.hostname isn't available. We rely on subdomain mapping if built.
                // Assuming a default or fetched tenant ID for native app.
                const domain = 'localhost'; // Placeholder or env variable
                const res = await publicAPI.getTenantConfig(domain);
                
                if (res.success && res.tenant) {
                    setHospital({
                        id: res.tenant.id,
                        name: res.tenant.name,
                        logo: res.tenant.branding?.logoUrl
                    });
                    if (res.tenant.id) {
                        loadBranding(res.tenant.id);
                    }
                }
            } catch (err) {
                console.error('Could not load hospital branding', err);
            } finally {
                setLoading(false);
            }
        };
        resolveHospital();
    }, [loadBranding]);

    const [otpStep, setOtpStep] = useState(null);
    const [preAuthToken, setPreAuthToken] = useState(null);
    const [otpRecipient, setOtpRecipient] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleLoginSubmit = async ({ id, password }) => {
        setErrorMsg('');
        setSuccessMsg('');

        if (!id.trim() || !password) {
            setErrorMsg('Email/Mobile and Password are required.');
            return;
        }

        if (!hospital?.id) {
            setErrorMsg('Hospital branding context is missing.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await patientAuthAPI.sendOtp(id.trim(), password, hospital.id);
            if (res.success && res.preAuthToken) {
                setPreAuthToken(res.preAuthToken);
                setOtpRecipient(res.email || res.mobile || id);
                setOtpStep('otp');
                setSuccessMsg(res.message || 'Verification code transmitted.');
            } else {
                setErrorMsg(res.message || 'Failed to initiate OTP verification.');
            }
        } catch (err) {
            console.error('Patient Login error:', err);
            setErrorMsg(err.response?.data?.message || err.message || 'Invalid credentials or login failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOtp = async (otp) => {
        if (!preAuthToken) return;
        setIsSubmitting(true);
        setErrorMsg('');

        try {
            const res = await patientAuthAPI.verifyOtp(preAuthToken, otp);
            if (res.success && res.token) {
                await AsyncStorage.setItem('patientToken', res.token);
                await AsyncStorage.setItem('patientUser', JSON.stringify(res.user));
                navigation.navigate('PatientDashboard');
            } else {
                setErrorMsg(res.message || 'OTP verification failed.');
            }
        } catch (err) {
            console.error('Patient OTP verify error:', err);
            setErrorMsg(err.response?.data?.message || err.message || 'Incorrect OTP code.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        if (!preAuthToken) return;
        setIsSubmitting(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const res = await patientAuthAPI.resendOtp(preAuthToken);
            if (res.success) {
                setSuccessMsg(res.message || 'New verification code transmitted.');
            } else {
                setErrorMsg(res.message || 'Failed to resend code.');
            }
        } catch (err) {
            setErrorMsg(err.response?.data?.message || err.message || 'Failed to resend OTP.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAbortOtp = () => {
        setOtpStep(null);
        setPreAuthToken(null);
        setErrorMsg('');
        setSuccessMsg('');
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loaderText}>Initializing Patient Health Node...</Text>
            </View>
        );
    }

    const patientExtraFooter = (
        <View style={{ flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => navigation.navigate('PatientForgotPassword')}>
                    <Text style={{ color: '#64748b', fontWeight: '600', fontSize: 13 }}>Forgot Secure Code?</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('PatientSignup')}>
                    <Text style={{ color: '#a855f7', fontWeight: '700', fontSize: 13 }}>Register Patient Account →</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <NeuralAuthPortal
            portalType="patient"
            title="Patient Portal"
            subtitle={`Access personal digital health records for ${hospital?.name || 'our patient network'}.`}
            idLabel="Mobile Number or Email"
            idPlaceholder="Enter registered mobile or email"
            idType="email-address"
            passkeyLabel="Password"
            passkeyPlaceholder="••••••••"
            branding={{
                name: hospital?.name,
                logoUrl: hospital?.logo
            }}
            onLoginSubmit={handleLoginSubmit}
            onVerifyOtp={handleVerifyOtp}
            onResendOtp={handleResendOtp}
            onAbortOtp={handleAbortOtp}
            otpStep={otpStep}
            otpEmail={otpRecipient}
            loading={isSubmitting}
            error={errorMsg}
            successMsg={successMsg}
            extraFooter={patientExtraFooter}
        />
    );
};

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
    loaderText: { color: '#0ea5e9', fontWeight: '600', marginTop: 10, fontFamily: 'monospace' },
});

export default PatientPortalLogin;
