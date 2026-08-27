import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBranding } from '../../context/BrandingContext';
import { publicAPI, patientAuthAPI } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Note: PasswordInput should ideally be a native component if ported, using a simple TextInput with secureTextEntry here.

const PatientPortalLogin = () => {
    const { loadBranding } = useBranding();
    const navigation = useNavigation();
    
    const [hospital, setHospital] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
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
    }, []);

    const handleLogin = async () => {
        setErrorMsg('');

        if (!loginId.trim() || !password) {
            setErrorMsg('Email/Mobile and Password are required.');
            return;
        }

        // if (!hospital?.id) {
        //     setErrorMsg('Hospital branding context is missing.');
        //     return;
        // }

        setIsSubmitting(true);
        try {
            const res = await patientAuthAPI.login(loginId.trim(), password, hospital?.id || 'default');
            if (res.success) {
                await AsyncStorage.setItem('patientToken', res.token);
                await AsyncStorage.setItem('patientUser', JSON.stringify(res.user));
                navigation.navigate('PatientDashboard');
            }
        } catch (err) {
            console.error('Login error:', err);
            setErrorMsg(err.message || 'Invalid credentials or login failed.');
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
                    <Text style={styles.portalTitle}>Patient Portal</Text>
                </View>

                {errorMsg ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                ) : null}

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mobile Number / Email</Text>
                        <TextInput 
                            style={styles.input}
                            placeholder="Enter your registered mobile or email"
                            value={loginId}
                            onChangeText={(t) => { setLoginId(t); setErrorMsg(''); }}
                            autoCapitalize="none"
                        />
                    </View>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput 
                            style={styles.input}
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
                            secureTextEntry={true}
                        />
                    </View>

                    <TouchableOpacity 
                        style={styles.forgotBtn} 
                        onPress={() => navigation.navigate('PatientForgotPassword')}
                    >
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                        onPress={handleLogin}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.primaryBtnText}>{isSubmitting ? 'Logging in...' : 'Secure Login'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.dividerBox}>
                    <Text style={styles.dividerText}>New to our portal?</Text>
                </View>

                <TouchableOpacity 
                    style={styles.secondaryBtn}
                    onPress={() => navigation.navigate('PatientSignup')}
                >
                    <Text style={styles.secondaryBtnText}>Create Patient Account</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    loaderText: { color: '#3b82f6', fontWeight: '600', marginTop: 10 },
    container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: '#ffffff', width: '100%', maxWidth: 400, borderRadius: 16, padding: 30, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
    branding: { alignItems: 'center', marginBottom: 30 },
    logo: { width: 80, height: 80, marginBottom: 16 },
    emojiLogo: { fontSize: 48, marginBottom: 16 },
    hospitalName: { fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
    portalTitle: { fontSize: 14, fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1 },
    errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 16 },
    errorText: { color: '#b91c1c', textAlign: 'center', fontSize: 14 },
    form: { width: '100%' },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a' },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: 24 },
    forgotText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
    primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
    dividerBox: { marginVertical: 24, alignItems: 'center' },
    dividerText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
    secondaryBtn: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    secondaryBtnText: { color: '#475569', fontSize: 15, fontWeight: '700' }
});

export default PatientPortalLogin;
