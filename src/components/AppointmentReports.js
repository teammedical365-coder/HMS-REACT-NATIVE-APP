import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { reportAPI } from '../utils/api';
import { useAuth } from '../store/hooks';
import { Feather } from '@expo/vector-icons';

const AppointmentReports = ({ appointmentId, prescriptions = [] }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    
    // AI Summary States
    const [aiLoading, setAiLoading] = useState({});
    const [aiSummaries, setAiSummaries] = useState({});
    const [aiErrors, setAiErrors] = useState({});

    const { user } = useAuth();
    const roleName = user?._roleData?.name?.toLowerCase() || (typeof user?.role === 'string' ? user.role.toLowerCase() : '');
    const isDoctor = roleName.includes('doctor');

    useEffect(() => {
        if (!appointmentId) return;
        
        setLoading(true);
        reportAPI.getReportsByAppointment(appointmentId)
            .then(res => {
                if (res.success) {
                    setReports(res.reports || []);
                }
            })
            .catch(err => console.error("Error fetching appointment reports:", err))
            .finally(() => setLoading(false));
    }, [appointmentId]);

    const isPDF = (mimetype) => mimetype === 'application/pdf' || (typeof mimetype === 'string' && mimetype.endsWith('pdf'));

    const rawFiles = [
        ...prescriptions.map(p => ({ 
            ...p, 
            name: p.name || 'Prescription',
            source: 'prescription' 
        })),
        ...reports.map(r => ({
            name: r.fileName || 'Medical Report',
            url: r.url,
            uploadedAt: r.uploadedAt,
            mimetype: r.mimeType,
            uploadedByRole: r.uploadedByRole,
            source: 'report'
        }))
    ];

    const allFiles = Array.from(new Map(rawFiles.map(f => [f.url || f.name, f])).values());

    const handleGenerateSummary = async (fileUrl, mimeType, index) => {
        setAiLoading(prev => ({ ...prev, [index]: true }));
        setAiErrors(prev => ({ ...prev, [index]: null }));
        try {
            const res = await reportAPI.generateAISummary(fileUrl, mimeType);
            if (res.success) {
                setAiSummaries(prev => ({ ...prev, [index]: res.summary }));
            } else {
                setAiErrors(prev => ({ ...prev, [index]: res.message || 'Failed to generate summary.' }));
            }
        } catch (error) {
            console.error("AI Summary error:", error);
            setAiErrors(prev => ({ ...prev, [index]: 'An error occurred while generating summary.' }));
        } finally {
            setAiLoading(prev => ({ ...prev, [index]: false }));
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({});
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setUploadFile(result.assets[0]);
            }
        } catch (err) {
            console.error("Document picking error:", err);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !appointmentId) return;
        setUploading(true);
        const formData = new FormData();
        
        formData.append('reportFile', {
            uri: uploadFile.uri,
            name: uploadFile.name,
            type: uploadFile.mimeType || 'application/octet-stream'
        });
        formData.append('appointmentId', appointmentId);
        
        try {
            const res = await reportAPI.uploadReport(formData);
            if (res.success) {
                Alert.alert('Success', 'Report uploaded successfully!');
                setUploadFile(null);
                const newRes = await reportAPI.getReportsByAppointment(appointmentId);
                if (newRes.success) {
                    setReports(newRes.reports || []);
                }
            } else {
                Alert.alert('Error', res.message || 'Failed to upload report');
            }
        } catch (err) {
            console.error("Upload error:", err);
            Alert.alert('Error', "Upload failed.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>📁 Appointment Reports & Files</Text>
            </View>
            
            <View style={styles.uploadSection}>
                <TouchableOpacity style={styles.filePickerBtn} onPress={pickDocument}>
                    <Text style={styles.filePickerText} numberOfLines={1} ellipsizeMode="middle">
                        {uploadFile ? uploadFile.name : 'Select a file...'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.uploadBtn, (uploading || !uploadFile) && styles.uploadBtnDisabled]} 
                    onPress={handleUpload} 
                    disabled={uploading || !uploadFile}
                >
                    <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Upload'}</Text>
                </TouchableOpacity>
            </View>

            {loading && <Text style={styles.loadingText}>Loading reports…</Text>}
            
            {!loading && allFiles.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📂</Text>
                    <Text style={styles.emptyText}>No uploaded reports or files for this visit.</Text>
                </View>
            )}
            
            {allFiles.length > 0 && (
                <View style={styles.fileList}>
                    {allFiles.map((f, i) => (
                        <View key={i} style={styles.fileCard}>
                            <View style={styles.fileCardHeader}>
                                <Text style={styles.fileIcon}>{isPDF(f.mimetype) ? '📄' : '🖼️'}</Text>
                                <View style={styles.fileInfo}>
                                    <Text style={styles.fileName} numberOfLines={1}>{f.name || 'Unnamed file'}</Text>
                                    <Text style={styles.fileSub}>
                                        {f.source === 'prescription' ? '📝 Prescription' : '📋 Report'}
                                        {f.uploadedByRole && ` (via ${f.uploadedByRole})`}
                                        {f.uploadedAt && ` · ${new Date(f.uploadedAt).toLocaleDateString('en-IN')}`}
                                    </Text>
                                </View>
                                
                                <View style={styles.actionRow}>
                                    {isDoctor && f.source === 'report' && f.url && (
                                        <TouchableOpacity 
                                            style={[styles.aiBtn, aiLoading[i] && styles.aiBtnDisabled]}
                                            onPress={() => handleGenerateSummary(f.url, f.mimetype, i)}
                                            disabled={aiLoading[i]}
                                        >
                                            <Text style={styles.aiBtnText}>
                                                {aiLoading[i] ? '⏳...' : '🤖 AI Summary'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {f.url ? (
                                        <TouchableOpacity 
                                            style={styles.viewBtn}
                                            onPress={() => Linking.openURL(f.url)}
                                        >
                                            <Text style={styles.viewBtnText}>{isPDF(f.mimetype) ? 'PDF' : 'View'}</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={styles.noUrlText}>No URL</Text>
                                    )}
                                </View>
                            </View>
                            
                            {/* AI Summary Display */}
                            {aiErrors[i] && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>❌ {aiErrors[i]}</Text>
                                </View>
                            )}
                            {aiSummaries[i] && (
                                <View style={styles.aiSummaryBox}>
                                    <Text style={styles.aiSummaryHeader}>🤖 AI Report Summary</Text>
                                    
                                    <View style={styles.summarySection}>
                                        <Text style={styles.summaryLabel}>Report Type:</Text>
                                        <Text style={styles.summaryValue}>{aiSummaries[i].ReportType || 'Unknown'}</Text>
                                    </View>
                                    
                                    <View style={styles.summarySection}>
                                        <Text style={styles.summaryLabel}>Overall Summary:</Text>
                                        <Text style={styles.summaryValue}>{aiSummaries[i].OverallSummary || 'No summary available.'}</Text>
                                    </View>
                                    
                                    {aiSummaries[i].ImportantFindings && aiSummaries[i].ImportantFindings.length > 0 && (
                                        <View style={styles.summarySection}>
                                            <Text style={styles.summaryLabel}>Important Findings:</Text>
                                            {aiSummaries[i].ImportantFindings.map((finding, idx) => (
                                                <Text key={idx} style={styles.bulletItem}>• {finding}</Text>
                                            ))}
                                        </View>
                                    )}
                                    
                                    {aiSummaries[i].AbnormalValues && aiSummaries[i].AbnormalValues.length > 0 && (
                                        <View style={styles.summarySection}>
                                            <Text style={[styles.summaryLabel, {color: '#ef4444'}]}>Abnormal Values:</Text>
                                            {aiSummaries[i].AbnormalValues.map((val, idx) => (
                                                <Text key={idx} style={styles.bulletItemError}>• {val}</Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginVertical: 10 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    uploadSection: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    filePickerBtn: { flex: 1, backgroundColor: 'white', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
    filePickerText: { fontSize: 13, color: '#334155' },
    uploadBtn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#3b82f6', borderRadius: 6, justifyContent: 'center' },
    uploadBtnDisabled: { opacity: 0.6 },
    uploadBtnText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
    loadingText: { color: '#94a3b8', fontSize: 13, marginVertical: 10 },
    emptyState: { alignItems: 'center', padding: 40, borderColor: '#e2e8f0', borderWidth: 1, borderStyle: 'dashed', borderRadius: 10 },
    emptyIcon: { fontSize: 32, marginBottom: 8 },
    emptyText: { color: '#94a3b8', fontSize: 14 },
    fileList: { gap: 10 },
    fileCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
    fileCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    fileIcon: { fontSize: 24 },
    fileInfo: { flex: 1 },
    fileName: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
    fileSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    aiBtn: { backgroundColor: '#8b5cf6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    aiBtnDisabled: { opacity: 0.7 },
    aiBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    viewBtn: { backgroundColor: '#3b82f6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    viewBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    noUrlText: { color: '#94a3b8', fontSize: 12 },
    errorBox: { padding: 10, backgroundColor: '#fee2e2', borderTopWidth: 1, borderTopColor: '#fecaca' },
    errorText: { color: '#991b1b', fontSize: 12 },
    aiSummaryBox: { padding: 16, backgroundColor: '#f5f3ff', borderTopWidth: 1, borderTopColor: '#ede9fe' },
    aiSummaryHeader: { marginVertical: 8, color: '#5b21b6', fontSize: 14, fontWeight: 'bold' },
    summarySection: { marginBottom: 10 },
    summaryLabel: { fontSize: 12, color: '#4c1d95', fontWeight: 'bold' },
    summaryValue: { fontSize: 13, color: '#334155', marginTop: 2, lineHeight: 20 },
    bulletItem: { fontSize: 13, color: '#334155', marginLeft: 8, marginTop: 2 },
    bulletItemError: { fontSize: 13, color: '#b91c1c', marginLeft: 8, marginTop: 2 }
});

export default AppointmentReports;
