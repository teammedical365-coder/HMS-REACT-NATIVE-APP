import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, TextInput, Linking, Alert } from 'react-native';
import { labAPI } from '../../utils/api';

const { width } = Dimensions.get('window');

const CompletedReports = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const res = await labAPI.getRequests('completed');
            if (res.success) {
                setRequests(res.requests || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleView = (url) => {
        if (!url) return;
        Linking.openURL(url).catch(() => Alert.alert("Error", "Cannot open URL"));
    };

    const handleDownload = (url) => {
        if (!url) return;
        // Mock download logic for RN
        Linking.openURL(url).catch(() => Alert.alert("Error", "Cannot download file"));
    };

    const handlePrint = (url) => {
        if (!url) return;
        Alert.alert("Print", "Printing requires expo-print package setup for React Native.");
    };

    const filteredReports = requests.filter(report => {
        const matchesSearch = 
            report.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.testNames?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesDate = filterDate ? report.updatedAt?.startsWith(filterDate) : true;
        
        return matchesSearch && matchesDate;
    });

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={[styles.header, !isLargeScreen && { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={!isLargeScreen && { marginBottom: 15 }}>
                    <Text style={styles.headerTitle}>✅ Completed Reports</Text>
                    <Text style={styles.headerSubtitle}>Full archive of diagnostic results and patient files.</Text>
                </View>
                
                <View style={[styles.controls, !isLargeScreen && { flexDirection: 'column' }]}>
                    <View style={styles.searchBox}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Search patient or test name..."
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                    <View style={styles.dateFilter}>
                        <TextInput 
                            style={styles.dateInput}
                            placeholder="YYYY-MM-DD"
                            value={filterDate}
                            onChangeText={setFilterDate}
                        />
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#22c55e" />
                    <Text style={styles.loadingText}>Loading records...</Text>
                </View>
            ) : (
                <View style={[styles.grid, !isLargeScreen && { flexDirection: 'column' }]}>
                    {filteredReports.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 40, marginBottom: 10 }}>📭</Text>
                            <Text style={styles.emptyStateTitle}>No reports found</Text>
                            <Text style={styles.emptyStateText}>Try different search terms or clear your date filter.</Text>
                        </View>
                    ) : (
                        filteredReports.map((report) => (
                            <View key={report._id} style={styles.card}>
                                <View style={styles.cardTop}>
                                    <View style={styles.patientMeta}>
                                        <Text style={styles.idBadge}>ID: {report.patientId}</Text>
                                        <Text style={styles.dateMeta}>📅 {formatDate(report.updatedAt)}</Text>
                                    </View>
                                    <View style={styles.statusPill}>
                                        <Text style={styles.statusPillText}>COMPLETED</Text>
                                    </View>
                                </View>

                                <View style={styles.cardMain}>
                                    <View style={styles.infoBlock}>
                                        <Text style={styles.infoLabel}>👤 Patient</Text>
                                        <Text style={styles.infoTitle}>{report.userId?.name}</Text>
                                    </View>
                                    <View style={styles.infoBlock}>
                                        <Text style={styles.infoLabel}>👨‍⚕️ Requesting Doctor</Text>
                                        <Text style={styles.infoDesc}>{report.doctorId?.name}</Text>
                                    </View>
                                    
                                    <View style={styles.testsBlock}>
                                        <Text style={styles.infoLabel}>🧪 Conducted Tests</Text>
                                        <View style={styles.testTags}>
                                            {report.testNames?.map((test, i) => (
                                                <View key={i} style={styles.testTag}>
                                                    <Text style={styles.testTagText}>{test}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                {report.reportFile && (
                                    <View style={styles.filePreview}>
                                        <Text style={styles.fileIcon}>📄</Text>
                                        <View>
                                            <Text style={styles.filename}>{report.reportFile.name || 'Report.pdf'}</Text>
                                            <Text style={styles.filesize}>Digital Report Ready</Text>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.cardActions}>
                                    <TouchableOpacity style={[styles.btnAction, styles.btnSecondary]} onPress={() => handleView(report.reportFile?.url)}>
                                        <Text style={styles.btnSecondaryText}>👁️ View</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnAction, styles.btnPrimary]} onPress={() => handleDownload(report.reportFile?.url)}>
                                        <Text style={styles.btnPrimaryText}>⬇️ Download</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnAction, styles.btnPrint]} onPress={() => handlePrint(report.reportFile?.url)}>
                                        <Text style={styles.btnPrintText}>🖨️ Print</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0fdf4',
    },
    contentContainer: {
        padding: 32,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
        elevation: 5,
        flexWrap: 'wrap',
        gap: 24
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0f172a',
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 16,
        marginTop: 4,
    },
    controls: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center'
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 45,
        minWidth: 250
    },
    searchIcon: {
        marginRight: 8,
        color: '#94a3b8'
    },
    searchInput: {
        flex: 1,
        height: '100%',
        color: '#0f172a'
    },
    dateFilter: {
        minWidth: 150
    },
    dateInput: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 45,
        color: '#0f172a'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 10,
        color: '#64748b',
        fontSize: 16
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        borderStyle: 'dashed'
    },
    emptyStateTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8
    },
    emptyStateText: {
        color: '#64748b',
        fontSize: 16
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24
    },
    card: {
        flex: 1,
        minWidth: 340,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 2
    },
    cardTop: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226, 232, 240, 0.6)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    patientMeta: {
        flexDirection: 'column',
        gap: 6
    },
    idBadge: {
        fontFamily: 'monospace',
        fontWeight: '700',
        color: '#64748b',
        fontSize: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        alignSelf: 'flex-start'
    },
    dateMeta: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500'
    },
    statusPill: {
        backgroundColor: '#dcfce7',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20
    },
    statusPillText: {
        color: '#15803d',
        fontWeight: '800',
        fontSize: 12
    },
    cardMain: {
        padding: 24
    },
    infoBlock: {
        marginBottom: 20
    },
    infoLabel: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0.5
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a'
    },
    infoDesc: {
        color: '#475569',
        fontSize: 16
    },
    testsBlock: {
        marginTop: 10
    },
    testTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10
    },
    testTag: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10
    },
    testTagText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '600'
    },
    filePreview: {
        marginHorizontal: 24,
        marginBottom: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    fileIcon: {
        fontSize: 28,
        color: '#ef4444'
    },
    filename: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155'
    },
    filesize: {
        fontSize: 13,
        color: '#94a3b8'
    },
    cardActions: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(226, 232, 240, 0.6)',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        flexDirection: 'row',
        gap: 16
    },
    btnAction: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8
    },
    btnPrimary: {
        backgroundColor: '#0f172a',
    },
    btnPrimaryText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 15
    },
    btnSecondary: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    btnSecondaryText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 15
    },
    btnPrint: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    btnPrintText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 15
    }
});

export default CompletedReports;
