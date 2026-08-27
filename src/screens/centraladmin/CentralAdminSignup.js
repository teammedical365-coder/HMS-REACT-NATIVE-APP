import React, { useState } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    KeyboardAvoidingView, Platform, ScrollView, Dimensions 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminAPI } from '../../utils/api';
import PasswordInput from '../../components/PasswordInput';
import { SafeAreaView } from 'react-native-safe-area-context';

const CentralAdminSignup = () => {
    const navigation = useNavigation();
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', confirmPassword: '', phone: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
        setError('');
    };

    const handleSubmit = async () => {
        setError('');
        setLoading(true);

        if (!formData.name || !formData.email || !formData.password) {
            setError('Please fill in all required fields');
            setLoading(false);
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters long');
            setLoading(false);
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const response = await adminAPI.signup(formData.name, formData.email, formData.password, formData.phone);
            if (response.success) {
                await AsyncStorage.setItem('token', response.token);
                await AsyncStorage.setItem('user', JSON.stringify(response.user));
                navigation.navigate('SupremeAdmin');
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
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.authCard}>
                        
                        {/* Left Side: Form */}
                        <View style={styles.authFormContainer}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Text style={styles.backButtonIcon}>←</Text>
                                <Text style={styles.backButtonText}>Go Back</Text>
                            </TouchableOpacity>

                            <View style={styles.authHeader}>
                                <Text style={styles.headerTitle}>🏛️ Create Central Admin Account</Text>
                                <Text style={styles.headerSubtitle}>Set up the top-level administration account</Text>
                            </View>

                            {error ? (
                                <View style={styles.errorMessage}>
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            <View style={styles.authForm}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Full Name *</Text>
                                    <View style={styles.inputWrapper}>
                                        <TextInput 
                                            style={styles.input}
                                            value={formData.name} 
                                            onChangeText={(t) => handleChange('name', t)} 
                                            placeholder="Enter your full name" 
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Email Address *</Text>
                                    <View style={styles.inputWrapper}>
                                        <TextInput 
                                            style={styles.input}
                                            value={formData.email} 
                                            onChangeText={(t) => handleChange('email', t)} 
                                            placeholder="Enter your email" 
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                        />
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Phone Number</Text>
                                    <View style={styles.inputWrapper}>
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
                                        />
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Password *</Text>
                                    <View style={styles.inputWrapper}>
                                        <PasswordInput 
                                            value={formData.password} 
                                            onChangeText={(t) => handleChange('password', t)} 
                                            placeholder="Enter your password"  
                                            style={styles.passwordInputCustom}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Confirm Password *</Text>
                                    <View style={styles.inputWrapper}>
                                        <PasswordInput 
                                            value={formData.confirmPassword} 
                                            onChangeText={(t) => handleChange('confirmPassword', t)} 
                                            placeholder="Confirm your password" 
                                            style={styles.passwordInputCustom}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    style={[styles.btnPrimary, styles.btnBlock]} 
                                    onPress={handleSubmit} 
                                    disabled={loading}
                                >
                                    <Text style={styles.btnPrimaryText}>
                                        {loading ? 'Creating Account...' : 'Sign Up'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.authFooter}>
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

                        {/* Right Side: Visual */}
                        <View style={styles.authVisual}>
                            <View style={styles.authContent}>
                                <Text style={styles.visualTitle}>Supreme Portal</Text>
                                <Text style={styles.visualSubtitle}>Join the administration platform to manage hospitals globally.</Text>
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
        padding: 20,
    },
    authCard: {
        width: '100%',
        maxWidth: 1100,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 24,
        flexDirection: 'row',
        overflow: 'hidden',
        minHeight: 650,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1,
    },
    authFormContainer: {
        flex: 1.2,
        padding: 40,
        justifyContent: 'center',
        backgroundColor: 'white',
    },
    authVisual: {
        flex: 1,
        backgroundColor: '#0d9488', // Fallback color since gradient requires Expo
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        display: Dimensions.get('window').width < 900 ? 'none' : 'flex',
    },
    authContent: {
        maxWidth: 380,
        zIndex: 2,
    },
    visualTitle: {
        color: '#fff',
        fontSize: 40,
        fontWeight: 'bold',
        marginBottom: 15,
        lineHeight: 48,
    },
    visualSubtitle: {
        color: '#ccfbf1',
        fontSize: 18,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    backButtonIcon: {
        fontSize: 16,
        marginRight: 6,
        color: '#64748b',
    },
    backButtonText: {
        fontSize: 15,
        color: '#64748b',
        fontWeight: '600',
    },
    authHeader: {
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#64748b',
    },
    errorMessage: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        borderLeftWidth: 3,
        borderLeftColor: '#ef4444',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        fontWeight: '500',
    },
    authForm: {
        flexDirection: 'column',
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 6,
    },
    inputWrapper: {
        position: 'relative',
    },
    input: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        fontSize: 15,
        color: '#1e293b',
    },
    passwordInputCustom: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        fontSize: 15,
        color: '#1e293b',
    },
    btnPrimary: {
        backgroundColor: '#0f766e', // Solid fallback for --brand-teal/--brand-pink since RN needs LinearGradient component
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 50,
        alignItems: 'center',
        shadowColor: '#0f766e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        marginTop: 10,
    },
    btnBlock: {
        width: '100%',
        marginTop: 15,
    },
    btnPrimaryText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    authFooter: {
        marginTop: 24,
        alignItems: 'center',
    },
    switchText: {
        color: '#64748b',
        fontSize: 14,
    },
    switchLink: {
        color: '#0f766e',
        fontWeight: '700',
    }
});

export default CentralAdminSignup;
