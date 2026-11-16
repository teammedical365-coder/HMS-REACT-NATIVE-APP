import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ipdClinicalAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import { useBranding } from '../../context/BrandingContext';

const ProgressNotesModal = ({
    visible,
    onClose,
    admissionId,
    patient,
    admission
}) => {
    const { user } = useAuth();
    const { branding } = useBranding();

    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // New Note Form
    const [noteText, setNoteText] = useState('');
    const [sheetNo, setSheetNo] = useState('1');

    // Edit Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editText, setEditText] = useState('');
    const [editReason, setEditReason] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    // Expand History
    const [expandedHistory, setExpandedHistory] = useState({});

    const loadProgressNotes = useCallback(async () => {
        if (!admissionId) return;
        setLoading(true);
        try {
            const res = await ipdClinicalAPI.getProgressNotes(admissionId);
            setNotes(res?.notes || res?.data || []);
        } catch (err) {
            console.error('Error fetching progress notes:', err);
            Alert.alert('Error', 'Unable to load progress notes.');
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => {
        if (visible) {
            loadProgressNotes();
        }
    }, [visible, loadProgressNotes]);

    const handleAddNote = async () => {
        const text = noteText.trim();
        if (!text) {
            Alert.alert('Validation', 'Please enter progress note text.');
            return;
        }

        setSubmitting(true);
        try {
            await ipdClinicalAPI.addProgressNote(admissionId, {
                note: text,
                sheetNo: sheetNo || '1',
                recordedAt: new Date()
            });
            setNoteText('');
            loadProgressNotes();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to save progress note.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEdit = (item) => {
        setEditingNoteId(item._id);
        setEditText(item.note);
        setEditReason('');
        setEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editText.trim()) {
            Alert.alert('Validation', 'Progress note text cannot be empty.');
            return;
        }
        if (!editReason.trim()) {
            Alert.alert('Audit Requirement', 'Please specify the reason for editing (NABH Mandatory).');
            return;
        }

        setSavingEdit(true);
        try {
            await ipdClinicalAPI.editProgressNote(admissionId, editingNoteId, {
                note: editText.trim(),
                editReason: editReason.trim()
            });
            setEditModalOpen(false);
            setEditingNoteId(null);
            setEditText('');
            setEditReason('');
            loadProgressNotes();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to update progress note.');
        } finally {
            setSavingEdit(false);
        }
    };

    const toggleHistory = (id) => {
        setExpandedHistory(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const formatTimestamp = (dateVal) => {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const handlePrintOrPdf = async () => {
        setDownloading(true);
        try {
            const hospitalName = branding?.customHospitalName || branding?.hospitalName || 'Medical 365 Super Speciality Hospital';
            const patientName = patient?.name || admission?.patientId?.name || 'Inpatient';
            const uhid = patient?.uhid || patient?.patientId || '—';
            const ipdNo = admission?.ipdNumber || admission?.admissionId || '—';

            const rowsHtml = notes.map((n, idx) => `
                <tr>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; width: 15%;">${formatTimestamp(n.recordedAt || n.createdAt)}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; width: 8%;">Sheet #${n.sheetNo || '1'}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; width: 57%; line-height: 1.5;">${n.note}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; width: 20%; font-size: 10px;">${n.authorName || 'Staff'}<br/><span style="color: #64748b;">${n.authorRole || 'Nurse'}</span></td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>IPD Clinical Progress Notes</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 15px; color: #0f172a; font-size: 11px; }
                        .hdr { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 6px; margin-bottom: 8px; }
                        .hosp-title { font-size: 18px; font-weight: 800; color: #0f172a; }
                        .chart-name { font-size: 13px; font-weight: 700; color: #0d9488; }
                        table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 10px; }
                        th { background: #0d9488; color: #ffffff; padding: 6px; border: 1px solid #0f766e; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="hdr">
                        <div class="hosp-title">${hospitalName}</div>
                        <div class="chart-name">CLINICAL PROGRESS NOTES (NABH COP.1)</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 10.5px; background: #f8fafc; padding: 6px 10px; border: 1px solid #e2e8f0; margin-bottom: 10px;">
                        <span><strong>Patient:</strong> ${patientName}</span>
                        <span><strong>UHID:</strong> ${uhid}</span>
                        <span><strong>IPD No:</strong> ${ipdNo}</span>
                        <span><strong>Printed:</strong> ${new Date().toLocaleDateString('en-GB')}</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date &amp; Time</th>
                                <th>Sheet</th>
                                <th>Clinical Progress Notes &amp; Observations</th>
                                <th>Staff Sign-off</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="4" style="text-align: center; padding: 15px;">No progress notes documented</td></tr>'}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Success', 'PDF generated successfully.');
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to generate PDF.');
        } finally {
            setDownloading(false);
        }
    };

    const renderItem = ({ item }) => {
        const hasHistory = Array.isArray(item.editHistory) && item.editHistory.length > 0;
        const isHistoryExpanded = !!expandedHistory[item._id];

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.badgeRow}>
                        <View style={styles.sheetBadge}>
                            <Text style={styles.sheetBadgeText}>Sheet #{item.sheetNo || '1'}</Text>
                        </View>
                        <Text style={styles.authorText}>
                            {item.authorName || 'Staff'} ({item.authorRole || 'Nurse'})
                        </Text>
                    </View>
                    <Text style={styles.timeText}>{formatTimestamp(item.recordedAt || item.createdAt)}</Text>
                </View>

                <Text style={styles.noteContent}>{item.note}</Text>

                <View style={styles.cardFooter}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEdit(item)}>
                        <Feather name="edit-2" size={12} color="#0d9488" />
                        <Text style={styles.editBtnText}>Edit Note</Text>
                    </TouchableOpacity>

                    {hasHistory && (
                        <TouchableOpacity style={styles.historyBtn} onPress={() => toggleHistory(item._id)}>
                            <Feather name="clock" size={12} color="#64748b" />
                            <Text style={styles.historyBtnText}>
                                {isHistoryExpanded ? 'Hide History' : `Edit Reason & History (${item.editHistory.length})`}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {isHistoryExpanded && hasHistory && (
                    <View style={styles.historyContainer}>
                        <Text style={styles.historyHeader}>Mandatory Revision Audit Trail:</Text>
                        {item.editHistory.map((h, i) => (
                            <View key={i} style={styles.historyItem}>
                                <Text style={styles.historyPreviousNote}>"{h.previousNote}"</Text>
                                <Text style={styles.historyReason}>Reason: {h.editReason || 'Correction'}</Text>
                                <Text style={styles.historyBy}>
                                    Edited by {h.editedByName || 'Staff'} ({h.editedByRole || 'Nurse'}) on {formatTimestamp(h.editedAt)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <View style={styles.modalBox}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>In-Patient Progress Notes</Text>
                            <Text style={styles.subtitle}>
                                Patient: {patient?.name || admission?.patientId?.name || 'Inpatient'} | IPD #{admission?.ipdNumber || '—'}
                            </Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.pdfBtn} onPress={handlePrintOrPdf} disabled={downloading}>
                                {downloading ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="printer" size={13} color="#ffffff" />
                                        <Text style={styles.pdfBtnText}>Print / PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Body */}
                    {loading ? (
                        <View style={styles.centerLoading}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={styles.loadingText}>Loading progress notes...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={notes}
                            keyExtractor={item => item._id || String(Math.random())}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Feather name="file-text" size={36} color="#cbd5e1" />
                                    <Text style={styles.emptyText}>No clinical progress notes recorded.</Text>
                                    <Text style={styles.emptySub}>Add patient progression notes below.</Text>
                                </View>
                            }
                        />
                    )}

                    {/* Compose Bar */}
                    <View style={styles.composeContainer}>
                        <View style={styles.sheetSelectorRow}>
                            <Text style={styles.sheetLabel}>Continuation Sheet:</Text>
                            {['1', '2', '3', '4'].map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.sheetChip, sheetNo === s && styles.sheetChipActive]}
                                    onPress={() => setSheetNo(s)}
                                >
                                    <Text style={[styles.sheetChipText, sheetNo === s && styles.sheetChipTextActive]}>
                                        Sheet {s}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.composeInput}
                                multiline
                                placeholder="Record daily clinical progression, patient response, and treatment changes..."
                                placeholderTextColor="#94a3b8"
                                value={noteText}
                                onChangeText={setNoteText}
                            />
                            <TouchableOpacity
                                style={[styles.addBtn, (!noteText.trim() || submitting) && styles.addBtnDisabled]}
                                onPress={handleAddNote}
                                disabled={!noteText.trim() || submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Feather name="plus" size={20} color="#ffffff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Mandatory Edit Reason Modal */}
                    <Modal visible={editModalOpen} transparent animationType="fade">
                        <View style={styles.subModalOverlay}>
                            <View style={styles.subModalBox}>
                                <Text style={styles.subModalTitle}>Edit Clinical Progress Note</Text>
                                <Text style={styles.subModalNotice}>
                                    NABH COP.1 requires an audit trail with explicit correction reason for all medical record modifications.
                                </Text>
                                <TextInput
                                    style={styles.editInputArea}
                                    multiline
                                    value={editText}
                                    onChangeText={setEditText}
                                />
                                <TextInput
                                    style={styles.reasonInput}
                                    placeholder="Enter mandatory reason for edit *"
                                    placeholderTextColor="#f87171"
                                    value={editReason}
                                    onChangeText={setEditReason}
                                />
                                <View style={styles.subModalActions}>
                                    <TouchableOpacity style={styles.subCancel} onPress={() => setEditModalOpen(false)}>
                                        <Text style={styles.subCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.subSubmit, (!editText.trim() || !editReason.trim() || savingEdit) && styles.subSubmitDisabled]}
                                        onPress={handleSaveEdit}
                                        disabled={!editText.trim() || !editReason.trim() || savingEdit}
                                    >
                                        <Text style={styles.subSubmitText}>{savingEdit ? 'Saving...' : 'Save Revision'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '88%',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    pdfBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    closeBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
    },
    centerLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 13,
        color: '#64748b',
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 10,
    },
    emptySub: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sheetBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    sheetBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
    },
    authorText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    timeText: {
        fontSize: 11,
        color: '#94a3b8',
    },
    noteContent: {
        fontSize: 13,
        color: '#1e293b',
        lineHeight: 19,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editBtnText: {
        fontSize: 11,
        color: '#0d9488',
        fontWeight: '600',
    },
    historyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    historyBtnText: {
        fontSize: 11,
        color: '#64748b',
    },
    historyContainer: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    historyHeader: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 4,
    },
    historyItem: {
        marginBottom: 6,
    },
    historyPreviousNote: {
        fontSize: 11,
        color: '#64748b',
        fontStyle: 'italic',
    },
    historyReason: {
        fontSize: 10,
        color: '#b91c1c',
        fontWeight: '600',
        marginTop: 2,
    },
    historyBy: {
        fontSize: 9,
        color: '#94a3b8',
    },
    composeContainer: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    sheetSelectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    sheetLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    sheetChip: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    sheetChipActive: {
        backgroundColor: '#0d9488',
    },
    sheetChipText: {
        fontSize: 10,
        color: '#475569',
        fontWeight: '500',
    },
    sheetChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    composeInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        maxHeight: 80,
    },
    addBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#0d9488',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
    subModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    subModalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        width: '100%',
        maxWidth: 380,
    },
    subModalTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 6,
    },
    subModalNotice: {
        fontSize: 11,
        color: '#64748b',
        marginBottom: 10,
        lineHeight: 15,
    },
    editInputArea: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        minHeight: 80,
        marginBottom: 10,
        textAlignVertical: 'top',
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        color: '#991b1b',
        backgroundColor: '#fef2f2',
        marginBottom: 10,
    },
    subModalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    subCancel: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    subCancelText: {
        fontSize: 12,
        color: '#64748b',
    },
    subSubmit: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#0d9488',
    },
    subSubmitDisabled: {
        backgroundColor: '#94a3b8',
    },
    subSubmitText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default ProgressNotesModal;

