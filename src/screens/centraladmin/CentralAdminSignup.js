import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/slices/authSlice';
import { adminAPI } from '../../utils/api';
import PasswordInput from '../../components/PasswordInput';
import { SafeAreaView } from 'react-native-safe-area-context';

const CentralAdminSignup = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', confirmPassword: '', phone: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { width } = useWindowDimensions();
    const isCompact = width < 900;

    const handleChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
        setError('');
    };

    // Validation helpers matching web version
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidPhone = (phone) => !phone || /^\d{10}$/.test(phone.replace(/\D/g, ''));

    const handleSubmit = async () => {
        setError('');
        
        // Validation chain matching web version
        if (!formData.name || !formData.email || !formData.password) {
            setError('Please fill in all required fields');
            return;
        }
        
        if (formData.name.trim().length < 2) {
            setError('Full name must be at least 2 characters long');
            return;
        }
        
        if (!isValidEmail(formData.email)) {
            setError('Please enter a valid email address');
            return;
        }
        
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }
        
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        
        if (formData.phone && !isValidPhone(formData.phone)) {
            setError('Phone number must be 10 digits');
            return;
        }

        setLoading(true);
        
        try {
            const response = await adminAPI.signup(formData.name, formData.email, formData.password, formData.phone);
            if (response.success || response.token) {
                const token = response.token || response.data?.token;
                const user = response.user || response.data?.user;
                
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('superadmin_token', token);
                if (user) {
                    await AsyncStorage.setItem('user', JSON.stringify(user));
                    dispatch(setCredentials({ user, token }));
                } else {
                    dispatch(setCredentials({ token }));
                }
                
                // Use navigation.reset to properly transition from Auth stack to CentralAdmin stack
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'CentralAdmin' }],
                });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating Central Admin account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.authPage}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.authCard}>
                        {/* LEFT: Form Container */}
                        <View style={styles.authFormContainer} pointerEvents="box-none">
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.backButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.backButtonIcon}>←</Text>
                                <Text style={styles.backButtonText}>Go Back</Text>
                            </TouchableOpacity>

                            <View style={styles.authHeader} pointerEvents="box-none">
                                <Text style={styles.headerTitle}>🏛️ Create Central Admin Account</Text>
                                <Text style={styles.headerSubtitle}>Set up the top-level administration account</Text>
                            </View>

                            {error ? (
                                <View style={styles.errorMessage} pointerEvents="box-none">
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            <View style={styles.authForm} pointerEvents="box-none">
                                {/* Full Name Field */}
                                <View style={styles.formGroup} pointerEvents="box-none">
                                    <Text style={styles.label}>Full Name *</Text>
                                    <View style={styles.inputWrapper} pointerEvents="box-none">
                                        <TextInput
                                            style={styles.input}
                                            value={formData.name}
                                            onChangeText={(t) => handleChange('name', t)}
                                            placeholder="Enter your full name"
                                            placeholderTextColor="#94a3b8"
                                            editable={!loading}
                                        />
                                    </View>
                                </View>

                                {/* Email Field */}
                                <View style={styles.formGroup} pointerEvents="box-none">
                                    <Text style={styles.label}>Email Address *</Text>
                                    <View style={styles.inputWrapper} pointerEvents="box-none">
                                        <TextInput
                                            style={styles.input}
                                            value={formData.email}
                                            onChangeText={(t) => handleChange('email', t)}
                                            placeholder="Enter your email"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            editable={!loading}
                                        />
                                    </View>
                                </View>

                                {/* Phone Field */}
                                <View style={styles.formGroup} pointerEvents="box-none">
                                    <Text style={styles.label}>Phone Number</Text>
                                    <View style={styles.inputWrapper} pointerEvents="box-none">
                                        <TextInput
                                            style={styles.input}
                                            value={formData.phone}
                                            onChangeText={(t) => {
                                                const cleanVal = t.replace(/\D/g, '').slice(0, 10);
                                                handleChange('phone', cleanVal);
                                            }}
                                            placeholder="Enter your phone number (optional)"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="numeric"
                                            maxLength={10}
                                            editable={!loading}
                                        />
                                    </View>
                                </View>

                                {/* Password Field */}
                                <View style={styles.formGroup} pointerEvents="box-none">
                                    <Text style={styles.label}>Password *</Text>
                                    <View style={styles.inputWrapper} pointerEvents="box-none">
                                        <PasswordInput
                                            value={formData.password}
                                            onChangeText={(t) => handleChange('password', t)}
                                            placeholder="Enter your password"
                                            style={styles.passwordInputCustom}
                                            editable={!loading}
                                        />
                                    </View>
                                </View>

                                {/* Confirm Password Field */}
                                <View style={styles.formGroup} pointerEvents="box-none">
                                    <Text style={styles.label}>Confirm Password *</Text>
                                    <View style={styles.inputWrapper} pointerEvents="box-none">
                                        <PasswordInput
                                            value={formData.confirmPassword}
                                            onChangeText={(t) => handleChange('confirmPassword', t)}
                                            placeholder="Confirm your password"
                                            style={styles.passwordInputCustom}
                                            editable={!loading}
                                        />
                                    </View>
                                </View>

                                {/* Sign Up Button */}
                                <TouchableOpacity
                                    style={[
                                        styles.btnPrimary,
                                        styles.btnBlock,
                                        loading && styles.btnDisabled,
                                    ]}
                                    onPress={handleSubmit}
                                    disabled={loading}
                                    activeOpacity={0.8}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>Sign Up</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Footer: Switch to Login */}
                            <View style={styles.authFooter} pointerEvents="box-none">
                                <Text style={styles.switchText}>
                                    Already have a Central Admin account?{' '}
                                    <Text
                                        style={styles.switchLink}
                                        onPress={() => navigation.navigate('CentralAdminLogin')}
                                    >
                                        Sign In
                                    </Text>
                                </Text>
                            </View>
                        </View>

                        {/* RIGHT: Visual Branding */}
                        <View
                            style={[styles.authVisual, isCompact && { display: 'none' }]}
                            pointerEvents="none"
                        >
                            <View style={styles.authContent}>
                                <Text style={styles.visualTitle}>Supreme Portal</Text>
                                <Text style={styles.visualSubtitle}>
                                    Join the administration platform to manage hospitals globally.
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    authPage: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    authCard: {
        width: '100%',
        maxWidth: 1100,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        flexDirection: 'row',
        overflow: 'hidden',
        minHeight: 650,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    authFormContainer: {
        flex: 1.2,
        padding: 40,
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    authVisual: {
        flex: 1,
        backgroundColor: '#0d9488',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    authContent: {
        maxWidth: 380,
        zIndex: 2,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        alignSelf: 'flex-start',
        paddingVertical: 8,
    },
    backButtonIcon: {
        fontSize: 16,
        marginRight: 6,
        color: '#64748b',
        fontWeight: '700',
    },
    backButtonText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    authHeader: {
        marginBottom: 28,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
    },
    errorMessage: {
        backgroundColor: '#fee2e2',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#dc2626',
    },
    errorText: {
        color: '#dc2626',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    authForm: {
        width: '100%',
    },
    formGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        paddingHorizontal: 14,
        height: 48,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '500',
        paddingVertical: 12,
    },
    passwordInputCustom: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '500',
        paddingVertical: 12,
    },
    btnPrimary: {
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    btnBlock: {
        width: '100%',
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    btnDisabled: {
        opacity: 0.6,
    },
    authFooter: {
        marginTop: 32,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#edf2f7',
        alignItems: 'center',
    },
    switchText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    switchLink: {
        color: '#2563eb',
        fontWeight: '700',
    },
    visualTitle: {
        color: '#ffffff',
        fontSize: 40,
        fontWeight: '800',
        marginBottom: 15,
        lineHeight: 48,
    },
    visualSubtitle: {
        color: '#ccfbf1',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500',
    },
});

export default CentralAdminSignup;
