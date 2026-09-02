import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Image, Animated, Easing, Dimensions, Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

const { width } = Dimensions.get('window');

const HospitalAdminHUDForm = ({
    hospitalAdminForm,
    setHospitalAdminForm,
    handleCreateHospitalAdmin,
    creatingHospitalAdmin,
    hospitals = []
}) => {
    const [selectedFileName, setSelectedFileName] = useState(hospitalAdminForm?.file?.name || '');
    const [latency, setLatency] = useState(12);

    // Live Telemetry Cycling
    useEffect(() => {
        const interval = setInterval(() => {
            setLatency(Math.floor(10 + Math.random() * 5));
        }, 2800);
        return () => clearInterval(interval);
    }, []);

    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, [pulseAnim]);


    const handleFileChange = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            setSelectedFileName(file.name);
            setHospitalAdminForm(prev => ({ ...prev, file }));
        } catch (err) {
            console.log('Document picking error', err);
        }
    };

    const sortedHospitals = [...hospitals].sort((a, b) =>
        (a.name || '').trim().toLowerCase().localeCompare((b.name || '').trim().toLowerCase())
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.unifiedCard}>
                
                {/* Visual Header / Cyber Dashboard */}
                <View style={styles.visualColumn}>
                    <View style={styles.hubImageContainer}>
                        {/* Placeholder for Smart Hospital Hub Image */}
                        <View style={styles.hubImgPlaceholder}>
                            <Ionicons name="business" size={60} color="rgba(0, 240, 255, 0.4)" />
                            
                            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
                            <Animated.View style={[styles.pulseCircle, { width: 60, height: 60, borderRadius: 30, transform: [{ scale: pulseAnim }] }]} />
                            
                            {/* Floating Badges */}
                            <View style={[styles.hubBadge, styles.badgeTop]}>
                                <View style={styles.hbadgeDot} />
                                <Text style={styles.badgeText}>COMMAND DECK • ONLINE</Text>
                            </View>
                            <View style={[styles.hubBadge, styles.badgeBottom]}>
                                <View style={[styles.hbadgeDot, styles.pulseEmerald]} />
                                <Text style={styles.badgeText}>AI CORE • {latency}ms</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.minimalPoints}>
                        <View style={styles.mPoint}>
                            <Text style={styles.mIcon}>✓</Text>
                            <Text style={styles.mText}>Manage OPD, IPD, Beds, Appointments & Doctors</Text>
                        </View>
                        <View style={styles.mPoint}>
                            <Text style={styles.mIcon}>✓</Text>
                            <Text style={styles.mText}>Access Pharmacy, Labs, Billing & Receptionists</Text>
                        </View>
                        <View style={styles.mPoint}>
                            <Text style={styles.mIcon}>✓</Text>
                            <Text style={styles.mText}>White-Label Domain & Custom Branding Controls</Text>
                        </View>
                    </View>
                </View>

                {/* Form Section */}
                <View style={styles.formColumn}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconBox}>
                            <Ionicons name="shield-checkmark" size={28} color="#0099a8" />
                        </View>
                        <View style={styles.titleCol}>
                            <View style={styles.titleRow}>
                                <Text style={styles.titleText}>Create Hospital Admin</Text>
                                <View style={styles.hadBadge}>
                                    <View style={styles.hadBadgeDot} />
                                    <Text style={styles.hadBadgeText}>ADMIN ACCESS</Text>
                                </View>
                            </View>
                            <Text style={styles.subtitleText}>
                                This administrator will login at <Text style={{fontWeight: 'bold'}}>/login</Text> and manage all hospital operations.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.formGrid}>
                        {/* FULL NAME */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>FULL NAME <Text style={styles.req}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="person-outline" size={18} color="#64748b" style={styles.fIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Dr. Ramesh Kumar"
                                    placeholderTextColor="#94a3b8"
                                    value={hospitalAdminForm.name}
                                    onChangeText={text => setHospitalAdminForm({ ...hospitalAdminForm, name: text })}
                                />
                            </View>
                        </View>

                        {/* EMAIL */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>EMAIL <Text style={styles.req}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.fIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="admin@hospital.com"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={hospitalAdminForm.email}
                                    onChangeText={text => setHospitalAdminForm({ ...hospitalAdminForm, email: text })}
                                />
                            </View>
                        </View>

                        {/* PASSWORD */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>PASSWORD <Text style={styles.req}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.fIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Temporary password"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={false}
                                    value={hospitalAdminForm.password}
                                    onChangeText={text => setHospitalAdminForm({ ...hospitalAdminForm, password: text })}
                                />
                            </View>
                        </View>

                        {/* PHONE */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>PHONE <Text style={styles.req}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="call-outline" size={18} color="#64748b" style={styles.fIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="10-digit phone number"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    value={hospitalAdminForm.phone}
                                    onChangeText={text => {
                                        const cleanVal = text.replace(/\D/g, '').slice(0, 10);
                                        setHospitalAdminForm({ ...hospitalAdminForm, phone: cleanVal });
                                    }}
                                />
                            </View>
                        </View>

                        {/* AGE */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>AGE <Text style={styles.req}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="calendar-outline" size={18} color="#64748b" style={styles.fIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Age"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                    maxLength={3}
                                    value={hospitalAdminForm.age ? String(hospitalAdminForm.age) : ''}
                                    onChangeText={text => {
                                        const cleanVal = text.replace(/\D/g, '').slice(0, 3);
                                        setHospitalAdminForm({ ...hospitalAdminForm, age: cleanVal });
                                    }}
                                />
                            </View>
                        </View>

                        {/* AADHAAR NUMBER */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>AADHAAR NUMBER <Text style={styles.req}>*</Text></Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="card-outline" size={18} color="#64748b" style={styles.fIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="12-digit Aadhaar"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                    maxLength={12}
                                    value={hospitalAdminForm.aadhaarNumber ? String(hospitalAdminForm.aadhaarNumber) : ''}
                                    onChangeText={text => {
                                        const cleanVal = text.replace(/\D/g, '').slice(0, 12);
                                        setHospitalAdminForm({ ...hospitalAdminForm, aadhaarNumber: cleanVal });
                                    }}
                                />
                            </View>
                        </View>
                    </View>

                    {/* BOTTOM ROW: PROFILE PHOTO & ASSIGN HOSPITAL */}
                    <View style={styles.bottomGrid}>
                        {/* PROFILE PHOTO SCANNER */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>PROFILE PHOTO</Text>
                            <TouchableOpacity style={styles.photoPicker} onPress={handleFileChange} activeOpacity={0.8}>
                                <View style={styles.photoShutter}>
                                    <Ionicons name="camera-outline" size={20} color="#0099a8" />
                                </View>
                                <View style={styles.photoMeta}>
                                    <Text style={styles.photoMetaStrong} numberOfLines={1}>
                                        {selectedFileName || 'Scan / Upload Photo'}
                                    </Text>
                                    <Text style={styles.photoMetaSpan}>
                                        {selectedFileName ? 'Photo attached' : 'Tap to select image file'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* ASSIGN HOSPITAL */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>ASSIGN HOSPITAL <Text style={styles.req}>*</Text></Text>
                            <View style={styles.pickerContainer}>
                                <Ionicons name="business-outline" size={18} color="#64748b" style={styles.fIconPicker} />
                                <Picker
                                    selectedValue={hospitalAdminForm.hospitalId || ''}
                                    onValueChange={(itemValue) => setHospitalAdminForm({ ...hospitalAdminForm, hospitalId: itemValue })}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="-- Select Hospital --" value="" color="#94a3b8" />
                                    {sortedHospitals.map(h => (
                                        <Picker.Item 
                                            key={h._id} 
                                            label={`${h.name}${h.city ? ` — ${h.city}` : ''}`} 
                                            value={h._id} 
                                        />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    </View>

                    {/* HIGH ENERGY SUBMIT BUTTON */}
                    <TouchableOpacity 
                        style={[styles.submitBtn, creatingHospitalAdmin && styles.submitBtnDisabled]}
                        onPress={handleCreateHospitalAdmin}
                        disabled={creatingHospitalAdmin}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chevron-forward-circle" size={24} color="#ffffff" style={styles.submitIcon} />
                        <Text style={styles.submitBtnText}>
                            {creatingHospitalAdmin ? 'Provisioning Hospital Admin Node...' : 'Create Hospital Admin'}
                        </Text>
                    </TouchableOpacity>
                </View>

            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    contentContainer: {
        padding: 16,
    },
    unifiedCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
        marginBottom: 20,
    },
    visualColumn: {
        backgroundColor: '#0f172a',
        padding: 20,
        alignItems: 'center',
    },
    hubImageContainer: {
        width: '100%',
        height: 180,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    hubImgPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    pulseCircle: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#00f0ff',
        opacity: 0.3,
    },
    hubBadge: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
    },
    badgeTop: {
        top: 10,
        right: 10,
    },
    badgeBottom: {
        bottom: 10,
        left: 10,
    },
    hbadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00f0ff',
        marginRight: 6,
    },
    pulseEmerald: {
        backgroundColor: '#10b981',
    },
    badgeText: {
        color: '#e2e8f0',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    minimalPoints: {
        marginTop: 20,
        width: '100%',
    },
    mPoint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    mIcon: {
        color: '#00f0ff',
        fontWeight: 'bold',
        fontSize: 14,
        marginRight: 10,
        marginTop: 2,
    },
    mText: {
        color: '#94a3b8',
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    },
    formColumn: {
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    iconBox: {
        width: 50,
        height: 50,
        backgroundColor: '#e0f2fe',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    titleCol: {
        flex: 1,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    titleText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        marginRight: 10,
    },
    hadBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    hadBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#d97706',
        marginRight: 4,
    },
    hadBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
        letterSpacing: 0.5,
    },
    subtitleText: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
    formGrid: {
        gap: 16,
        marginBottom: 16,
    },
    fieldGroup: {
        marginBottom: 8,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    req: {
        color: '#ef4444',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        height: 48,
    },
    fIcon: {
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#0f172a',
        paddingRight: 12,
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        height: 48,
    },
    fIconPicker: {
        paddingLeft: 12,
    },
    picker: {
        flex: 1,
        height: '100%',
        color: '#0f172a',
    },
    bottomGrid: {
        gap: 16,
        marginBottom: 24,
    },
    photoPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        padding: 12,
    },
    photoShutter: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e0f2fe',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    photoMeta: {
        flex: 1,
    },
    photoMetaStrong: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 2,
    },
    photoMetaSpan: {
        fontSize: 12,
        color: '#64748b',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0ea5e9',
        borderRadius: 8,
        height: 52,
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitIcon: {
        marginRight: 8,
    },
    submitBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default HospitalAdminHUDForm;
