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
import { ipdClinicalAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';

const InpatientCommunicationModal = ({
    visible,
    onClose,
    admissionId,
    patientName,
    ipdNumber
}) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [inputText, setInputText] = useState('');
    const [senderRole, setSenderRole] = useState('Nurse');
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [expandedHistory, setExpandedHistory] = useState({});

    const loadNotes = useCallback(async () => {
        if (!admissionId) return;
        setLoading(true);
        try {
            const res = await ipdClinicalAPI.getPatientNurseCommunication(admissionId);
            setMessages(res?.messages || res?.data || []);
        } catch (err) {
            console.error('Error loading communication notes:', err);
            Alert.alert('Error', 'Unable to load communication notes.');
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => {
        if (visible) {
            loadNotes();
        }
    }, [visible, loadNotes]);

    const handleSendNote = async () => {
        const text = inputText.trim();
        if (!text) {
            Alert.alert('Validation', 'Please enter a note before adding.');
            return;
        }

        setSending(true);
        try {
            await ipdClinicalAPI.addPatientNurseCommunication(admissionId, {
                message: text,
                senderRole: senderRole || 'Nurse'
            });
            setInputText('');
            loadNotes();
        } catch (err) {
            console.error('Error adding communication note:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Failed to add note.');
        } finally {
            setSending(false);
        }
    };

    const handleStartEdit = (item) => {
        setEditingNoteId(item._id);
        setEditingText(item.message);
    };

    const handleSaveEdit = async () => {
        const text = editingText.trim();
        if (!text) {
            Alert.alert('Validation', 'Note text cannot be empty.');
            return;
        }

        try {
            await ipdClinicalAPI.editPatientNurseCommunication(admissionId, editingNoteId, {
                message: text
            });
            setEditingNoteId(null);
            setEditingText('');
            loadNotes();
        } catch (err) {
            console.error('Error editing note:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Failed to edit note.');
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
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const canEdit = (item) => {
        const uId = user?._id || user?.userId || user?.id;
        const sId = item?.senderId?._id || item?.senderId;
        const isAuthor = uId && String(uId) === String(sId);
        const isAdmin = ['superadmin', 'centraladmin', 'hospitaladmin'].includes((user?.role || '').toLowerCase());
        return isAuthor || isAdmin;
    };

    const renderItem = ({ item }) => {
        const isBeingEdited = editingNoteId === item._id;
        const hasHistory = Array.isArray(item.editHistory) && item.editHistory.length > 0;
        const isHistoryExpanded = !!expandedHistory[item._id];

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.badgeRow}>
                        <View style={[styles.roleBadge, item.senderRole === 'Doctor' ? styles.doctorBadge : styles.nurseBadge]}>
                            <Text style={styles.roleBadgeText}>{item.senderRole || 'Nurse'}</Text>
                        </View>
                        <Text style={styles.authorName}>{item.senderName || 'Clinical Staff'}</Text>
                    </View>
                    <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
                </View>

                {isBeingEdited ? (
                    <View style={styles.editContainer}>
                        <TextInput
                            style={styles.editInput}
                            multiline
                            value={editingText}
                            onChangeText={setEditingText}
                        />
                        <View style={styles.editActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingNoteId(null)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                                <Text style={styles.saveBtnText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <Text style={styles.messageText}>{item.message}</Text>
                )}

                <View style={styles.cardFooter}>
                    {canEdit(item) && !isBeingEdited && (
                        <TouchableOpacity style={styles.editLink} onPress={() => handleStartEdit(item)}>
                            <Feather name="edit-2" size={12} color="#0d9488" />
                            <Text style={styles.editLinkText}>Edit Note</Text>
                        </TouchableOpacity>
                    )}

                    {hasHistory && (
                        <TouchableOpacity style={styles.historyToggle} onPress={() => toggleHistory(item._id)}>
                            <Feather name="clock" size={12} color="#64748b" />
                            <Text style={styles.historyToggleText}>
                                {isHistoryExpanded ? 'Hide Edit History' : `Edit History (${item.editHistory.length})`}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {isHistoryExpanded && hasHistory && (
                    <View style={styles.historyBox}>
                        <Text style={styles.historyTitle}>Audit Trail / Previous Revisions:</Text>
                        {item.editHistory.map((h, idx) => (
                            <View key={idx} style={styles.historyItem}>
                                <Text style={styles.historyText}>"{h.previousMessage}"</Text>
                                <Text style={styles.historyMeta}>
                                    Edited by {h.editedByName || 'Staff'} on {formatTimestamp(h.editedAt)}
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
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Inpatient Communication &amp; Add Note</Text>
                            <Text style={styles.subtitle}>
                                Patient: {patientName || 'Inpatient'} | IPD #{ipdNumber || '—'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Feather name="x" size={20} color="#475569" />
                        </TouchableOpacity>
                    </View>

                    {/* Message List */}
                    {loading ? (
                        <View style={styles.centerLoading}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={styles.loadingText}>Loading notes...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={messages}
                            keyExtractor={(item) => item._id || String(Math.random())}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Feather name="message-square" size={36} color="#cbd5e1" />
                                    <Text style={styles.emptyText}>No communication notes recorded yet.</Text>
                                    <Text style={styles.emptySub}>Add bedside observations or notes below.</Text>
                                </View>
                            }
                        />
                    )}

                    {/* Compose Input */}
                    <View style={styles.composeContainer}>
                        <View style={styles.roleSelector}>
                            {['Nurse', 'Doctor', 'Authorized Staff'].map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.roleChip, senderRole === r && styles.roleChipActive]}
                                    onPress={() => setSenderRole(r)}
                                >
                                    <Text style={[styles.roleChipText, senderRole === r && styles.roleChipTextActive]}>
                                        {r}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.composeInput}
                                placeholder="Type nurse observation or clinical note..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                value={inputText}
                                onChangeText={setInputText}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
                                onPress={handleSendNote}
                                disabled={!inputText.trim() || sending}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Feather name="send" size={18} color="#ffffff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
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
    container: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '85%',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#f8fafc',
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
        fontSize: 13,
        color: '#64748b',
        marginTop: 8,
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
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
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
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    nurseBadge: {
        backgroundColor: '#ccfbf1',
    },
    doctorBadge: {
        backgroundColor: '#e0e7ff',
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0f766e',
    },
    authorName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    timestamp: {
        fontSize: 11,
        color: '#94a3b8',
    },
    messageText: {
        fontSize: 13,
        color: '#1e293b',
        lineHeight: 19,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    editLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editLinkText: {
        fontSize: 11,
        color: '#0d9488',
        fontWeight: '600',
    },
    historyToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    historyToggleText: {
        fontSize: 11,
        color: '#64748b',
    },
    historyBox: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    historyTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 4,
    },
    historyItem: {
        marginBottom: 4,
    },
    historyText: {
        fontSize: 11,
        color: '#64748b',
        fontStyle: 'italic',
    },
    historyMeta: {
        fontSize: 9,
        color: '#94a3b8',
    },
    editContainer: {
        marginTop: 4,
    },
    editInput: {
        borderWidth: 1,
        borderColor: '#0d9488',
        borderRadius: 8,
        padding: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f0fdfa',
        minHeight: 60,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 6,
    },
    cancelBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        fontSize: 12,
        color: '#64748b',
    },
    saveBtn: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#0d9488',
    },
    saveBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    composeContainer: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    roleSelector: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    roleChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    roleChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    roleChipText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '500',
    },
    roleChipTextActive: {
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
        maxHeight: 90,
    },
    sendBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#0d9488',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
});

export default InpatientCommunicationModal;

