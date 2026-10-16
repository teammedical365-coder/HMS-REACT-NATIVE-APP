import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { publicAPI } from '../../utils/api';
import { useBranding } from '../../context/BrandingContext';

export default function WorkspaceLoginScreen({ navigation }) {
    const [workspaceCode, setWorkspaceCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [storedSlug, setStoredSlug] = useState(null);
    const { loadBrandingBySlug } = useBranding();

    useEffect(() => {
        let isMounted = true;
        AsyncStorage.getItem('tenantSlug').then((saved) => {
            if (isMounted && saved && saved.trim()) {
                setStoredSlug(saved.trim());
            }
        }).catch(() => {});
        return () => { isMounted = false; };
    }, []);

    const handleValidateAndProceed = async (targetCode) => {
        const rawCode = (targetCode || workspaceCode || '').trim();
        if (!rawCode) {
            setError('Please enter your hospital code or workspace domain.');
            return;
        }

        setError('');
        setLoading(true);

        const cleanCode = rawCode.toLowerCase();

        // Direct Central Admin detection: 'admin' is a platform-reserved subdomain (web Mainroutes.jsx)
        // and maps directly to the Central Admin portal.
        if (cleanCode === 'admin' || cleanCode === 'admin.medical365.in') {
            navigation.navigate('CentralAdminLogin');
            setLoading(false);
            return;
        }

        try {
            const data = await publicAPI.getTenantConfig(cleanCode);

            if (data && data.success && data.tenant) {
                const tenant = data.tenant;

                // Central Admin workspace detection
                if (tenant.isCentralAdmin || tenant.slug === 'admin') {
                    navigation.navigate('CentralAdminLogin');
                    return;
                }

                // Legitimate Hospital Tenant validation confirmed
                const confirmedSlug = tenant.slug || cleanCode;
                await AsyncStorage.setItem('tenantSlug', confirmedSlug);
                await AsyncStorage.setItem('tenant', JSON.stringify(tenant));
                if (tenant.id) {
                    await AsyncStorage.setItem('hospitalId', String(tenant.id));
                }

                if (loadBrandingBySlug) {
                    try {
                        await loadBrandingBySlug(confirmedSlug);
                    } catch (bErr) {
                        console.warn('[WorkspaceLogin] Branding load non-fatal error:', bErr);
                    }
                }

                // Proceed to secure hospital staff/user login with resolved tenant context
                navigation.navigate('Login', { slug: confirmedSlug, tenant });
            } else {
                setError(`Hospital workspace "${cleanCode}" could not be verified.`);
            }
        } catch (err) {
            console.error('[WorkspaceLogin] Tenant validation error:', err);
            if (err.response?.status === 404) {
                setError(`Hospital workspace "${cleanCode}" was not found. Please verify the code with your hospital administrator.`);
            } else if (err.response?.data?.message) {
                setError(err.response.data.message);
            } else {
                setError('Unable to reach the hospital server. Please check your network connection.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>MEDICAL 365 WORKSPACE</Text>
                    </View>

                    <Text style={styles.title}>Hospital Workspace</Text>
                    <Text style={styles.subtitle}>
                        Enter your hospital slug or organization domain to connect to your facility's portal.
                    </Text>

                    {storedSlug ? (
                        <View style={styles.savedTenantBox}>
                            <Text style={styles.savedTenantLabel}>Previously connected:</Text>
                            <TouchableOpacity
                                style={styles.savedTenantButton}
                                onPress={() => {
                                    setWorkspaceCode(storedSlug);
                                    handleValidateAndProceed(storedSlug);
                                }}
                                disabled={loading}
                            >
                                <Text style={styles.savedTenantText}>{storedSlug}</Text>
                                <Text style={styles.savedTenantAction}>Connect →</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Hospital Code / Domain</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. metropolis, stmarys, or hospital.domain.com"
                            placeholderTextColor="#94a3b8"
                            value={workspaceCode}
                            onChangeText={(val) => {
                                setWorkspaceCode(val);
                                setError('');
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={() => handleValidateAndProceed()}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={styles.buttonText}>Verify & Continue</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                        style={styles.centralAdminLink}
                        onPress={() => navigation.navigate('CentralAdminLogin')}
                        disabled={loading}
                    >
                        <Text style={styles.centralAdminText}>
                            Are you a Central Administrator?{' '}
                            <Text style={styles.centralAdminHighlight}>Central Console Login</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
        elevation: 8,
    },
    badgeContainer: {
        alignSelf: 'flex-start',
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 16,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#16a34a',
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        marginBottom: 24,
    },
    savedTenantBox: {
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 12,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    savedTenantLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 6,
    },
    savedTenantButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    savedTenantText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    savedTenantAction: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0284c7',
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
        padding: 12,
        borderRadius: 8,
        marginBottom: 18,
    },
    errorText: {
        color: '#b91c1c',
        fontSize: 13,
        lineHeight: 18,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 10,
        fontSize: 15,
        color: '#0f172a',
    },
    button: {
        backgroundColor: '#0284c7',
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        marginHorizontal: 12,
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    centralAdminLink: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    centralAdminText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
    },
    centralAdminHighlight: {
        color: '#0284c7',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});