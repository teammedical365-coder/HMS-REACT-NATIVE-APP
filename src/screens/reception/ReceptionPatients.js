import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { receptionAPI, reportAPI, consentAPI } from '../../utils/api';

const { width } = Dimensions.get('window');

const ReceptionPatients = () => {
    const navigation = useNavigation();
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [loadingAppts, setLoadingAppts] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    const [uploadModal, setUploadModal] = useState({ open: false, apptId: null, patientName: '', patientId: null });
    const [profileModal, setProfileModal] = useState({ open: false, patient: null });
    const [consentModal, setConsentModal] = useState({ open: false, apptId: null, patientId: null, patientName: '' });

    useEffect(() => {
        fetchRecentPatients();
        fetchAppointments();
    }, []);

    const fetchRecentPatients = async () => {
        setLoadingPatients(true);
        try {
            const res = await receptionAPI.getAllPatients();
            if (res.success) setPatients(res.patients || []);
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoadingPatients(false);
        }
    };

    const fetchAppointments = async () => {
        setLoadingAppts(true);
        try {
            const res = await receptionAPI.getAllAppointments({ all: 'true' });
            if (res.success) setAppointments(res.appointments || []);
        } catch (error) {
            console.error("Error fetching appointments:", error);
        } finally {
            setLoadingAppts(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const getAvatarColor = (name) => {
        const charCode = (name || 'P').charCodeAt(0);
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#14b8a6'];
        return colors[charCode % colors.length];
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const totalPatientsCount = patients.length;
    const upcomingApptsCount = appointments.filter(a => {
        const isFuture = a.appointmentDate && new Date(a.appointmentDate).toISOString().split('T')[0] >= todayStr;
        return isFuture && ['pending', 'confirmed'].includes(a.status);
    }).length;
    const completedTodayCount = appointments.filter(a => {
        const isToday = a.appointmentDate && new Date(a.appointmentDate).toISOString().split('T')[0] === todayStr;
        return isToday && a.status === 'completed';
    }).length;

    const filteredAppointments = appointments.filter(appt => {
        if (activeTab === 'today') {
            const isToday = appt.appointmentDate && new Date(appt.appointmentDate).toISOString().split('T')[0] === todayStr;
            if (!isToday) return false;
        }
        if (searchText.trim().length > 0) {
            const q = searchText.toLowerCase();
            const matchName = String(appt.userId?.name || '').toLowerCase().includes(q);
            const matchPhone = String(appt.userId?.phone || '').includes(q);
            const matchMRN = String(appt.userId?.patientId || '').toLowerCase().includes(q);
            const matchDoc = String(appt.doctorId?.name || '').toLowerCase().includes(q);
            return matchName || matchPhone || matchMRN || matchDoc;
        }
        return true;
    });

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#eff6ff' }]}><Text style={{fontSize:24}}>👥</Text></View>
                    <View>
                        <Text style={styles.statValue}>{totalPatientsCount}</Text>
                        <Text style={styles.statLabel}>TOTAL PATIENTS</Text>
                    </View>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#fff7ed' }]}><Text style={{fontSize:24}}>📅</Text></View>
                    <View>
                        <Text style={styles.statValue}>{upcomingApptsCount}</Text>
                        <Text style={styles.statLabel}>UPCOMING</Text>
                    </View>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#f0fdf4' }]}><Text style={{fontSize:24}}>✅</Text></View>
                    <View>
                        <Text style={styles.statValue}>{completedTodayCount}</Text>
                        <Text style={styles.statLabel}>COMPLETED TODAY</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.controlsRow, !isLargeScreen && { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={styles.searchBox}>
                    <Text>🔍</Text>
                    <TextInput 
                        placeholder="Search patient, phone, MRN, doctor..." 
                        value={searchText} 
                        onChangeText={setSearchText} 
                        style={styles.searchInput}
                    />
                </View>

                <View style={styles.tabToggle}>
                    <TouchableOpacity onPress={() => setActiveTab('today')} style={[styles.tabBtn, activeTab === 'today' && styles.tabBtnActive]}>
                        <Text style={[styles.tabBtnText, activeTab === 'today' && styles.tabBtnTextActive]}>Today's Queue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('all')} style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}>
                        <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>All Appointments</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.tableCard}>
                <View style={styles.tableHeaderSection}>
                    <Text style={{ fontSize: 20 }}>📁</Text>
                    <Text style={styles.tableTitle}>{activeTab === 'today' ? "Today's Queue" : "All Appointments"}</Text>
                </View>

                {loadingAppts ? (
                    <ActivityIndicator size="large" color="#2563eb" style={{ padding: 40 }} />
                ) : (
                    <ScrollView horizontal>
                        <View style={styles.tableWrapper}>
                            <View style={styles.tableRowHeader}>
                                <Text style={[styles.cellHeader, { width: 40 }]}>#</Text>
                                <Text style={[styles.cellHeader, { width: 200 }]}>Patient</Text>
                                <Text style={[styles.cellHeader, { width: 120 }]}>Contact</Text>
                                <Text style={[styles.cellHeader, { width: 180 }]}>Doctor</Text>
                                <Text style={[styles.cellHeader, { width: 100 }]}>Time</Text>
                                <Text style={[styles.cellHeader, { width: 100 }]}>Date</Text>
                                <Text style={[styles.cellHeader, { width: 120 }]}>Status</Text>
                                <Text style={[styles.cellHeader, { width: 250, textAlign: 'center' }]}>Action</Text>
                            </View>
                            {filteredAppointments.map((appt, idx) => (
                                <View key={appt._id} style={styles.tableRow}>
                                    <View style={[styles.cell, { width: 40 }]}><Text style={styles.cellTextSmall}>{idx + 1}</Text></View>
                                    <View style={[styles.cell, { width: 200, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                                        <View style={[styles.avatar, { backgroundColor: getAvatarColor(appt.userId?.name) }]}>
                                            <Text style={styles.avatarText}>{(appt.userId?.name || 'P')[0].toUpperCase()}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.patientName}>{appt.userId?.name || 'Walk-in'}</Text>
                                            <Text style={styles.patientIdText}>MRN: {appt.userId?.patientId || 'N/A'}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.cell, { width: 120 }]}><Text style={styles.cellTextBold}>{appt.userId?.phone || '-'}</Text></View>
                                    <View style={[styles.cell, { width: 180, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                        <View style={[styles.docAvatar]}><Text style={styles.docAvatarText}>{(appt.doctorId?.name || 'D')[0].toUpperCase()}</Text></View>
                                        <Text style={styles.cellTextBold}>{appt.doctorId?.name || 'Not Assigned'}</Text>
                                    </View>
                                    <View style={[styles.cell, { width: 100 }]}><Text style={styles.cellTextBlack}>{appt.appointmentTime}</Text></View>
                                    <View style={[styles.cell, { width: 100 }]}><Text style={styles.cellTextSmall}>{formatDate(appt.appointmentDate)}</Text></View>
                                    <View style={[styles.cell, { width: 120 }]}>
                                        <View style={[styles.statusBadge, { backgroundColor: appt.status === 'confirmed' ? '#dcfce7' : appt.status === 'completed' ? '#eff6ff' : '#fef3c7' }]}>
                                            <Text style={[styles.statusBadgeText, { color: appt.status === 'confirmed' ? '#166534' : appt.status === 'completed' ? '#1e40af' : '#92400e' }]}>{appt.status}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.cell, { width: 250, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
                                        <TouchableOpacity style={styles.actionBtnProfile}>
                                            <Text style={styles.actionBtnProfileText}>👁️ Profile</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionBtnUpload}>
                                            <Text style={styles.actionBtnUploadText}>📁 Upload Report</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionBtnConsent}>
                                            <Text style={styles.actionBtnConsentText}>📝 Consent</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { padding: 20 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 24 },
    statCard: { flex: 1, minWidth: 250, backgroundColor: '#ffffff', borderRadius: 12, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    statIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
    statLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
    controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 14, flex: 1, maxWidth: 400 },
    searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },
    tabToggle: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 3 },
    tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
    tabBtnActive: { backgroundColor: '#2563eb' },
    tabBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    tabBtnTextActive: { color: '#ffffff' },
    tableCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    tableHeaderSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    tableTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    tableWrapper: { minWidth: 1000 },
    tableRowHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 2, borderBottomColor: '#edf2f7', paddingVertical: 12 },
    cellHeader: { paddingHorizontal: 14, color: '#475569', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#edf2f7', paddingVertical: 14, alignItems: 'center' },
    cell: { paddingHorizontal: 14 },
    cellTextSmall: { color: '#64748b', fontWeight: '600', fontSize: 13 },
    cellTextBold: { fontWeight: '600', color: '#334155', fontSize: 13 },
    cellTextBlack: { color: '#1e293b', fontWeight: '700', fontSize: 13 },
    avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    patientName: { fontWeight: '700', color: '#1e293b', fontSize: 13 },
    patientIdText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    docAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' },
    docAvatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, alignSelf: 'flex-start' },
    statusBadgeText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
    actionBtnProfile: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    actionBtnProfileText: { color: '#2563eb', fontSize: 12, fontWeight: '600' },
    actionBtnUpload: { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    actionBtnUploadText: { color: '#db2777', fontSize: 12, fontWeight: '600' },
    actionBtnConsent: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    actionBtnConsentText: { color: '#ef4444', fontSize: 12, fontWeight: '600' }
});

export default ReceptionPatients;
