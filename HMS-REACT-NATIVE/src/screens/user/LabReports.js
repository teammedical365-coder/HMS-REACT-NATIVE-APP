import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, TextInput, Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../store/hooks';
import { fetchMyLabReports } from '../../store/slices/labSlice';

const LabReports = () => {
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const { user } = useAuth();
    const { requests: reports, loading } = useSelector((state) => state.lab);

    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        dispatch(fetchMyLabReports());
    }, [dispatch]);

    const handleDownload = (url) => {
        if (!url) return;
        Linking.openURL(url);
    };

    const filteredReports = (reports || []).filter(report => {
        const matchesStatus = filter === 'all' ||
            (filter === 'completed' && report.testStatus === 'DONE') ||
            (filter === 'pending' && report.testStatus === 'PENDING') ||
            (filter === 'pending' && report.testStatus === 'IN_PROGRESS');

        const matchesSearch =
            report.testNames?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
            report.doctorId?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesStatus && (searchTerm ? matchesSearch : true);
    });

    if (loading && (!reports || reports.length === 0)) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#14C38E" />
                <Text style={styles.loadingText}>Fetching your medical records...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.contentWrapper}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.backLink}>
                    <Text style={styles.backLinkText}>← Back to Dashboard</Text>
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <View style={styles.badge}><Text style={styles.badgeText}>PATIENT LAB PORTAL</Text></View>
                    <Text style={styles.title}>Your <Text style={styles.textGradient}>Medical Reports</Text></Text>
                    <Text style={styles.greeting}>
                        Welcome, <Text style={styles.greetingBold}>{user?.name}</Text>
                    </Text>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <View style={styles.searchBox}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by test name or doctor..."
                        placeholderTextColor="#64748B"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                </View>

                <View style={styles.filterButtons}>
                    {['all', 'completed', 'pending'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Reports Grid */}
            {filteredReports.length > 0 ? (
                <View style={styles.reportsGrid}>
                    {filteredReports.map((report) => (
                        <View key={report._id} style={styles.reportCard}>
                            {/* Card Header */}
                            <View style={styles.reportCardHeader}>
                                <View style={styles.reportId}>
                                    <Text style={styles.idLabel}>TEST ID</Text>
                                    <Text style={styles.idValue}>#{report._id.slice(-6).toUpperCase()}</Text>
                                </View>
                                <Text style={[
                                    styles.statusBadge,
                                    report.testStatus === 'DONE' ? styles.statusCompleted : styles.statusPending
                                ]}>
                                    {report.testStatus === 'DONE' ? '✓ Ready' : '⏳ ' + report.testStatus}
                                </Text>
                            </View>

                            {/* Card Body */}
                            <View style={styles.reportCardBody}>
                                <View style={styles.patientInfo}>
                                    <Text style={styles.testName}>{report.testNames?.join(', ')}</Text>
                                    <Text style={styles.testType}>Prescribed by {report.doctorId?.name}</Text>
                                </View>

                                <View style={styles.reportMeta}>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>DATE REQUESTED</Text>
                                        <Text style={styles.metaValue}>{new Date(report.createdAt).toLocaleDateString()}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>PAYMENT</Text>
                                        <Text style={[
                                            styles.metaValue,
                                            { color: (report.paymentStatus || '').toLowerCase() === 'paid' ? '#14C38E' : '#ff9800' }
                                        ]}>
                                            {report.paymentStatus}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Card Footer */}
                            <View style={styles.reportCardFooter}>
                                {report.testStatus === 'DONE' && report.reportFile?.url ? (
                                    <TouchableOpacity
                                        style={styles.btnPrimary}
                                        onPress={() => handleDownload(report.reportFile?.url)}
                                    >
                                        <Text style={styles.btnPrimaryText}>Download PDF</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={[styles.btnSecondary, { opacity: 0.5 }]}>
                                        <Text style={[styles.btnSecondaryText, { color: '#64748B' }]}>Processing Results</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Reports Found</Text>
                    <Text style={styles.emptySubtext}>
                        Your diagnostic records will appear here once requested or processed.
                    </Text>
                </View>
            )}

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    contentWrapper: {
        padding: 24,
        paddingTop: 40,
        paddingBottom: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FD',
    },
    loadingText: {
        marginTop: 20,
        color: '#64748B',
        fontSize: 16,
    },

    /* Header */
    header: {
        marginBottom: 60,
        paddingTop: 20,
    },
    backLink: {
        marginBottom: 30,
    },
    backLinkText: {
        color: '#64748B',
        fontSize: 15,
        fontWeight: '500',
    },
    headerContent: {
        alignItems: 'center',
    },
    badge: {
        backgroundColor: 'rgba(20, 195, 142, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 20,
    },
    badgeText: {
        color: '#0A2647',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 20,
        textAlign: 'center',
    },
    textGradient: {
        color: '#14C38E',
    },
    greeting: {
        fontSize: 15,
        color: '#64748B',
        marginTop: 12,
        fontStyle: 'italic',
    },
    greetingBold: {
        color: '#14C38E',
        fontWeight: '600',
    },

    /* Controls */
    controls: {
        marginBottom: 50,
        gap: 20,
    },
    searchBox: {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    searchInput: {
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 50,
        fontSize: 15,
        backgroundColor: '#FFFFFF',
        color: '#1E293B',
    },
    filterButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    filterBtn: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        backgroundColor: '#FFFFFF',
        borderRadius: 50,
    },
    filterBtnActive: {
        backgroundColor: '#0A2647',
        borderColor: '#0A2647',
    },
    filterBtnText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    filterBtnTextActive: {
        color: '#FFFFFF',
    },

    /* Reports Grid */
    reportsGrid: {
        gap: 30,
        marginBottom: 60,
    },

    /* Report Card */
    reportCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    reportCardHeader: {
        paddingVertical: 20,
        paddingHorizontal: 24,
        backgroundColor: '#F8F9FD',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reportId: {
        flexDirection: 'column',
        gap: 4,
    },
    idLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    idValue: {
        fontSize: 15,
        color: '#0A2647',
        fontWeight: '700',
        fontFamily: 'monospace',
    },
    statusBadge: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        fontSize: 13,
        fontWeight: '600',
        overflow: 'hidden',
    },
    statusCompleted: {
        backgroundColor: 'rgba(20, 195, 142, 0.1)',
        color: '#14C38E',
    },
    statusPending: {
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        color: '#ff9800',
    },

    /* Card Body */
    reportCardBody: {
        padding: 24,
    },
    patientInfo: {
        marginBottom: 20,
    },
    testName: {
        fontSize: 20,
        color: '#1E293B',
        fontWeight: '700',
        marginBottom: 8,
    },
    testType: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },
    reportMeta: {
        flexDirection: 'column',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    metaItem: {
        flexDirection: 'column',
        gap: 4,
    },
    metaLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    metaValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '500',
        marginTop: 4,
    },

    /* Card Footer */
    reportCardFooter: {
        paddingVertical: 20,
        paddingHorizontal: 24,
        backgroundColor: '#F8F9FD',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },

    /* Buttons */
    btnPrimary: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#0A2647',
        borderRadius: 50,
        alignItems: 'center',
    },
    btnPrimaryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    btnSecondary: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#0A2647',
        borderRadius: 50,
        alignItems: 'center',
    },
    btnSecondaryText: {
        color: '#0A2647',
        fontSize: 14,
        fontWeight: '600',
    },

    /* Empty State */
    emptyState: {
        alignItems: 'center',
        paddingVertical: 80,
        maxWidth: 500,
        alignSelf: 'center',
    },
    emptyTitle: {
        fontSize: 22,
        color: '#1E293B',
        fontWeight: '700',
        marginBottom: 12,
    },
    emptySubtext: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
});

export default LabReports;
