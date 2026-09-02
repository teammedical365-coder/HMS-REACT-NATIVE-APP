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
import { signupUser, clearError } from '../../store/slices/authSlice';

const SignupScreen = ({ navigation }) => {
    const dispatch = useAppDispatch();
    const { loading, error } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (error) {
            Toast.show({
                type: 'error',
                text1: 'Signup Failed',
                text2: String(error),
            });
            dispatch(clearError());
        }
    }, [error, dispatch]);

    const handleSignup = async () => {
        if (!name || !email || !password) {
            Toast.show({ type: 'error', text1: 'Please fill all required fields' });
            return;
        }
        if (password.length < 6) {
            Toast.show({ type: 'error', text1: 'Password must be at least 6 characters' });
            return;
        }
        dispatch(signupUser({ name, email, password, phone }));
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join Medical 365</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your full name"
                            placeholderTextColor="#cbd5e1"
                            value={name}
                            onChangeText={setName}
                            editable={!loading}
                        />
                    </View>

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
                        <Text style={styles.label}>Phone (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your phone number"
                            placeholderTextColor="#cbd5e1"
                            value={phone}
                            onChangeText={setPhone}
                            editable={!loading}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordInputContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="At least 6 characters"
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

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSignup}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign Up</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.footerLink}>Log in</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: 24, paddingHorizontal: 16 },
    header: { marginBottom: 32 },
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

export default SignupScreen;