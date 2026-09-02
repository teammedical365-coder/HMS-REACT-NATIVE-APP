import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, clearError } from '../../store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/Constants';

const LoginScreen = ({ navigation }) => {
    const dispatch = useAppDispatch();
    const { loading, error, otpStep, preAuthToken, sessionExpiredMessage } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [hospitalSlug, setHospitalSlug] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Check for session expired message
    useEffect(() => {
        const checkSessionMessage = async () => {
            const message = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_EXPIRED_MESSAGE);
            if (message) {
                Toast.show({
                    type: 'error',
                    text1: 'Session Expired',
                    text2: message,
                });
                await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRED_MESSAGE);
            }
        };
        checkSessionMessage();
    }, []);

    // Show errors
    useEffect(() => {
        if (error) {
            Toast.show({
                type: 'error',
                text1: 'Login Failed',
                text2: String(error),
            });
            dispatch(clearError());
        }
    }, [error, dispatch]);

    const handleLogin = async () => {
        if (!email || !password) {
            Toast.show({ type: 'error', text1: 'Please fill all fields' });
            return;
        }
        dispatch(sendOtp({ email, password, hospitalSlug, loginType: 'email' }));
    };

    // After OTP step is reached, navigate to OTP verification
    useEffect(() => {
        if (otpStep === 'otp' && preAuthToken) {
            navigation.navigate('OTPVerification', { preAuthToken });
        }
    }, [otpStep, preAuthToken, navigation]);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>Medical 365</Text>
                    <Text style={styles.subtitle}>Staff Login</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#cbd5e1"
                            value={email}
                            onChangeText={setEmail}
                            editable={!loading}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordInputContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Enter your password"
                                placeholderTextColor="#cbd5e1"
                                value={password}
                                onChangeText={setPassword}
                                editable={!loading}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Text style={styles.togglePassword}>{showPassword ? 'Hide' : 'Show'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Hospital Slug (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., city-hospital"
                            placeholderTextColor="#cbd5e1"
                            value={hospitalSlug}
                            onChangeText={setHospitalSlug}
                            editable={!loading}
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={styles.buttonText}>Continue</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                        <Text style={styles.footerLink}>Sign up</Text>
                    </TouchableOpacity>
                </View>
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
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        paddingRight: 12,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1e293b',
    },
    togglePassword: { fontSize: 13, color: '#14b8a6', fontWeight: '600' },
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
    footer: { flexDirection: 'row', justifyContent: 'center' },
    footerText: { fontSize: 13, color: '#64748b' },
    footerLink: { fontSize: 13, color: '#14b8a6', fontWeight: '600' },
});

export default LoginScreen;