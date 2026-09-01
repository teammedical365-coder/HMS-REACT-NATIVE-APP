import React, { useState, useEffect, useRef } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    ScrollView, 
    StyleSheet, 
    Modal, 
    Animated, 
    Dimensions,
    Platform
} from 'react-native';
import { questionLibraryAPI } from '../../utils/api';
import confirmToast, { promptToast, toast } from '../../utils/confirmToast';
import { FontAwesome5 } from '@expo/vector-icons'; // Using FontAwesome5 as equivalent for FontAwesome6

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AdminQuestionLibrary = () => {
    const [libraryData, setLibraryData] = useState({
        "General": {},
        "Orthopedics": {},
        "ENT": {}
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [allowedDepartments, setAllowedDepartments] = useState(null);

    const [departmentTab, setDepartmentTab] = useState('General');
    const [activeCategory, setActiveCategory] = useState('');
    const [newCatName, setNewCatName] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [editIndex, setEditIndex] = useState(null);

    // Department Modal State
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState('');
    const [customDept, setCustomDept] = useState('');

    // Predefined departments for dropdown
    const [predefinedDepartments, setPredefinedDepartments] = useState([
        "General", "Orthopedics", "ENT", "Cardiology", "Neurology", "Pediatrics", "Gynecology", "Dermatology", "Oncology", "IVF"
    ]);

    const [showPreview, setShowPreview] = useState(false);
    const [previewIntake, setPreviewIntake] = useState({});

    const [newQ, setNewQ] = useState({
        q: '',
        type: 'text',
        options: '',
        extra: '',
        parentQ: '',
        condition: ''
    });

    // Ambient Orbs Animation
    const orb1Anim = useRef(new Animated.Value(0)).current;
    const orb2Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateOrb = (anim) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 6000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 6000,
                        useNativeDriver: true,
                    })
                ])
            ).start();
        };

        animateOrb(orb1Anim);
        setTimeout(() => animateOrb(orb2Anim), 2500);
    }, [orb1Anim, orb2Anim]);

    useEffect(() => {
        fetchLibrary();
    }, []);

    const fetchLibrary = async () => {
        try {
            setLoading(true);
            const res = await questionLibraryAPI.getLibrary();
            let data = res.data?.data;
            if (!data || Object.keys(data).length === 0) {
                data = { "General": {}, "Orthopedics": {}, "ENT": {} };
            }

            setLibraryData(data);
            setAllowedDepartments(res.allowedDepartments || null);

            const visibleDepts = res.allowedDepartments ? Object.keys(data).filter(d => res.allowedDepartments.includes(d)) : Object.keys(data);
            let defaultDept = 'General';
            
            if (visibleDepts.length > 0) {
                defaultDept = visibleDepts[0];
                setDepartmentTab(defaultDept);
                const firstDeptCats = Object.keys(data[defaultDept] || {});
                if (firstDeptCats.length > 0) {
                    setActiveCategory(firstDeptCats[0]);
                }
            } else {
                setDepartmentTab('General');
            }
        } catch (err) {
            console.error('Error fetching question library:', err);
            toast.error('Failed to fetch library.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await questionLibraryAPI.updateLibrary(libraryData);
            if (res.success) {
                toast.success('Question Library synced & deployed to core doctor workflows!');
            }
        } catch (err) {
            toast.error('Error saving library.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddCategory = (catNameInput = null) => {
        const cat = (catNameInput || newCatName).trim();
        if (!cat) return;
        if (libraryData[departmentTab] && libraryData[departmentTab][cat]) {
            toast.error(`Category "${cat}" already exists in ${departmentTab}`);
            return;
        }

        const newLib = { ...libraryData };
        if (!newLib[departmentTab]) newLib[departmentTab] = {};
        newLib[departmentTab][cat] = [];

        setLibraryData(newLib);
        setActiveCategory(cat);
        setNewCatName('');
        toast.success(`Category "${cat}" injected`);
    };

    const handleEditCategory = async (oldName) => {
        const newName = await promptToast('Enter new name for category:', {
            title: 'Rename Category',
            defaultValue: oldName,
            placeholder: 'Category name...',
            confirmText: 'Rename'
        });
        if (!newName || !newName.trim() || newName.trim() === oldName) return;
        const cleanName = newName.trim();

        if (libraryData[departmentTab][cleanName]) {
            toast.error("Category with this name already exists!");
            return;
        }

        const newLib = { ...libraryData };
        const questions = newLib[departmentTab][oldName];
        delete newLib[departmentTab][oldName];
        newLib[departmentTab][cleanName] = questions;

        setLibraryData(newLib);
        if (activeCategory === oldName) setActiveCategory(cleanName);
        toast.success(`Renamed category to "${cleanName}"`);
    };

    const handleDeleteCategory = async (catName) => {
        const confirmed = await confirmToast(
            `Are you sure you want to delete the sequence "${catName}" and all its data points?`,
            { title: 'Delete Category', confirmText: 'Delete' }
        );
        if (!confirmed) return;
        
        const newLib = { ...libraryData };
        delete newLib[departmentTab][catName];

        setLibraryData(newLib);
        if (activeCategory === catName) {
            const keys = Object.keys(newLib[departmentTab] || {});
            setActiveCategory(keys.length > 0 ? keys[0] : '');
        }
        toast.success(`Category "${catName}" deleted`);
    };

    const handleAddDepartmentClick = () => {
        setShowDeptModal(true);
        setSelectedDept('');
        setCustomDept('');
    };

    const confirmAddDepartment = () => {
        const dept = customDept.trim() || selectedDept.trim();
        if (!dept) {
            toast.error("Please select or enter a department name.");
            return;
        }
        if (libraryData[dept]) {
            toast.error("Department already exists!");
            return;
        }
        
        if (customDept.trim() && !predefinedDepartments.includes(customDept.trim())) {
            setPredefinedDepartments([...predefinedDepartments, customDept.trim()]);
        }

        setLibraryData({ ...libraryData, [dept]: {} });
        setDepartmentTab(dept);
        setActiveCategory('');
        setShowDeptModal(false);
        toast.success(`Department "${dept}" initialized`);
    };

    const handleEditDepartment = async (oldDept) => {
        const newDept = await promptToast('Enter new name for department:', {
            title: 'Rename Department',
            defaultValue: oldDept,
            placeholder: 'Department name...',
            confirmText: 'Rename'
        });
        if (!newDept || !newDept.trim() || newDept.trim() === oldDept) return;
        const cleanName = newDept.trim();

        if (libraryData[cleanName]) {
            toast.error("Department with this name already exists!");
            return;
        }

        const newLib = { ...libraryData };
        const categories = newLib[oldDept];
        delete newLib[oldDept];
        newLib[cleanName] = categories;

        if (customDept.trim() && !predefinedDepartments.includes(cleanName)) {
            setPredefinedDepartments([...predefinedDepartments, cleanName]);
        }

        setSaving(true);
        try {
            const res = await questionLibraryAPI.updateLibrary(newLib);
            if (res.success) {
                setLibraryData(newLib);
                if (departmentTab === oldDept) setDepartmentTab(cleanName);
                toast.success(`Department renamed to "${cleanName}"`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Error renaming department in backend.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDepartment = async (deptName) => {
        const confirmed = await confirmToast(
            `Are you sure? This will permanently delete the "${deptName}" department and all its questions.`,
            { title: 'Delete Department', confirmText: 'Delete Department' }
        );
        if (!confirmed) return;
        
        const newLib = { ...libraryData };
        delete newLib[deptName];

        setSaving(true);
        try {
            const res = await questionLibraryAPI.updateLibrary(newLib);
            if (res.success) {
                setLibraryData(newLib);
                if (departmentTab === deptName) {
                    const keys = Object.keys(newLib);
                    if (keys.length > 0) {
                        setDepartmentTab(keys[0]);
                        const cats = Object.keys(newLib[keys[0]] || {});
                        setActiveCategory(cats.length > 0 ? cats[0] : '');
                    } else {
                        setDepartmentTab('');
                        setActiveCategory('');
                    }
                }
                toast.success(`Department "${deptName}" deleted`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting department from backend.');
        } finally {
            setSaving(false);
        }
    };

    const resetModalState = () => {
        setShowAddModal(false);
        setEditIndex(null);
        setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' });
    };

    const handleAddQuestion = () => {
        const qText = newQ.q.trim();
        if (!qText) {
            toast.error("Please enter a question.");
            return;
        }

        const finalQuestion = {
            q: qText,
            type: newQ.type
        };

        if (['select', 'checkbox-group', 'checkbox-date-group', 'checkbox-text-group'].includes(newQ.type)) {
            finalQuestion.options = newQ.options.split(',').map(s => s.trim()).filter(s => s);
        }

        if (['checkbox-date-group', 'checkbox-text-group'].includes(newQ.type)) {
            finalQuestion.extra = newQ.extra.trim() || 'Remarks';
        }

        if (newQ.parentQ.trim() && newQ.condition.trim()) {
            finalQuestion.parentQ = newQ.parentQ.trim();
            finalQuestion.condition = newQ.condition.trim();
        }

        const newLib = { ...libraryData };
        if (!newLib[departmentTab][activeCategory]) {
            newLib[departmentTab][activeCategory] = [];
        }

        if (editIndex !== null) {
            newLib[departmentTab][activeCategory][editIndex] = finalQuestion;
            toast.success('Data point updated');
        } else {
            newLib[departmentTab][activeCategory] = [
                ...newLib[departmentTab][activeCategory],
                finalQuestion
            ];
            toast.success('Data point injected');
        }

        setLibraryData(newLib);
        resetModalState();
    };

    const handleEditQuestion = (index) => {
        const qToEdit = libraryData[departmentTab][activeCategory][index];
        setNewQ({
            q: qToEdit.q || '',
            type: qToEdit.type || 'text',
            options: qToEdit.options ? qToEdit.options.join(', ') : '',
            extra: qToEdit.extra || '',
            parentQ: qToEdit.parentQ || '',
            condition: qToEdit.condition || ''
        });
        setEditIndex(index);
        setShowAddModal(true);
    };

    const handleDeleteQuestion = async (cat, index) => {
        const confirmed = await confirmToast("Are you sure you want to delete this question?", {
            title: 'Delete Question',
            confirmText: 'Delete'
        });
        if (!confirmed) return;
        const newLib = { ...libraryData };
        newLib[departmentTab][cat].splice(index, 1);
        setLibraryData(newLib);
        toast.success('Question deleted');
    };

    const getTypeLabel = (type) => {
        const map = {
            'text': 'TEXT',
            'number': 'NUMERIC',
            'yes-no': 'YES/NO',
            'date': 'DATE',
            'textarea': 'LONG TEXT',
            'select': 'DROPDOWN',
            'checkbox-group': 'MULTI-CHECK',
            'checkbox-date-group': 'CHECK+DATE',
            'checkbox-text-group': 'CHECK+TEXT',
            'gender-toggle': 'GENDER',
            'row': 'ROW'
        };
        return map[type] || 'CLINICAL';
    };

    const renderQuestionCard = (item, index, cat) => {
        let inputHtml = null;

        if (item.type === "select") {
            inputHtml = (
                <View style={styles.disabledInput}>
                    <Text style={styles.disabledInputText}>Select option...</Text>
                </View>
            );
        } else if (item.type === "yes-no") {
            inputHtml = (
                <View style={[styles.disabledInput, { width: 160 }]}>
                    <Text style={styles.disabledInputText}>Select...</Text>
                </View>
            );
        } else if (item.type === "date") {
            inputHtml = (
                <View style={[styles.disabledInput, { width: 200 }]}>
                    <Text style={styles.disabledInputText}>Date format</Text>
                </View>
            );
        } else if (item.type === "checkbox-group") {
            inputHtml = (
                <View style={styles.qlCheckboxGrid}>
                    {(item.options || []).map(opt => (
                        <View key={opt} style={styles.checkboxLabelWrapper}>
                            <View style={styles.fakeCheckbox} />
                            <Text style={styles.checkboxLabelText}>{opt}</Text>
                        </View>
                    ))}
                </View>
            );
        } else if (item.type === "textarea") {
            inputHtml = (
                <View style={[styles.disabledInput, { height: 60 }]}>
                    <Text style={styles.disabledInputText}>Clinical observations...</Text>
                </View>
            );
        } else if (item.type === "checkbox-date-group" || item.type === "checkbox-text-group") {
            inputHtml = (
                <View style={styles.qlComplexGroup}>
                    {(item.options || []).map(opt => (
                        <View style={styles.qlComplexRow} key={opt}>
                            <View style={styles.checkboxLabelWrapper}>
                                <View style={styles.fakeCheckbox} />
                                <Text style={styles.checkboxLabelText}>{opt}</Text>
                            </View>
                            {opt !== 'None' && (
                                <View style={[styles.disabledInput, { width: 120, marginLeft: 10, paddingVertical: 4 }]}>
                                    <Text style={styles.disabledInputText}>Input...</Text>
                                </View>
                            )}
                        </View>
                    ))}
                    <View style={styles.qlExtraField}>
                        <Text style={styles.qlExtraFieldLabel}>{item.extra || 'Remarks'}:</Text>
                        <View style={styles.disabledInput}>
                            <Text style={styles.disabledInputText}>Details...</Text>
                        </View>
                    </View>
                </View>
            );
        } else {
            inputHtml = (
                <View style={styles.disabledInput}>
                    <Text style={styles.disabledInputText}>Input sequence value...</Text>
                </View>
            );
        }

        return (
            <View style={styles.qlQuestionCard} key={index}>
                <View style={styles.qlQuestionTop}>
                    <View style={styles.qlQuestionInfo}>
                        <FontAwesome5 name="question-circle" size={16} color="#64748b" style={styles.qIcon} />
                        <Text style={styles.qlQuestionTitleText}>{item.q}</Text>
                        <View style={styles.qlQuestionTypeBadge}>
                            <Text style={styles.qlQuestionTypeBadgeText}>{getTypeLabel(item.type)}</Text>
                        </View>
                    </View>
                    <View style={styles.qlQuestionActions}>
                        <TouchableOpacity style={styles.qlBtnEditQ} onPress={() => handleEditQuestion(index)}>
                            <FontAwesome5 name="pen" size={10} color="#64748b" />
                            <Text style={styles.qlBtnEditQText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.qlBtnDelQ} onPress={() => handleDeleteQuestion(cat, index)}>
                            <FontAwesome5 name="trash" size={10} color="#ef4444" />
                            <Text style={styles.qlBtnDelQText}>Del</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {item.parentQ ? (
                    <View style={styles.qlConditionBadge}>
                        <Text style={styles.qlConditionBadgeText}>
                            <FontAwesome5 name="bolt" size={10} color="#eab308" /> Only shown if "{item.parentQ}" equals "{item.condition}"
                        </Text>
                    </View>
                ) : null}
                <View style={styles.qlInputPreview}>
                    {inputHtml}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.qlAdminBody, { alignItems: 'center', justifyContent: 'center' }]}>
                <View style={{ alignItems: 'center' }}>
                    <FontAwesome5 name="microchip" size={40} color="#1E60A4" style={{ marginBottom: 16 }} />
                    <Text style={{ fontWeight: '700', letterSpacing: 1, color: '#1E60A4' }}>INITIALIZING NEURAL AI BUILDER...</Text>
                </View>
            </View>
        );
    }

    const currentCategories = libraryData[departmentTab] || {};
    const questionsInActiveCategory = currentCategories[activeCategory] || [];
    const visibleDepartments = allowedDepartments ? Object.keys(libraryData).filter(dept => allowedDepartments.includes(dept)) : Object.keys(libraryData);

    const getDeptIcon = (dept) => {
        const d = (dept || '').toLowerCase();
        if (d.includes('ortho') || d.includes('bone')) return "bone";
        if (d.includes('neuro') || d.includes('brain')) return "brain";
        if (d.includes('cardio') || d.includes('heart')) return "heartbeat";
        if (d.includes('ent') || d.includes('ear')) return "ear-listen";
        if (d.includes('ivf') || d.includes('genet')) return "dna";
        if (d.includes('pediat') || d.includes('baby')) return "baby";
        if (d.includes('lab') || d.includes('test')) return "flask";
        if (d.includes('derm')) return "stethoscope";
        return "server";
    };

    const orb1Transform = orb1Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20]
    });
    
    const orb2Transform = orb2Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -20]
    });

    return (
        <View style={styles.qlAdminBody}>
            {/* Ambient Lighting Orbs */}
            <Animated.View style={[styles.ambientOrb, styles.orb1, { transform: [{ translateX: orb1Transform }, { translateY: Animated.multiply(orb1Transform, -1) }] }]} />
            <Animated.View style={[styles.ambientOrb, styles.orb2, { transform: [{ translateX: orb2Transform }, { translateY: Animated.multiply(orb2Transform, -1) }] }]} />

            <ScrollView contentContainerStyle={styles.qlAppContainer} showsVerticalScrollIndicator={false}>
                {/* ─── 1. HEADER ─── */}
                <View style={styles.qlAppHeader}>
                    <View style={styles.qlHeaderTitles}>
                        <Text style={styles.qlHeaderTitlesH1}>Question Library Builder</Text>
                        <Text style={styles.qlHeaderTitlesP}>Construct dynamic diagnostic forms for doctors.</Text>
                    </View>
                    <View style={styles.qlHeaderActions}>
                        <TouchableOpacity style={[styles.qlBtn, styles.qlBtnPreview]} onPress={() => { setPreviewIntake({}); setShowPreview(true); }}>
                            <FontAwesome5 name="eye" size={12} color="#475569" />
                            <Text style={styles.qlBtnPreviewText}>Preview</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.qlBtn, styles.qlBtnSave, saving && styles.qlBtnSaveDisabled]} onPress={handleSave} disabled={saving}>
                            <FontAwesome5 name="cloud-upload-alt" size={12} color="#ffffff" />
                            <Text style={styles.qlBtnSaveText}>{saving ? 'Syncing...' : 'Save & Deploy'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ─── 2. DEPARTMENT TABS ─── */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qlDeptTabs}>
                    {visibleDepartments.map(dept => (
                        <TouchableOpacity
                            key={dept}
                            style={[styles.qlTab, departmentTab === dept && styles.qlTabActive]}
                            onPress={() => {
                                setDepartmentTab(dept);
                                const cats = Object.keys(libraryData[dept] || {});
                                setActiveCategory(cats.length > 0 ? cats[0] : '');
                            }}
                        >
                            <FontAwesome5 name={getDeptIcon(dept)} size={12} color={departmentTab === dept ? '#1E60A4' : '#64748b'} />
                            <Text style={[styles.qlTabText, departmentTab === dept && styles.qlTabTextActive]}>{dept}</Text>
                            {departmentTab === dept && allowedDepartments === null && (
                                <View style={styles.tabActionsQuick}>
                                    <TouchableOpacity style={styles.tabActionIcon} onPress={() => handleEditDepartment(dept)}>
                                        <FontAwesome5 name="pen" size={10} color="#64748b" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.tabActionIcon} onPress={() => handleDeleteDepartment(dept)}>
                                        <FontAwesome5 name="trash" size={10} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}

                    {allowedDepartments === null && (
                        <TouchableOpacity style={[styles.qlTab, styles.qlTabDashed]} onPress={handleAddDepartmentClick}>
                            <FontAwesome5 name="plus" size={12} color="#38B29B" />
                            <Text style={styles.qlTabDashedText}>Initialize Dept</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>

                {/* ─── 3. WORKSPACE GRID ─── */}
                <View style={styles.qlWorkspaceGrid}>
                    {/* LEFT SIDEBAR */}
                    <View style={styles.qlSidebar}>
                        <View style={styles.qlAddCategoryBox}>
                            <TextInput 
                                style={styles.qlAddCategoryInput}
                                placeholder="Input sequence name..." 
                                placeholderTextColor="#94a3b8"
                                value={newCatName} 
                                onChangeText={setNewCatName} 
                                onSubmitEditing={() => handleAddCategory()}
                            />
                            <TouchableOpacity style={styles.qlBtnAddCat} onPress={() => handleAddCategory()}>
                                <FontAwesome5 name="plus" size={12} color="#ffffff" />
                                <Text style={styles.qlBtnAddCatText}>Inject Category</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.qlCategoryList}>
                            {Object.keys(currentCategories).map(cat => (
                                <TouchableOpacity 
                                    key={cat} 
                                    style={[styles.qlCategoryItem, cat === activeCategory && styles.qlCategoryItemActive]} 
                                    onPress={() => setActiveCategory(cat)}
                                >
                                    <View style={styles.catItemLeft}>
                                        <FontAwesome5 name={cat === activeCategory ? 'folder-open' : 'folder'} size={14} color="#64748b" style={styles.catFolderIcon} />
                                        <Text style={[styles.catText, cat === activeCategory && styles.catTextActive]} numberOfLines={1}>{cat}</Text>
                                    </View>
                                    <View style={styles.catItemRight}>
                                        <TouchableOpacity style={styles.qlCatActionBtn} onPress={() => handleEditCategory(cat)}>
                                            <FontAwesome5 name="pen" size={10} color="#64748b" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.qlCatActionBtn} onPress={() => handleDeleteCategory(cat)}>
                                            <FontAwesome5 name="trash" size={10} color="#ef4444" />
                                        </TouchableOpacity>
                                        <FontAwesome5 name="angle-right" size={12} color={cat === activeCategory ? '#38B29B' : 'rgba(0,0,0,0.4)'} />
                                    </View>
                                    {cat === activeCategory && <View style={styles.qlCategoryItemIndicator} />}
                                </TouchableOpacity>
                            ))}
                            {Object.keys(currentCategories).length === 0 && (
                                <View style={styles.qlNoCats}>
                                    <Text style={styles.qlNoCatsText}>No categories injected yet.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>

                    {/* RIGHT CANVAS */}
                    <View style={styles.qlMainCanvas}>
                        {/* Dynamic Grid Background - simplified for RN */}
                        <View style={styles.qlCanvasGridBg} />

                        <View style={styles.qlCanvasContent}>
                            {!activeCategory ? (
                                <View style={styles.qlCanvasEmpty}>
                                    <FontAwesome5 name="cubes" size={56} color="#38B29B" style={styles.holoIcon} />
                                    <Text style={styles.qlCanvasEmptyText}>WAITING FOR CATEGORY SELECTION...</Text>
                                </View>
                            ) : (
                                <View style={styles.qlCanvasActive}>
                                    <View style={styles.qlCanvasHeader}>
                                        <View style={styles.qlCanvasHeaderLeft}>
                                            <Text style={styles.qlCanvasHeaderH2}>{activeCategory.toUpperCase()}</Text>
                                            <View style={styles.qlItemCountBadge}>
                                                <Text style={styles.qlItemCountBadgeText}>{questionsInActiveCategory.length} data points</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity 
                                            style={styles.qlBtnAddQ} 
                                            onPress={() => { 
                                                setEditIndex(null); 
                                                setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' }); 
                                                setShowAddModal(true); 
                                            }}
                                        >
                                            <FontAwesome5 name="plus" size={12} color="#ffffff" />
                                            <Text style={styles.qlBtnAddQText}>Inject Data Point</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView contentContainerStyle={styles.qlQuestionStream}>
                                        {questionsInActiveCategory.map((q, idx) => renderQuestionCard(q, idx, activeCategory))}
                                        {questionsInActiveCategory.length === 0 && (
                                            <View style={styles.qlDataStreamEmpty}>
                                                <Text style={styles.streamComment}>// SYNCING WITH MAINFRAME...</Text>
                                                <Text style={styles.streamText}>&gt; No data parameters detected in this sequence.</Text>
                                                <Text style={styles.streamText}>&gt; Awaiting manual input or AI generation.</Text>
                                                <Text style={styles.streamBlink}>_</Text>
                                            </View>
                                        )}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Department Modal */}
            <Modal visible={showDeptModal} transparent animationType="fade">
                <View style={styles.qlModalOverlay}>
                    <View style={styles.qlModalContent}>
                        <View style={styles.qlModalHeaderTop}>
                            <Text style={styles.qlModalHeaderH3}>Initialize Department</Text>
                            <TouchableOpacity style={styles.modalClose} onPress={() => setShowDeptModal(false)}>
                                <FontAwesome5 name="times" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{ marginTop: 16 }}>
                            <Text style={styles.qlModalLabel}>Select from Predefined List</Text>
                            {/* Simple mapping for select in RN since we can't use native select easily without Picker */}
                            <ScrollView style={{maxHeight: 120, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, marginTop: 4}}>
                                {predefinedDepartments.map(d => (
                                    <TouchableOpacity key={d} onPress={() => { setSelectedDept(d); setCustomDept(''); }} style={{padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: selectedDept === d ? '#e2e8f0' : '#fff'}}>
                                        <Text style={{fontSize: 13.5, color: '#0f172a'}}>{d}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <Text style={styles.qlModalDivider}>OR</Text>
                        
                        <View>
                            <Text style={styles.qlModalLabel}>Custom Department Name</Text>
                            <TextInput 
                                style={styles.qlModalInput} 
                                placeholder="e.g., Cardiology, Oncology..." 
                                placeholderTextColor="#94a3b8"
                                value={customDept} 
                                onChangeText={(val) => {
                                    setCustomDept(val);
                                    setSelectedDept('');
                                }} 
                                onSubmitEditing={confirmAddDepartment}
                            />
                        </View>

                        <View style={styles.qlModalActions}>
                            <TouchableOpacity style={[styles.qlModalBtn, styles.qlModalBtnCancel]} onPress={() => setShowDeptModal(false)}>
                                <Text style={styles.qlModalBtnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.qlModalBtn, styles.qlModalBtnSubmit]} onPress={confirmAddDepartment}>
                                <Text style={styles.qlModalBtnSubmitText}>Initialize</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add / Edit Question Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <View style={styles.qlModalOverlay}>
                    <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', padding: 20}}>
                        <View style={styles.qlModalContent}>
                            <View style={styles.qlModalHeaderTop}>
                                <Text style={styles.qlModalHeaderH3}>{editIndex !== null ? 'Edit Data Point' : 'Inject New Data Point'}</Text>
                                <TouchableOpacity style={styles.modalClose} onPress={resetModalState}>
                                    <FontAwesome5 name="times" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={{ marginTop: 16 }}>
                                <Text style={styles.qlModalLabel}>Question Label / Title *</Text>
                                <TextInput 
                                    style={styles.qlModalInput} 
                                    placeholder="e.g. Previous Medical History..." 
                                    placeholderTextColor="#94a3b8"
                                    value={newQ.q} 
                                    onChangeText={(val) => setNewQ({ ...newQ, q: val })} 
                                />
                            </View>

                            <View style={{ marginTop: 12 }}>
                                <Text style={styles.qlModalLabel}>Input Parameter Type (Tap to type, ideally use a Picker in full app)</Text>
                                <TextInput 
                                    style={styles.qlModalInput} 
                                    value={newQ.type} 
                                    onChangeText={(val) => setNewQ({ ...newQ, type: val })}
                                    placeholder="text, select, checkbox-group..."
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>

                            {['select', 'checkbox-group', 'checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.qlModalLabel}>Options (Comma separated)</Text>
                                    <TextInput 
                                        style={styles.qlModalInput} 
                                        placeholder="Option A, Option B, Option C" 
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.options} 
                                        onChangeText={(val) => setNewQ({ ...newQ, options: val })} 
                                    />
                                </View>
                            )}

                            {['checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.qlModalLabel}>Extra Notes Field Title</Text>
                                    <TextInput 
                                        style={styles.qlModalInput} 
                                        placeholder="e.g. Remarks, Details..." 
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.extra} 
                                        onChangeText={(val) => setNewQ({ ...newQ, extra: val })} 
                                    />
                                </View>
                            )}

                            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <FontAwesome5 name="bolt" size={12} color="#eab308" />
                                    <Text style={styles.qlModalLabel}>Conditional Display (Optional)</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TextInput 
                                        style={[styles.qlModalInput, { flex: 1 }]} 
                                        placeholder="Parent Question Label" 
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.parentQ} 
                                        onChangeText={(val) => setNewQ({ ...newQ, parentQ: val })} 
                                    />
                                    <TextInput 
                                        style={[styles.qlModalInput, { flex: 1 }]} 
                                        placeholder="When Parent = (e.g. Yes)" 
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.condition} 
                                        onChangeText={(val) => setNewQ({ ...newQ, condition: val })} 
                                    />
                                </View>
                            </View>

                            <View style={styles.qlModalActions}>
                                <TouchableOpacity style={[styles.qlModalBtn, styles.qlModalBtnCancel]} onPress={resetModalState}>
                                    <Text style={styles.qlModalBtnCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.qlModalBtn, styles.qlModalBtnSubmit]} onPress={handleAddQuestion}>
                                    <Text style={styles.qlModalBtnSubmitText}>{editIndex !== null ? 'Update Parameter' : 'Inject Parameter'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Smart Preview Modal */}
            <Modal visible={showPreview} transparent animationType="slide">
                <View style={styles.qlModalOverlay}>
                    <View style={[styles.qlModalContent, { maxHeight: '85%' }]}>
                        <View style={styles.qlModalHeaderTop}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <FontAwesome5 name="eye" size={16} color="#1E60A4" />
                                <Text style={styles.qlModalHeaderH3}>Doctor Live Form Preview</Text>
                            </View>
                            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPreview(false)}>
                                <FontAwesome5 name="times" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ marginTop: 16 }}>
                            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                                Interactive rendering of all categories for department: <Text style={{ color: '#1E60A4', fontWeight: 'bold' }}>{departmentTab}</Text>
                            </Text>

                            {Object.keys(currentCategories).map(cat => (
                                <View key={cat} style={{ marginBottom: 20, backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                    <Text style={{ margin: 0, marginBottom: 12, color: '#0f172a', fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 6, fontWeight: 'bold' }}>
                                        📂 {cat}
                                    </Text>
                                    <View style={{ flexDirection: 'column', gap: 12 }}>
                                        {(currentCategories[cat] || []).map((q, qIdx) => (
                                            <View key={qIdx}>
                                                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155', marginBottom: 4 }}>
                                                    {q.q}
                                                </Text>
                                                {q.type === 'textarea' ? (
                                                    <TextInput multiline numberOfLines={2} placeholder="Doctor notes..." placeholderTextColor="#94a3b8" style={{ width: '100%', padding: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 13, textAlignVertical: 'top' }} />
                                                ) : q.type === 'yes-no' || q.type === 'select' ? (
                                                    <View style={{ width: q.type === 'yes-no' ? 140 : 160, padding: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' }}>
                                                        <Text style={{fontSize: 13, color: '#94a3b8'}}>Select...</Text>
                                                    </View>
                                                ) : (
                                                    <TextInput placeholder="Value..." placeholderTextColor="#94a3b8" style={{ width: '100%', padding: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 13 }} />
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.qlModalActions}>
                            <TouchableOpacity style={[styles.qlModalBtn, styles.qlModalBtnCancel]} onPress={() => setShowPreview(false)}>
                                <Text style={styles.qlModalBtnCancelText}>Close Preview</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    qlAdminBody: {
        backgroundColor: '#f0f7f9',
        flex: 1,
        paddingTop: Platform.OS === 'web' ? 30 : 50,
        paddingHorizontal: Platform.OS === 'web' ? 36 : 16,
    },
    ambientOrb: {
        position: 'absolute',
        borderRadius: 9999,
        opacity: 0.6,
        // React Native doesn't support massive blur easily without external libs, simulating with opacity
    },
    orb1: {
        width: 550,
        height: 550,
        backgroundColor: 'rgba(56, 178, 155, 0.1)',
        top: -80,
        left: -80,
    },
    orb2: {
        width: 650,
        height: 650,
        backgroundColor: 'rgba(30, 96, 164, 0.08)',
        bottom: -120,
        right: -80,
    },
    qlAppContainer: {
        flexGrow: 1,
        maxWidth: 1440,
        alignSelf: 'center',
        width: '100%',
        paddingBottom: 40,
    },
    qlAppHeader: {
        flexDirection: Platform.OS === 'web' && SCREEN_WIDTH > 768 ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: Platform.OS === 'web' && SCREEN_WIDTH > 768 ? 'center' : 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(30, 96, 164, 0.15)',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginBottom: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 2,
    },
    qlHeaderTitles: {
        marginBottom: Platform.OS === 'web' && SCREEN_WIDTH > 768 ? 0 : 14,
    },
    qlHeaderTitlesH1: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
        letterSpacing: -0.3,
    },
    qlHeaderTitlesP: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
        fontWeight: '500',
    },
    qlHeaderActions: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        width: Platform.OS === 'web' && SCREEN_WIDTH > 768 ? 'auto' : '100%',
        flexWrap: 'wrap',
    },
    qlBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    qlBtnPreview: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    qlBtnPreviewText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700',
    },
    qlBtnSave: {
        backgroundColor: '#1E60A4', // Simplified gradient
        shadowColor: 'rgba(30, 96, 164, 0.25)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 14,
        elevation: 4,
    },
    qlBtnSaveDisabled: {
        opacity: 0.6,
    },
    qlBtnSaveText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    qlDeptTabs: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        marginBottom: 22,
        paddingRight: 20,
    },
    qlTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(30, 96, 164, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 1,
        marginRight: 10,
    },
    qlTabActive: {
        backgroundColor: 'rgba(30, 96, 164, 0.08)',
        borderColor: '#1E60A4',
    },
    qlTabDashed: {
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#38B29B',
        backgroundColor: 'transparent',
        elevation: 0,
        shadowOpacity: 0,
    },
    qlTabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    qlTabTextActive: {
        color: '#1E60A4',
    },
    qlTabDashedText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#38B29B',
    },
    tabActionsQuick: {
        flexDirection: 'row',
        gap: 4,
        marginLeft: 6,
    },
    tabActionIcon: {
        padding: 2,
    },
    qlWorkspaceGrid: {
        flexDirection: SCREEN_WIDTH > 1024 ? 'row' : 'column',
        gap: 24,
        minHeight: SCREEN_HEIGHT - 240,
    },
    qlSidebar: {
        width: SCREEN_WIDTH > 1024 ? 330 : '100%',
        flexDirection: 'column',
        gap: 16,
    },
    qlAddCategoryBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#38B29B',
        borderRadius: 18,
        padding: 18,
        flexDirection: 'column',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 2,
    },
    qlAddCategoryInput: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: 'rgba(30, 96, 164, 0.2)',
        fontSize: 13.5,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    qlBtnAddCat: {
        width: '100%',
        padding: 12,
        backgroundColor: '#38B29B',
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    qlBtnAddCatText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    qlCategoryList: {
        maxHeight: 520,
    },
    qlCategoryItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(30, 96, 164, 0.15)',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 1,
        overflow: 'hidden',
    },
    qlCategoryItemActive: {
        backgroundColor: '#ffffff',
        borderColor: '#1E60A4',
        transform: [{ translateX: 4 }],
    },
    qlCategoryItemIndicator: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4.5,
        backgroundColor: '#1E60A4',
    },
    catItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    catFolderIcon: {
        fontSize: 15,
    },
    catText: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#64748b',
    },
    catTextActive: {
        color: '#1E60A4',
    },
    catItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    qlCatActionBtn: {
        padding: 2,
    },
    qlCatActionBtnText: {
        fontSize: 11,
    },
    qlNoCats: {
        alignItems: 'center',
        padding: 24,
    },
    qlNoCatsText: {
        fontSize: 13,
        color: '#64748b',
    },
    qlMainCanvas: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 22,
        minHeight: 520,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
    },
    qlCanvasGridBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.04,
        backgroundColor: '#1E60A4',
        // In full app, use an SVG pattern for grid
    },
    qlCanvasContent: {
        flex: 1,
        zIndex: 2,
    },
    qlCanvasEmpty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 380,
    },
    holoIcon: {
        marginBottom: 16,
    },
    qlCanvasEmptyText: {
        color: '#1E60A4',
        fontSize: 14.5,
        letterSpacing: 0.5,
        fontWeight: '700',
    },
    qlCanvasHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'rgba(30, 96, 164, 0.1)',
        paddingBottom: 18,
        marginBottom: 20,
    },
    qlCanvasHeaderH2: {
        fontSize: 22,
        color: '#1E60A4',
        fontWeight: '800',
    },
    qlItemCountBadge: {
        backgroundColor: 'rgba(56, 178, 155, 0.12)',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    qlItemCountBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#38B29B',
    },
    qlBtnAddQ: {
        backgroundColor: '#1E60A4',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 12,
    },
    qlBtnAddQText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    qlQuestionStream: {
        flexDirection: 'column',
        gap: 14,
        paddingBottom: 20,
    },
    qlDataStreamEmpty: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: 'rgba(30, 96, 164, 0.15)',
        borderRadius: 16,
        padding: 22,
    },
    streamComment: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '500',
    },
    streamText: {
        color: '#1E60A4',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
    },
    streamBlink: {
        color: '#1E60A4',
        fontSize: 13,
        fontWeight: 'bold',
        marginTop: 8,
    },
    qlQuestionCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(30, 96, 164, 0.16)',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 14,
    },
    qlQuestionTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    qlQuestionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        flexWrap: 'wrap',
    },
    qIcon: {
        fontSize: 14,
    },
    qlQuestionTitleText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    qlQuestionTypeBadge: {
        backgroundColor: 'rgba(56, 178, 155, 0.12)',
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 6,
    },
    qlQuestionTypeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#38B29B',
        letterSpacing: 0.5,
    },
    qlQuestionActions: {
        flexDirection: 'row',
        gap: 6,
    },
    qlBtnEditQ: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    qlBtnEditQText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    qlBtnDelQ: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    qlBtnDelQText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    qlConditionBadge: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    qlConditionBadgeText: {
        color: '#92400e',
        fontSize: 11.5,
    },
    qlInputPreview: {
        marginTop: 6,
    },
    disabledInput: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    disabledInputText: {
        color: '#94a3b8',
        fontSize: 13,
    },
    qlCheckboxGrid: {
        flexDirection: 'row',
        gap: 14,
        flexWrap: 'wrap',
    },
    checkboxLabelWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fakeCheckbox: {
        width: 14,
        height: 14,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 3,
        backgroundColor: '#f1f5f9',
    },
    checkboxLabelText: {
        fontSize: 13,
        color: '#334155',
    },
    qlComplexGroup: {
        flexDirection: 'column',
        gap: 8,
    },
    qlComplexRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    qlExtraField: {
        marginTop: 6,
    },
    qlExtraFieldLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    qlModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    qlModalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 520,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.3,
        shadowRadius: 50,
        elevation: 10,
    },
    qlModalHeaderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    qlModalHeaderH3: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalClose: {
        padding: 4,
    },
    qlModalLabel: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    qlModalInput: {
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        fontSize: 13.5,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    qlModalDivider: {
        textAlign: 'center',
        marginVertical: 10,
        color: '#94a3b8',
        fontSize: 11.5,
        fontWeight: '700',
    },
    qlModalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 20,
    },
    qlModalBtn: {
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 10,
    },
    qlModalBtnCancel: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    qlModalBtnCancelText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700',
    },
    qlModalBtnSubmit: {
        backgroundColor: '#1E60A4',
    },
    qlModalBtnSubmitText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    }
});

export default AdminQuestionLibrary;
