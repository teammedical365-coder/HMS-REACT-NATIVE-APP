import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, TextInput, Linking, Alert, Platform,
    useWindowDimensions, RefreshControl
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { safePrintDocument } from '../../utils/printHelper';
import { fetchLabRequests } from '../../store/slices/labSlice';
import DatePickerInput from '../../components/common/DatePickerInput';
import { fetchLabCompletedReportsWithOffline } from '../../services/offline/offlineLabService';
import { checkOnlineStatus } from '../../services/offline/networkStatus';
import OfflineBanner from '../../components/OfflineBanner';
import OfflineEmptyState from '../../components/OfflineEmptyState';

const CompletedReports = () => {
    const { width } = useWindowDimensions();
    const dispatch = useDispatch();
    const { requests: reduxRequests = [], loading: reduxLoading } = useSelector((state) => state.lab);

    const [reports, setReports] = useState(reduxRequests);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const [offlineState, setOfflineState] = useState({
        isOffline: false,
        fromCache: false,
        lastFetchedAt: null,
        noCache: false,
    });

    const loadReports = useCallback(async (isPullToRefresh = false) => {
        if (isPullToRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetchLabCompletedReportsWithOffline({
                onCacheHit: (cached) => {
                    if (cached && Array.isArray(cached.requests)) {
                        setReports(cached.requests);
                        setOfflineState({
                            isOffline: false,
                            fromCache: true,
                            lastFetchedAt: cached.lastFetchedAt,
                            noCache: false,
                        });
                        setLoading(false);
                    }
                },
            });

            if (res && res.success && Array.isArray(res.requests)) {
                setReports(res.requests);
                setOfflineState({
                    isOffline: !!res.isOffline,
                    fromCache: !!res.fromCache,
                    lastFetchedAt: res.lastFetchedAt || Date.now(),
                    noCache: false,
                });
            }

            // Sync with redux if online
            if (!res.isOffline) {
                dispatch(fetchLabRequests('completed'));
            }
        } catch (err) {
            console.error('[CompletedReports] Error loading records:', err?.message || err);
            setOfflineState((prev) => ({
                ...prev,
                isOffline: true,
                noCache: reports.length === 0,
            }));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dispatch, reports.length]);

    useEffect(() => {
        loadReports();
    }, []);

    const handleView = async (url) => {
        if (!url) return;
        const isOnline = await checkOnlineStatus();
        if (!isOnline && url.startsWith('http')) {
            Alert.alert("Network Required", "Viewing remote digital documents requires an internet connection. Diagnostic report metadata is preserved offline.");
            return;
        }
        Linking.openURL(url).catch(() => Alert.alert("Error", "Cannot open URL"));
    };

    const handleDownload = async (url, fileName) => {
        if (!url) return;
        const isOnline = await checkOnlineStatus();
        if (!isOnline && url.startsWith('http')) {
            Alert.alert("Network Required", "Downloading digital report files requires an active network connection.");
            return;
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName || 'lab-report.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            } catch (error) {
                console.error("Web download failed, falling back to window.open:", error);
                window.open(url, '_blank');
            }
        } else {
            try {
                const rawName = fileName || url.split('/').pop()?.split('?')[0] || `lab_report_${Date.now()}.pdf`;
                const sanitizedName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;
                const targetUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${sanitizedName}`;

                const downloadResult = await FileSystem.downloadAsync(url, targetUri);
                if (downloadResult && downloadResult.uri) {
                    const isShareAvailable = await Sharing.isAvailableAsync();
                    if (isShareAvailable) {
                        await Sharing.shareAsync(downloadResult.uri);
                    } else {
                        Alert.alert("Download Complete", `Report saved to: ${downloadResult.uri}`);
                    }
                }
            } catch (nativeErr) {
                console.error("Native download failed, falling back to Linking:", nativeErr);
                Linking.openURL(url).catch(() => Alert.alert("Error", "Cannot download file"));
            }
        }
    };

    const handlePrint = async (url) => {
        if (!url) {
            Alert.alert("Report Unavailable", "This diagnostic record does not have an attached digital report document to print.");
            return;
        }
        const isOnline = await checkOnlineStatus();
        if (!isOnline && url.startsWith('http')) {
            Alert.alert("Network Required", "Printing remote report documents requires an active internet connection.");
            return;
        }

        try {
            await safePrintDocument(url);
        } catch (error) {
            console.error("Print failed, falling back to open URL:", error);
            Linking.openURL(url).catch(() => Alert.alert("Error", "Unable to open or print document."));
        }
    };

    const activeList = reports.length > 0 ? reports : reduxRequests;

    const filteredReports = (activeList || []).filter((report) => {
        const matchesSearch =
            report.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.testNames?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

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
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.contentContainer, width < 400 && { padding: 16 }]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadReports(true)} colors={['#22c55e']} />
            }
        >
            <OfflineBanner
                isOffline={offlineState.isOffline}
                fromCache={offlineState.fromCache}
                lastFetchedAt={offlineState.lastFetchedAt}
            />

            <View style={[styles.header, !isLargeScreen && { flexDirection: 'column', alignItems: 'stretch' }, width < 400 && { padding: 16, marginBottom: 24 }]}>
                <View style={!isLargeScreen && { marginBottom: 15 }}>
                    <Text style={styles.headerTitle}>✅ Completed Reports</Text>
                    <Text style={styles.headerSubtitle}>Full archive of diagnostic results and patient files.</Text>
                </View>

                <View style={[styles.controls, !isLargeScreen && { flexDirection: 'column', width: '100%' }]}>
                    <View style={[styles.searchBox, !isLargeScreen && { minWidth: '100%', width: '100%' }]}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search patient or test name..."
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                    <View style={[styles.dateFilter, !isLargeScreen && { minWidth: '100%', width: '100%' }]}>
                        <DatePickerInput
                            value={filterDate}
                            onChange={(val) => setFilterDate(val || '')}
                            placeholder="Filter by date..."
                            allowClear={true}
                            style={{ width: '100%' }}
                            inputStyle={styles.datePickerInput}
                        />
                    </View>
                </View>
            </View>

            {offlineState.noCache && activeList.length === 0 ? (
                <OfflineEmptyState
                    title="No Cached Completed Reports"
                    message="Completed diagnostic records are not cached on this device yet. Connect to the network to download archived reports."
                    onRetry={() => loadReports(false)}
                />
            ) : loading && activeList.length === 0 ? (
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
                            <View key={report._id} style={[styles.card, !isLargeScreen && { minWidth: '100%', width: '100%' }]}>
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
                                        <Text style={styles.infoTitle}>{report.userId?.name || 'N/A'}</Text>
                                    </View>
                                    <View style={styles.infoBlock}>
                                        <Text style={styles.infoLabel}>👨‍⚕️ Requesting Doctor</Text>
                                        <Text style={styles.infoDesc}>Dr. {report.doctorId?.name || 'N/A'}</Text>
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

                                <View style={[styles.cardActions, width < 480 && { flexDirection: 'column' }]}>
                                    <TouchableOpacity style={[styles.btnAction, styles.btnSecondary]} onPress={() => handleView(report.reportFile?.url)}>
                                        <Text style={styles.btnSecondaryText}>👁️ View</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnAction, styles.btnPrimary]} onPress={() => handleDownload(report.reportFile?.url, report.reportFile?.name)}>
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
        minWidth: 200,
        flex: 1
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
        minWidth: 150,
        flex: 1
    },
    datePickerInput: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 45,
        justifyContent: 'center'
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
        flex: 1,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)'
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8
    },
    emptyStateText: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center'
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24
    },
    card: {
        flex: 1,
        minWidth: 320,
        maxWidth: '100%',
        backgroundColor: 'white',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    patientMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    idBadge: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0ea5e9',
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    dateMeta: {
        fontSize: 12,
        color: '#64748b'
    },
    statusPill: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20
    },
    statusPillText: {
        color: '#15803d',
        fontSize: 11,
        fontWeight: '800'
    },
    cardMain: {
        gap: 12,
        marginBottom: 20
    },
    infoBlock: {},
    infoLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 2
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a'
    },
    infoDesc: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500'
    },
    testsBlock: {
        marginTop: 4
    },
    testTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 6
    },
    testTag: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    testTagText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600'
    },
    filePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20
    },
    fileIcon: {
        fontSize: 24
    },
    filename: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b'
    },
    filesize: {
        fontSize: 11,
        color: '#10b981',
        fontWeight: '600'
    },
    cardActions: {
        flexDirection: 'row',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 16
    },
    btnAction: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnSecondary: {
        backgroundColor: '#f1f5f9'
    },
    btnSecondaryText: {
        color: '#334155',
        fontWeight: '600',
        fontSize: 13
    },
    btnPrimary: {
        backgroundColor: '#e0f2fe'
    },
    btnPrimaryText: {
        color: '#0284c7',
        fontWeight: '600',
        fontSize: 13
    },
    btnPrint: {
        backgroundColor: '#f0fdf4'
    },
    btnPrintText: {
        color: '#16a34a',
        fontWeight: '600',
        fontSize: 13
    }
});

export default CompletedReports;
