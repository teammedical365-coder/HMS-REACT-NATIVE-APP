import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBranding } from '../../context/BrandingContext';
import { publicAPI, patientAuthAPI } from '../../utils/api';

const PatientSignup = () => {
    const navigation = useNavigation();
    const { loadBranding } = useBranding();
    
    const [hospital, setHospital] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [formData, setFormData] = useState({
        name: '', mobile: '', email: '', password: '', confirmPassword: ''
    });

    useEffect(() => {
        const resolveHospital = async () => {
            try {
                setLoading(true);
                const domain = 'localhost'; // Placeholder for RN
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

    const handleChange = (name, value) => {
        if (name === 'mobile') {
            const clean = value.replace(/\D/g, '').slice(0, 10);
            setFormData(prev => ({ ...prev, mobile: clean }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        setErrorMsg('');
    };

    const validateForm = () => {
        if (!formData.name.trim()) return "Full Name is required.";
        if (formData.name.trim().length < 2) return "Name must be at least 2 characters.";
        if (!formData.mobile.trim()) return "Mobile Number is required.";
        if (!/^\d{10}$/.test(formData.mobile)) return "Mobile number must be exactly 10 digits.";
        if (!formData.email.trim()) return "Email Address is required.";
        if (!formData.password) return "Password is required.";
        if (!formData.confirmPassword) return "Confirm Password is required.";
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) return "Please enter a valid email address.";
        if (formData.password.length < 8) return "Password must be at least 8 characters long.";
        if (formData.password !== formData.confirmPassword) return "Passwords do not match.";

        return null;
    };

    const handleSignup = async () => {
        const validationError = validateForm();
        if (validationError) {
            setErrorMsg(validationError);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await patientAuthAPI.register(
                formData.name,
                formData.email,
                formData.mobile,
                formData.password,
                hospital?.id || 'default'
            );

            if (response.success) {
                Alert.alert("Success", "Your account has been created successfully. Please login to continue.");
                navigation.navigate('PatientPortalLogin');
            }
        } catch (err) {
            console.error('Registration error', err);
            setErrorMsg(err.message || "Failed to create account.");
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
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.card}>
                <View style={styles.branding}>
                    {hospital?.logo ? (
                        <Image source={{ uri: hospital.logo }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <Text style={styles.emojiLogo}>🏥</Text>
                    )}
                    <Text style={styles.hospitalName}>{hospital?.name || 'Welcome to Our Hospital'}</Text>
                    <Text style={styles.portalTitle}>Create Patient Account</Text>
                </View>

                {errorMsg ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                ) : null}

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput style={styles.input} placeholder="John Doe" value={formData.name} onChangeText={(t) => handleChange('name', t)} />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.flex1]}>
                            <Text style={styles.label}>Mobile Number</Text>
                            <TextInput style={styles.input} placeholder="9876543210" value={formData.mobile} onChangeText={(t) => handleChange('mobile', t)} keyboardType="numeric" maxLength={10} />
                        </View>
                        <View style={[styles.inputGroup, styles.flex1]}>
                            <Text style={styles.label}>Email Address</Text>
                            <TextInput style={styles.input} placeholder="john@example.com" value={formData.email} onChangeText={(t) => handleChange('email', t)} autoCapitalize="none" keyboardType="email-address" />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.flex1]}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput style={styles.input} placeholder="Min. 8 characters" value={formData.password} onChangeText={(t) => handleChange('password', t)} secureTextEntry />
                        </View>
                        <View style={[styles.inputGroup, styles.flex1]}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <TextInput style={styles.input} placeholder="Confirm password" value={formData.confirmPassword} onChangeText={(t) => handleChange('confirmPassword', t)} secureTextEntry />
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]} onPress={handleSignup} disabled={isSubmitting}>
                        <Text style={styles.primaryBtnText}>{isSubmitting ? 'Creating Account...' : 'Sign Up'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.dividerBox}>
                    <Text style={styles.dividerText}>Already have an account?</Text>
                </View>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('PatientPortalLogin')}>
                    <Text style={styles.secondaryBtnText}>Go to Login</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    loaderText: { color: '#3b82f6', fontWeight: '600', marginTop: 10 },
    container: { flexGrow: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: '#ffffff', width: '100%', maxWidth: 500, borderRadius: 16, padding: 30, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
    branding: { alignItems: 'center', marginBottom: 30 },
    logo: { width: 80, height: 80, marginBottom: 16 },
    emojiLogo: { fontSize: 48, marginBottom: 16 },
    hospitalName: { fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
    portalTitle: { fontSize: 14, fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1 },
    errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 16 },
    errorText: { color: '#b91c1c', textAlign: 'center', fontSize: 14 },
    form: { width: '100%' },
    row: { flexDirection: 'row', gap: 16 },
    flex1: { flex: 1 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a' },
    primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
    dividerBox: { marginVertical: 24, alignItems: 'center' },
    dividerText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
    secondaryBtn: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    secondaryBtnText: { color: '#475569', fontSize: 15, fontWeight: '700' }
});

export default PatientSignup;
