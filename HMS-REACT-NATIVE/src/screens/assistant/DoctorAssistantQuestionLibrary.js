import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Modal,
    useWindowDimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getOfflineQuestionLibrary, getOfflineAssistantDoctors } from '../../services/offline/offlineAssistantService';
import OfflineBanner from '../../components/OfflineBanner';

const DEPT_ICONS = {
    'Cardiology': '🫀',
    'ENT': '👂',
    'Orthopedics': '🦴',
    'Pediatrics': '👶',
    'Gynecology & Obstetrics': '🤰',
    'Dermatology': '🧴',
    'Ophthalmology': '👁️',
    'Neurology': '🧠',
    'Gastroenterology': '🩺',
    'Pulmonology': '🫁',
    'Dentistry': '🦷',
    'IVF & Fertility': '🔬',
    'General Surgery': '🔪',
    'Urology': '🚽',
    'Nephrology': '🩺',
    'Oncology': '🎗️',
    'Psychiatry': '🧠',
    'General Medicine': '🏥',
    'General': '🏥'
};

const DoctorAssistantQuestionLibrary = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const initialDept = route.params?.dept || '';
    const initialDocId = route.params?.doctorId || '';

    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [authorizedDepartments, setAuthorizedDepartments] = useState([]);
    const [allDepartments, setAllDepartments] = useState([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState(initialDocId);
    const [selectedDepartment, setSelectedDepartment] = useState(initialDept);
    const [libraryData, setLibraryData] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState({});
    const [allExpanded, setAllExpanded] = useState(true);

    // Interactive Preview Answers State
    const [previewAnswers, setPreviewAnswers] = useState({});

    // Filter modals
    const [showDocModal, setShowDocModal] = useState(false);
    const [showDeptModal, setShowDeptModal] = useState(false);

    const fetchLibrary = useCallback(async (dept = selectedDepartment, docId = selectedDoctorId, isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await getOfflineQuestionLibrary({
                department: dept || undefined,
                doctorId: docId || undefined
            }, !isSilent);

            if (res) {
                setDoctors(res.doctors || []);
                setAuthorizedDepartments(res.authorizedDepartments || []);
                setAllDepartments(res.allDepartments || []);
                setLibraryData(res.data || {});

                // Default expand all categories
                if (res.data) {
                    const expanded = {};
                    Object.entries(res.data).forEach(([deptKey, categories]) => {
                        Object.keys(categories || {}).forEach(catKey => {
                            expanded[`${deptKey}_${catKey}`] = true;
                        });
                    });
                    setExpandedCategories(expanded);
                    setAllExpanded(true);
                }
            }
        } catch (error) {
            console.error('Question library load error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDepartment, selectedDoctorId]);

    useEffect(() => {
        fetchLibrary(selectedDepartment, selectedDoctorId);
    }, [fetchLibrary, selectedDepartment, selectedDoctorId]);

    const handleDoctorChange = (docId) => {
        setSelectedDoctorId(docId);
        if (docId) {
            const doc = doctors.find(d => String(d._id) === String(docId));
            if (doc) {
                const docDept = doc.departments?.[0] || doc.specialty || '';
                if (docDept) {
                    setSelectedDepartment(docDept.trim());
                }
            }
        }
    };

    const toggleCategory = (categoryKey) => {
        setExpandedCategories(prev => ({
            ...prev,
            [categoryKey]: !prev[categoryKey]
        }));
    };

    const toggleAllCategories = () => {
        const nextState = !allExpanded;
        const updated = {};
        Object.entries(libraryData).forEach(([deptKey, categories]) => {
            Object.keys(categories || {}).forEach(catKey => {
                updated[`${deptKey}_${catKey}`] = nextState;
            });
        });
        setExpandedCategories(updated);
        setAllExpanded(nextState);
    };

    const departmentOptions = useMemo(() => {
        const set = new Set([...allDepartments, ...authorizedDepartments]);
        return Array.from(set).map(s => s && s.trim()).filter(Boolean).sort();
    }, [allDepartments, authorizedDepartments]);

    const totalQuestionsCount = useMemo(() => {
        let count = 0;
        Object.values(libraryData).forEach(categories => {
            Object.values(categories || {}).forEach(questions => {
                if (Array.isArray(questions)) count += questions.length;
            });
        });
        return count;
    }, [libraryData]);

    const selectedDocObj = useMemo(() => {
        if (!selectedDoctorId) return null;
        return doctors.find(d => String(d._id) === String(selectedDoctorId));
    }, [doctors, selectedDoctorId]);

    const handleOptionSelect = (qKey, optionVal, isMulti = false) => {
        setPreviewAnswers(prev => {
            if (isMulti) {
                const current = Array.isArray(prev[qKey]) ? prev[qKey] : [];
                const updated = current.includes(optionVal)
                    ? current.filter(item => item !== optionVal)
                    : [...current, optionVal];
                return { ...prev, [qKey]: updated };
            }
            return {
                ...prev,
                [qKey]: prev[qKey] === optionVal ? '' : optionVal
            };
        });
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchLibrary(selectedDepartment, selectedDoctorId, true)} />
            }
        >
            <OfflineBanner />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <View style={styles.titleRow}>
                        <Feather name="book-open" size={24} color="#0ea5e9" />
                        <Text style={styles.title}>Clinical Intake & Question Library</Text>
                    </View>
                    <View style={styles.countPillRow}>
                        <View style={styles.countPill}>
                            <Text style={styles.countPillText}>{totalQuestionsCount} Questions</Text>
                        </View>
                        <Text style={styles.subtitle}>
                            Department & Doctor-specific clinical questionnaires with structured answer options
                        </Text>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={() => navigation.navigate('DoctorAssistantDashboard')}
                    >
                        <Feather name="arrow-left" size={14} color="#0f172a" />
                        <Text style={styles.btnSecondaryText}>Dashboard</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={toggleAllCategories}
                    >
                        <Feather name={allExpanded ? "minimize-2" : "maximize-2"} size={14} color="#0f172a" />
                        <Text style={styles.btnSecondaryText}>{allExpanded ? 'Collapse All' : 'Expand All'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={() => fetchLibrary(selectedDepartment, selectedDoctorId, true)}
                        disabled={loading}
                    >
                        <Feather name="refresh-cw" size={14} color="#0f172a" />
                        <Text style={styles.btnSecondaryText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterCard}>
                <View style={styles.searchBox}>
                    <Feather name="search" size={16} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search symptoms, protocols, or questions..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Feather name="x" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={styles.filterPillsRow}>
                    <TouchableOpacity
                        style={[styles.filterPill, selectedDoctorId && styles.filterPillActive]}
                        onPress={() => setShowDocModal(true)}
                    >
                        <Feather name="user" size={12} color={selectedDoctorId ? '#0284c7' : '#64748b'} />
                        <Text style={[styles.filterPillText, selectedDoctorId && styles.filterPillTextActive]}>
                            {selectedDocObj ? selectedDocObj.name : `All Doctors (${doctors.length})`}
                        </Text>
                        <Feather name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, selectedDepartment && styles.filterPillActive]}
                        onPress={() => setShowDeptModal(true)}
                    >
                        <Feather name="layers" size={12} color={selectedDepartment ? '#0284c7' : '#64748b'} />
                        <Text style={[styles.filterPillText, selectedDepartment && styles.filterPillTextActive]}>
                            {selectedDepartment ? `${DEPT_ICONS[selectedDepartment] || '🏥'} ${selectedDepartment}` : `All Specialties (${departmentOptions.length})`}
                        </Text>
                        <Feather name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>

                    {(selectedDoctorId || selectedDepartment || searchQuery) ? (
                        <TouchableOpacity
                            style={styles.resetBtn}
                            onPress={() => {
                                setSelectedDoctorId('');
                                setSelectedDepartment('');
                                setSearchQuery('');
                            }}
                        >
                            <Text style={styles.resetBtnText}>Reset</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* Doctor Picker Modal */}
            <Modal visible={showDocModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Doctor</Text>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => { handleDoctorChange(''); setShowDocModal(false); }}
                        >
                            <Text style={styles.modalOptionText}>All Hospital Doctors ({doctors.length})</Text>
                        </TouchableOpacity>
                        {doctors.map(doc => (
                            <TouchableOpacity
                                key={doc._id}
                                style={styles.modalOption}
                                onPress={() => { handleDoctorChange(doc._id); setShowDocModal(false); }}
                            >
                                <Text style={styles.modalOptionText}>👨‍⚕️ {doc.name} {doc.specialty ? `(${doc.specialty})` : ''}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDocModal(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Department Picker Modal */}
            <Modal visible={showDeptModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Department / Specialty</Text>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => { setSelectedDepartment(''); setShowDeptModal(false); }}
                        >
                            <Text style={styles.modalOptionText}>All Specialties ({departmentOptions.length})</Text>
                        </TouchableOpacity>
                        {departmentOptions.map(dept => (
                            <TouchableOpacity
                                key={dept}
                                style={styles.modalOption}
                                onPress={() => { setSelectedDepartment(dept); setShowDeptModal(false); }}
                            >
                                <Text style={styles.modalOptionText}>{DEPT_ICONS[dept] || '🏥'} {dept}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDeptModal(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Selected Doctor Info Card */}
            {selectedDocObj && (
                <View style={styles.docBanner}>
                    <View style={styles.docAvatar}>
                        <Text style={styles.docAvatarText}>👨‍⚕️</Text>
                    </View>
                    <View style={styles.docBannerInfo}>
                        <View style={styles.docNameRow}>
                            <Text style={styles.docBannerName}>{selectedDocObj.name}</Text>
                            <View style={styles.docActiveTag}>
                                <Text style={styles.docActiveTagText}>Active Protocol</Text>
                            </View>
                        </View>
                        <Text style={styles.docBannerMeta}>
                            Specialty: {selectedDocObj.specialty || 'General'} • Departments: {(selectedDocObj.departments || [selectedDepartment || 'General']).join(', ')}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.clearDocBtn}
                        onPress={() => {
                            setSelectedDoctorId('');
                            setSelectedDepartment('');
                        }}
                    >
                        <Text style={styles.clearDocBtnText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Library Content */}
            {loading ? (
                <View style={styles.emptyCard}>
                    <ActivityIndicator size="small" color="#0ea5e9" />
                    <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading Question Library & Answer Options...</Text>
                </View>
            ) : Object.keys(libraryData).length === 0 ? (
                <View style={styles.emptyCard}>
                    <Feather name="book-open" size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyTitle}>No protocols found</Text>
                    <Text style={styles.emptyText}>Try clearing the search query or selecting a different department.</Text>
                </View>
            ) : (
                Object.entries(libraryData).map(([deptName, categories]) => {
                    const categoryEntries = Object.entries(categories || {});
                    if (categoryEntries.length === 0) return null;

                    const icon = DEPT_ICONS[deptName] || '🏥';

                    return (
                        <View key={deptName} style={styles.deptSection}>
                            <View style={styles.deptHeader}>
                                <View style={styles.deptTitleRow}>
                                    <Text style={styles.deptIcon}>{icon}</Text>
                                    <Text style={styles.deptTitle}>{deptName}</Text>
                                </View>
                                <View style={styles.deptBadge}>
                                    <Text style={styles.deptBadgeText}>
                                        {categoryEntries.length} {categoryEntries.length === 1 ? 'Protocol' : 'Protocols'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.categoriesList}>
                                {categoryEntries.map(([catName, questions]) => {
                                    const qList = Array.isArray(questions) ? questions : [];
                                    const filteredQuestions = searchQuery.trim()
                                        ? qList.filter(q =>
                                            (q.q || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            (catName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            (deptName || '').toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        : qList;

                                    if (searchQuery.trim() && filteredQuestions.length === 0) {
                                        return null;
                                    }

                                    const catKey = `${deptName}_${catName}`;
                                    const isExpanded = expandedCategories[catKey] ?? true;

                                    return (
                                        <View key={catName} style={[styles.categoryCard, isExpanded && styles.categoryCardExpanded]}>
                                            <TouchableOpacity
                                                style={styles.catHeader}
                                                onPress={() => toggleCategory(catKey)}
                                            >
                                                <View style={styles.catHeaderLeft}>
                                                    <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={16} color="#0ea5e9" />
                                                    <Text style={styles.catTitle}>{catName}</Text>
                                                </View>
                                                <View style={styles.catCountBadge}>
                                                    <Text style={styles.catCountBadgeText}>{qList.length} Questions</Text>
                                                </View>
                                            </TouchableOpacity>

                                            <Text style={styles.catSnippet} numberOfLines={1}>
                                                {qList[0]?.q ? `“${qList[0].q}”` : 'Standard clinical intake protocol'}
                                            </Text>

                                            {isExpanded && (
                                                <View style={styles.questionsDrawer}>
                                                    {filteredQuestions.map((qItem, qIdx) => {
                                                        const qType = qItem.type || 'text';
                                                        const qUniqueKey = `${deptName}_${catName}_${qIdx}`;
                                                        const currentAnswer = previewAnswers[qUniqueKey];

                                                        let optionsList = qItem.options || [];
                                                        if (qType === 'yes-no' && (!optionsList || optionsList.length === 0)) {
                                                            optionsList = ['Yes', 'No'];
                                                        }

                                                        const isMulti = qType === 'checkbox-group';

                                                        return (
                                                            <View key={qIdx} style={styles.qItem}>
                                                                <View style={styles.qTop}>
                                                                    <Text style={styles.qText}>
                                                                        <Text style={styles.qNum}>{qIdx + 1}. </Text>
                                                                        {qItem.q}
                                                                    </Text>
                                                                    <View style={[styles.qTypePill, styles[`type_${qType}`] || styles.type_text]}>
                                                                        <Text style={styles.qTypePillText}>
                                                                            {qType === 'yes-no' ? 'Yes / No' :
                                                                             qType === 'checkbox-group' ? 'Multi Choice' :
                                                                             qType === 'select' ? 'Single Choice' :
                                                                             qType === 'textarea' ? 'Notes' : 'Text'}
                                                                        </Text>
                                                                    </View>
                                                                </View>

                                                                {/* Options Section */}
                                                                <View style={styles.optionsWrap}>
                                                                    {qType === 'yes-no' ? (
                                                                        <View style={styles.yesNoRow}>
                                                                            <TouchableOpacity
                                                                                style={[styles.optionBtn, currentAnswer === 'Yes' && styles.optionBtnYesActive]}
                                                                                onPress={() => handleOptionSelect(qUniqueKey, 'Yes')}
                                                                            >
                                                                                <Feather name="check" size={14} color={currentAnswer === 'Yes' ? '#ffffff' : '#059669'} />
                                                                                <Text style={[styles.optionBtnText, currentAnswer === 'Yes' && styles.optionBtnTextActive]}>Yes</Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                style={[styles.optionBtn, currentAnswer === 'No' && styles.optionBtnNoActive]}
                                                                                onPress={() => handleOptionSelect(qUniqueKey, 'No')}
                                                                            >
                                                                                <Feather name="x" size={14} color={currentAnswer === 'No' ? '#ffffff' : '#ef4444'} />
                                                                                <Text style={[styles.optionBtnText, currentAnswer === 'No' && styles.optionBtnTextActive]}>No</Text>
                                                                            </TouchableOpacity>
                                                                        </View>
                                                                    ) : optionsList && optionsList.length > 0 ? (
                                                                        <View style={styles.pillsList}>
                                                                            {optionsList.map((opt, oIdx) => {
                                                                                const isSelected = isMulti
                                                                                    ? Array.isArray(currentAnswer) && currentAnswer.includes(opt)
                                                                                    : currentAnswer === opt;
                                                                                return (
                                                                                    <TouchableOpacity
                                                                                        key={oIdx}
                                                                                        style={[styles.pillBtn, isSelected && styles.pillBtnSelected]}
                                                                                        onPress={() => handleOptionSelect(qUniqueKey, opt, isMulti)}
                                                                                    >
                                                                                        <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                                                                                            {isSelected ? (
                                                                                                <Feather name="check" size={10} color="#ffffff" />
                                                                                            ) : null}
                                                                                        </View>
                                                                                        <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextSelected]}>
                                                                                            {opt}
                                                                                        </Text>
                                                                                    </TouchableOpacity>
                                                                                );
                                                                            })}
                                                                        </View>
                                                                    ) : (
                                                                        <View style={styles.textPlaceholderWrap}>
                                                                            <Feather name="edit-3" size={12} color="#0ea5e9" />
                                                                            <Text style={styles.textPlaceholder}>
                                                                                Text intake response entered by Assistant during consultation preparation
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    countPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
        flexWrap: 'wrap',
    },
    countPill: {
        backgroundColor: '#e0f2fe',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    countPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0284c7',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 12,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    btnSecondary: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnSecondaryText: {
        color: '#0f172a',
        fontWeight: '600',
        fontSize: 12,
    },
    filterCard: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 16,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 42,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
    },
    filterPillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
        alignItems: 'center',
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterPillActive: {
        backgroundColor: '#e0f2fe',
        borderColor: '#38bdf8',
    },
    filterPillText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '500',
    },
    filterPillTextActive: {
        color: '#0284c7',
        fontWeight: '700',
    },
    resetBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    resetBtnText: {
        fontSize: 12,
        color: '#ef4444',
        fontWeight: '600',
    },
    docBanner: {
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        borderRadius: 10,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    docAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    docAvatarText: {
        fontSize: 18,
    },
    docBannerInfo: {
        flex: 1,
    },
    docNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    docBannerName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0369a1',
    },
    docActiveTag: {
        backgroundColor: '#dcfce7',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    docActiveTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803d',
    },
    docBannerMeta: {
        fontSize: 12,
        color: '#0284c7',
        marginTop: 2,
    },
    clearDocBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#ffffff',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    clearDocBtnText: {
        fontSize: 11,
        color: '#0284c7',
        fontWeight: '600',
    },
    deptSection: {
        marginBottom: 20,
    },
    deptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    deptTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    deptIcon: {
        fontSize: 18,
    },
    deptTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    deptBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    deptBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    categoriesList: {
        gap: 10,
    },
    categoryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
    },
    categoryCardExpanded: {
        borderColor: '#cbd5e1',
    },
    catHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    catHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    catTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    catCountBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    catCountBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    catSnippet: {
        fontSize: 12,
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: 4,
    },
    questionsDrawer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        gap: 14,
    },
    qItem: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    qTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
    },
    qText: {
        fontSize: 13,
        color: '#0f172a',
        fontWeight: '600',
        flex: 1,
        lineHeight: 18,
    },
    qNum: {
        color: '#0ea5e9',
        fontWeight: 'bold',
    },
    qTypePill: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    qTypePillText: {
        fontSize: 10,
        fontWeight: '700',
    },
    type_yes_no: {
        backgroundColor: '#ecfdf5',
    },
    type_checkbox_group: {
        backgroundColor: '#eff6ff',
    },
    type_select: {
        backgroundColor: '#f5f3ff',
    },
    type_textarea: {
        backgroundColor: '#fef3c7',
    },
    type_text: {
        backgroundColor: '#f1f5f9',
    },
    optionsWrap: {
        marginTop: 8,
    },
    yesNoRow: {
        flexDirection: 'row',
        gap: 10,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    optionBtnYesActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    optionBtnNoActive: {
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
    },
    optionBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    optionBtnTextActive: {
        color: '#ffffff',
    },
    pillsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    pillBtnSelected: {
        backgroundColor: '#e0f2fe',
        borderColor: '#0ea5e9',
    },
    checkCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: '#94a3b8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleSelected: {
        backgroundColor: '#0ea5e9',
        borderColor: '#0ea5e9',
    },
    pillBtnText: {
        fontSize: 12,
        color: '#475569',
    },
    pillBtnTextSelected: {
        color: '#0369a1',
        fontWeight: '700',
    },
    textPlaceholderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 8,
        borderRadius: 6,
    },
    textPlaceholder: {
        fontSize: 11,
        color: '#64748b',
        fontStyle: 'italic',
    },
    emptyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    emptyText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 18,
        width: '100%',
        maxWidth: 420,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 12,
    },
    modalOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalOptionText: {
        fontSize: 14,
        color: '#334155',
    },
    modalCloseBtn: {
        marginTop: 14,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        alignItems: 'center',
    },
    modalCloseText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
});

export default DoctorAssistantQuestionLibrary;
