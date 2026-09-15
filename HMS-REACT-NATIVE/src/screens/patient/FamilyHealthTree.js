import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    Switch,
    useWindowDimensions
} from 'react-native';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import { patientAPI } from '../../utils/api';

const RELATIONSHIP_OPTIONS = [
    { value: 'Father', generation: -1 },
    { value: 'Mother', generation: -1 },
    { value: 'Brother', generation: 0 },
    { value: 'Sister', generation: 0 },
    { value: 'Son', generation: 1 },
    { value: 'Daughter', generation: 1 },
    { value: 'Grandfather (P)', generation: -2 },
    { value: 'Grandmother (P)', generation: -2 },
    { value: 'Grandfather (M)', generation: -2 },
    { value: 'Grandmother (M)', generation: -2 },
    { value: 'Uncle', generation: -1 },
    { value: 'Aunt', generation: -1 },
    { value: 'Spouse', generation: 0 },
    { value: 'Cousin', generation: 0 },
    { value: 'Nephew', generation: 1 },
    { value: 'Niece', generation: 1 },
    { value: 'Grandson', generation: 2 },
    { value: 'Granddaughter', generation: 2 },
    { value: 'Other', generation: 0 },
];

const COMMON_CONDITIONS = ['Diabetes', 'Hypertension', 'Heart Disease', 'Cancer', 'Stroke', 'Asthma', 'Arthritis', 'Thyroid'];

const GENERATION_LABELS = {
    '-2': 'Grandparents (Gen -2)',
    '-1': 'Parents & Elders (Gen -1)',
    '0': 'Patient & Siblings (Gen 0)',
    '1': 'Children (Gen +1)',
    '2': 'Grandchildren (Gen +2)',
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

export default function FamilyHealthTree(props) {
    const route = useRoute();
    const navigation = useNavigation();

    // Support both prop passing (when embedded in UnifiedPatientProfile) and route.params
    const patientId = props.patientId || route.params?.patientId || route.params?.id;
    const patientData = props.patientData || route.params?.patientData;

    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState(null);
    const [detailTab, setDetailTab] = useState('overview');
    const [showModal, setShowModal] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [saving, setSaving] = useState(false);

    const emptyForm = {
        name: '', relationship: '', gender: 'Male', dob: '', age: '',
        bloodGroup: '', isAlive: true, phone: '', address: '', occupation: '',
        notes: '', medicalConditions: [], lifestyle: {
            smoking: '', alcohol: '', exercise: '', diet: ''
        }
    };
    const [form, setForm] = useState(emptyForm);

    const fetchMembers = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        try {
            const res = await patientAPI.getFamilyMembers(patientId);
            if (res.success) {
                setMembers(res.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch family members:', err);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    // Computed Stats
    const stats = useMemo(() => {
        const totalMembers = members.length;
        const allConditions = new Set();
        let affectedCount = 0;

        members.forEach(m => {
            if (m.isAffected || (m.medicalConditions && m.medicalConditions.length > 0)) {
                affectedCount++;
                (m.medicalConditions || []).forEach(c => allConditions.add(c.name));
            }
        });

        const generations = new Set(members.map(m => m.generation));
        return {
            totalMembers,
            conditionsCount: allConditions.size,
            generationsCount: generations.size,
            affectedCount,
            healthyCount: Math.max(0, totalMembers - affectedCount),
        };
    }, [members]);

    // Hereditary pattern insights
    const patternInsights = useMemo(() => {
        const conditionMap = {};

        members.forEach(m => {
            (m.medicalConditions || []).forEach(c => {
                if (!conditionMap[c.name]) {
                    conditionMap[c.name] = { name: c.name, members: [], generations: new Set() };
                }
                conditionMap[c.name].members.push(m.name);
                conditionMap[c.name].generations.add(m.generation);
            });
        });

        return Object.values(conditionMap)
            .map(item => ({
                ...item,
                count: item.members.length,
                genCount: item.generations.size,
                risk: item.generations.size >= 3 ? 'high' : item.generations.size >= 2 ? 'moderate' : 'low'
            }))
            .sort((a, b) => b.genCount - a.genCount || b.count - a.count)
            .slice(0, 5);
    }, [members]);

    // Chronological timeline
    const timeline = useMemo(() => {
        const events = [];
        members.forEach(m => {
            (m.medicalConditions || []).forEach(c => {
                if (c.diagnosedAge && m.dob) {
                    const birthYear = new Date(m.dob).getFullYear();
                    const year = birthYear + Number(c.diagnosedAge);
                    events.push({ year, person: m.name, event: `Diagnosed with ${c.name}`, age: c.diagnosedAge });
                } else if (c.diagnosedAge && m.age) {
                    const currentYear = new Date().getFullYear();
                    const year = currentYear - (Number(m.age) - Number(c.diagnosedAge));
                    events.push({ year, person: m.name, event: `Diagnosed with ${c.name}`, age: c.diagnosedAge });
                }
            });
        });
        return events.sort((a, b) => a.year - b.year).slice(0, 6);
    }, [members]);

    // Group members by generation
    const generationGroups = useMemo(() => {
        const groups = {};
        members.forEach(m => {
            const gen = String(m.generation || 0);
            if (!groups[gen]) groups[gen] = [];
            groups[gen].push(m);
        });
        return groups;
    }, [members]);

    const familyChecklist = useMemo(() => {
        const allCondNames = new Set();
        members.forEach(m => (m.medicalConditions || []).forEach(c => allCondNames.add(c.name)));
        return COMMON_CONDITIONS.map(name => ({
            name,
            present: allCondNames.has(name)
        }));
    }, [members]);

    const openAddModal = () => {
        setEditingMember(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEditModal = (member) => {
        setEditingMember(member);
        setForm({
            name: member.name || '',
            relationship: member.relationship || '',
            gender: member.gender || 'Male',
            dob: member.dob ? new Date(member.dob).toISOString().split('T')[0] : '',
            age: member.age ? String(member.age) : '',
            bloodGroup: member.bloodGroup || '',
            isAlive: member.isAlive !== false,
            phone: member.phone || '',
            address: member.address || '',
            occupation: member.occupation || '',
            notes: member.notes || '',
            medicalConditions: member.medicalConditions || [],
            lifestyle: member.lifestyle || { smoking: '', alcohol: '', exercise: '', diet: '' }
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.relationship) {
            Alert.alert('Validation Error', 'Name and Relationship are required.');
            return;
        }
        setSaving(true);
        try {
            const relConfig = RELATIONSHIP_OPTIONS.find(r => r.value === form.relationship);
            const payload = {
                ...form,
                generation: relConfig ? relConfig.generation : 0,
                age: form.age ? parseInt(form.age, 10) : null,
                dob: form.dob || null,
            };

            if (editingMember) {
                const res = await patientAPI.updateFamilyMember(patientId, editingMember._id, payload);
                if (res.success) {
                    setMembers(prev => prev.map(m => m._id === editingMember._id ? res.data : m));
                    if (selectedMember && selectedMember._id === editingMember._id) {
                        setSelectedMember(res.data);
                    }
                    Alert.alert('Success', 'Family member updated successfully!');
                }
            } else {
                const res = await patientAPI.addFamilyMember(patientId, payload);
                if (res.success) {
                    setMembers(prev => [...prev, res.data]);
                    Alert.alert('Success', 'Family member added successfully!');
                }
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingMember(null);
        } catch (err) {
            console.error('Save family member error:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Failed to save family member.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (memberId) => {
        Alert.alert(
            'Remove Family Member',
            'Are you sure you want to remove this family member from the pedigree tree?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await patientAPI.deleteFamilyMember(patientId, memberId);
                            if (res.success) {
                                setMembers(prev => prev.filter(m => m._id !== memberId));
                                if (selectedMember && selectedMember._id === memberId) {
                                    setSelectedMember(null);
                                }
                                Alert.alert('Success', 'Family member removed successfully!');
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete family member.');
                        }
                    }
                }
            ]
        );
    };

    const addCondition = () => {
        setForm(prev => ({
            ...prev,
            medicalConditions: [...prev.medicalConditions, { name: '', status: 'Active', diagnosedAge: '', treatment: '', notes: '' }]
        }));
    };

    const removeCondition = (index) => {
        setForm(prev => ({
            ...prev,
            medicalConditions: prev.medicalConditions.filter((_, i) => i !== index)
        }));
    };

    const updateCondition = (index, field, value) => {
        setForm(prev => ({
            ...prev,
            medicalConditions: prev.medicalConditions.map((c, i) => i === index ? { ...c, [field]: value } : c)
        }));
    };

    const patientSelf = {
        _id: 'self',
        name: patientData?.name || 'Patient (Self)',
        gender: patientData?.gender || 'Male',
        age: patientData?.age,
        bloodGroup: patientData?.bloodGroup,
    };

    const renderMemberCard = (member, isSelf = false) => {
        const isSelected = selectedMember?._id === member._id;
        const isAlive = member.isAlive !== false;

        return (
            <TouchableOpacity
                key={member._id || 'self'}
                style={[
                    styles.memberCard,
                    isSelf && styles.memberCardSelf,
                    isSelected && styles.memberCardSelected
                ]}
                onPress={() => {
                    if (!isSelf) {
                        setSelectedMember(member);
                        setDetailTab('overview');
                    }
                }}
            >
                <View style={[styles.avatarCircle, isSelf ? styles.avatarSelf : (member.gender === 'Female' ? styles.avatarFemale : styles.avatarMale)]}>
                    <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
                    {!isSelf && (
                        <View style={[styles.dotAlive, { backgroundColor: isAlive ? '#10b981' : '#64748b' }]} />
                    )}
                </View>
                <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                <Text style={styles.memberRel}>{isSelf ? 'Patient' : member.relationship}</Text>

                {member.medicalConditions && member.medicalConditions.length > 0 ? (
                    <View style={styles.conditionTagsWrap}>
                        {member.medicalConditions.slice(0, 2).map((c, i) => (
                            <View key={i} style={styles.conditionChip}>
                                <Text style={styles.conditionChipText} numberOfLines={1}>{c.name}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <Text style={styles.memberMetaText}>
                    {isAlive ? '🟢 Alive' : '⚫ Deceased'} {member.age ? `• ${member.age}y` : ''}
                </Text>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16a34a" />
                <Text style={styles.loadingText}>Loading Family Health Pedigree...</Text>
            </View>
        );
    }

    const genOrder = ['-2', '-1', '0', '1', '2'];
    const activeGens = genOrder.filter(g => generationGroups[g]?.length > 0 || g === '0');

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Stats Header Bar */}
            <View style={styles.statsBar}>
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>{stats.totalMembers}</Text>
                    <Text style={styles.statLbl}>Members</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statVal, { color: '#f59e0b' }]}>{stats.conditionsCount}</Text>
                    <Text style={styles.statLbl}>Conditions</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statVal, { color: '#059669' }]}>{stats.generationsCount || 1}</Text>
                    <Text style={styles.statLbl}>Generations</Text>
                </View>
                <TouchableOpacity style={styles.btnAddMember} onPress={openAddModal}>
                    <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.btnAddMemberText}>Add Member</Text>
                </TouchableOpacity>
            </View>

            {/* Tree Graphical Pedigree Area */}
            <View style={styles.treeSection}>
                <View style={styles.treeHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <FontAwesome5 name="dna" size={16} color="#16a34a" style={{ marginRight: 8 }} />
                        <Text style={styles.treeTitle}>Generational Pedigree Chart</Text>
                    </View>
                </View>

                {members.length === 0 ? (
                    <View style={styles.emptyTreeBox}>
                        <MaterialCommunityIcons name="family-tree" size={48} color="#94a3b8" />
                        <Text style={styles.emptyTreeTitle}>No Family Members Recorded</Text>
                        <Text style={styles.emptyTreeSub}>Build the genealogical pedigree to trace genetic conditions and hereditary patterns across generations.</Text>
                        <TouchableOpacity style={[styles.btnAddMember, { marginTop: 14 }]} onPress={openAddModal}>
                            <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                            <Text style={styles.btnAddMemberText}>Add First Family Member</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.treeChartContainer}>
                        {activeGens.map((gen, idx) => (
                            <View key={gen} style={styles.genRowBlock}>
                                <View style={styles.genTag}>
                                    <Text style={styles.genTagText}>{GENERATION_LABELS[gen] || `Gen ${gen}`}</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genMembersRow}>
                                    {gen === '0' && renderMemberCard(patientSelf, true)}
                                    {(generationGroups[gen] || []).map(m => renderMemberCard(m))}
                                </ScrollView>
                                {idx < activeGens.length - 1 && <View style={styles.treeTrunkLine} />}
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Selected Member Detail Panel */}
            {selectedMember && (
                <View style={styles.detailCard}>
                    <View style={styles.detailHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={[styles.avatarCircle, selectedMember.gender === 'Female' ? styles.avatarFemale : styles.avatarMale, { width: 44, height: 44, borderRadius: 22 }]}>
                                <Text style={[styles.avatarText, { fontSize: 16 }]}>{getInitials(selectedMember.name)}</Text>
                            </View>
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={styles.detailName}>{selectedMember.name}</Text>
                                <Text style={styles.detailSub}>{selectedMember.relationship} • {selectedMember.age || '—'} yrs • {selectedMember.bloodGroup || 'No blood group'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedMember(null)}>
                            <Feather name="x" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={styles.detailTabRow}>
                        {['overview', 'conditions', 'lifestyle', 'notes'].map(t => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.detailTabBtn, detailTab === t && styles.detailTabBtnActive]}
                                onPress={() => setDetailTab(t)}
                            >
                                <Text style={[styles.detailTabBtnText, detailTab === t && styles.detailTabBtnTextActive]}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {detailTab === 'overview' && (
                        <View style={styles.tabPane}>
                            <Text style={styles.secHeading}>Personal & Health Summary</Text>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoCol}>
                                    <Text style={styles.infoLbl}>DOB</Text>
                                    <Text style={styles.infoVal}>{selectedMember.dob ? new Date(selectedMember.dob).toLocaleDateString('en-IN') : 'N/A'}</Text>
                                </View>
                                <View style={styles.infoCol}>
                                    <Text style={styles.infoLbl}>Occupation</Text>
                                    <Text style={styles.infoVal}>{selectedMember.occupation || 'N/A'}</Text>
                                </View>
                                <View style={styles.infoCol}>
                                    <Text style={styles.infoLbl}>Phone</Text>
                                    <Text style={styles.infoVal}>{selectedMember.phone || 'N/A'}</Text>
                                </View>
                                <View style={styles.infoCol}>
                                    <Text style={styles.infoLbl}>Status</Text>
                                    <Text style={styles.infoVal}>{selectedMember.isAlive !== false ? 'Alive' : 'Deceased'}</Text>
                                </View>
                            </View>

                            <Text style={[styles.secHeading, { marginTop: 14 }]}>Hereditary Conditions Checklist</Text>
                            <View style={styles.checklistGrid}>
                                {familyChecklist.map((c, i) => (
                                    <View key={i} style={styles.checklistItem}>
                                        <Feather name={c.present ? 'check-circle' : 'circle'} size={14} color={c.present ? '#16a34a' : '#94a3b8'} />
                                        <Text style={[styles.checklistText, c.present && { fontWeight: '700', color: '#166534' }]}>{c.name}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {detailTab === 'conditions' && (
                        <View style={styles.tabPane}>
                            <Text style={styles.secHeading}>Diagnosed Conditions ({(selectedMember.medicalConditions || []).length})</Text>
                            {(!selectedMember.medicalConditions || selectedMember.medicalConditions.length === 0) ? (
                                <Text style={styles.emptyText}>No medical conditions documented.</Text>
                            ) : (
                                selectedMember.medicalConditions.map((c, i) => (
                                    <View key={i} style={styles.conditionCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.condName}>{c.name}</Text>
                                            <View style={styles.statusPill}><Text style={styles.statusPillText}>{c.status || 'Active'}</Text></View>
                                        </View>
                                        {c.diagnosedAge ? <Text style={styles.condDetail}>Diagnosed age: {c.diagnosedAge} yrs</Text> : null}
                                        {c.treatment ? <Text style={styles.condDetail}>Treatment: {c.treatment}</Text> : null}
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {detailTab === 'lifestyle' && (
                        <View style={styles.tabPane}>
                            <Text style={styles.secHeading}>Lifestyle Factors</Text>
                            <View style={styles.lifestyleRow}>
                                <View style={styles.lifestyleCard}><Text style={styles.lifeLbl}>Smoking</Text><Text style={styles.lifeVal}>{selectedMember.lifestyle?.smoking || 'Unknown'}</Text></View>
                                <View style={styles.lifestyleCard}><Text style={styles.lifeLbl}>Alcohol</Text><Text style={styles.lifeVal}>{selectedMember.lifestyle?.alcohol || 'Unknown'}</Text></View>
                            </View>
                            <View style={styles.lifestyleRow}>
                                <View style={styles.lifestyleCard}><Text style={styles.lifeLbl}>Exercise</Text><Text style={styles.lifeVal}>{selectedMember.lifestyle?.exercise || 'Unknown'}</Text></View>
                                <View style={styles.lifestyleCard}><Text style={styles.lifeLbl}>Diet</Text><Text style={styles.lifeVal}>{selectedMember.lifestyle?.diet || 'Unknown'}</Text></View>
                            </View>
                        </View>
                    )}

                    {detailTab === 'notes' && (
                        <View style={styles.tabPane}>
                            <Text style={styles.secHeading}>Clinical Notes</Text>
                            <Text style={styles.notesText}>{selectedMember.notes || 'No notes documented.'}</Text>
                        </View>
                    )}

                    <View style={styles.detailActionRow}>
                        <TouchableOpacity style={styles.btnEdit} onPress={() => openEditModal(selectedMember)}>
                            <Feather name="edit-2" size={14} color="#2563eb" style={{ marginRight: 6 }} />
                            <Text style={styles.btnEditText}>Edit Member</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnDelete} onPress={() => handleDelete(selectedMember._id)}>
                            <Feather name="trash-2" size={14} color="#ef4444" style={{ marginRight: 6 }} />
                            <Text style={styles.btnDeleteText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Bottom Insights Section */}
            {members.length > 0 && (
                <View style={styles.insightsSection}>
                    <View style={styles.insightCard}>
                        <Text style={styles.insightCardTitle}>🧬 Hereditary Pattern Risk</Text>
                        {patternInsights.length === 0 ? (
                            <Text style={styles.emptyText}>No repeated hereditary patterns detected yet.</Text>
                        ) : (
                            patternInsights.map((item, i) => (
                                <View key={i} style={styles.patternItem}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.patternName}>{item.name}</Text>
                                        <Text style={styles.patternSub}>{item.genCount} generation(s) • {item.count} affected</Text>
                                    </View>
                                    <View style={[styles.riskBadge, item.risk === 'high' ? styles.riskHigh : item.risk === 'moderate' ? styles.riskMod : styles.riskLow]}>
                                        <Text style={styles.riskBadgeText}>{item.risk.toUpperCase()} RISK</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    {/* Timeline */}
                    <View style={styles.insightCard}>
                        <Text style={styles.insightCardTitle}>📅 Family Health Timeline</Text>
                        {timeline.length === 0 ? (
                            <Text style={styles.emptyText}>No diagnostic timeline milestones recorded.</Text>
                        ) : (
                            timeline.map((evt, i) => (
                                <View key={i} style={styles.tlEventRow}>
                                    <Text style={styles.tlYear}>{evt.year}</Text>
                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                        <Text style={styles.tlPerson}>{evt.person}</Text>
                                        <Text style={styles.tlEvent}>{evt.event}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            )}

            {/* Modal: Add / Edit Family Member */}
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingMember ? 'Edit Family Member' : 'Add Family Member'}</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                            <Text style={styles.inputLabel}>Full Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter member name"
                                value={form.name}
                                onChangeText={(val) => setForm({ ...form, name: val })}
                            />

                            <Text style={styles.inputLabel}>Relationship *</Text>
                            <View style={styles.pickerBox}>
                                <Picker
                                    selectedValue={form.relationship}
                                    onValueChange={(val) => setForm({ ...form, relationship: val })}
                                    style={{ height: 44 }}
                                >
                                    <Picker.Item label="Select relationship..." value="" />
                                    {RELATIONSHIP_OPTIONS.map(r => (
                                        <Picker.Item key={r.value} label={r.value} value={r.value} />
                                    ))}
                                </Picker>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Gender</Text>
                                    <View style={styles.pickerBox}>
                                        <Picker
                                            selectedValue={form.gender}
                                            onValueChange={(val) => setForm({ ...form, gender: val })}
                                            style={{ height: 44 }}
                                        >
                                            <Picker.Item label="Male" value="Male" />
                                            <Picker.Item label="Female" value="Female" />
                                            <Picker.Item label="Other" value="Other" />
                                        </Picker>
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Age</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. 54"
                                        keyboardType="numeric"
                                        value={form.age}
                                        onChangeText={(val) => setForm({ ...form, age: val })}
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Blood Group</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. B+"
                                        value={form.bloodGroup}
                                        onChangeText={(val) => setForm({ ...form, bloodGroup: val })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Occupation</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Engineer"
                                        value={form.occupation}
                                        onChangeText={(val) => setForm({ ...form, occupation: val })}
                                    />
                                </View>
                            </View>

                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Is this member currently alive?</Text>
                                <Switch
                                    value={form.isAlive}
                                    onValueChange={(val) => setForm({ ...form, isAlive: val })}
                                    trackColor={{ true: '#10b981', false: '#cbd5e1' }}
                                />
                            </View>

                            {/* Medical Conditions */}
                            <View style={{ marginTop: 14 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={[styles.inputLabel, { margin: 0 }]}>Medical Conditions</Text>
                                    <TouchableOpacity style={styles.btnAddCond} onPress={addCondition}>
                                        <Feather name="plus" size={14} color="#16a34a" />
                                        <Text style={styles.btnAddCondText}>Add Condition</Text>
                                    </TouchableOpacity>
                                </View>

                                {form.medicalConditions.map((cond, i) => (
                                    <View key={i} style={styles.condItemForm}>
                                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                            <TextInput
                                                style={[styles.input, { flex: 2 }]}
                                                placeholder="Condition name (e.g. Diabetes)"
                                                value={cond.name}
                                                onChangeText={(val) => updateCondition(i, 'name', val)}
                                            />
                                            <TextInput
                                                style={[styles.input, { flex: 1 }]}
                                                placeholder="Diagnosed Age"
                                                keyboardType="numeric"
                                                value={String(cond.diagnosedAge || '')}
                                                onChangeText={(val) => updateCondition(i, 'diagnosedAge', val)}
                                            />
                                            <TouchableOpacity onPress={() => removeCondition(i)}>
                                                <Feather name="trash-2" size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Notes</Text>
                            <TextInput
                                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                                placeholder="Additional medical or pedigree observations..."
                                multiline
                                value={form.notes}
                                onChangeText={(val) => setForm({ ...form, notes: val })}
                            />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity style={styles.btnCancel} onPress={() => setShowModal(false)}>
                                    <Text style={styles.btnCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
                                    <Text style={styles.btnSaveText}>{saving ? 'Saving...' : 'Save Member'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 14 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { marginTop: 12, color: '#16a34a', fontWeight: '700', fontSize: 14 },
    statsBar: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', marginBottom: 14 },
    statBox: { marginRight: 16 },
    statVal: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    statLbl: { fontSize: 11, color: '#64748b' },
    btnAddMember: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 'auto' },
    btnAddMemberText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    treeSection: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
    treeHeaderRow: { marginBottom: 12 },
    treeTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    emptyTreeBox: { padding: 30, alignItems: 'center', justifyContent: 'center' },
    emptyTreeTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 10 },
    emptyTreeSub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 300 },
    treeChartContainer: { paddingVertical: 8 },
    genRowBlock: { alignItems: 'center', marginVertical: 6 },
    genTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginBottom: 8 },
    genTagText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    genMembersRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
    treeTrunkLine: { width: 2, height: 16, backgroundColor: '#cbd5e1', marginVertical: 4 },
    memberCard: { width: 135, backgroundColor: '#ffffff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    memberCardSelf: { borderColor: '#3b82f6', backgroundColor: '#eff6ff', borderWidth: 2 },
    memberCardSelected: { borderColor: '#16a34a', backgroundColor: '#f0fdf4', borderWidth: 2 },
    avatarCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    avatarMale: { backgroundColor: '#3b82f6' },
    avatarFemale: { backgroundColor: '#ec4899' },
    avatarSelf: { backgroundColor: '#6366f1' },
    avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
    dotAlive: { width: 9, height: 9, borderRadius: 4.5, position: 'absolute', right: -1, bottom: -1, borderWidth: 1.5, borderColor: '#ffffff' },
    memberName: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 6, textAlign: 'center' },
    memberRel: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '500' },
    conditionTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4, justifyContent: 'center' },
    conditionChip: { backgroundColor: '#fef3c7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
    conditionChipText: { fontSize: 9, color: '#b45309', fontWeight: '600' },
    memberMetaText: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
    detailCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
    detailHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 12 },
    detailName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    detailSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    detailTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
    detailTabBtn: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    detailTabBtnActive: { borderBottomColor: '#16a34a' },
    detailTabBtnText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    detailTabBtnTextActive: { color: '#16a34a', fontWeight: '800' },
    tabPane: { paddingVertical: 12 },
    secHeading: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    infoCol: { width: '47%' },
    infoLbl: { fontSize: 11, color: '#64748b' },
    infoVal: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 2 },
    checklistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    checklistItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
    checklistText: { fontSize: 12, color: '#475569' },
    emptyText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic' },
    conditionCard: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8 },
    condName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    statusPill: { backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusPillText: { fontSize: 10, color: '#0369a1', fontWeight: '700' },
    condDetail: { fontSize: 12, color: '#64748b', marginTop: 2 },
    lifestyleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    lifestyleCard: { flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 },
    lifeLbl: { fontSize: 11, color: '#64748b' },
    lifeVal: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 2 },
    notesText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    detailActionRow: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: '#f1f5f9' },
    btnEdit: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: '#eff6ff' },
    btnEditText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
    btnDelete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
    btnDeleteText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
    insightsSection: { gap: 12, marginBottom: 20 },
    insightCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    insightCardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
    patternItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    patternName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    patternSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    riskHigh: { backgroundColor: '#fee2e2' },
    riskMod: { backgroundColor: '#fef3c7' },
    riskLow: { backgroundColor: '#dcfce7' },
    riskBadgeText: { fontSize: 10, fontWeight: '800', color: '#1e293b' },
    tlEventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    tlYear: { fontSize: 13, fontWeight: '800', color: '#16a34a', width: 45 },
    tlPerson: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
    tlEvent: { fontSize: 12, color: '#64748b' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalCard: { backgroundColor: '#ffffff', width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: 16, padding: 18 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 8, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a' },
    pickerBox: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, overflow: 'hidden' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, paddingVertical: 6 },
    switchLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
    btnAddCond: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    btnAddCondText: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
    condItemForm: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, marginBottom: 6 },
    modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
    btnCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
    btnCancelText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    btnSave: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: '#16a34a' },
    btnSaveText: { fontSize: 13, fontWeight: '700', color: '#ffffff' }
});
