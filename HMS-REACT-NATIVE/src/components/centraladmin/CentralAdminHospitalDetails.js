import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Dimensions, Linking, Image } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 768;

export default function CentralAdminHospitalDetails({ hospital, onBack }) {
    const [datePreset, setDatePreset] = useState('all');
    const [apptMode, setApptMode] = useState(hospital?.appointmentMode || 'slot');

    // Mocks / Fallbacks matching the web dashboard
    const stats = {
        totalStaff: 1,
        totalPatients: 0,
        totalAppointments: 0,
        totalRevenue: 0
    };

    const handleOpenURL = (url) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    const features = [
        { label: 'Doctors', icon: 'plus-circle', color: '#3b82f6', bg: '#eff6ff' },
        { label: 'Staff', icon: 'users', color: '#8b5cf6', bg: '#f5f3ff' },
        { label: 'Roles', icon: 'key', color: '#eab308', bg: '#fefce8' },
        { label: 'Labs', icon: 'activity', color: '#22c55e', bg: '#f0fdf4' },
        { label: 'Lab Tests', icon: 'file-text', color: '#10b981', bg: '#ecfdf5' },
        { label: 'Pharmacy', icon: 'shopping-bag', color: '#f97316', bg: '#fff7ed' },
        { label: 'Reception', icon: 'monitor', color: '#14b8a6', bg: '#f0fdfa' },
        { label: 'Services', icon: 'grid', color: '#d946ef', bg: '#fdf4ff' },
        { label: 'Medicines', icon: 'heart', color: '#ef4444', bg: '#fef2f2' },
    ];

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header Section */}
            <View style={styles.headerContainer}>
                <LinearGradient colors={['#1e1b4b', '#312e81', '#1e3a8a']} style={styles.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.headerTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.hospitalLogoBox}>
                                <Feather name="plus" size={32} color="#ef4444" style={{ fontWeight: 'bold' }} />
                            </View>
                            <View style={{ marginLeft: 16 }}>
                                <Text style={styles.hospitalProfileTag}>Hospital Profile</Text>
                                <Text style={styles.hospitalName}>{hospital?.name || 'Hospital Name'}</Text>
                                <View style={styles.hospitalContactRow}>
                                    <View style={styles.contactBadge}>
                                        <Feather name="map-pin" size={12} color="#3b82f6" />
                                        <Text style={styles.contactBadgeText}>{hospital?.city || 'Location'}, {hospital?.state || ''}</Text>
                                    </View>
                                    {hospital?.phone && (
                                        <View style={styles.contactBadge}>
                                            <Feather name="phone" size={12} color="#10b981" />
                                            <Text style={styles.contactBadgeText}>{hospital.phone}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.backButton} onPress={onBack}>
                            <Feather name="arrow-left" size={16} color="#fff" />
                            <Text style={styles.backButtonText}>Back to Hospitals</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
                
                {/* Floating Info Cards */}
                <View style={styles.floatingCardsRow}>
                    <View style={styles.floatCard}>
                        <Feather name="shield" size={16} color="#6366f1" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.floatCardLabel}>Trusted Care</Text>
                            <Text style={styles.floatCardValue}>24/7</Text>
                        </View>
                    </View>
                    <View style={styles.floatCard}>
                        <Feather name="user" size={16} color="#10b981" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.floatCardLabel}>Expert Doctors</Text>
                            <Text style={styles.floatCardValue}>1</Text>
                        </View>
                    </View>
                    <View style={styles.floatCard}>
                        <Feather name="users" size={16} color="#3b82f6" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.floatCardLabel}>Patients Served</Text>
                            <Text style={styles.floatCardValue}>10K+</Text>
                        </View>
                    </View>
                    <View style={styles.floatCardStatus}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>ACTIVE</Text>
                    </View>
                </View>
            </View>

            {/* Analytics Timeframe */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="calendar" size={18} color="#6366f1" />
                        <Text style={styles.sectionTitle}>Analytics Timeframe</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>Choose a reporting period</Text>
                </View>
                <View style={styles.timeframeControls}>
                    <View style={styles.datePickerGroup}>
                        <View style={styles.dateInput}><Text style={{ color: '#94a3b8' }}>dd-mm-yyyy</Text><Feather name="calendar" size={14} color="#94a3b8" /></View>
                        <Text style={{ color: '#64748b' }}>to</Text>
                        <View style={styles.dateInput}><Text style={{ color: '#94a3b8' }}>dd-mm-yyyy</Text><Feather name="calendar" size={14} color="#94a3b8" /></View>
                        <TouchableOpacity style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>Apply Custom</Text></TouchableOpacity>
                    </View>
                    <View style={styles.presetGroup}>
                        {['all', 'today', '30days'].map((preset) => (
                            <TouchableOpacity 
                                key={preset} 
                                style={[styles.presetBtn, datePreset === preset && styles.presetBtnActive]}
                                onPress={() => setDatePreset(preset)}
                            >
                                <Text style={[styles.presetBtnText, datePreset === preset && styles.presetBtnTextActive]}>
                                    {preset === 'all' ? 'All Time' : preset === 'today' ? 'Today' : '30 Days'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Stat Cards Grid */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderBottomColor: '#22c55e', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#dcfce7' }]}>
                        <Feather name="user" size={20} color="#16a34a" />
                    </View>
                    <Text style={styles.statValue}>{stats.totalStaff}</Text>
                    <Text style={styles.statLabel}>Total Staff</Text>
                    <Text style={styles.statSub}>Active staff members</Text>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#3b82f6', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#dbeafe' }]}>
                        <Feather name="users" size={20} color="#2563eb" />
                    </View>
                    <Text style={styles.statValue}>{stats.totalPatients}</Text>
                    <Text style={styles.statLabel}>Unique Patients</Text>
                    <Text style={styles.statSub}>In selected period</Text>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#a855f7', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#f3e8ff' }]}>
                        <Feather name="calendar" size={20} color="#9333ea" />
                    </View>
                    <Text style={styles.statValue}>{stats.totalAppointments}</Text>
                    <Text style={styles.statLabel}>Total Appointments</Text>
                    <Text style={styles.statSub}>In selected period</Text>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#eab308', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#fef9c3' }]}>
                        <Text style={{ fontSize: 18, color: '#ca8a04', fontWeight: 'bold' }}>₹</Text>
                    </View>
                    <Text style={styles.statValue}>₹{stats.totalRevenue}</Text>
                    <Text style={styles.statLabel}>Total Revenue</Text>
                    <Text style={styles.statSub}>From paid appointments</Text>
                </View>
            </View>

            {/* Quick Feature Management */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="zap" size={18} color="#ea580c" />
                        <Text style={styles.sectionTitle}>Quick Feature Management</Text>
                    </View>
                </View>
                <Text style={[styles.sectionSubtitle, { marginBottom: 16, marginTop: -10 }]}>Jump to manage specific features for this hospital.</Text>
                
                <View style={styles.featuresGrid}>
                    {features.map((feature, idx) => (
                        <TouchableOpacity key={idx} style={[styles.featureBtn, { backgroundColor: feature.bg }]}>
                            <Feather name={feature.icon} size={14} color={feature.color} />
                            <Text style={[styles.featureBtnText, { color: feature.color }]}>{feature.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Appointment System Mode */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 16, height: 12, backgroundColor: '#f43f5e', borderRadius: 2, marginRight: 8 }} />
                        <Text style={styles.sectionTitle}>Appointment System Mode</Text>
                        <View style={styles.badgeBlue}><Text style={styles.badgeBlueText}>Current: {apptMode === 'slot' ? 'Time Slots' : 'Token Queue'}</Text></View>
                    </View>
                </View>
                <Text style={[styles.sectionSubtitle, { marginBottom: 16, marginTop: -10 }]}>Choose your appointment system mode. You can switch between modes at any time.</Text>
                
                <View style={styles.modeCardsRow}>
                    <TouchableOpacity 
                        style={[styles.modeCard, apptMode === 'slot' && styles.modeCardActive]} 
                        onPress={() => setApptMode('slot')}
                    >
                        <View style={styles.modeIconBox}><Feather name="clock" size={18} color="#6366f1" /></View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.modeCardTitle}>Time Slot Booking</Text>
                                <View style={styles.badgePrimary}><Text style={styles.badgePrimaryText}>Recommended</Text></View>
                            </View>
                            <Text style={styles.modeCardDesc}>Patients pick a specific time (10:00, 10:30...). Doctor sees one time slot at a time.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.modeCard, apptMode === 'token' && styles.modeCardActive]} 
                        onPress={() => setApptMode('token')}
                    >
                        <View style={[styles.modeIconBox, { backgroundColor: '#fef3c7' }]}><Feather name="list" size={18} color="#d97706" /></View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.modeCardTitle}>Token Queue System</Text>
                            <Text style={styles.modeCardDesc}>Sequential tokens (1, 2, 3...). 1 patient per day or live token updating board.</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                    <TouchableOpacity style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>Save Mode</Text></TouchableOpacity>
                    <Text style={{ marginLeft: 12, color: '#64748b', fontSize: 13 }}>All changes are saved.</Text>
                </View>
            </View>

            {/* Hospital Info */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.statIconBox, { backgroundColor: '#e0e7ff', width: 32, height: 32 }]}><Feather name="cpu" size={16} color="#4f46e5" /></View>
                        <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Hospital Info</Text>
                        <View style={[styles.badgeBlue, { backgroundColor: '#ccfbf1', borderColor: '#99f6e4' }]}><Text style={[styles.badgeBlueText, { color: '#0f766e' }]}>AI Synced</Text></View>
                    </View>
                </View>

                <View style={styles.infoGridRow}>
                    <View style={styles.infoRow}><Feather name="mail" size={14} color="#3b82f6" /><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{hospital?.email || 'N/A'}</Text></View>
                    <View style={styles.infoRow}><Feather name="map-pin" size={14} color="#eab308" /><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{hospital?.city}, {hospital?.state}</Text></View>
                    <View style={styles.infoRow}><Feather name="user" size={14} color="#8b5cf6" /><Text style={styles.infoLabel}>Admin</Text><Text style={styles.infoValue}>SuperAdmin</Text></View>
                    <View style={styles.infoRow}><Feather name="at-sign" size={14} color="#ec4899" /><Text style={styles.infoLabel}>Admin Email</Text><Text style={styles.infoValue}>{hospital?.email || 'N/A'}</Text></View>
                    <View style={styles.infoRow}>
                        <Feather name="link" size={14} color="#10b981" />
                        <Text style={styles.infoLabel}>Staff Login URL</Text>
                        <TouchableOpacity style={styles.urlBadge} onPress={() => handleOpenURL(`https://${hospital?.slug || hospital?.customDomain || 'demo'}.medical365.in/login`)}>
                            <Text style={styles.urlText}>https://{hospital?.slug || hospital?.customDomain || 'demo'}.medical365.in/login</Text>
                            <Feather name="external-link" size={12} color="#059669" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerContainer: {
        marginBottom: 40,
        position: 'relative',
    },
    headerGradient: {
        paddingTop: 30,
        paddingBottom: 60,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isSmallScreen ? 'flex-start' : 'center',
        gap: 16
    },
    hospitalLogoBox: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    hospitalProfileTag: {
        color: '#93c5fd',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    hospitalName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    hospitalContactRow: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap'
    },
    contactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    contactBadgeText: {
        color: '#e2e8f0',
        fontSize: 13,
        marginLeft: 6,
        fontWeight: '500'
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    backButtonText: {
        color: '#fff',
        marginLeft: 8,
        fontWeight: '600',
        fontSize: 14
    },
    floatingCardsRow: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: -25,
        left: 24,
        right: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 8,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10
    },
    floatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 16,
        borderRightWidth: 1,
        borderRightColor: '#f1f5f9'
    },
    floatCardLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500'
    },
    floatCardValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a'
    },
    floatCardStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#a7f3d0'
    },
    statusDot: {
        width: 6,
        height: 6,
        backgroundColor: '#10b981',
        borderRadius: 3,
        marginRight: 6
    },
    statusText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '700'
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        marginLeft: 8
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
    },
    timeframeControls: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isSmallScreen ? 'stretch' : 'center',
        gap: 16
    },
    datePickerGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 120
    },
    btnPrimary: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    btnPrimaryText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13
    },
    presetGroup: {
        flexDirection: 'row',
        gap: 8
    },
    presetBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    presetBtnActive: {
        backgroundColor: '#6366f1',
    },
    presetBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569'
    },
    presetBtnTextActive: {
        color: '#fff'
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    statCard: {
        width: isSmallScreen ? '45%' : '23%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        margin: '1%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    statIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4
    },
    statLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 2
    },
    statSub: {
        fontSize: 12,
        color: '#94a3b8'
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    featureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        gap: 8,
        width: isSmallScreen ? '47%' : '23%'
    },
    featureBtnText: {
        fontWeight: '600',
        fontSize: 13
    },
    badgeBlue: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        marginLeft: 12
    },
    badgeBlueText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: '600'
    },
    modeCardsRow: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        gap: 16
    },
    modeCard: {
        flex: 1,
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    modeCardActive: {
        backgroundColor: '#eef2ff',
        borderColor: '#c7d2fe'
    },
    modeIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e0e7ff',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modeCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b'
    },
    badgePrimary: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8
    },
    badgePrimaryText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600'
    },
    modeCardDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 6,
        lineHeight: 18
    },
    infoGridRow: {
        marginTop: 10
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    infoLabel: {
        width: 140,
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginLeft: 12
    },
    infoValue: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '500',
        textAlign: 'right'
    },
    urlBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        flex: 1,
        justifyContent: 'flex-end'
    },
    urlText: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '600'
    }
});
