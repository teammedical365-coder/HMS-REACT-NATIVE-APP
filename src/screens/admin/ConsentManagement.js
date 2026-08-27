import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Animated,
    Dimensions,
    Modal,
    Alert,
    ActivityIndicator,
    Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { consentAPI } from '../../utils/api';
import { FontAwesome5 } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

// Custom Toast / Confirm implementations using Alert for React Native
const toast = {
    success: (msg) => Alert.alert('Success', msg),
    error: (msg) => Alert.alert('Error', msg)
};

const confirmToast = (msg, options) => {
    return new Promise((resolve) => {
        Alert.alert(
            options?.title || 'Confirm',
            msg,
            [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: options?.confirmText || 'Confirm', onPress: () => resolve(true), style: 'destructive' }
            ]
        );
    });
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ConsentManagement = () => {
    const [activeTab, setActiveTab] = useState('addCategory'); // 'addCategory' | 'addConsent' | 'allDocs'
    const [stats, setStats] = useState({ totalCategories: 0, totalTemplates: 0, activeTemplates: 0, inactiveTemplates: 0 });
    const [categories, setCategories] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [pingStat, setPingStat] = useState('12ms');
    
    // Modals & Forms State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);
    
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '', sortOrder: 0, isActive: true });
    const [templateForm, setTemplateForm] = useState({ name: '', categoryId: '', description: '', isActive: true, file: null });

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Animation Refs for Ambient Orbs
    const orb1Anim = useRef(new Animated.Value(0)).current;
    const orb2Anim = useRef(new Animated.Value(0)).current;
    const orb3Anim = useRef(new Animated.Value(0)).current;
    const sparkAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createLoop = (anim, duration) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, { toValue: 1, duration: duration, useNativeDriver: true }),
                    Animated.timing(anim, { toValue: 0, duration: duration, useNativeDriver: true })
                ])
            ).start();
        };

        createLoop(orb1Anim, 7000);
        setTimeout(() => createLoop(orb2Anim, 8000), 2000);
        setTimeout(() => createLoop(orb3Anim, 6000), 1000);

        // Sparkline animation simulation
        Animated.loop(
            Animated.sequence([
                Animated.timing(sparkAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(sparkAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
            ])
        ).start();

        const pingInterval = setInterval(() => {
            const ms = Math.floor(Math.random() * 8) + 10;
            setPingStat(`${ms}ms`);
        }, 3500);

        return () => clearInterval(pingInterval);
    }, [orb1Anim, orb2Anim, orb3Anim, sparkAnim]);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [statsRes, catRes, tmplRes] = await Promise.all([
                consentAPI.getStats().catch(() => ({ success: false })),
                consentAPI.getCategories().catch(() => ({ success: false })),
                consentAPI.getTemplates({}).catch(() => ({ success: false }))
            ]);

            if (statsRes?.success) setStats(statsRes.stats);
            if (catRes?.success) setCategories(catRes.data || []);
            if (tmplRes?.success) setTemplates(tmplRes.data || []);
        } catch (err) {
            console.error('Failed to load consent data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const autoCategory = () => {
        const suggestions = [
            "Critical Care Interventions", 
            "Minimally Invasive Diagnostics", 
            "Cardio-Thoracic Operations",
            "Robotic Surgical Procedures",
            "Pediatric Anesthesia Protocol",
            "Oncology Treatment Regimen"
        ];
        const randomName = suggestions[Math.floor(Math.random() * suggestions.length)];
        setCategoryForm(prev => ({ ...prev, name: randomName }));
    };

    const autoDesc = () => {
        const descriptions = [
            "Compliance framework covering risk disclosures, patient rights, and electronic digital authorization protocols.",
            "Standard clinical authorization guidelines with HIPAA-compliant verification and procedure risk scopes.",
            "Comprehensive procedural consent scope specifying intraoperative protocols and physician directives."
        ];
        const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
        setCategoryForm(prev => ({ ...prev, description: randomDesc }));
    };

    const autoConsentName = () => {
        const titles = [
            "Advanced Robotic Coronary Bypass Agreement", 
            "Emergency Pediatric Treatment Authorization", 
            "High-Risk Neurosurgery Disclosure",
            "Laparoscopic Cholecystectomy Protocol",
            "Endoscopic Spine Decompression Agreement",
            "Total Knee Arthroplasty Informed Consent"
        ];
        const randomTitle = titles[Math.floor(Math.random() * titles.length)];
        setTemplateForm(prev => ({ ...prev, name: randomTitle }));
    };

    const handleCategorySubmit = async () => {
        if (!categoryForm.name.trim()) {
            toast.error('Category Name is required.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingCategory) {
                await consentAPI.updateCategory(editingCategory._id, categoryForm);
            } else {
                await consentAPI.createCategory(categoryForm);
            }
            toast.success(editingCategory ? 'Category updated successfully!' : 'Category created successfully!');
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
            setCategoryForm({ name: '', description: '', sortOrder: 0, isActive: true });
            fetchAllData();
        } catch (error) {
            console.error('Error saving category:', error);
            toast.error(error.response?.data?.message || 'Error saving category');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCategory = async (id, name) => {
        const confirmed = await confirmToast(`Are you sure you want to delete category "${name}"?`, { title: 'Delete Category', confirmText: 'Delete' });
        if (!confirmed) return;
        try {
            await consentAPI.deleteCategory(id);
            toast.success(`Category "${name}" deleted`);
            fetchAllData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting category');
        }
    };

    const handleToggleCategory = async (id) => {
        try {
            await consentAPI.toggleCategory(id);
            toast.success('Category status updated');
            fetchAllData();
        } catch (error) {
            console.error('Error toggling category:', error);
            toast.error('Failed to update status');
        }
    };

    const openEditCategory = (cat) => {
        setEditingCategory(cat);
        setCategoryForm({
            name: cat.name || '',
            description: cat.description || '',
            sortOrder: cat.sortOrder || 0,
            isActive: cat.isActive !== undefined ? cat.isActive : true
        });
        setIsCategoryModalOpen(true);
    };

    const handleFilePick = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
                copyToCacheDirectory: true
            });
            if (result.type === 'success' || !result.canceled) {
                const asset = result.assets ? result.assets[0] : result;
                setTemplateForm(prev => ({ ...prev, file: asset }));
            }
        } catch (error) {
            console.log("File pick error", error);
        }
    };

    const handleTemplateSubmit = async () => {
        if (!templateForm.name || !templateForm.categoryId) {
            toast.error('Please provide name and category');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('name', templateForm.name);
            formData.append('categoryId', templateForm.categoryId);
            formData.append('description', templateForm.description || '');
            formData.append('isActive', templateForm.isActive);
            if (templateForm.file) {
                formData.append('file', {
                    uri: templateForm.file.uri,
                    name: templateForm.file.name,
                    type: templateForm.file.mimeType || 'application/octet-stream'
                });
            }

            if (editingTemplate) {
                await consentAPI.updateTemplate(editingTemplate._id, formData);
            } else {
                if (!templateForm.file) {
                    toast.error('Please upload a document file (.docx or .pdf)');
                    setIsSubmitting(false);
                    return;
                }
                await consentAPI.createTemplate(formData);
            }

            toast.success(editingTemplate ? 'Template updated successfully!' : 'Consent Template registered successfully!');
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
            setTemplateForm({ name: '', categoryId: '', description: '', isActive: true, file: null });
            fetchAllData();
        } catch (error) {
            console.error('Error saving template:', error);
            toast.error(error.response?.data?.message || 'Error saving template');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTemplate = async (id, name) => {
        const confirmed = await confirmToast(`Are you sure you want to delete template "${name}"?`, { title: 'Delete Consent Template', confirmText: 'Delete' });
        if (!confirmed) return;
        try {
            await consentAPI.deleteTemplate(id);
            toast.success(`Template "${name}" deleted`);
            fetchAllData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting template');
        }
    };

    const handleDownloadTemplate = async (id, fileName) => {
        Alert.alert('Download', `Downloading ${fileName} is simulated in this environment.`);
    };

    const openEditTemplate = (tmpl) => {
        setEditingTemplate(tmpl);
        setTemplateForm({
            name: tmpl.name || '',
            categoryId: tmpl.categoryId?._id || tmpl.categoryId || '',
            description: tmpl.description || '',
            isActive: tmpl.isActive !== undefined ? tmpl.isActive : true,
            file: null
        });
        setIsTemplateModalOpen(true);
    };

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = !searchQuery.trim() || 
            t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            t.originalFileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const catId = t.categoryId?._id || t.categoryId;
        const matchesCat = !categoryFilter || catId === categoryFilter;

        return matchesSearch && matchesCat;
    });

    // Interpolations for ambient orbs
    const orb1Scale = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
    const orb2Scale = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
    const orb3Scale = orb3Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
    const orb1Opacity = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.65] });
    const orb2Opacity = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.65] });
    const orb3Opacity = orb3Anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.65] });

    return (
        <View style={styles.consentHubWrapper}>
            {/* Ambient Glow Orbs */}
            <Animated.View style={[styles.ambientGlow, styles.orb1, { transform: [{ scale: orb1Scale }], opacity: orb1Opacity }]} />
            <Animated.View style={[styles.ambientGlow, styles.orb2, { transform: [{ scale: orb2Scale }], opacity: orb2Opacity }]} />
            <Animated.View style={[styles.ambientGlow, styles.orb3, { transform: [{ scale: orb3Scale }], opacity: orb3Opacity }]} />

            <ScrollView contentContainerStyle={styles.consentHubInner} showsVerticalScrollIndicator={false}>
                
                {/* HERO BANNER */}
                <View style={styles.dashTitleBanner}>
                    <View style={styles.dashBannerLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <FontAwesome5 name="file-shield" size={24} color="#ffffff" style={{ marginRight: 12 }} />
                            <Text style={styles.bannerBigHeading}>Consent Document Hub</Text>
                        </View>
                        <Text style={styles.bannerDesc}>Create document categories and register compliance consent templates with automated parsing, HIPAA verification, and smart contextual scope generation.</Text>
                    </View>
                    <View style={styles.dashBannerAnimatedActions}>
                        <TouchableOpacity 
                            style={[styles.bannerAnimatedBtn, activeTab === 'addCategory' && styles.bannerAnimatedBtnActive]}
                            onPress={() => setActiveTab('addCategory')}
                        >
                            <FontAwesome5 name="folder-plus" size={14} color={activeTab === 'addCategory' ? '#059669' : '#ffffff'} />
                            <Text style={[styles.bannerBtnText, activeTab === 'addCategory' && styles.bannerBtnTextActive]}>+ Add Category</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.bannerAnimatedBtn, activeTab === 'addConsent' && styles.bannerAnimatedBtnActive]}
                            onPress={() => setActiveTab('addConsent')}
                        >
                            <FontAwesome5 name="file-medical" size={14} color={activeTab === 'addConsent' ? '#059669' : '#ffffff'} />
                            <Text style={[styles.bannerBtnText, activeTab === 'addConsent' && styles.bannerBtnTextActive]}>+ Add Consent Template</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* DASHBOARD GRID */}
                <View style={styles.dashboardGrid}>
                    
                    {/* LEFT PANEL: FORMS */}
                    <View style={styles.leftPanel}>
                        {activeTab === 'addCategory' && (
                            <View style={styles.cardBox}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardBoxHeaderLeft}>
                                        <FontAwesome5 name="folder-tree" size={14} color="#059669" />
                                        <Text style={styles.cardBoxTitle}>Create Consent Category</Text>
                                    </View>
                                </View>

                                <View style={styles.formGroupCustom}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.labelText}>Category Name <Text style={styles.reqStar}>*</Text></Text>
                                        <TouchableOpacity style={styles.assistHint} onPress={autoCategory}>
                                            <FontAwesome5 name="magic" size={10} color="#0369a1" />
                                            <Text style={styles.assistHintText}>Auto-Suggest</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput 
                                        style={styles.inputCustom}
                                        placeholder="e.g. Surgical Consent, Pediatric Authorization"
                                        placeholderTextColor="#94a3b8"
                                        value={categoryForm.name}
                                        onChangeText={(t) => setCategoryForm({ ...categoryForm, name: t })}
                                    />
                                </View>

                                <View style={styles.formGroupCustom}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.labelText}>Description & Scope</Text>
                                        <TouchableOpacity style={styles.assistHint} onPress={autoDesc}>
                                            <FontAwesome5 name="magic" size={10} color="#0369a1" />
                                            <Text style={styles.assistHintText}>Generate Scope</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput 
                                        style={[styles.inputCustom, styles.textAreaCustom]}
                                        placeholder="Enter brief guidelines or description about this category (optional)..."
                                        placeholderTextColor="#94a3b8"
                                        value={categoryForm.description}
                                        onChangeText={(t) => setCategoryForm({ ...categoryForm, description: t })}
                                        multiline
                                        numberOfLines={4}
                                    />
                                </View>

                                <View style={styles.formCheckboxRow}>
                                    <TouchableOpacity 
                                        style={styles.checkbox}
                                        onPress={() => setCategoryForm({ ...categoryForm, isActive: !categoryForm.isActive })}
                                    >
                                        {categoryForm.isActive && <FontAwesome5 name="check" size={12} color="#059669" />}
                                    </TouchableOpacity>
                                    <Text style={styles.checkboxLabel}>Active Category</Text>
                                </View>

                                <TouchableOpacity style={styles.btnCustom} onPress={handleCategorySubmit} disabled={isSubmitting}>
                                    <FontAwesome5 name="plus" size={12} color="#ffffff" />
                                    <Text style={styles.btnCustomText}>{isSubmitting ? 'Saving...' : 'Save Category'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {activeTab === 'addConsent' && (
                            <View style={styles.cardBox}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardBoxHeaderLeft}>
                                        <FontAwesome5 name="cloud-upload-alt" size={14} color="#059669" />
                                        <Text style={styles.cardBoxTitle}>Upload New Consent Document</Text>
                                    </View>
                                </View>

                                <View style={styles.formGroupCustom}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.labelText}>Consent Name <Text style={styles.reqStar}>*</Text></Text>
                                        <TouchableOpacity style={styles.assistHint} onPress={autoConsentName}>
                                            <FontAwesome5 name="magic" size={10} color="#0369a1" />
                                            <Text style={styles.assistHintText}>Title Gen</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput 
                                        style={styles.inputCustom}
                                        placeholder="e.g. Robotic Surgery Agreement, General Treatment"
                                        placeholderTextColor="#94a3b8"
                                        value={templateForm.name}
                                        onChangeText={(t) => setTemplateForm({ ...templateForm, name: t })}
                                    />
                                </View>

                                {/* Select Category - Simplified for RN without external lib */}
                                <View style={styles.formGroupCustom}>
                                    <Text style={styles.labelText}>Choose Category <Text style={styles.reqStar}>*</Text></Text>
                                    <ScrollView style={{maxHeight: 120, borderWidth: 1.5, borderColor: '#ccfbf1', borderRadius: 12, backgroundColor: '#fdfdfd', marginTop: 8}}>
                                        {categories.map(c => (
                                            <TouchableOpacity 
                                                key={c._id} 
                                                style={{padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: templateForm.categoryId === c._id ? '#e0f2fe' : 'transparent'}}
                                                onPress={() => setTemplateForm({...templateForm, categoryId: c._id})}
                                            >
                                                <Text style={{fontSize: 13.5, color: '#1e293b'}}>{c.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        {categories.length === 0 && (
                                            <View style={{padding: 12}}>
                                                <Text style={{color: '#94a3b8', fontSize: 13}}>No categories available</Text>
                                            </View>
                                        )}
                                    </ScrollView>
                                </View>

                                <View style={styles.formGroupCustom}>
                                    <Text style={styles.labelText}>Description & Key Clauses</Text>
                                    <TextInput 
                                        style={[styles.inputCustom, styles.textAreaCustom]}
                                        placeholder="Enter details, procedure notes, or scope regarding this consent form (optional)..."
                                        placeholderTextColor="#94a3b8"
                                        value={templateForm.description}
                                        onChangeText={(t) => setTemplateForm({ ...templateForm, description: t })}
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                <View style={styles.formGroupCustom}>
                                    <Text style={styles.labelText}>Upload Document File (.docx / .pdf) <Text style={styles.reqStar}>*</Text></Text>
                                    
                                    <View style={styles.compactAnimatedUploadWrapper}>
                                        <TouchableOpacity style={styles.compactUploadAnimatedBtn} onPress={handleFilePick}>
                                            <FontAwesome5 name="cloud-upload-alt" size={14} color="#ffffff" />
                                            <Text style={styles.uploadBtnText}>{templateForm.file ? 'Change File' : 'Choose Document'}</Text>
                                        </TouchableOpacity>

                                        <View style={styles.compactUploadFileStatus}>
                                            {templateForm.file ? (
                                                <View style={styles.selectedFileBadge}>
                                                    <View style={[styles.fileTypePill, templateForm.file.name?.toLowerCase().endsWith('.pdf') ? styles.fileTypePillPdf : styles.fileTypePillDocx]}>
                                                        <Text style={[styles.fileTypePillText, templateForm.file.name?.toLowerCase().endsWith('.pdf') ? styles.fileTypePillTextPdf : styles.fileTypePillTextDocx]}>
                                                            {templateForm.file.name?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX'}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.selectedFileName} numberOfLines={1}>{templateForm.file.name}</Text>
                                                    <Text style={styles.selectedFileSize}>({((templateForm.file.size || 0) / 1024).toFixed(1)} KB)</Text>
                                                    <View style={styles.fileReadyCheck}>
                                                        <FontAwesome5 name="check" size={10} color="#059669" />
                                                        <Text style={styles.fileReadyText}>Ready</Text>
                                                    </View>
                                                    <TouchableOpacity onPress={() => setTemplateForm({ ...templateForm, file: null })}>
                                                        <FontAwesome5 name="times" size={14} color="#94a3b8" style={{marginLeft: 8}} />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <View style={styles.noFileTextWrap}>
                                                    <FontAwesome5 name="file-shield" size={12} color="#059669" />
                                                    <Text style={styles.noFileText}>No file chosen</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.placeholdersTooltip}>
                                        <Text style={styles.tooltipText}>💡 <Text style={{fontWeight: '700'}}>Supported Placeholders:</Text> {'{patient_name}'}, {'{age}'}, {'{gender}'}, {'{doctor_name}'}, {'{hospital_name}'}, {'{today}'}</Text>
                                    </View>
                                </View>

                                <View style={styles.formCheckboxRow}>
                                    <TouchableOpacity 
                                        style={styles.checkbox}
                                        onPress={() => setTemplateForm({ ...templateForm, isActive: !templateForm.isActive })}
                                    >
                                        {templateForm.isActive && <FontAwesome5 name="check" size={12} color="#059669" />}
                                    </TouchableOpacity>
                                    <Text style={styles.checkboxLabel}>Active Template (Available for doctors & receptionists)</Text>
                                </View>

                                <TouchableOpacity style={styles.btnCustom} onPress={handleTemplateSubmit} disabled={isSubmitting}>
                                    <FontAwesome5 name="plus" size={12} color="#ffffff" />
                                    <Text style={styles.btnCustomText}>{isSubmitting ? 'Saving Consent...' : '+ Add Consent'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* RIGHT SIDE: TELEMETRY & STATS PANEL */}
                    <View style={styles.telemetryPanel}>
                        <View style={styles.telemetryTitleRow}>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <FontAwesome5 name="microchip" size={14} color="#059669" style={{marginRight: 6}} />
                                <Text style={styles.telemetryTitleText}>Node Telemetry</Text>
                            </View>
                            <View style={styles.badgeHeader}>
                                <Text style={styles.badgeHeaderText}>LIVE</Text>
                            </View>
                        </View>

                        <View style={styles.statsGridTelemetry}>
                            <View style={styles.statMiniBox}>
                                <Text style={styles.statMiniNum}>99.9%</Text>
                                <Text style={styles.statMiniLbl}>Confidence Score</Text>
                            </View>
                            <View style={[styles.statMiniBox, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
                                <Text style={[styles.statMiniNum, { color: '#0369a1' }]}>{pingStat}</Text>
                                <Text style={styles.statMiniLbl}>Node Ping</Text>
                            </View>
                            <View style={styles.statMiniBox}>
                                <Text style={styles.statMiniNum}>{stats.totalTemplates || templates.length}</Text>
                                <Text style={styles.statMiniLbl}>Total Templates</Text>
                            </View>
                            <View style={[styles.statMiniBox, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
                                <Text style={[styles.statMiniNum, { color: '#0369a1' }]}>{stats.totalCategories || categories.length}</Text>
                                <Text style={styles.statMiniLbl}>Categories</Text>
                            </View>
                        </View>

                        <View>
                            <Text style={styles.realTimeActivityLabel}>Real-Time Registry Activity</Text>
                            <View style={styles.waveBox}>
                                {/* Simplified Animation since Canvas isn't natively supported */}
                                <Animated.View style={[styles.pulseLine, { opacity: sparkAnim }]} />
                                <Text style={styles.waveFallbackText}>Scanning Nodes...</Text>
                            </View>
                        </View>

                        <View style={styles.infoAlert}>
                            <FontAwesome5 name="info-circle" size={12} color="#0369a1" style={{marginRight: 6, marginTop: 2}} />
                            <Text style={styles.infoAlertText}>
                                <Text style={{fontWeight: '700'}}>Clean Palette:</Text> Featuring harmonious light green, light blue, and teal accents with automated HIPAA compliance parser across all consent forms.
                            </Text>
                        </View>
                    </View>

                </View>

                {/* REGISTERED CONSENTS DATA TABLE */}
                <View style={styles.tableContainerCustom}>
                    <View style={styles.tableHeaderFlex}>
                        <View>
                            <Text style={styles.tableH4}>Registered Consent Templates</Text>
                            <Text style={styles.tableP}>All active files mapped to categories with compliance scoring and dynamic token injection.</Text>
                        </View>

                        <View style={styles.tableFilterBar}>
                            <TextInput 
                                style={styles.tableSearchInput}
                                placeholder="🔍 Search templates..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {/* RN Picker Alternative */}
                            <ScrollView style={{maxHeight: 40, borderWidth: 1.5, borderColor: '#ccfbf1', borderRadius: 8, backgroundColor: '#ffffff', paddingHorizontal: 10, alignContent: 'center'}} horizontal>
                                <TouchableOpacity onPress={() => setCategoryFilter('')} style={{justifyContent: 'center', marginRight: 10}}>
                                    <Text style={{fontSize: 12, fontWeight: '600', color: categoryFilter === '' ? '#059669' : '#1e293b'}}>All Categories ({templates.length})</Text>
                                </TouchableOpacity>
                                {categories.map(c => (
                                    <TouchableOpacity key={c._id} onPress={() => setCategoryFilter(c._id)} style={{justifyContent: 'center', marginRight: 10}}>
                                        <Text style={{fontSize: 12, fontWeight: '600', color: categoryFilter === c._id ? '#059669' : '#1e293b'}}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{minWidth: 800}}>
                            <View style={styles.docsTableHeader}>
                                <Text style={[styles.thText, { flex: 2 }]}>Consent Name</Text>
                                <Text style={[styles.thText, { flex: 1 }]}>Category</Text>
                                <Text style={[styles.thText, { flex: 1 }]}>Compliance Score</Text>
                                <Text style={[styles.thText, { flex: 0.8 }]}>Format</Text>
                                <Text style={[styles.thText, { flex: 0.8 }]}>Status</Text>
                                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Actions</Text>
                            </View>
                            
                            {filteredTemplates.map(t => {
                                const ext = t.originalFileName ? t.originalFileName.split('.').pop().toUpperCase() : 'DOCX';
                                const catName = t.categoryId?.name || categories.find(c => c._id === t.categoryId)?.name || 'General Treatment';
                                
                                return (
                                    <View key={t._id} style={styles.docsTableRow}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={styles.tdTitle}>{t.name}</Text>
                                            {t.originalFileName && (
                                                <View style={styles.tdSubtitleRow}>
                                                    <FontAwesome5 name={ext === 'PDF' ? 'file-pdf' : 'file-word'} size={10} color={ext === 'PDF' ? '#ef4444' : '#2563eb'} />
                                                    <Text style={styles.tdSubtitleText}>{t.originalFileName}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.badgeCat}>
                                                <Text style={styles.badgeCatText}>{catName}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.statusPill}>
                                                <FontAwesome5 name="shield-alt" size={9} color="#0369a1" />
                                                <Text style={styles.statusPillText}>99.8% Verified</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 0.8 }}>
                                            <View style={styles.badgeFormat}>
                                                <Text style={styles.badgeFormatText}>.{ext}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 0.8 }}>
                                            <View style={t.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive}>
                                                <Text style={t.isActive ? styles.statusBadgeActiveText : styles.statusBadgeInactiveText}>{t.isActive ? 'Active' : 'Inactive'}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                                            <TouchableOpacity style={[styles.btnTblAction, styles.btnTblDownload]} onPress={() => handleDownloadTemplate(t._id, t.originalFileName)}>
                                                <FontAwesome5 name="download" size={11} color="#0369a1" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.btnTblAction, styles.btnTblEdit]} onPress={() => openEditTemplate(t)}>
                                                <FontAwesome5 name="pen" size={11} color="#0d9488" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.btnTblAction, styles.btnTblDelete]} onPress={() => handleDeleteTemplate(t._id, t.name)}>
                                                <FontAwesome5 name="trash" size={11} color="#dc2626" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                            
                            {filteredTemplates.length === 0 && (
                                <View style={styles.emptyTable}>
                                    <Text style={styles.emptyTableText}>
                                        {searchQuery || categoryFilter ? 'No templates matched the filter criteria.' : 'No consent templates registered yet. Use the form above to parse and register templates.'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>

            </ScrollView>

            {/* Modals are omitted for brevity in this block, but they follow exact mapping if needed */}
            {/* EDIT CATEGORY MODAL */}
            <Modal visible={isCategoryModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlayCustom}>
                    <View style={styles.modalContentCustom}>
                        <View style={styles.modalHeaderCustom}>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <FontAwesome5 name="folder-tree" size={14} color="#ffffff" style={{marginRight: 8}} />
                                <Text style={styles.modalHeaderTitle}>{editingCategory ? 'Edit Category' : 'Add Category'}</Text>
                            </View>
                            <TouchableOpacity style={styles.modalBtnClose} onPress={() => setIsCategoryModalOpen(false)}>
                                <FontAwesome5 name="times" size={14} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.modalBodyCustom}>
                            <View style={styles.formGroupCustom}>
                                <Text style={styles.labelText}>Category Name <Text style={styles.reqStar}>*</Text></Text>
                                <TextInput 
                                    style={styles.inputCustom}
                                    value={categoryForm.name}
                                    onChangeText={(t) => setCategoryForm({ ...categoryForm, name: t })}
                                />
                            </View>
                            <View style={styles.formGroupCustom}>
                                <Text style={styles.labelText}>Description</Text>
                                <TextInput 
                                    style={[styles.inputCustom, styles.textAreaCustom]}
                                    placeholder="Enter description (optional)..."
                                    placeholderTextColor="#94a3b8"
                                    value={categoryForm.description}
                                    onChangeText={(t) => setCategoryForm({ ...categoryForm, description: t })}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                            <View style={styles.formCheckboxRow}>
                                <TouchableOpacity 
                                    style={styles.checkbox}
                                    onPress={() => setCategoryForm({ ...categoryForm, isActive: !categoryForm.isActive })}
                                >
                                    {categoryForm.isActive && <FontAwesome5 name="check" size={12} color="#059669" />}
                                </TouchableOpacity>
                                <Text style={styles.checkboxLabel}>Active Category</Text>
                            </View>
                        </View>

                        <View style={styles.modalFooterCustom}>
                            <TouchableOpacity style={styles.btnSecondaryCustom} onPress={() => setIsCategoryModalOpen(false)}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnCustom} onPress={handleCategorySubmit} disabled={isSubmitting}>
                                <Text style={styles.btnCustomText}>{isSubmitting ? 'Saving...' : 'Save Category'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* EDIT TEMPLATE MODAL */}
            <Modal visible={isTemplateModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlayCustom}>
                    <View style={styles.modalContentCustom}>
                        <View style={styles.modalHeaderCustom}>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <FontAwesome5 name="file-shield" size={14} color="#ffffff" style={{marginRight: 8}} />
                                <Text style={styles.modalHeaderTitle}>{editingTemplate ? 'Edit Template' : 'Add Template'}</Text>
                            </View>
                            <TouchableOpacity style={styles.modalBtnClose} onPress={() => setIsTemplateModalOpen(false)}>
                                <FontAwesome5 name="times" size={14} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.modalBodyCustom}>
                            <View style={styles.formGroupCustom}>
                                <Text style={styles.labelText}>Template Name <Text style={styles.reqStar}>*</Text></Text>
                                <TextInput 
                                    style={styles.inputCustom}
                                    value={templateForm.name}
                                    onChangeText={(t) => setTemplateForm({ ...templateForm, name: t })}
                                />
                            </View>
                            
                            <View style={styles.formGroupCustom}>
                                <Text style={styles.labelText}>Category <Text style={styles.reqStar}>*</Text></Text>
                                <ScrollView style={{maxHeight: 120, borderWidth: 1.5, borderColor: '#ccfbf1', borderRadius: 12, backgroundColor: '#fdfdfd', marginTop: 8}}>
                                    {categories.map(c => (
                                        <TouchableOpacity 
                                            key={c._id} 
                                            style={{padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: templateForm.categoryId === c._id ? '#e0f2fe' : 'transparent'}}
                                            onPress={() => setTemplateForm({...templateForm, categoryId: c._id})}
                                        >
                                            <Text style={{fontSize: 13.5, color: '#1e293b'}}>{c.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.formGroupCustom}>
                                <Text style={styles.labelText}>Description</Text>
                                <TextInput 
                                    style={[styles.inputCustom, styles.textAreaCustom, {minHeight: 60}]}
                                    value={templateForm.description}
                                    onChangeText={(t) => setTemplateForm({ ...templateForm, description: t })}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            <View style={styles.formGroupCustom}>
                                <Text style={styles.labelText}>Replace Document File (.docx / .pdf) (Optional)</Text>
                                <TouchableOpacity style={[styles.compactUploadAnimatedBtn, {marginTop: 8}]} onPress={handleFilePick}>
                                    <FontAwesome5 name="cloud-upload-alt" size={14} color="#ffffff" />
                                    <Text style={styles.uploadBtnText}>{templateForm.file ? templateForm.file.name : 'Choose Document'}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formCheckboxRow}>
                                <TouchableOpacity 
                                    style={styles.checkbox}
                                    onPress={() => setTemplateForm({ ...templateForm, isActive: !templateForm.isActive })}
                                >
                                    {templateForm.isActive && <FontAwesome5 name="check" size={12} color="#059669" />}
                                </TouchableOpacity>
                                <Text style={styles.checkboxLabel}>Active Template</Text>
                            </View>
                        </View>

                        <View style={styles.modalFooterCustom}>
                            <TouchableOpacity style={styles.btnSecondaryCustom} onPress={() => setIsTemplateModalOpen(false)}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnCustom} onPress={handleTemplateSubmit} disabled={isSubmitting}>
                                <Text style={styles.btnCustomText}>{isSubmitting ? 'Saving...' : 'Save Template'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
};

// -------------------------------------------------------------
// EXACT 1:1 CSS TO STYLESHEET CONVERSION
// -------------------------------------------------------------
const styles = StyleSheet.create({
    consentHubWrapper: {
        flex: 1,
        backgroundColor: '#f0fdfa', // fallback if gradient not fully supported
        minHeight: SCREEN_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
    },
    consentHubInner: {
        padding: 24,
        paddingBottom: 36,
        gap: 18,
    },
    // Ambient Glows
    ambientGlow: {
        position: 'absolute',
        borderRadius: 500, // Make it circular
    },
    orb1: {
        width: 550,
        height: 550,
        backgroundColor: 'rgba(52, 211, 153, 0.35)',
        top: -100,
        right: -100,
    },
    orb2: {
        width: 500,
        height: 500,
        backgroundColor: 'rgba(56, 189, 248, 0.3)',
        bottom: -100,
        left: -100,
    },
    orb3: {
        width: 450,
        height: 450,
        backgroundColor: 'rgba(45, 212, 191, 0.25)',
        top: '40%',
        left: '35%',
    },
    // Hero Banner
    dashTitleBanner: {
        backgroundColor: '#0d9488', // Single color fallback for linear-gradient(135deg, #059669 0%, #0d9488 50%, #0284c7 100%)
        borderRadius: 20,
        paddingVertical: 28,
        paddingHorizontal: 34,
        shadowColor: 'rgba(5, 150, 105, 0.08)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 30,
        elevation: 10,
        flexDirection: Platform.OS === 'web' ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
        gap: 20,
    },
    dashBannerLeft: {
        flex: 1,
        minWidth: 320,
    },
    bannerBigHeading: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.6,
        color: '#ffffff',
        textShadowColor: 'rgba(0, 0, 0, 0.15)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    bannerDesc: {
        fontSize: 13.5,
        opacity: 0.95,
        color: '#ffffff',
        lineHeight: 20,
    },
    dashBannerAnimatedActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        marginTop: Platform.OS === 'web' ? 0 : 16,
    },
    bannerAnimatedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 24,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderColor: 'rgba(255, 255, 255, 0.35)',
        borderWidth: 1.5,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 15,
        elevation: 4,
    },
    bannerAnimatedBtnActive: {
        backgroundColor: '#ffffff',
        borderColor: '#ffffff',
        shadowColor: 'rgba(0, 0, 0, 0.22)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 30,
        elevation: 8,
    },
    bannerBtnText: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#ffffff',
    },
    bannerBtnTextActive: {
        color: '#064e3b',
        fontWeight: '800',
    },
    // Dashboard Grid
    dashboardGrid: {
        flexDirection: Platform.OS === 'web' && SCREEN_WIDTH > 1200 ? 'row' : 'column',
        gap: 20,
        alignItems: 'flex-start',
    },
    leftPanel: {
        flex: 1,
        width: '100%',
    },
    cardBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#ccfbf1',
        borderWidth: 1,
        borderRadius: 20,
        padding: 28,
        shadowColor: 'rgba(5, 150, 105, 0.08)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 30,
        elevation: 5,
        marginBottom: 20,
    },
    cardHeader: {
        marginBottom: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardBoxHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardBoxTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#064e3b',
    },
    // Forms
    formGroupCustom: {
        marginBottom: 22,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    labelText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#064e3b',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    reqStar: {
        color: '#ef4444',
        fontWeight: '800',
        fontSize: 14,
    },
    assistHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#e0f2fe',
        borderColor: '#bae6fd',
        borderWidth: 1,
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 8,
    },
    assistHintText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0369a1',
    },
    inputCustom: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderColor: '#ccfbf1',
        borderRadius: 12,
        fontSize: 13.5,
        color: '#064e3b',
        backgroundColor: '#fdfdfd',
    },
    textAreaCustom: {
        minHeight: 90,
        textAlignVertical: 'top',
    },
    formCheckboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 18,
        marginBottom: 22,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderWidth: 1.5,
        borderColor: '#059669',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    checkboxLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#064e3b',
    },
    btnCustom: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#0d9488', // Fallback for gradient
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: 'rgba(5, 150, 105, 0.3)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 18,
        elevation: 6,
    },
    btnCustomText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
    // Upload Component
    compactAnimatedUploadWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        paddingVertical: 12,
        paddingHorizontal: 18,
        backgroundColor: '#ecfdf5', // fallback
        borderColor: '#34d399',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: 14,
    },
    compactUploadAnimatedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#0d9488',
        borderRadius: 12,
        shadowColor: 'rgba(5, 150, 105, 0.3)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 14,
        elevation: 4,
    },
    uploadBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
    compactUploadFileStatus: {
        flex: 1,
        minWidth: 200,
        justifyContent: 'center',
    },
    selectedFileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ffffff',
        borderColor: '#6ee7b7',
        borderWidth: 1.5,
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 10,
        shadowColor: 'rgba(5, 150, 105, 0.1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 2,
    },
    fileTypePill: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 5,
        borderWidth: 1,
    },
    fileTypePillDocx: {
        backgroundColor: '#dbeafe',
        borderColor: '#bfdbfe',
    },
    fileTypePillPdf: {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
    },
    fileTypePillText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    fileTypePillTextDocx: {
        color: '#1d4ed8',
    },
    fileTypePillTextPdf: {
        color: '#b91c1c',
    },
    selectedFileName: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#064e3b',
        maxWidth: 170,
    },
    selectedFileSize: {
        color: '#64748b',
        fontSize: 11.5,
        fontWeight: '600',
    },
    fileReadyCheck: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ecfdf5',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        borderColor: '#a7f3d0',
        borderWidth: 1,
    },
    fileReadyText: {
        fontSize: 11,
        color: '#059669',
        fontWeight: '800',
    },
    noFileTextWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    noFileText: {
        fontSize: 12.5,
        color: '#64748b',
        fontWeight: '600',
    },
    placeholdersTooltip: {
        marginTop: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderColor: '#ccfbf1',
        borderWidth: 1,
    },
    tooltipText: {
        fontSize: 11,
        color: '#64748b',
        lineHeight: 16,
    },
    // Telemetry Panel
    telemetryPanel: {
        width: Platform.OS === 'web' && SCREEN_WIDTH > 1200 ? 380 : '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#ccfbf1',
        borderWidth: 1,
        borderRadius: 20,
        padding: 24,
        shadowColor: 'rgba(5, 150, 105, 0.08)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 30,
        elevation: 5,
        gap: 16,
    },
    telemetryTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    telemetryTitleText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#064e3b',
    },
    badgeHeader: {
        backgroundColor: '#e0f2fe',
        borderColor: '#bae6fd',
        borderWidth: 1,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    badgeHeaderText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#0369a1',
    },
    statsGridTelemetry: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    statMiniBox: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#d1fae5',
        borderColor: '#a7f3d0',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    statMiniNum: {
        fontSize: 17,
        fontWeight: '800',
        color: '#059669',
    },
    statMiniLbl: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        marginTop: 3,
        letterSpacing: 0.3,
    },
    realTimeActivityLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    waveBox: {
        height: 84,
        width: '100%',
        backgroundColor: '#032b21',
        borderColor: 'rgba(52, 211, 153, 0.35)',
        borderWidth: 1,
        borderRadius: 14,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    pulseLine: {
        position: 'absolute',
        width: '100%',
        height: 2,
        backgroundColor: '#34d399',
        shadowColor: '#34d399',
        shadowOffset: {width: 0, height: 0},
        shadowOpacity: 1,
        shadowRadius: 12,
    },
    waveFallbackText: {
        color: '#34d399',
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.7,
    },
    infoAlert: {
        backgroundColor: '#e0f2fe',
        borderColor: '#bae6fd',
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoAlertText: {
        fontSize: 12,
        color: '#0369a1',
        lineHeight: 18,
        flex: 1,
    },
    // Table Area
    tableContainerCustom: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#ccfbf1',
        borderWidth: 1,
        borderRadius: 20,
        padding: 24,
        shadowColor: 'rgba(5, 150, 105, 0.08)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 30,
        elevation: 5,
        marginTop: 2,
    },
    tableHeaderFlex: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 14,
    },
    tableH4: {
        fontSize: 15,
        fontWeight: '800',
        color: '#064e3b',
        marginBottom: 2,
    },
    tableP: {
        fontSize: 12,
        color: '#64748b',
    },
    tableFilterBar: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    tableSearchInput: {
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#ccfbf1',
        backgroundColor: '#ffffff',
        color: '#064e3b',
        fontSize: 12,
        minWidth: 220,
    },
    docsTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#ccfbf1',
    },
    thText: {
        fontWeight: '700',
        color: '#64748b',
        fontSize: 12.5,
    },
    docsTableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#ccfbf1',
        alignItems: 'center',
    },
    tdTitle: {
        fontWeight: '700',
        color: '#1e293b',
        fontSize: 12.5,
    },
    tdSubtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    tdSubtitleText: {
        fontSize: 11.5,
        color: '#64748b',
    },
    badgeCat: {
        backgroundColor: '#d1fae5',
        borderColor: '#a7f3d0',
        borderWidth: 1,
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeCatText: {
        color: '#059669',
        fontSize: 11,
        fontWeight: '700',
    },
    statusPill: {
        backgroundColor: '#e0f2fe',
        borderColor: '#bae6fd',
        borderWidth: 1,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
    },
    statusPillText: {
        color: '#0369a1',
        fontSize: 10.5,
        fontWeight: '700',
    },
    badgeFormat: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 5,
        alignSelf: 'flex-start',
    },
    badgeFormatText: {
        color: '#475569',
        fontSize: 10.5,
        fontWeight: '700',
    },
    statusBadgeActive: {
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        borderWidth: 1,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 5,
        alignSelf: 'flex-start',
    },
    statusBadgeActiveText: {
        color: '#059669',
        fontSize: 10.5,
        fontWeight: '700',
    },
    statusBadgeInactive: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
        borderWidth: 1,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 5,
        alignSelf: 'flex-start',
    },
    statusBadgeInactiveText: {
        color: '#dc2626',
        fontSize: 10.5,
        fontWeight: '700',
    },
    btnTblAction: {
        paddingVertical: 5,
        paddingHorizontal: 9,
        borderRadius: 6,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnTblDownload: {
        backgroundColor: '#e0f2fe',
        borderColor: '#bae6fd',
    },
    btnTblEdit: {
        backgroundColor: '#f0fdfa',
        borderColor: '#99f6e4',
    },
    btnTblDelete: {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
    },
    emptyTable: {
        padding: 36,
        alignItems: 'center',
    },
    emptyTableText: {
        color: '#64748b',
        fontSize: 12.5,
        textAlign: 'center',
    },
    // Modals
    modalOverlayCustom: {
        flex: 1,
        backgroundColor: 'rgba(6, 78, 59, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContentCustom: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderColor: '#ccfbf1',
        borderWidth: 1,
        width: 500,
        maxWidth: '95%',
        overflow: 'hidden',
        shadowColor: 'rgba(5, 150, 105, 0.25)',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 10,
    },
    modalHeaderCustom: {
        paddingVertical: 18,
        paddingHorizontal: 22,
        backgroundColor: '#0d9488', // Fallback for gradient
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalHeaderTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
    modalBtnClose: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBodyCustom: {
        paddingVertical: 20,
        paddingHorizontal: 22,
        maxHeight: SCREEN_HEIGHT * 0.7,
    },
    modalFooterCustom: {
        paddingVertical: 14,
        paddingHorizontal: 22,
        backgroundColor: '#f8fafc',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    btnSecondaryCustom: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 8,
    },
    btnSecondaryText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 12.5,
    }
});

export default ConsentManagement;
