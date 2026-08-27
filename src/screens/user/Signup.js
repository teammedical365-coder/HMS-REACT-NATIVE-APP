import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useAuth } from '../../store/hooks';
import { signupUser, clearError } from '../../store/slices/authSlice';
import PasswordInput from '../../components/PasswordInput';

const Signup = () => {
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const { loading, error, isAuthenticated } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: ''
    });

    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (isAuthenticated) navigation.replace('Dashboard');
    }, [isAuthenticated, navigation]);

    useEffect(() => {
        dispatch(clearError());
    }, [dispatch]);

    const handleChange = (name, value) => {
        if (name === 'phone') {
            const clean = value.replace(/\D/g, '').slice(0, 10);
            setFormData({ ...formData, phone: clean });
        } else {
            setFormData({ ...formData, [name]: value });
        }
        dispatch(clearError());
        setLocalError('');
    };

    const handleSubmit = async () => {
        dispatch(clearError());
        setLocalError('');

        if (formData.password !== formData.confirmPassword) {
            setLocalError('Passwords do not match.');
            return;
        }

        if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
            setLocalError('Mobile number must be exactly 10 digits.');
            return;
        }

        await dispatch(signupUser({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone
        }));
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>

                    <Text style={styles.title}>Start Your Journey</Text>
                    <Text style={styles.subtitle}>Create an account to book and track appointments.</Text>

                    {(error || localError) ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{localError || error}</Text>
                        </View>
                    ) : null}

                    <View style={styles.formContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.icon}>👤</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. John Doe"
                                    placeholderTextColor="#94a3b8"
                                    value={formData.name}
                                    onChangeText={(val) => handleChange('name', val)}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.icon}>✉️</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. name@example.com"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={formData.email}
                                    onChangeText={(val) => handleChange('email', val)}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.icon}>📞</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Your contact number"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                    maxLength={10}
                                    value={formData.phone}
                                    onChangeText={(val) => handleChange('phone', val)}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Create Password</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.icon}>🔒</Text>
                                <View style={styles.passwordWrapper}>
                                    <PasswordInput
                                        placeholder="Min 6 characters"
                                        value={formData.password}
                                        onChangeText={(val) => handleChange('password', val)}
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.icon}>🛡️</Text>
                                <View style={styles.passwordWrapper}>
                                    <PasswordInput
                                        placeholder="Repeat your password"
                                        value={formData.confirmPassword}
                                        onChangeText={(val) => handleChange('confirmPassword', val)}
                                    />
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Account</Text>}
                        </TouchableOpacity>

                        <View style={styles.switchContainer}>
                            <Text style={styles.switchText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text style={styles.switchLink}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 40 },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)'
    },
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 5 },
    subtitle: { fontSize: 14, color: '#666', marginBottom: 30 },
    errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#ef4444', marginBottom: 20 },
    errorText: { color: '#ef4444', fontSize: 14 },
    formContainer: { gap: 16 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
    inputWrapper: { position: 'relative', justifyContent: 'center' },
    icon: { position: 'absolute', left: 14, fontSize: 16, zIndex: 1, color: '#94a3b8' },
    input: {
        width: '100%',
        paddingVertical: 12,
        paddingRight: 16,
        paddingLeft: 42,
        backgroundColor: '#f8fafc',
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        fontSize: 15,
        color: '#1e293b'
    },
    passwordWrapper: { paddingLeft: 30 },
    btnPrimary: {
        backgroundColor: '#a855f7', // Using one of the gradient colors
        paddingVertical: 14,
        borderRadius: 50,
        alignItems: 'center',
        marginTop: 15,
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4
    },
    btnPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    switchContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    switchText: { color: '#666', fontSize: 14 },
    switchLink: { color: '#d91a8a', fontWeight: '700', textDecorationLine: 'underline', fontSize: 14 }
});

export default Signup;
