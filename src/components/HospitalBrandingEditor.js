import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, Image
} from 'react-native';
import { hospitalAPI } from '../utils/api';
import { useBranding } from '../context/BrandingContext';

/* ── Color swatch picker ─────────────────────────────────── */
const ColorField = ({ label, name, value, onChange }) => (
    <View style={styles.colorField}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: value || '#14b8a6' }]} />
            <TextInput
                style={styles.hexInput}
                value={value || ''}
                onChangeText={text => onChange(name, text)}
                placeholder="#hex"
                placeholderTextColor="#94a3b8"
                maxLength={7}
            />
        </View>
    </View>
);

/* ── Text field ──────────────────────────────────────────── */
const TextField = ({ label, name, value, onChange, placeholder, type = 'text', hint, multiline = false }) => (
    <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
        <TextInput
            style={[styles.input, multiline && styles.inputMultiline]}
            value={value || ''}
            onChangeText={text => onChange(name, text)}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            keyboardType={type === 'email' ? 'email-address' : type === 'url' ? 'url' : 'default'}
            autoCapitalize="none"
            multiline={multiline}
        />
    </View>
);

/* ── Main Component ──────────────────────────────────────── */
const HospitalBrandingEditor = ({ hospital, onClose }) => {
    const { loadBranding } = useBranding();

    const [tab, setTab] = useState('identity');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [previewing, setPreviewing] = useState(false);

    const [form, setForm] = useState({
        appName: '', tagline: '', logoUrl: '', faviconUrl: '',
        primaryColor: '#14b8a6', secondaryColor: '#0a2647', accentColor: '#6366f1',
        successColor: '#10b981', backgroundColor: '#f8fafc', textColor: '#1e293b',
        supportEmail: '', supportPhone: '', address: '',
        websiteUrl: '', instagramUrl: '', facebookUrl: '', twitterUrl: '',
        footerText: '',
    });

    // Load existing branding on mount
    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await hospitalAPI.getBranding(hospital._id);
                if (res.success && res.branding) {
                    setForm(prev => ({ ...prev, ...res.branding }));
                }
            } catch (e) { /* branding may not exist yet */ }
            finally { setLoading(false); }
        };
        fetch();
    }, [hospital._id]);

    const handleChange = useCallback((name, value) => {
        setForm(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSave = async () => {
        setSaving(true); setError(''); setSuccess('');
        try {
            const res = await hospitalAPI.updateBranding(hospital._id, form);
            if (res.success) {
                setSuccess('✅ Branding saved successfully!');
                if (previewing) {
                    await loadBranding(hospital._id);
                }
                setTimeout(() => setSuccess(''), 4000);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save branding.');
        } finally { setSaving(false); }
    };

    const handlePreview = async () => {
        setSaving(true);
        try {
            const res = await hospitalAPI.updateBranding(hospital._id, form);
            if (res.success) {
                await loadBranding(hospital._id);
                setPreviewing(true);
                setSuccess('🎨 Preview applied! The app now shows this hospital\'s theme.');
                setTimeout(() => setSuccess(''), 5000);
            }
        } catch (e) { setError('Preview failed.'); }
        finally { setSaving(false); }
    };

    const handleReset = () => {
        setForm({
            appName: hospital.name || '', tagline: '',
            logoUrl: hospital.logo || '', faviconUrl: '',
            primaryColor: '#14b8a6', secondaryColor: '#0a2647', accentColor: '#6366f1',
            successColor: '#10b981', backgroundColor: '#f8fafc', textColor: '#1e293b',
            supportEmail: hospital.email || '', supportPhone: hospital.phone || '',
            address: hospital.address || '', websiteUrl: hospital.website || '',
            instagramUrl: '', facebookUrl: '', twitterUrl: '',
            footerText: `© ${new Date().getFullYear()} ${hospital.name}. All rights reserved.`,
        });
    };

    const tabs = [
        { id: 'identity', label: '🏷️ Identity' },
        { id: 'colors', label: '🎨 Colors' },
        { id: 'contact', label: '📞 Contact' },
        { id: 'social', label: '🌐 Social' },
    ];

    const presets = [
        { name: 'Ocean Teal (Default)', p: '#14b8a6', s: '#0a2647', a: '#6366f1', bg: '#f8fafc', t: '#1e293b' },
        { name: 'Crimson Medical', p: '#e11d48', s: '#1e1b4b', a: '#7c3aed', bg: '#fff1f2', t: '#1e293b' },
        { name: 'Forest Green', p: '#16a34a', s: '#14532d', a: '#0ea5e9', bg: '#f0fdf4', t: '#1e293b' },
        { name: 'Royal Purple', p: '#7c3aed', s: '#1e1b4b', a: '#e11d48', bg: '#faf5ff', t: '#1e293b' },
        { name: 'Sunrise Orange', p: '#ea580c', s: '#092032', a: '#eab308', bg: '#fff7ed', t: '#1e293b' },
        { name: 'Sky Blue', p: '#0284c7', s: '#0c4a6e', a: '#10b981', bg: '#f0f9ff', t: '#1e293b' },
    ];

    return (
        <View style={styles.overlay}>
            <View style={styles.modal}>
                
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={styles.headerInfo}>
                        <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>WHITE LABEL</Text></View>
                        <Text style={styles.title}>Branding Studio</Text>
                        <Text style={styles.subtitle}>
                            Configuring: <Text style={styles.subtitleBold}>{hospital.name}</Text>
                            {hospital.city && ` · ${hospital.city}`}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Preview Banner ── */}
                {previewing && (
                    <View style={styles.previewBanner}>
                        <Text style={styles.previewBannerText}>🎨 You're previewing {hospital.name}'s theme</Text>
                    </View>
                )}

                {/* ── Status Messages ── */}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {success ? <Text style={styles.successText}>{success}</Text> : null}

                {/* ── Tabs ── */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsContent}>
                    {tabs.map(t => (
                        <TouchableOpacity
                            key={t.id}
                            style={[styles.tab, tab === t.id && styles.tabActive]}
                            onPress={() => setTab(t.id)}
                        >
                            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#14b8a6" />
                        <Text style={styles.loadingText}>Loading current branding…</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

                        {/* ── IDENTITY TAB ── */}
                        {tab === 'identity' && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>🏥 Identity & App Name</Text>
                                <TextField label="App / Suite Name" name="appName" value={form.appName} onChange={handleChange} placeholder={`${hospital.name} HMS`} hint="Shows in navbar" />
                                <TextField label="Tagline" name="tagline" value={form.tagline} onChange={handleChange} placeholder="Caring for every life" hint="Shows below the logo" />
                                <TextField label="Logo URL" name="logoUrl" value={form.logoUrl} onChange={handleChange} placeholder="https://cdn.hospital.com/logo.png" hint="Direct image URL" />
                                
                                {form.logoUrl ? (
                                    <View style={styles.logoPreviewContainer}>
                                        <Text style={styles.previewLabel}>Logo Preview</Text>
                                        <View style={styles.logoBox}>
                                            <Image source={{ uri: form.logoUrl }} style={styles.logoImage} resizeMode="contain" />
                                        </View>
                                    </View>
                                ) : null}

                                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🪪 Footer Text</Text>
                                <TextField label="Footer Copyright Text" name="footerText" value={form.footerText} onChange={handleChange} placeholder={`© ${new Date().getFullYear()} ${hospital.name}. All rights reserved.`} />
                            </View>
                        )}

                        {/* ── COLORS TAB ── */}
                        {tab === 'colors' && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>🎨 Color Theme</Text>
                                <Text style={styles.sectionDesc}>
                                    These colors control the entire app's appearance for this hospital's staff.
                                </Text>

                                {/* Live theme preview */}
                                <View style={[styles.colorPreviewCard, { backgroundColor: form.backgroundColor }]}>
                                    <View style={[styles.cpHeader, { backgroundColor: form.primaryColor }]}>
                                        <Text style={styles.cpBrand}>{form.appName || hospital.name}</Text>
                                    </View>
                                    <View style={styles.cpBody}>
                                        <View style={styles.cpCard}>
                                            <Text style={[styles.cpStat, { color: form.primaryColor }]}>128</Text>
                                            <Text style={[styles.cpStatDesc, { color: form.textColor }]}>Patients</Text>
                                        </View>
                                        <View style={styles.cpBtns}>
                                            <View style={[styles.cpBtnPrimary, { backgroundColor: form.primaryColor }]}>
                                                <Text style={styles.cpBtnText}>Book Appt</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.colorGrid}>
                                    <ColorField label="Primary Color" name="primaryColor" value={form.primaryColor} onChange={handleChange} />
                                    <ColorField label="Secondary / Dark" name="secondaryColor" value={form.secondaryColor} onChange={handleChange} />
                                    <ColorField label="Accent" name="accentColor" value={form.accentColor} onChange={handleChange} />
                                    <ColorField label="Success" name="successColor" value={form.successColor} onChange={handleChange} />
                                    <ColorField label="Background" name="backgroundColor" value={form.backgroundColor} onChange={handleChange} />
                                    <ColorField label="Text Color" name="textColor" value={form.textColor} onChange={handleChange} />
                                </View>

                                {/* Preset themes */}
                                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>⚡ Quick Presets</Text>
                                <View style={styles.presetsContainer}>
                                    {presets.map(preset => (
                                        <TouchableOpacity
                                            key={preset.name}
                                            style={styles.presetBtn}
                                            onPress={() => setForm(prev => ({ ...prev, primaryColor: preset.p, secondaryColor: preset.s, accentColor: preset.a, backgroundColor: preset.bg, textColor: preset.t }))}
                                        >
                                            <View style={styles.presetSwatches}>
                                                <View style={[styles.swatch, { backgroundColor: preset.p }]} />
                                                <View style={[styles.swatch, { backgroundColor: preset.s }]} />
                                                <View style={[styles.swatch, { backgroundColor: preset.a }]} />
                                            </View>
                                            <Text style={styles.presetName}>{preset.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* ── CONTACT TAB ── */}
                        {tab === 'contact' && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>📞 Contact Information</Text>
                                <Text style={styles.sectionDesc}>Shown throughout the app — on login pages, receipts, etc.</Text>
                                <TextField label="Support Email" name="supportEmail" value={form.supportEmail} onChange={handleChange} placeholder="support@hospital.com" type="email" />
                                <TextField label="Support Phone" name="supportPhone" value={form.supportPhone} onChange={handleChange} placeholder="+91 98765 43210" />
                                <TextField label="Full Address" name="address" value={form.address} onChange={handleChange} placeholder="123, Main Street, Mumbai" multiline={true} />
                                <TextField label="Hospital Website" name="websiteUrl" value={form.websiteUrl} onChange={handleChange} placeholder="https://www.hospital.com" type="url" />
                            </View>
                        )}

                        {/* ── SOCIAL TAB ── */}
                        {tab === 'social' && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>🌐 Social Media Links</Text>
                                <Text style={styles.sectionDesc}>Optional links shown in patient-facing portals.</Text>
                                <TextField label="Instagram" name="instagramUrl" value={form.instagramUrl} onChange={handleChange} placeholder="https://instagram.com/hospital" />
                                <TextField label="Facebook" name="facebookUrl" value={form.facebookUrl} onChange={handleChange} placeholder="https://facebook.com/hospital" />
                                <TextField label="Twitter / X" name="twitterUrl" value={form.twitterUrl} onChange={handleChange} placeholder="https://twitter.com/hospital" />
                            </View>
                        )}
                    </ScrollView>
                )}

                {/* ── Footer Actions ── */}
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.btnGhost} onPress={handleReset}>
                        <Text style={styles.btnGhostText}>↺ Reset</Text>
                    </TouchableOpacity>
                    <View style={styles.footerRight}>
                        <TouchableOpacity style={styles.btnPreview} onPress={handlePreview} disabled={saving}>
                            <Text style={styles.btnPreviewText}>{saving ? '⏳ Saving…' : '👁 Preview'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
                            <Text style={styles.btnSaveText}>{saving ? '⏳ Saving…' : '💾 Save'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#f8fafc', // Adjusted for React Native typical full screen usage
    },
    modal: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerInfo: {
        flex: 1,
    },
    headerBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    headerBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    subtitleBold: {
        fontWeight: '700',
        color: '#0f172a',
    },
    closeBtn: {
        width: 32,
        height: 32,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: 'bold',
    },
    previewBanner: {
        backgroundColor: '#fef3c7',
        padding: 12,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#fde68a',
    },
    previewBannerText: {
        color: '#b45309',
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        color: '#ef4444',
        padding: 12,
        backgroundColor: '#fee2e2',
        textAlign: 'center',
    },
    successText: {
        color: '#10b981',
        padding: 12,
        backgroundColor: '#d1fae5',
        textAlign: 'center',
    },
    tabsContainer: {
        maxHeight: 50,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tabsContent: {
        paddingHorizontal: 16,
        alignItems: 'flex-end', // Aligns tabs to bottom of container
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 8,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#14b8a6',
    },
    tabText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#14b8a6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#64748b',
        fontSize: 14,
    },
    body: {
        flex: 1,
    },
    bodyContent: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
    },
    sectionDesc: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 16,
        lineHeight: 20,
    },
    field: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
    },
    fieldHint: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    inputMultiline: {
        height: 80,
        textAlignVertical: 'top',
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    colorField: {
        width: '48%',
        marginBottom: 16,
    },
    colorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        padding: 6,
    },
    colorSwatch: {
        width: 28,
        height: 28,
        borderRadius: 6,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    hexInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        padding: 0, // override default padding
    },
    logoPreviewContainer: {
        marginTop: 12,
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    previewLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 8,
        fontWeight: '600',
    },
    logoBox: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    colorPreviewCard: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
    },
    cpHeader: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cpBrand: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    cpBody: {
        padding: 16,
    },
    cpCard: {
        backgroundColor: 'rgba(255,255,255,0.8)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    cpStat: {
        fontSize: 24,
        fontWeight: '800',
    },
    cpStatDesc: {
        fontSize: 12,
        opacity: 0.8,
    },
    cpBtns: {
        flexDirection: 'row',
    },
    cpBtnPrimary: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    cpBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    presetsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    presetBtn: {
        width: '47%',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    presetSwatches: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    swatch: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginHorizontal: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    presetName: {
        fontSize: 12,
        color: '#334155',
        fontWeight: '600',
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    btnGhost: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    btnGhostText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    footerRight: {
        flexDirection: 'row',
        gap: 12,
    },
    btnPreview: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    btnPreviewText: {
        color: '#334155',
        fontSize: 14,
        fontWeight: '600',
    },
    btnSave: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#14b8a6',
        borderRadius: 8,
    },
    btnSaveText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default HospitalBrandingEditor;
