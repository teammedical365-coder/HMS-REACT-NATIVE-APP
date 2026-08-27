import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBranding } from '../../context/BrandingContext';
import { publicAPI, patientAuthAPI } from '../../utils/api';

const PatientForgotPassword = () => {
    const { loadBranding } = useBranding();
    const navigation = useNavigation();
    
    const [hospital, setHospital] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [resetToken, setResetToken] = useState('');

    useEffect(() => {
        const resolveHospital = async () => {
            try {
                setLoading(true);
                const domain = 'localhost';
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
    }, []);

    const handleSubmit = async () => {
        setErrorMsg('');
        setSuccessMsg('');
        setResetToken('');

        if (!email.trim()) {
            setErrorMsg('Email Address is required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await patientAuthAPI.forgotPassword(email.trim(), hospital?.id || 'default');
            if (res.success) {
                setSuccessMsg('Reset link generated successfully.');
                setResetToken(res.token);
            }
        } catch (err) {
            console.error('Forgot password error:', err);
            setErrorMsg(err.message || 'Failed to process request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loaderText}>Loading Portal...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.branding}>
                    {hospital?.logo ? (
                        <Image source={{ uri: hospital.logo }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <Text style={styles.emojiLogo}>🏥</Text>
                    )}
                    <Text style={styles.hospitalName}>{hospital?.name || 'Welcome to Our Hospital'}</Text>
                    <Text style={styles.portalTitle}>Reset Password</Text>
                </View>

                {errorMsg ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                ) : null}

                {successMsg ? (
                    <View style={styles.successBox}>
                        <Text style={styles.successText}>{successMsg}</Text>
                    </View>
                ) : null}

                {resetToken ? (
                    <View style={styles.mockLinkBox}>
                        <Text style={styles.mockLinkHeader}>[Mock Email Link]:</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('PatientResetPassword', { token: resetToken })}>
                            <Text style={styles.mockLinkText}>Click here to reset your password</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Registered Email Address</Text>
                        <TextInput 
                            style={styles.input}
                            placeholder="Enter your email address"
                            value={email}
                            onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <TouchableOpacity 
                        style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.primaryBtnText}>{isSubmitting ? 'Sending...' : 'Get Reset Link'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.dividerBox}>
                    <Text style={styles.dividerText}>Or remember your password?</Text>
                </View>

                <TouchableOpacity 
                    style={styles.secondaryBtn}
                    onPress={() => navigation.navigate('PatientPortalLogin')}
                >
                    <Text style={styles.secondaryBtnText}>Back to Login</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    loaderText: { color: '#3b82f6', fontWeight: '600', marginTop: 10 },
    container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: '#ffffff', width: '100%', maxWidth: 400, borderRadius: 16, padding: 30, elevation: 5 },
    branding: { alignItems: 'center', marginBottom: 30 },
    logo: { width: 80, height: 80, marginBottom: 16 },
    emojiLogo: { fontSize: 48, marginBottom: 16 },
    hospitalName: { fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
    portalTitle: { fontSize: 14, fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1 },
    errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 16 },
    errorText: { color: '#b91c1c', textAlign: 'center', fontSize: 14 },
    successBox: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
    successText: { color: '#065f46', textAlign: 'center', fontSize: 14 },
    mockLinkBox: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
    mockLinkHeader: { fontWeight: 'bold', color: '#1e40af', marginBottom: 4, fontSize: 13 },
    mockLinkText: { color: '#2563eb', fontWeight: 'bold', fontSize: 14 },
    form: { width: '100%' },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a' },
    primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
    dividerBox: { marginVertical: 24, alignItems: 'center' },
    dividerText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
    secondaryBtn: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    secondaryBtnText: { color: '#475569', fontSize: 15, fontWeight: '700' }
});

export default PatientForgotPassword;
