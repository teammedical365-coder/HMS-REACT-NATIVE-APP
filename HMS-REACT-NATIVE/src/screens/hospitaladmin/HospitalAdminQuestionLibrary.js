import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Modal, Dimensions, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { questionLibraryAPI } from '../../utils/api';
import {
    SUPPORTED_LANGUAGES,
    getUIText,
    getTranslatedDepartment,
    getTranslatedCategory,
    getTranslatedClinicalText
} from '../../utils/questionLibraryI18n';

// ─── 12 Standard Medical Departments & 60+ Clinical Intake Questions ───────────
const defaultQuestionLibraryData = {
    "ENT": {
        "Clinical History & Intake": [
            { q: "When did the ear/throat/nose pain or irritation first start?", type: "text" },
            { q: "Have you consulted a doctor or taken any treatment for this previously?", type: "yes-no" },
            { q: "Are you currently taking any medicines (antibiotics, pain killers, nasal sprays)?", type: "textarea" },
            { q: "Does anyone in your family (parents/siblings) have a history of allergies or sinus/hearing issues?", type: "yes-no" },
            { q: "Which primary symptoms are you currently experiencing?", type: "checkbox-group", options: ["Ear Pain / Discharge", "Throat Soreness / Pain Swallowing", "Nasal Congestion / Blockage", "Hearing Loss / Ringing (Tinnitus)", "Dizziness / Vertigo", "Frequent Sneezing / Cold"] },
            { q: "Pain Severity Level (Scale 1 to 10)", type: "select", options: ["1 - Very Mild", "3 - Mild", "5 - Moderate", "7 - Severe", "9 - Very Severe", "10 - Unbearable"] }
        ]
    },
    "Cardiology": {
        "Cardiac Symptoms & Risk Profile": [
            { q: "When did you first notice the chest discomfort, heaviness, or palpitations?", type: "text" },
            { q: "Have you ever had an ECG, 2D Echo, Angiography, or TMT test done before?", type: "yes-no" },
            { q: "Are you currently taking any blood pressure, blood thinner (Aspirin), or cholesterol medicines?", type: "textarea" },
            { q: "Is there a family history of heart attack, hypertension, or sudden cardiac issues (Parents/Siblings)?", type: "yes-no" },
            { q: "Nature and sensation of chest discomfort", type: "select", options: ["Heavy Pressure / Squeezing", "Sharp / Stabbing", "Burning / Acidity-like", "Shortness of Breath on Exertion", "No Chest Pain (Only Palpitations)"] },
            { q: "Does the discomfort radiate to left arm, neck, shoulder, jaw, or back?", type: "yes-no" }
        ]
    },
    "Orthopedics": {
        "Joint & Bone Assessment": [
            { q: "When did the bone/joint/back pain begin, and was it caused by an injury or fall?", type: "text" },
            { q: "Have you had prior X-rays, MRI scans, or physiotherapy for this condition?", type: "yes-no" },
            { q: "What pain relief tablets, ointments, or calcium/vitamin D supplements are you taking?", type: "textarea" },
            { q: "Does any family member suffer from Arthritis, Gout, Spondylitis, or Osteoporosis?", type: "yes-no" },
            { q: "Are you able to put weight on the affected limb and walk without support?", type: "yes-no" },
            { q: "Associated symptoms observed", type: "checkbox-group", options: ["Joint Swelling / Warmth", "Morning Stiffness (>30 mins)", "Joint Clicking / Locking", "Numbness / Tingling in Limbs", "Restricted Joint Movement"] }
        ]
    },
    "Pediatrics": {
        "Child Health & Development": [
            { q: "When did the child's fever, cough, vomiting, or symptoms first appear?", type: "text" },
            { q: "Has the child visited a clinic or received emergency pediatric care for this episode?", type: "yes-no" },
            { q: "What syrups, drops, or fever medicines (with dose & time) were given?", type: "textarea" },
            { q: "Is the child's vaccination / immunization schedule completely up-to-date?", type: "yes-no" },
            { q: "Feeding, fluid intake, and active urine output status", type: "select", options: ["Normal Feeding & Playful", "Mildly Reduced Oral Intake", "Lethargic / Decreased Urine Output", "Refusing All Feeds / Vomiting Everything"] },
            { q: "Family history of childhood asthma, eczema, or food allergies", type: "yes-no" }
        ]
    },
    "Gynecology & Obstetrics": {
        "Women's Health & Obstetric Profile": [
            { q: "What was the date of your Last Menstrual Period (LMP)?", type: "text" },
            { q: "Have you consulted a gynecologist or had prior pelvic ultrasound scans?", type: "yes-no" },
            { q: "Are you currently taking any hormonal pills, thyroid medication, iron, or folic acid?", type: "textarea" },
            { q: "Is there a family history of PCOD/PCOS, Fibroids, Diabetes, or Gynae issues?", type: "yes-no" },
            { q: "Primary complaints and symptoms experienced", type: "checkbox-group", options: ["Irregular / Delayed Periods", "Severe Cramps / Pelvic Pain", "Heavy Bleeding with Clots", "Abnormal Vaginal Discharge / Itching", "Morning Sickness / Nausea", "Difficulty in Conceiving"] },
            { q: "Obstetric history: Total prior pregnancies (Gravida / Para / Living / Abortion)", type: "text" }
        ]
    },
    "Dermatology": {
        "Skin & Hair Assessment": [
            { q: "When did the skin rash, itching, boil, or hair loss first appear?", type: "text" },
            { q: "Have you applied any steroid creams, home remedies, or taken skin treatments before?", type: "yes-no" },
            { q: "List all oral medicines, supplements, soaps, oils, or cosmetics started recently", type: "textarea" },
            { q: "Does anyone in your family have Psoriasis, Eczema, Fungal infections, or Vitiligo?", type: "yes-no" },
            { q: "Characteristics and triggers of the skin condition", type: "checkbox-group", options: ["Intense Itching (Worse at night)", "Burning / Painful Sensation", "Spreading to Other Body Parts", "Flaking / Peeling Skin", "Pus-filled Lesions / Blisters", "Triggered by Sun / Sweat"] },
            { q: "Any known food, drug, or chemical allergies?", type: "text" }
        ]
    },
    "Ophthalmology": {
        "Eye Health & Vision Intake": [
            { q: "When did you first notice blurriness, redness, irritation, or vision changes?", type: "text" },
            { q: "Do you currently wear eyeglasses or contact lenses?", type: "yes-no" },
            { q: "Are you using any eye drops (lubricant, antibiotic, anti-glaucoma, steroid)?", type: "textarea" },
            { q: "Is there a family history of Glaucoma, Cataract, or Diabetic Retinopathy?", type: "yes-no" },
            { q: "Which eye is affected and what are the primary symptoms?", type: "checkbox-group", options: ["Right Eye Only", "Left Eye Only", "Both Eyes", "Redness & Excessive Watering", "Foreign Body Sensation / Grittiness", "Night Blindness / Glare Sensitivity", "Floaters / Flashes of Light"] },
            { q: "Do you have a history of Diabetes or High Blood Pressure?", type: "yes-no" }
        ]
    },
    "Neurology": {
        "Neurological Screening Protocol": [
            { q: "When did the headaches, dizziness, tremors, or weakness first begin?", type: "text" },
            { q: "Have you ever had an MRI/CT Brain scan, EEG, or consultation with a neurologist?", type: "yes-no" },
            { q: "Are you currently taking any anti-seizure, nerve pain, or migraine medicines?", type: "textarea" },
            { q: "Is there a family history of Stroke, Epilepsy, Parkinson's, or chronic migraines?", type: "yes-no" },
            { q: "Symptoms experienced during or between episodes", type: "checkbox-group", options: ["One-sided Throbbing Headache", "Numbness / Tingling in Arms/Legs", "Fainting / Loss of Consciousness", "Hand Tremors / Muscle Jerks", "Slurred Speech / Difficulty Speaking", "Balance / Walking Difficulty"] },
            { q: "Severity and impact on daily activities", type: "select", options: ["Mild - Does not affect daily work", "Moderate - Disables temporarily during episodes", "Severe - Unable to perform normal work / bedridden"] }
        ]
    },
    "Gastroenterology": {
        "Digestive & GI Tract Evaluation": [
            { q: "When did the stomach pain, indigestion, acidity, or bowel irregularity begin?", type: "text" },
            { q: "Have you undergone an Endoscopy, Colonoscopy, or Abdominal Ultrasound previously?", type: "yes-no" },
            { q: "What antacids (Pan-D, Omez), laxatives, or digestive syrups do you consume regularly?", type: "textarea" },
            { q: "Is there a family history of Gastric Ulcers, Gallstones, Fatty Liver, or Colon Polyps?", type: "yes-no" },
            { q: "Primary digestive complaints noted", type: "checkbox-group", options: ["Heartburn / Chest Acid Burning (GERD)", "Stomach Bloating / Excessive Gas", "Chronic Constipation", "Frequent Loose Stools / Diarrhea", "Post-Meal Nausea / Vomiting", "Black Stool / Blood in Stool"] },
            { q: "Pain relation to food consumption", type: "select", options: ["Increases after eating spicy/oily food", "Relieved after eating food/milk", "Severe on empty stomach", "No fixed relation to meals"] }
        ]
    },
    "Pulmonology": {
        "Respiratory & Chest Health": [
            { q: "Since how many days/months have you had the cough, breathlessness, or wheezing?", type: "text" },
            { q: "Have you had a Chest X-ray, HRCT Chest, or Pulmonary Function Test (PFT/Spirometry)?", type: "yes-no" },
            { q: "Do you use an inhaler (Rotahaler/Metered dose), nebulizer, or steroid syrups?", type: "textarea" },
            { q: "Is there a family history of Asthma, Chronic Bronchitis, TB, or Dust Allergy?", type: "yes-no" },
            { q: "Nature of cough and sputum production", type: "select", options: ["Dry Persistent Cough", "Wet Cough with Clear White Sputum", "Thick Yellow/Green Sputum", "Cough with Blood Streaks (Hemoptysis)", "Night-time Wheezing / Breathlessness"] },
            { q: "Tobacco / Smoking history and environmental exposure", type: "select", options: ["Non-Smoker (No exposure)", "Active Smoker (>5 cigarettes/day)", "Former Smoker (Quit)", "Heavy Dust / Chemical Factory Exposure"] }
        ]
    },
    "General Medicine": {
        "Baseline Clinical History": [
            { q: "What is your main health concern or problem, and when did it start?", type: "textarea" },
            { q: "Have you been hospitalized or had surgery in the past 2-3 years?", type: "yes-no" },
            { q: "List all ongoing daily medications, dosages, and health supplements", type: "textarea" },
            { q: "Family history of chronic conditions (Diabetes, High BP, Kidney Disease, Thyroid)?", type: "yes-no" },
            { q: "Constitutional symptoms present currently", type: "checkbox-group", options: ["Fever / Chills", "Unexplained Weight Loss", "Extreme Fatigue / Weakness", "Loss of Appetite", "Disturbed Sleep / Insomnia", "Generalized Body Aches"] },
            { q: "Any known drug allergies (e.g. Penicillin, Sulfa, Paracetamol, Aspirin)?", type: "text" }
        ]
    },
    "Dentistry": {
        "Dental & Oral Health History": [
            { q: "When did the toothache, sensitivity, swelling, or gum bleeding start?", type: "text" },
            { q: "When was your last dental check-up, cleaning (scaling), or tooth filling done?", type: "text" },
            { q: "Are you taking pain relievers, antibiotics, or blood-thinning medications?", type: "textarea" },
            { q: "Is there a family history of early tooth loss, gum problems, or jaw disorders?", type: "yes-no" },
            { q: "Primary dental and oral complaints", type: "checkbox-group", options: ["Sharp Pain on Biting / Chewing", "Hot & Cold Sensitivity", "Bleeding / Swollen / Receding Gums", "Bad Breath (Halitosis)", "Mobile / Loose Tooth", "Jaw Joint (TMJ) Pain / Clicking"] },
            { q: "Oral hygiene and habits", type: "select", options: ["Brushing Once Daily", "Brushing Twice Daily", "Night Teeth Grinding (Bruxism)", "Tobacco / Gutkha / Pan Masala Habit", "None"] }
        ]
    }
};

const PREDEFINED_DEPARTMENTS = [
    "ENT", "Cardiology", "Orthopedics", "Pediatrics", "Gynecology & Obstetrics",
    "Dermatology", "Ophthalmology", "Neurology", "Gastroenterology", "Pulmonology",
    "General Medicine", "Dentistry"
];

const QUESTION_TYPES = [
    { label: 'Single-line Text', value: 'text' },
    { label: 'Multi-line Notes / Textarea', value: 'textarea' },
    { label: 'Numeric Value', value: 'number' },
    { label: 'Yes / No Toggle', value: 'yes-no' },
    { label: 'Date Selection', value: 'date' },
    { label: 'Dropdown Options', value: 'select' },
    { label: 'Multi-Checkbox Group', value: 'checkbox-group' },
    { label: 'Checkbox + Date Field', value: 'checkbox-date-group' },
    { label: 'Checkbox + Text Field', value: 'checkbox-text-group' }
];

const HospitalAdminQuestionLibrary = () => {
    // ─── State ────────────────────────────────────────────────────────────────
    const [libraryData, setLibraryData] = useState(defaultQuestionLibraryData);
    const [currentLang, setCurrentLang] = useState('en');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [allowedDepartments, setAllowedDepartments] = useState(null);

    const [departmentTab, setDepartmentTab] = useState('ENT');
    const [activeCategory, setActiveCategory] = useState('Clinical History & Intake');
    const [newCatName, setNewCatName] = useState('');

    // Question Add/Edit Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
    const [newQ, setNewQ] = useState({
        q: '',
        type: 'text',
        options: '',
        extra: '',
        parentQ: '',
        condition: ''
    });

    // Department Modal
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState('');
    const [customDept, setCustomDept] = useState('');

    // Rename Department Modal
    const [renameDeptModal, setRenameDeptModal] = useState({ open: false, oldName: '', newName: '' });

    // Rename Category Modal
    const [renameCatModal, setRenameCatModal] = useState({ open: false, oldName: '', newName: '' });

    // Confirm Dialog Modal
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        isDestructive: false,
        onConfirm: null
    });

    // Preview Modal
    const [showPreview, setShowPreview] = useState(false);

    // Language Selector Modal
    const [showLangModal, setShowLangModal] = useState(false);
    const [langSearch, setLangSearch] = useState('');

    // Notification Banner
    const [notification, setNotification] = useState(null);

    const showNotify = (text, type = 'success') => {
        setNotification({ text, type });
        setTimeout(() => setNotification(null), 4500);
    };

    // ─── Lifecycle & Storage ──────────────────────────────────────────────────
    useEffect(() => {
        loadSavedLanguage();
        fetchLibrary();
    }, []);

    const loadSavedLanguage = async () => {
        try {
            const saved = await AsyncStorage.getItem('hms_question_lib_lang');
            if (saved) setCurrentLang(saved);
        } catch (e) {
            console.error('Failed to load language setting:', e);
        }
    };

    const handleLanguageChange = async (newLang) => {
        setCurrentLang(newLang);
        setShowLangModal(false);
        try {
            await AsyncStorage.setItem('hms_question_lib_lang', newLang);
        } catch (e) {
            console.error('Failed to persist language:', e);
        }
    };

    // ─── API Methods ──────────────────────────────────────────────────────────
    const fetchLibrary = async () => {
        try {
            setLoading(true);
            const res = await questionLibraryAPI.getLibrary();
            let data = res.data?.data;
            if (!data || Object.keys(data).length === 0) {
                data = defaultQuestionLibraryData;
            } else {
                data = { ...defaultQuestionLibraryData, ...data };
            }

            setLibraryData(data);
            setAllowedDepartments(res.allowedDepartments || null);

            const visibleDepts = res.allowedDepartments
                ? Object.keys(data).filter(d => res.allowedDepartments.includes(d))
                : Object.keys(data);
            const defaultDept = visibleDepts.length > 0 ? visibleDepts[0] : 'ENT';

            setDepartmentTab(defaultDept);
            const firstDeptCats = Object.keys(data[defaultDept] || {});
            if (firstDeptCats.length > 0) {
                setActiveCategory(firstDeptCats[0]);
            }
        } catch (err) {
            console.error('Error fetching question library:', err);
            showNotify('Failed to fetch library from server.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchLibrary();
        setTimeout(() => {
            setRefreshing(false);
            showNotify('Question Library refreshed!');
        }, 300);
    };

    const handleResetToStandard = () => {
        setConfirmDialog({
            open: true,
            title: 'Load 12 Medical Departments',
            message: 'Do you want to reset & load all 12 standard medical departments (ENT, Cardiology, Orthopedics, Pediatrics, Gynecology, etc.) with 60+ clinical intake questions?',
            confirmText: 'Load All 12 Depts',
            isDestructive: false,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setLibraryData(defaultQuestionLibraryData);
                setDepartmentTab('ENT');
                setActiveCategory('Clinical History & Intake');
                setSaving(true);
                try {
                    await questionLibraryAPI.updateLibrary(defaultQuestionLibraryData);
                    showNotify('✨ Successfully loaded and deployed all 12 Medical Departments!');
                } catch (err) {
                    showNotify('Error updating standard library in database.', 'error');
                } finally {
                    setSaving(false);
                }
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await questionLibraryAPI.updateLibrary(libraryData);
            if (res.success) {
                showNotify('Question Library updated & synced with all doctor workflows successfully!');
            }
        } catch (err) {
            console.error('Error saving question library:', err);
            showNotify('Error saving library to server.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ─── Department Operations ────────────────────────────────────────────────
    const confirmAddDepartment = () => {
        const dept = (selectedDept || customDept).trim();
        if (!dept) {
            showNotify('Please select or enter a department name.', 'error');
            return;
        }

        if (libraryData[dept]) {
            showNotify('Department already exists.', 'error');
            return;
        }

        const newLib = { ...libraryData };
        newLib[dept] = {
            'General Intake': []
        };

        setLibraryData(newLib);
        setDepartmentTab(dept);
        setActiveCategory('General Intake');
        setShowDeptModal(false);
        setSelectedDept('');
        setCustomDept('');
        showNotify(`Department "${dept}" created with General Intake category!`);
    };

    const confirmRenameDepartment = async () => {
        const oldName = renameDeptModal.oldName;
        const trimmed = renameDeptModal.newName.trim();
        if (!trimmed || trimmed === oldName) {
            setRenameDeptModal({ open: false, oldName: '', newName: '' });
            return;
        }

        if (libraryData[trimmed]) {
            showNotify('A department with this name already exists.', 'error');
            return;
        }

        const newLib = { ...libraryData };
        const categories = newLib[oldName];
        delete newLib[oldName];
        newLib[trimmed] = categories;

        setLibraryData(newLib);
        if (departmentTab === oldName) {
            setDepartmentTab(trimmed);
        }
        setRenameDeptModal({ open: false, oldName: '', newName: '' });

        setSaving(true);
        try {
            await questionLibraryAPI.updateLibrary(newLib);
            showNotify(`Department renamed to "${trimmed}" & saved successfully!`);
        } catch (err) {
            showNotify('Error saving updated department name.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDepartment = (deptName) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Department',
            message: `Are you sure you want to permanently delete the department "${deptName}" and all its categories and questions?`,
            confirmText: 'Delete Department',
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                const newLib = { ...libraryData };
                delete newLib[deptName];

                const remainingDepts = Object.keys(newLib);
                const nextDept = remainingDepts.length > 0 ? remainingDepts[0] : '';

                setLibraryData(newLib);
                setDepartmentTab(nextDept);
                if (nextDept && newLib[nextDept]) {
                    const nextCats = Object.keys(newLib[nextDept]);
                    setActiveCategory(nextCats.length > 0 ? nextCats[0] : '');
                } else {
                    setActiveCategory('');
                }

                setSaving(true);
                try {
                    await questionLibraryAPI.updateLibrary(newLib);
                    showNotify(`Department "${deptName}" deleted successfully!`);
                } catch (err) {
                    showNotify('Error deleting department from server.', 'error');
                } finally {
                    setSaving(false);
                }
            }
        });
    };

    // ─── Category Operations ──────────────────────────────────────────────────
    const handleAddCategory = () => {
        const cat = newCatName.trim();
        if (!cat) return;

        if (libraryData[departmentTab]?.[cat]) {
            showNotify('Category already exists in this department.', 'error');
            return;
        }

        const newLib = { ...libraryData };
        if (!newLib[departmentTab]) {
            newLib[departmentTab] = {};
        }
        newLib[departmentTab][cat] = [];
        setLibraryData(newLib);
        setActiveCategory(cat);
        setNewCatName('');
        showNotify(`Category "${cat}" added.`);
    };

    const confirmRenameCategory = () => {
        const oldName = renameCatModal.oldName;
        const trimmed = renameCatModal.newName.trim();
        if (!trimmed || trimmed === oldName) {
            setRenameCatModal({ open: false, oldName: '', newName: '' });
            return;
        }

        if (libraryData[departmentTab]?.[trimmed]) {
            showNotify('A category with this name already exists.', 'error');
            return;
        }

        const newLib = { ...libraryData };
        const questions = newLib[departmentTab][oldName];
        delete newLib[departmentTab][oldName];
        newLib[departmentTab][trimmed] = questions;

        setLibraryData(newLib);
        if (activeCategory === oldName) {
            setActiveCategory(trimmed);
        }
        setRenameCatModal({ open: false, oldName: '', newName: '' });
        showNotify(`Category renamed to "${trimmed}".`);
    };

    const handleDeleteCategory = (catName) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Category',
            message: `Are you sure you want to delete category "${catName}" and all its questions?`,
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                const newLib = { ...libraryData };
                delete newLib[departmentTab][catName];
                setLibraryData(newLib);

                const remainingCats = Object.keys(newLib[departmentTab] || {});
                setActiveCategory(remainingCats.length > 0 ? remainingCats[0] : '');
                showNotify(`Category "${catName}" deleted.`);
            }
        });
    };

    // ─── Question Operations ──────────────────────────────────────────────────
    const resetModalState = () => {
        setShowAddModal(false);
        setEditIndex(null);
        setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' });
    };

    const handleAddOrUpdateQuestion = () => {
        const qText = newQ.q.trim();
        if (!qText) {
            showNotify('Please enter question text.', 'error');
            return;
        }

        const finalQuestion = {
            q: qText,
            type: newQ.type
        };

        if (['select', 'checkbox-group', 'checkbox-date-group', 'checkbox-text-group'].includes(newQ.type)) {
            finalQuestion.options = newQ.options
                ? newQ.options.split(',').map(s => s.trim()).filter(Boolean)
                : [];
        }

        if (['checkbox-date-group', 'checkbox-text-group'].includes(newQ.type)) {
            finalQuestion.extra = newQ.extra.trim() || 'Remarks';
        }

        if (newQ.parentQ.trim() && newQ.condition.trim()) {
            finalQuestion.parentQ = newQ.parentQ.trim();
            finalQuestion.condition = newQ.condition.trim();
        }

        const newLib = { ...libraryData };
        if (!newLib[departmentTab]) newLib[departmentTab] = {};
        if (!newLib[departmentTab][activeCategory]) {
            newLib[departmentTab][activeCategory] = [];
        }

        if (editIndex !== null) {
            newLib[departmentTab][activeCategory][editIndex] = finalQuestion;
            showNotify('Question data point updated');
        } else {
            newLib[departmentTab][activeCategory].push(finalQuestion);
            showNotify('Question data point injected');
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

    const handleDeleteQuestion = (cat, index) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Question',
            message: 'Are you sure you want to delete this diagnostic question?',
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                const newLib = { ...libraryData };
                newLib[departmentTab][cat].splice(index, 1);
                setLibraryData(newLib);
                showNotify('Question deleted');
            }
        });
    };

    const handleMoveQuestion = (index, direction) => {
        const targetIndex = index + direction;
        const list = libraryData[departmentTab]?.[activeCategory] || [];
        if (targetIndex < 0 || targetIndex >= list.length) return;

        const newLib = { ...libraryData };
        const questions = [...newLib[departmentTab][activeCategory]];
        const temp = questions[index];
        questions[index] = questions[targetIndex];
        questions[targetIndex] = temp;
        newLib[departmentTab][activeCategory] = questions;

        setLibraryData(newLib);
    };

    // ─── Helper Formatters ────────────────────────────────────────────────────
    const getTypeLabel = (type) => {
        const badgeKey = 'badge_' + (type || '').replace(/-/g, '_');
        const localizedBadge = getUIText(badgeKey, currentLang);
        if (localizedBadge && localizedBadge !== badgeKey) return localizedBadge;
        const map = {
            'text': 'TEXT',
            'number': 'NUMERIC',
            'yes-no': 'YES/NO',
            'date': 'DATE',
            'textarea': 'LONG TEXT',
            'select': 'DROPDOWN',
            'checkbox-group': 'MULTI-CHECK',
            'checkbox-date-group': 'CHECK+DATE',
            'checkbox-text-group': 'CHECK+TEXT'
        };
        return map[type] || 'CLINICAL';
    };

    const getDeptIconComponent = (dept) => {
        const d = (dept || '').toLowerCase();
        if (d.includes('ent') || d.includes('ear') || d.includes('throat')) {
            return <MaterialCommunityIcons name="ear-hearing" size={16} color="#0d9488" />;
        }
        if (d.includes('cardio') || d.includes('heart')) {
            return <MaterialCommunityIcons name="heart-pulse" size={16} color="#e11d48" />;
        }
        if (d.includes('ortho') || d.includes('bone') || d.includes('joint')) {
            return <MaterialCommunityIcons name="bone" size={16} color="#d97706" />;
        }
        if (d.includes('pediat') || d.includes('baby') || d.includes('child')) {
            return <MaterialCommunityIcons name="baby-face-outline" size={16} color="#8b5cf6" />;
        }
        if (d.includes('gyn') || d.includes('obs') || d.includes('women')) {
            return <MaterialCommunityIcons name="human-pregnant" size={16} color="#ec4899" />;
        }
        if (d.includes('derm') || d.includes('skin') || d.includes('hair')) {
            return <MaterialCommunityIcons name="flask-outline" size={16} color="#06b6d4" />;
        }
        if (d.includes('opht') || d.includes('eye') || d.includes('vision')) {
            return <Feather name="eye" size={16} color="#2563eb" />;
        }
        if (d.includes('neuro') || d.includes('brain') || d.includes('nerve')) {
            return <MaterialCommunityIcons name="brain" size={16} color="#7c3aed" />;
        }
        if (d.includes('gastro') || d.includes('stomach') || d.includes('digest')) {
            return <MaterialCommunityIcons name="cube-outline" size={16} color="#f59e0b" />;
        }
        if (d.includes('pulm') || d.includes('chest') || d.includes('lung')) {
            return <MaterialCommunityIcons name="lungs" size={16} color="#0284c7" />;
        }
        if (d.includes('dent') || d.includes('oral') || d.includes('tooth')) {
            return <MaterialCommunityIcons name="tooth-outline" size={16} color="#0ea5e9" />;
        }
        return <Feather name="activity" size={16} color="#10b981" />;
    };

    // ─── Sub-renderers ────────────────────────────────────────────────────────
    const renderQuestionCard = (item, index, cat) => {
        const questionsList = libraryData[departmentTab]?.[cat] || [];
        const isFirst = index === 0;
        const isLast = index === questionsList.length - 1;

        let inputPreview = null;
        if (item.type === 'select') {
            inputPreview = (
                <View style={styles.previewDropdown}>
                    <Text style={styles.previewDropdownText}>{getUIText('selectOption', currentLang)}</Text>
                    <Feather name="chevron-down" size={14} color="#94a3b8" />
                </View>
            );
        } else if (item.type === 'yes-no') {
            inputPreview = (
                <View style={styles.previewYesNoRow}>
                    <View style={styles.previewPill}><Text style={styles.previewPillText}>{getUIText('yes', currentLang)}</Text></View>
                    <View style={styles.previewPill}><Text style={styles.previewPillText}>{getUIText('no', currentLang)}</Text></View>
                </View>
            );
        } else if (item.type === 'date') {
            inputPreview = (
                <View style={[styles.previewInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 220 }]}>
                    <Text style={styles.previewInputPlaceholder}>YYYY-MM-DD</Text>
                    <Feather name="calendar" size={14} color="#94a3b8" />
                </View>
            );
        } else if (item.type === 'checkbox-group') {
            inputPreview = (
                <View style={styles.previewCheckboxGrid}>
                    {(item.options || []).map((opt, oIdx) => (
                        <View key={oIdx} style={styles.previewCheckboxItem}>
                            <View style={styles.previewCheckboxSquare} />
                            <Text style={styles.previewCheckboxLabel}>{getTranslatedClinicalText(opt, currentLang)}</Text>
                        </View>
                    ))}
                </View>
            );
        } else if (item.type === 'textarea') {
            inputPreview = (
                <View style={styles.previewTextarea}>
                    <Text style={styles.previewInputPlaceholder}>{getUIText('doctorNotes', currentLang)}</Text>
                </View>
            );
        } else if (item.type === 'checkbox-date-group' || item.type === 'checkbox-text-group') {
            inputPreview = (
                <View style={styles.previewComplexGroup}>
                    {(item.options || []).map((opt, oIdx) => (
                        <View key={oIdx} style={styles.previewComplexRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <View style={styles.previewCheckboxSquare} />
                                <Text style={styles.previewCheckboxLabel}>{getTranslatedClinicalText(opt, currentLang)}</Text>
                            </View>
                            <View style={styles.previewMiniInput}>
                                <Text style={styles.previewInputPlaceholder}>
                                    {item.type === 'checkbox-date-group' ? 'YYYY-MM-DD' : getUIText('inputPlaceholder', currentLang)}
                                </Text>
                            </View>
                        </View>
                    ))}
                    <View style={styles.previewExtraRow}>
                        <Text style={styles.previewExtraLabel}>
                            {getTranslatedClinicalText(item.extra, currentLang) || getUIText('detailsPlaceholder', currentLang)}:
                        </Text>
                        <View style={[styles.previewInput, { marginTop: 4 }]}>
                            <Text style={styles.previewInputPlaceholder}>{getUIText('detailsPlaceholder', currentLang)}</Text>
                        </View>
                    </View>
                </View>
            );
        } else {
            inputPreview = (
                <View style={styles.previewInput}>
                    <Text style={styles.previewInputPlaceholder}>{getUIText('enterResponse', currentLang)}</Text>
                </View>
            );
        }

        return (
            <View key={index} style={styles.questionCard}>
                {/* Header Row */}
                <View style={styles.qCardHeader}>
                    <View style={styles.qCardTitleRow}>
                        <View style={styles.qIconCircle}>
                            <Text style={{ fontSize: 13 }}>❓</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.qCardQuestionText}>
                                {getTranslatedClinicalText(item.q, currentLang)}
                            </Text>
                            <View style={styles.qTypeBadge}>
                                <Text style={styles.qTypeBadgeText}>{getTypeLabel(item.type)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.qActionButtons}>
                        {/* Move Up */}
                        <TouchableOpacity
                            style={[styles.qActionBtnSmall, isFirst && styles.qActionBtnDisabled]}
                            disabled={isFirst}
                            onPress={() => handleMoveQuestion(index, -1)}
                            accessibilityLabel="Move Question Up"
                        >
                            <Feather name="arrow-up" size={13} color={isFirst ? '#cbd5e1' : '#475569'} />
                        </TouchableOpacity>

                        {/* Move Down */}
                        <TouchableOpacity
                            style={[styles.qActionBtnSmall, isLast && styles.qActionBtnDisabled]}
                            disabled={isLast}
                            onPress={() => handleMoveQuestion(index, 1)}
                            accessibilityLabel="Move Question Down"
                        >
                            <Feather name="arrow-down" size={13} color={isLast ? '#cbd5e1' : '#475569'} />
                        </TouchableOpacity>

                        {/* Edit */}
                        <TouchableOpacity
                            style={styles.qActionBtnEdit}
                            onPress={() => handleEditQuestion(index)}
                            accessibilityLabel="Edit Question"
                        >
                            <Feather name="edit-2" size={12} color="#2563eb" />
                            <Text style={styles.qActionBtnEditText}>{getUIText('edit', currentLang)}</Text>
                        </TouchableOpacity>

                        {/* Delete */}
                        <TouchableOpacity
                            style={styles.qActionBtnDelete}
                            onPress={() => handleDeleteQuestion(cat, index)}
                            accessibilityLabel="Delete Question"
                        >
                            <Feather name="trash-2" size={12} color="#dc2626" />
                            <Text style={styles.qActionBtnDeleteText}>{getUIText('delete', currentLang)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Conditional Logic Badge */}
                {Boolean(item.parentQ && item.condition) && (
                    <View style={styles.conditionalBadge}>
                        <Feather name="zap" size={12} color="#d97706" />
                        <Text style={styles.conditionalBadgeText}>
                            {getUIText('onlyShownIf', currentLang)
                                .replace('{parentQ}', getTranslatedClinicalText(item.parentQ, currentLang))
                                .replace('{condition}', item.condition)}
                        </Text>
                    </View>
                )}

                {/* Interactive Input Preview */}
                <View style={styles.inputPreviewContainer}>
                    {inputPreview}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0d9488" />
                <Text style={styles.loadingText}>{getUIText('initializing', currentLang)}</Text>
            </View>
        );
    }

    const currentCategories = libraryData[departmentTab] || {};
    const questionsInActiveCategory = currentCategories[activeCategory] || [];
    const visibleDepartments = allowedDepartments
        ? Object.keys(libraryData).filter(dept => allowedDepartments.includes(dept))
        : Object.keys(libraryData);

    const activeLanguage = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

    const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang =>
        lang.name.toLowerCase().includes(langSearch.toLowerCase()) ||
        lang.native.toLowerCase().includes(langSearch.toLowerCase()) ||
        lang.code.toLowerCase().includes(langSearch.toLowerCase())
    );

    return (
        <ScrollView style={styles.mainContainer} contentContainerStyle={styles.mainScrollContent}>
            {/* ─── NOTIFICATION BANNER ───────────────────────────────────────── */}
            {notification && (
                <View style={[styles.notificationBanner, notification.type === 'error' ? styles.notificationError : styles.notificationSuccess]}>
                    <Feather name={notification.type === 'error' ? 'alert-triangle' : 'check-circle'} size={16} color="#ffffff" />
                    <Text style={styles.notificationText}>{notification.text}</Text>
                </View>
            )}

            {/* ─── 1. HEADER SECTION ──────────────────────────────────────────── */}
            <View style={styles.headerSection}>
                <View style={styles.headerTitleColumn}>
                    <Text style={styles.headerTitle}>{getUIText('pageTitle', currentLang)}</Text>
                    <Text style={styles.headerSubtitle}>{getUIText('pageSubtitle', currentLang)}</Text>
                </View>

                <View style={styles.headerRightColumn}>
                    {/* Top Row: Language Selector */}
                    <TouchableOpacity
                        style={styles.langSelectorBtn}
                        onPress={() => setShowLangModal(true)}
                        activeOpacity={0.8}
                    >
                        <Feather name="globe" size={14} color="#0d9488" />
                        <Text style={styles.langSelectorFlag}>{activeLanguage.flag}</Text>
                        <Text style={styles.langSelectorText}>{activeLanguage.code.toUpperCase()}</Text>
                        <Feather name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>

                    {/* Bottom Row: Actions */}
                    <View style={styles.headerActionsRow}>
                        {/* Refresh */}
                        <TouchableOpacity
                            style={styles.btnActionRefresh}
                            onPress={handleRefresh}
                            disabled={refreshing}
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color="#2563eb" />
                            ) : (
                                <Feather name="rotate-cw" size={14} color="#2563eb" />
                            )}
                            <Text style={styles.btnActionRefreshText}>
                                {refreshing ? getUIText('refreshing', currentLang) : getUIText('refresh', currentLang)}
                            </Text>
                        </TouchableOpacity>

                        {/* Reset / Standard 12 Departments */}
                        <TouchableOpacity
                            style={styles.btnActionReset}
                            onPress={handleResetToStandard}
                            disabled={saving}
                        >
                            <Feather name="layers" size={14} color="#0d9488" />
                            <Text style={styles.btnActionResetText}>{getUIText('resetDepts', currentLang)}</Text>
                        </TouchableOpacity>

                        {/* Preview */}
                        <TouchableOpacity
                            style={styles.btnActionPreview}
                            onPress={() => setShowPreview(true)}
                        >
                            <Feather name="eye" size={14} color="#334155" />
                            <Text style={styles.btnActionPreviewText}>{getUIText('preview', currentLang)}</Text>
                        </TouchableOpacity>

                        {/* Save & Deploy */}
                        <TouchableOpacity
                            style={[styles.btnActionSave, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Feather name="cloud" size={14} color="#ffffff" />
                            )}
                            <Text style={styles.btnActionSaveText}>
                                {saving ? getUIText('syncing', currentLang) : getUIText('saveDeploy', currentLang)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* ─── 2. DEPARTMENT TABS (Horizontal Scroll) ────────────────────── */}
            <View style={styles.tabsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsScrollContent}
                >
                    {visibleDepartments.map(dept => {
                        const isActive = departmentTab === dept;
                        const deptCatCount = Object.keys(libraryData[dept] || {}).length;
                        return (
                            <TouchableOpacity
                                key={dept}
                                style={[styles.deptTab, isActive && styles.deptTabActive]}
                                onPress={() => {
                                    setDepartmentTab(dept);
                                    const cats = Object.keys(libraryData[dept] || {});
                                    setActiveCategory(cats.length > 0 ? cats[0] : '');
                                }}
                                activeOpacity={0.8}
                            >
                                <View style={styles.deptTabIconWrap}>
                                    {getDeptIconComponent(dept)}
                                </View>
                                <Text style={[styles.deptTabText, isActive && styles.deptTabTextActive]}>
                                    {getTranslatedDepartment(dept, currentLang)}
                                </Text>

                                {isActive && allowedDepartments === null && (
                                    <View style={styles.tabQuickActions}>
                                        <TouchableOpacity
                                            style={styles.tabQuickBtn}
                                            onPress={() => setRenameDeptModal({ open: true, oldName: dept, newName: dept })}
                                            accessibilityLabel="Rename Department"
                                        >
                                            <Text style={{ fontSize: 11 }}>✏️</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.tabQuickBtn}
                                            onPress={() => handleDeleteDepartment(dept)}
                                            accessibilityLabel="Delete Department"
                                        >
                                            <Text style={{ fontSize: 11 }}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    {allowedDepartments === null && (
                        <TouchableOpacity
                            style={styles.deptTabAdd}
                            onPress={() => {
                                setSelectedDept('');
                                setCustomDept('');
                                setShowDeptModal(true);
                            }}
                        >
                            <Feather name="plus" size={14} color="#0d9488" />
                            <Text style={styles.deptTabAddText}>{getUIText('addDept', currentLang)}</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>

            {/* ─── 3. WORKSPACE (Category Sidebar + Question Stream) ─────────── */}
            <View style={styles.workspaceWrapper}>
                {/* Left Category Column */}
                <View style={styles.categoryPanel}>
                    {/* Add Category Box */}
                    <View style={styles.addCategoryBox}>
                        <TextInput
                            style={styles.addCategoryInput}
                            placeholder={getUIText('enterCatPlaceholder', currentLang)}
                            placeholderTextColor="#94a3b8"
                            value={newCatName}
                            onChangeText={setNewCatName}
                            onSubmitEditing={handleAddCategory}
                        />
                        <TouchableOpacity
                            style={styles.addCategoryBtn}
                            onPress={handleAddCategory}
                            activeOpacity={0.8}
                        >
                            <Feather name="plus" size={14} color="#ffffff" />
                            <Text style={styles.addCategoryBtnText}>{getUIText('addCategory', currentLang)}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Category List */}
                    <View style={styles.categoryList}>
                        {Object.keys(currentCategories).map(cat => {
                            const isCatActive = cat === activeCategory;
                            const catQuestionsCount = (currentCategories[cat] || []).length;
                            return (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.categoryItem, isCatActive && styles.categoryItemActive]}
                                    onPress={() => setActiveCategory(cat)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.categoryItemLeft}>
                                        <Text style={{ fontSize: 14 }}>{isCatActive ? '📂' : '📁'}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.categoryItemTitle, isCatActive && styles.categoryItemTitleActive]} numberOfLines={1}>
                                                {getTranslatedCategory(cat, currentLang)}
                                            </Text>
                                            <Text style={styles.categoryItemSub}>{catQuestionsCount} {getUIText('questionsCount', currentLang)}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.categoryItemRight}>
                                        <TouchableOpacity
                                            style={styles.catQuickBtn}
                                            onPress={() => setRenameCatModal({ open: true, oldName: cat, newName: cat })}
                                            accessibilityLabel="Rename Category"
                                        >
                                            <Text style={{ fontSize: 11 }}>✏️</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.catQuickBtn}
                                            onPress={() => handleDeleteCategory(cat)}
                                            accessibilityLabel="Delete Category"
                                        >
                                            <Text style={{ fontSize: 11 }}>🗑️</Text>
                                        </TouchableOpacity>
                                        <Feather name="chevron-right" size={14} color={isCatActive ? '#0d9488' : '#94a3b8'} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {Object.keys(currentCategories).length === 0 && (
                            <View style={styles.emptyCategoriesBox}>
                                <Text style={styles.emptyCategoriesText}>{getUIText('noCats', currentLang)}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Right Canvas Column (Questions) */}
                <View style={styles.questionsCanvas}>
                    {!activeCategory ? (
                        <View style={styles.canvasEmptyState}>
                            <MaterialCommunityIcons name="cube-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.canvasEmptyTitle}>{getUIText('selectCatPrompt', currentLang)}</Text>
                        </View>
                    ) : (
                        <View style={styles.canvasActiveContent}>
                            {/* Canvas Category Header */}
                            <View style={styles.canvasHeader}>
                                <View style={styles.canvasHeaderLeft}>
                                    <Text style={styles.canvasCategoryTitle}>
                                        {getTranslatedCategory(activeCategory, currentLang)}
                                    </Text>
                                    <View style={styles.canvasCountPill}>
                                        <Text style={styles.canvasCountPillText}>
                                            {questionsInActiveCategory.length} {getUIText('questionsCount', currentLang)}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.btnAddQuestion}
                                    onPress={() => {
                                        setEditIndex(null);
                                        setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' });
                                        setShowAddModal(true);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Feather name="plus" size={14} color="#ffffff" />
                                    <Text style={styles.btnAddQuestionText}>{getUIText('addQuestion', currentLang)}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Question Stream */}
                            <View style={styles.questionStream}>
                                {questionsInActiveCategory.map((q, idx) =>
                                    renderQuestionCard(q, idx, activeCategory)
                                )}

                                {questionsInActiveCategory.length === 0 && (
                                    <View style={styles.emptyQuestionsBox}>
                                        <Text style={styles.emptyQuestionsTitle}>{getUIText('noQuestions', currentLang)}</Text>
                                        <Text style={styles.emptyQuestionsSub}>{getUIText('clickAddQuestion', currentLang)}</Text>
                                        <TouchableOpacity
                                            style={[styles.btnAddQuestion, { marginTop: 12, alignSelf: 'center' }]}
                                            onPress={() => {
                                                setEditIndex(null);
                                                setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' });
                                                setShowAddModal(true);
                                            }}
                                        >
                                            <Feather name="plus" size={14} color="#ffffff" />
                                            <Text style={styles.btnAddQuestionText}>{getUIText('addQuestion', currentLang)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* ─── MODALS ────────────────────────────────────────────────────── */}

            {/* 1. Add / Edit Question Modal */}
            <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={resetModalState}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editIndex !== null ? getUIText('editQuestion', currentLang) : getUIText('addQuestion', currentLang)}
                            </Text>
                            <TouchableOpacity onPress={resetModalState}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                            {/* Question Title */}
                            <Text style={styles.inputLabel}>{getUIText('questionLabel', currentLang)}</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder={getUIText('questionLabelPlaceholder', currentLang)}
                                placeholderTextColor="#94a3b8"
                                value={newQ.q}
                                onChangeText={t => setNewQ({ ...newQ, q: t })}
                            />

                            {/* Question Type */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>{getUIText('questionType', currentLang)}</Text>
                            <View style={styles.typeSelectorRow}>
                                {QUESTION_TYPES.map(t => {
                                    const isSelected = newQ.type === t.value;
                                    return (
                                        <TouchableOpacity
                                            key={t.value}
                                            style={[styles.typeOptionPill, isSelected && styles.typeOptionPillActive]}
                                            onPress={() => setNewQ({ ...newQ, type: t.value })}
                                        >
                                            <Text style={[styles.typeOptionText, isSelected && styles.typeOptionTextActive]}>
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Options (Comma separated) */}
                            {['select', 'checkbox-group', 'checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                                <View style={{ marginTop: 14 }}>
                                    <Text style={styles.inputLabel}>{getUIText('optionsLabel', currentLang)}</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder={getUIText('optionsPlaceholder', currentLang)}
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.options}
                                        onChangeText={t => setNewQ({ ...newQ, options: t })}
                                    />
                                    <Text style={styles.inputHelpText}>Separate each selectable option with a comma.</Text>
                                </View>
                            )}

                            {/* Extra Remarks field title */}
                            {['checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                                <View style={{ marginTop: 14 }}>
                                    <Text style={styles.inputLabel}>{getUIText('extraFieldTitle', currentLang)}</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder={getUIText('extraFieldPlaceholder', currentLang)}
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.extra}
                                        onChangeText={t => setNewQ({ ...newQ, extra: t })}
                                    />
                                </View>
                            )}

                            {/* Conditional Display */}
                            <View style={styles.conditionalBox}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Feather name="zap" size={14} color="#eab308" />
                                    <Text style={styles.conditionalTitle}>{getUIText('conditionalDisplay', currentLang)}</Text>
                                </View>
                                <View style={styles.conditionalInputsRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabelSub}>{getUIText('parentQuestionLabel', currentLang)}</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Parent question text"
                                            placeholderTextColor="#94a3b8"
                                            value={newQ.parentQ}
                                            onChangeText={t => setNewQ({ ...newQ, parentQ: t })}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabelSub}>{getUIText('whenParentEquals', currentLang)}</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="e.g. Yes or Mild"
                                            placeholderTextColor="#94a3b8"
                                            value={newQ.condition}
                                            onChangeText={t => setNewQ({ ...newQ, condition: t })}
                                        />
                                    </View>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={resetModalState}>
                                <Text style={styles.modalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnSubmit} onPress={handleAddOrUpdateQuestion}>
                                <Text style={styles.modalBtnSubmitText}>
                                    {editIndex !== null ? getUIText('updateQuestion', currentLang) : getUIText('addQuestion', currentLang)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 2. Add Department Modal */}
            <Modal visible={showDeptModal} transparent animationType="fade" onRequestClose={() => setShowDeptModal(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 460 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{getUIText('addDept', currentLang)}</Text>
                            <TouchableOpacity onPress={() => setShowDeptModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ marginTop: 14 }}>
                            <Text style={styles.inputLabel}>{getUIText('selectPredefined', currentLang)}</Text>
                            <View style={styles.predefinedDeptGrid}>
                                {PREDEFINED_DEPARTMENTS.map(d => {
                                    const isSelected = selectedDept === d;
                                    return (
                                        <TouchableOpacity
                                            key={d}
                                            style={[styles.predefinedDeptChip, isSelected && styles.predefinedDeptChipActive]}
                                            onPress={() => {
                                                setSelectedDept(d);
                                                setCustomDept('');
                                            }}
                                        >
                                            <Text style={[styles.predefinedDeptText, isSelected && styles.predefinedDeptTextActive]}>
                                                {getTranslatedDepartment(d, currentLang)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={styles.modalDividerRow}>
                                <View style={styles.modalDividerLine} />
                                <Text style={styles.modalDividerText}>{getUIText('or', currentLang)}</Text>
                                <View style={styles.modalDividerLine} />
                            </View>

                            <Text style={styles.inputLabel}>{getUIText('customDeptName', currentLang)}</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder={getUIText('customDeptPlaceholder', currentLang)}
                                placeholderTextColor="#94a3b8"
                                value={customDept}
                                onChangeText={t => {
                                    setCustomDept(t);
                                    setSelectedDept('');
                                }}
                            />
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowDeptModal(false)}>
                                <Text style={styles.modalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnSubmit} onPress={confirmAddDepartment}>
                                <Text style={styles.modalBtnSubmitText}>{getUIText('addDept', currentLang)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 3. Rename Department Modal */}
            <Modal visible={renameDeptModal.open} transparent animationType="fade" onRequestClose={() => setRenameDeptModal({ open: false, oldName: '', newName: '' })}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 420 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{getUIText('rename', currentLang)} Department</Text>
                            <TouchableOpacity onPress={() => setRenameDeptModal({ open: false, oldName: '', newName: '' })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ marginTop: 14 }}>
                            <Text style={styles.inputLabel}>New Department Name</Text>
                            <TextInput
                                style={styles.textInput}
                                value={renameDeptModal.newName}
                                onChangeText={t => setRenameDeptModal({ ...renameDeptModal, newName: t })}
                            />
                        </View>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setRenameDeptModal({ open: false, oldName: '', newName: '' })}>
                                <Text style={styles.modalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnSubmit} onPress={confirmRenameDepartment}>
                                <Text style={styles.modalBtnSubmitText}>{getUIText('rename', currentLang)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 4. Rename Category Modal */}
            <Modal visible={renameCatModal.open} transparent animationType="fade" onRequestClose={() => setRenameCatModal({ open: false, oldName: '', newName: '' })}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 420 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{getUIText('rename', currentLang)} Category</Text>
                            <TouchableOpacity onPress={() => setRenameCatModal({ open: false, oldName: '', newName: '' })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ marginTop: 14 }}>
                            <Text style={styles.inputLabel}>New Category Name</Text>
                            <TextInput
                                style={styles.textInput}
                                value={renameCatModal.newName}
                                onChangeText={t => setRenameCatModal({ ...renameCatModal, newName: t })}
                            />
                        </View>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setRenameCatModal({ open: false, oldName: '', newName: '' })}>
                                <Text style={styles.modalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnSubmit} onPress={confirmRenameCategory}>
                                <Text style={styles.modalBtnSubmitText}>{getUIText('rename', currentLang)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 5. Confirmation Dialog Modal */}
            <Modal visible={confirmDialog.open} transparent animationType="fade" onRequestClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 440 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, confirmDialog.isDestructive && { color: '#dc2626' }]}>
                                {confirmDialog.title}
                            </Text>
                            <TouchableOpacity onPress={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ marginTop: 14 }}>
                            <Text style={styles.confirmMessageText}>{confirmDialog.message}</Text>
                        </View>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                                <Text style={styles.modalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtnSubmit, confirmDialog.isDestructive ? { backgroundColor: '#dc2626' } : null]}
                                onPress={confirmDialog.onConfirm}
                            >
                                <Text style={styles.modalBtnSubmitText}>{confirmDialog.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 6. Doctor Live Form Preview Modal */}
            <Modal visible={showPreview} transparent animationType="slide" onRequestClose={() => setShowPreview(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 680, maxHeight: '88%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="eye" size={18} color="#2563eb" />
                                <Text style={styles.modalTitle}>{getUIText('doctorPreviewTitle', currentLang)}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowPreview(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.previewDeptSubtitle}>
                            {getUIText('previewSubtitle', currentLang)}{' '}
                            <Text style={{ color: '#0d9488', fontWeight: 'bold' }}>
                                {getTranslatedDepartment(departmentTab, currentLang)}
                            </Text>
                        </Text>

                        <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                            {Object.keys(currentCategories).map(cat => (
                                <View key={cat} style={styles.previewCatCard}>
                                    <Text style={styles.previewCatHeading}>
                                        📂 {getTranslatedCategory(cat, currentLang)}
                                    </Text>
                                    <View style={{ gap: 12 }}>
                                        {(currentCategories[cat] || []).map((q, qIdx) => (
                                            <View key={qIdx} style={styles.previewQuestionItem}>
                                                <Text style={styles.previewQuestionLabel}>
                                                    {getTranslatedClinicalText(q.q, currentLang)}
                                                </Text>
                                                {q.type === 'textarea' ? (
                                                    <TextInput
                                                        style={[styles.textInput, { height: 64, textAlignVertical: 'top' }]}
                                                        multiline
                                                        placeholder={getUIText('doctorNotes', currentLang)}
                                                        placeholderTextColor="#94a3b8"
                                                    />
                                                ) : q.type === 'yes-no' ? (
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <TouchableOpacity style={styles.previewPillActive}><Text style={styles.previewPillActiveText}>{getUIText('yes', currentLang)}</Text></TouchableOpacity>
                                                        <TouchableOpacity style={styles.previewPill}><Text style={styles.previewPillText}>{getUIText('no', currentLang)}</Text></TouchableOpacity>
                                                    </View>
                                                ) : q.type === 'select' ? (
                                                    <View style={styles.previewDropdown}>
                                                        <Text style={styles.previewDropdownText}>{getUIText('selectOption', currentLang)}</Text>
                                                        <Feather name="chevron-down" size={14} color="#64748b" />
                                                    </View>
                                                ) : q.type === 'checkbox-group' ? (
                                                    <View style={styles.previewCheckboxGrid}>
                                                        {(q.options || []).map((opt, oIdx) => (
                                                            <View key={oIdx} style={styles.previewCheckboxItem}>
                                                                <View style={styles.previewCheckboxSquare} />
                                                                <Text style={styles.previewCheckboxLabel}>{getTranslatedClinicalText(opt, currentLang)}</Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                ) : (
                                                    <TextInput
                                                        style={styles.textInput}
                                                        placeholder={getUIText('valuePlaceholder', currentLang)}
                                                        placeholderTextColor="#94a3b8"
                                                    />
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnSubmit} onPress={() => setShowPreview(false)}>
                                <Text style={styles.modalBtnSubmitText}>{getUIText('closePreview', currentLang)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 7. Language Selector Modal */}
            <Modal visible={showLangModal} transparent animationType="fade" onRequestClose={() => setShowLangModal(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 460, maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="globe" size={18} color="#0d9488" />
                                <Text style={styles.modalTitle}>Select Translation Language</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowLangModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Language */}
                        <View style={[styles.textInput, { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }]}>
                            <Feather name="search" size={14} color="#94a3b8" />
                            <TextInput
                                style={{ flex: 1, fontSize: 13, color: '#0f172a', padding: 0 }}
                                placeholder="Search language / भाषा खोजें..."
                                placeholderTextColor="#94a3b8"
                                value={langSearch}
                                onChangeText={setLangSearch}
                            />
                        </View>

                        {/* Language List */}
                        <ScrollView style={[styles.modalBodyScroll, { marginTop: 10 }]} showsVerticalScrollIndicator={false}>
                            {filteredLanguages.map(lang => {
                                const isSelected = lang.code === currentLang;
                                return (
                                    <TouchableOpacity
                                        key={lang.code}
                                        style={[styles.langListItem, isSelected && styles.langListItemActive]}
                                        onPress={() => handleLanguageChange(lang.code)}
                                    >
                                        <Text style={{ fontSize: 20 }}>{lang.flag}</Text>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.langNativeName, isSelected && styles.langNativeNameActive]}>
                                                {lang.native}
                                            </Text>
                                            <Text style={styles.langEnglishName}>{lang.name}</Text>
                                        </View>
                                        {isSelected && <Feather name="check" size={16} color="#0d9488" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowLangModal(false)}>
                                <Text style={styles.modalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

// ─── Styles matching Web Design System ─────────────────────────────────────────
const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    mainScrollContent: {
        padding: 20,
        paddingBottom: 40
    },
    loadingContainer: {
        flex: 1,
        minHeight: 400,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        gap: 12
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0d9488',
        letterSpacing: 0.5
    },

    // Notification Banner
    notificationBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        marginBottom: 16
    },
    notificationSuccess: {
        backgroundColor: '#0d9488'
    },
    notificationError: {
        backgroundColor: '#dc2626'
    },
    notificationText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
        flex: 1
    },

    // Header Section
    headerSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 18
    },
    headerTitleColumn: {
        flex: 1,
        minWidth: 260
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f4c47',
        letterSpacing: -0.3
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1a7a6e',
        marginTop: 4
    },
    headerRightColumn: {
        alignItems: 'flex-end',
        gap: 8
    },
    langSelectorBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1
    },
    langSelectorFlag: {
        fontSize: 14
    },
    langSelectorText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155'
    },
    headerActionsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap'
    },
    btnActionRefresh: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    btnActionRefreshText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563eb'
    },
    btnActionReset: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    btnActionResetText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d9488'
    },
    btnActionPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    btnActionPreviewText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155'
    },
    btnActionSave: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0d9488',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        shadowColor: '#0d9488',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 2
    },
    btnActionSaveText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff'
    },

    // Department Tabs
    tabsContainer: {
        marginBottom: 18
    },
    tabsScrollContent: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4
    },
    deptTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1
    },
    deptTabActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488'
    },
    deptTabIconWrap: {
        alignItems: 'center',
        justifyContent: 'center'
    },
    deptTabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b'
    },
    deptTabTextActive: {
        color: '#ffffff'
    },
    tabQuickActions: {
        flexDirection: 'row',
        gap: 4,
        marginLeft: 6
    },
    tabQuickBtn: {
        padding: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 4
    },
    deptTabAdd: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#0d9488',
        borderStyle: 'dashed'
    },
    deptTabAddText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0d9488'
    },

    // Workspace Wrapper
    workspaceWrapper: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 18
    },

    // Left Category Panel
    categoryPanel: {
        flex: 1,
        minWidth: 280,
        maxWidth: Platform.OS === 'web' && Dimensions.get('window').width > 900 ? 340 : '100%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
        alignSelf: 'flex-start'
    },
    addCategoryBox: {
        gap: 8,
        marginBottom: 14
    },
    addCategoryInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc'
    },
    addCategoryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#0d9488',
        paddingVertical: 8,
        borderRadius: 8
    },
    addCategoryBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff'
    },
    categoryList: {
        gap: 6
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    categoryItemActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#a7f3d0'
    },
    categoryItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1
    },
    categoryItemTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155'
    },
    categoryItemTitleActive: {
        color: '#0d9488'
    },
    categoryItemSub: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2
    },
    categoryItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    catQuickBtn: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    emptyCategoriesBox: {
        padding: 16,
        alignItems: 'center'
    },
    emptyCategoriesText: {
        fontSize: 12,
        color: '#94a3b8'
    },

    // Right Canvas (Questions)
    questionsCanvas: {
        flex: 2,
        minWidth: 320,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1
    },
    canvasEmptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 12
    },
    canvasEmptyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b'
    },
    canvasActiveContent: {},
    canvasHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 14,
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 8
    },
    canvasHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    canvasCategoryTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a'
    },
    canvasCountPill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    canvasCountPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b'
    },
    btnAddQuestion: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#2563eb',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    btnAddQuestionText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff'
    },

    // Question Stream
    questionStream: {
        gap: 14
    },
    questionCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        gap: 10
    },
    qCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 8
    },
    qCardTitleRow: {
        flexDirection: 'row',
        gap: 8,
        flex: 1,
        minWidth: 200
    },
    qIconCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2
    },
    qCardQuestionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        lineHeight: 18
    },
    qTypeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#eff6ff',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginTop: 4
    },
    qTypeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#2563eb'
    },
    qActionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    qActionBtnSmall: {
        padding: 5,
        backgroundColor: '#ffffff',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    qActionBtnDisabled: {
        opacity: 0.4
    },
    qActionBtnEdit: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        backgroundColor: '#eff6ff',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bfdbfe'
    },
    qActionBtnEditText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#2563eb'
    },
    qActionBtnDelete: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        backgroundColor: '#fef2f2',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#fecaca'
    },
    qActionBtnDeleteText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#dc2626'
    },

    // Conditional Badge
    conditionalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fefce8',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#fef08a'
    },
    conditionalBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#854d0e',
        flex: 1
    },

    // Interactive Previews
    inputPreviewContainer: {
        marginTop: 2
    },
    previewInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    previewInputPlaceholder: {
        fontSize: 12,
        color: '#94a3b8'
    },
    previewDropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        maxWidth: 220
    },
    previewDropdownText: {
        fontSize: 12,
        color: '#64748b'
    },
    previewYesNoRow: {
        flexDirection: 'row',
        gap: 8
    },
    previewPill: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 6
    },
    previewPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b'
    },
    previewPillActive: {
        backgroundColor: '#0d9488',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 6
    },
    previewPillActiveText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff'
    },
    previewTextarea: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        height: 52
    },
    previewCheckboxGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4
    },
    previewCheckboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6
    },
    previewCheckboxSquare: {
        width: 14,
        height: 14,
        borderRadius: 3,
        borderWidth: 1.5,
        borderColor: '#94a3b8'
    },
    previewCheckboxLabel: {
        fontSize: 11,
        color: '#334155'
    },
    previewComplexGroup: {
        gap: 8
    },
    previewComplexRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
    },
    previewMiniInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        width: 120
    },
    previewExtraRow: {
        marginTop: 4
    },
    previewExtraLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569'
    },
    emptyQuestionsBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 36,
        gap: 4
    },
    emptyQuestionsTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569'
    },
    emptyQuestionsSub: {
        fontSize: 12,
        color: '#94a3b8'
    },

    // Modals
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
    },
    modalCard: {
        width: '100%',
        maxWidth: 540,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#0f172a',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 12
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a'
    },
    modalBodyScroll: {
        maxHeight: 420,
        marginTop: 12
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6
    },
    inputLabelSub: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 4
    },
    inputHelpText: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff'
    },
    typeSelectorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6
    },
    typeOptionPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    typeOptionPillActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#2563eb'
    },
    typeOptionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b'
    },
    typeOptionTextActive: {
        color: '#2563eb',
        fontWeight: '700'
    },
    conditionalBox: {
        backgroundColor: '#fefce8',
        borderRadius: 10,
        padding: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#fef08a',
        gap: 8
    },
    conditionalTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#854d0e'
    },
    conditionalInputsRow: {
        flexDirection: 'row',
        gap: 10
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 14,
        marginTop: 14
    },
    modalBtnCancel: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#f1f5f9'
    },
    modalBtnCancelText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b'
    },
    modalBtnSubmit: {
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#0d9488'
    },
    modalBtnSubmitText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff'
    },

    // Predefined Dept Grid
    predefinedDeptGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6
    },
    predefinedDeptChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    predefinedDeptChipActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#0d9488'
    },
    predefinedDeptText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569'
    },
    predefinedDeptTextActive: {
        color: '#0d9488',
        fontWeight: '700'
    },
    modalDividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginVertical: 14
    },
    modalDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0'
    },
    modalDividerText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8'
    },
    confirmMessageText: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 20
    },

    // Preview Modal
    previewDeptSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 8,
        marginBottom: 12
    },
    previewCatCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12
    },
    previewCatHeading: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 6,
        marginBottom: 10
    },
    previewQuestionItem: {
        gap: 4
    },
    previewQuestionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155'
    },

    // Language Modal
    langListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    langListItemActive: {
        backgroundColor: '#f0fdf4'
    },
    langNativeName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b'
    },
    langNativeNameActive: {
        color: '#0d9488'
    },
    langEnglishName: {
        fontSize: 11,
        color: '#64748b'
    }
});

export default HospitalAdminQuestionLibrary;
