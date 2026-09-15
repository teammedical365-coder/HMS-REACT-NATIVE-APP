import React, { useState } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminAPI } from '../../utils/api';

const AdminSignup = () => {
    const navigation = useNavigation();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        setError('');
    };

    const handleSubmit = async () => {
        setError('');

        // Validation (1:1 with Web)
        if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
            setError('Please fill in all required fields');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
            setError('Please enter a valid email address');
            return;
        }

        if (formData.phone && formData.phone.replace(/\D/g, '').length !== 10) {
            setError('Phone number must be exactly 10 digits');
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

        setLoading(true);
        try {
            const cleanPhone = formData.phone ? formData.phone.replace(/\D/g, '') : '';
            const response = await adminAPI.signup(
                formData.name.trim(), 
                formData.email.trim().toLowerCase(), 
                formData.password, 
                cleanPhone
            );

            if (response.success) {
                // Store token and user in AsyncStorage (1:1 with Web localStorage)
                if (response.token) {
                    await AsyncStorage.setItem('token', response.token);
                }
                if (response.user) {
                    await AsyncStorage.setItem('user', JSON.stringify(response.user));
                }

                Alert.alert(
                    'Success', 
                    'Super Admin account created successfully.',
                    [
                        { 
                            text: 'Proceed', 
                            onPress: () => {
                                // Navigate to central admin dashboard or login
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                } else {
                                    navigation.navigate('CentralAdminLogin');
                                }
                            }
                        }
                    ]
                );
            } else {
                setError(response.message || 'Error creating Super Admin account. Please try again.');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Error creating Super Admin account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={styles.container}
        >
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Back Button */}
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={18} color="#475569" />
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>

                {/* Auth Card */}
                <View style={styles.authCard}>
                    <View style={styles.authHeader}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="shield-checkmark" size={32} color="#0d9488" />
                        </View>
                        <Text style={styles.title}>Create Super Admin Account</Text>
                        <Text style={styles.subtitle}>Sign up to create a Super Admin account</Text>
                    </View>

                    {/* Error Banner */}
                    {!!error && (
                        <View style={styles.errorBox}>
                            <Feather name="alert-circle" size={16} color="#dc2626" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Form Fields */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your full name"
                            placeholderTextColor="#94a3b8"
                            value={formData.name}
                            onChangeText={v => handleChange('name', v)}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Email Address *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#94a3b8"
                            value={formData.email}
                            onChangeText={v => handleChange('email', v)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Phone Number (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 10-digit phone number"
                            placeholderTextColor="#94a3b8"
                            value={formData.phone}
                            onChangeText={v => handleChange('phone', v)}
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Password * (min 6 characters)</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Enter your password"
                                placeholderTextColor="#94a3b8"
                                value={formData.password}
                                onChangeText={v => handleChange('password', v)}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity 
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeBtn}
                            >
                                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Confirm Password *</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Confirm your password"
                                placeholderTextColor="#94a3b8"
                                value={formData.confirmPassword}
                                onChangeText={v => handleChange('confirmPassword', v)}
                                secureTextEntry={!showConfirmPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity 
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={styles.eyeBtn}
                            >
                                <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity 
                        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={styles.submitButtonText}>Sign Up</Text>
                        )}
                    </TouchableOpacity>

                    {/* Footer Links */}
                    <View style={styles.authFooter}>
                        <View style={styles.footerRow}>
                            <Text style={styles.footerText}>Already have a Super Admin account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('CentralAdminLogin')}>
                                <Text style={styles.linkText}>Sign In</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.footerRow, { marginTop: 10 }]}>
                            <Text style={styles.footerSubText}>Regular users should use </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                <Text style={[styles.linkText, { fontSize: 13 }]}>user signup</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 40,
        alignItems: 'center',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        marginBottom: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    backButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    authCard: {
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 28,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 3,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
    },
    authHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f0fdfa',
        borderWidth: 1.5,
        borderColor: '#99f6e4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
        textAlign: 'center',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 10,
        padding: 12,
        marginBottom: 18,
    },
    errorText: {
        flex: 1,
        fontSize: 13,
        color: '#dc2626',
        fontWeight: '600',
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    input: {
        height: 48,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 14,
        fontSize: 14,
        color: '#0f172a',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 14,
    },
    passwordInput: {
        flex: 1,
        height: 48,
        fontSize: 14,
        color: '#0f172a',
    },
    eyeBtn: {
        padding: 6,
    },
    submitButton: {
        height: 50,
        backgroundColor: '#0d9488',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        elevation: 2,
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    submitButtonDisabled: {
        backgroundColor: '#94a3b8',
    },
    submitButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
    authFooter: {
        marginTop: 24,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 18,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    footerText: {
        fontSize: 13,
        color: '#64748b',
    },
    footerSubText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    linkText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0d9488',
    },
});

export default AdminSignup;
