import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
    Platform,
    useWindowDimensions,
    ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { questionLibraryAPI } from '../../utils/api';
import confirmToast, { promptToast, toast } from '../../utils/confirmToast';
import { FontAwesome5 } from '@expo/vector-icons';
import LanguageSelector from '../../components/common/LanguageSelector';
import {
    getUIText,
    getTranslatedDepartment,
    getTranslatedCategory,
    getTranslatedClinicalText
} from '../../utils/questionLibraryI18n';
import { 
    fetchSuperAdminQuestionLibrary,
    queueQuestionAddition,
    getPendingQuestionLibraryOperations,
    getPendingQuestionCount,
    syncPendingQuestionLibraryOperations
} from '../../services/offline/offlineSuperAdminService';
import { subscribeNetworkStatus } from '../../services/offline/networkStatus';
import OfflineBanner from '../../components/OfflineBanner';
import OfflineEmptyState from '../../components/OfflineEmptyState';

// Standard 12-Department Medical Question Library fallback
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

const QUESTION_TYPES = [
    { value: 'text', labelKey: 'type_text' },
    { value: 'textarea', labelKey: 'type_textarea' },
    { value: 'number', labelKey: 'type_number' },
    { value: 'yes-no', labelKey: 'type_yes_no' },
    { value: 'date', labelKey: 'type_date' },
    { value: 'select', labelKey: 'type_select' },
    { value: 'checkbox-group', labelKey: 'type_checkbox_group' },
    { value: 'checkbox-text-group', labelKey: 'type_checkbox_text_group' },
    { value: 'checkbox-date-group', labelKey: 'type_checkbox_date_group' },
];

const AdminQuestionLibrary = () => {
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 980;

    const [libraryData, setLibraryData] = useState(defaultQuestionLibraryData);
    const [currentLang, setCurrentLang] = useState('en');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [allowedDepartments, setAllowedDepartments] = useState(null);

    const [offlineState, setOfflineState] = useState({
        isOffline: false,
        fromCache: false,
        lastFetchedAt: null,
        isSynthetic: false,
        noCache: false,
    });

    const [departmentTab, setDepartmentTab] = useState('ENT');
    const [activeCategory, setActiveCategory] = useState('Clinical History & Intake');
    const [newCatName, setNewCatName] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
    const [initialQ, setInitialQ] = useState(null);

    // Department Modal State
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState('');
    const [customDept, setCustomDept] = useState('');

    // Predefined departments for dropdown
    const [predefinedDepartments, setPredefinedDepartments] = useState([
        "ENT", "Cardiology", "Orthopedics", "Pediatrics", "Gynecology & Obstetrics",
        "Dermatology", "Ophthalmology", "Neurology", "Gastroenterology", "Pulmonology",
        "General Medicine", "Dentistry"
    ]);

    const [showPreview, setShowPreview] = useState(false);
    const [previewIntake, setPreviewIntake] = useState({});

    // Question form state
    const [newQ, setNewQ] = useState({
        q: '',
        type: 'text',
        options: '',
        extra: '',
        parentQ: '',
        condition: ''
    });

    // Offline pending sync state
    const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingQuestionCount());
    const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState(false);

    // Language load and persistence
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                let saved = null;
                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                    saved = window.localStorage.getItem('hms_question_lib_lang');
                }
                if (!saved) {
                    saved = await AsyncStorage.getItem('hms_question_lib_lang');
                }
                if (isMounted && saved) {
                    setCurrentLang(saved);
                }
            } catch (err) {
                // Ignore storage read error
            }
        })();
        return () => { isMounted = false; };
    }, []);

    const handleLanguageChange = async (newLang) => {
        setCurrentLang(newLang);
        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('hms_question_lib_lang', newLang);
            }
            await AsyncStorage.setItem('hms_question_lib_lang', newLang);
        } catch (err) {
            // Ignore storage save error
        }
    };

    const isQuestionModified = useMemo(() => {
        if (editIndex === null || !initialQ) return true;
        return (
            (newQ.q || '').trim() !== (initialQ.q || '').trim() ||
            newQ.type !== initialQ.type ||
            (newQ.options || '').trim() !== (initialQ.options || '').trim() ||
            (newQ.extra || '').trim() !== (initialQ.extra || '').trim() ||
            (newQ.parentQ || '').trim() !== (initialQ.parentQ || '').trim() ||
            (newQ.condition || '').trim() !== (initialQ.condition || '').trim()
        );
    }, [editIndex, initialQ, newQ]);

    const applyLibraryPayload = (payload) => {
        if (!payload) return;
        const rawData = payload.data?.data || payload.data || payload;
        let data = (rawData && typeof rawData === 'object' && Object.keys(rawData).length > 0)
            ? rawData
            : defaultQuestionLibraryData;

        setLibraryData(data);
        const allowed = payload.allowedDepartments || null;
        setAllowedDepartments(allowed);

        const visibleDepts = allowed ? Object.keys(data).filter(d => allowed.includes(d)) : Object.keys(data);

        setDepartmentTab((prevDept) => {
            if (prevDept && visibleDepts.includes(prevDept)) {
                return prevDept;
            }
            return visibleDepts.length > 0 ? visibleDepts[0] : 'ENT';
        });

        setActiveCategory((prevCat) => {
            const currentDept = (departmentTab && visibleDepts.includes(departmentTab))
                ? departmentTab
                : (visibleDepts.length > 0 ? visibleDepts[0] : 'ENT');
            const deptCats = Object.keys(data[currentDept] || {});
            if (prevCat && deptCats.includes(prevCat)) {
                return prevCat;
            }
            return deptCats.length > 0 ? deptCats[0] : '';
        });

        setPendingSyncCount(getPendingQuestionCount());
    };

    const fetchLibrary = async (isManual = false) => {
        try {
            if (isManual) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const res = await fetchSuperAdminQuestionLibrary({
                onCacheHit: (cached) => {
                    if (cached?.data) {
                        applyLibraryPayload(cached.data);
                        setOfflineState(prev => ({
                            ...prev,
                            fromCache: true,
                            lastFetchedAt: cached.lastFetchedAt,
                            isSynthetic: Boolean(cached.isSynthetic),
                            noCache: false,
                        }));
                    }
                },
            });

            if (res.success && res.data) {
                applyLibraryPayload(res.data);
                setOfflineState({
                    isOffline: Boolean(res.isOffline),
                    fromCache: Boolean(res.fromCache),
                    lastFetchedAt: res.lastFetchedAt,
                    isSynthetic: Boolean(res.isSynthetic),
                    noCache: false,
                });
                if (isManual) {
                    toast.success(res.fromCache ? 'Loaded Question Library from local cache' : 'Question Library refreshed from server!');
                }
            } else if (res.noCache) {
                setOfflineState({
                    isOffline: true,
                    fromCache: false,
                    lastFetchedAt: null,
                    isSynthetic: false,
                    noCache: true,
                });
            } else if (!res.success && !res.fromCache) {
                toast.error('Failed to fetch Question Library.');
            }
        } catch (err) {
            console.error('Error fetching question library:', err);
            toast.error('Failed to fetch Question Library.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const triggerSyncPendingQuestions = async () => {
        if (isSyncingOfflineQueue) return;
        const count = getPendingQuestionCount();
        if (count === 0) return;

        setIsSyncingOfflineQueue(true);
        try {
            const res = await syncPendingQuestionLibraryOperations();
            if (res.success && res.syncedCount > 0) {
                toast.success(`Successfully synchronized ${res.syncedCount} offline question(s) with server!`);
                await fetchLibrary();
            } else if (res.failedCount > 0) {
                toast.error(`Sync partially failed: ${res.failedCount} question(s) need attention.`);
            }
        } catch (err) {
            console.error('Error syncing offline questions:', err);
        } finally {
            setIsSyncingOfflineQueue(false);
            setPendingSyncCount(getPendingQuestionCount());
        }
    };

    useEffect(() => {
        fetchLibrary();

        const unsubscribe = subscribeNetworkStatus(async (netState, meta = {}) => {
            const online = typeof netState === 'boolean'
                ? netState
                : Boolean(netState?.isOnline);

            if (online) {
                setOfflineState(prev => ({ ...prev, isOffline: false }));
                if (meta?.wasOffline) {
                    await triggerSyncPendingQuestions();
                    fetchLibrary();
                }
            } else {
                setOfflineState(prev => ({ ...prev, isOffline: true }));
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    const handleRefresh = async () => {
        if (offlineState.isOffline) {
            await fetchLibrary(true);
            return;
        }
        await fetchLibrary(true);
    };

    const handleSave = async () => {
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
        setInitialQ(null);
        setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' });
    };

    const handleAddQuestion = async () => {
        const qText = newQ.q.trim();
        if (!qText) {
            toast.error("Please enter a question.");
            return;
        }

        if (editIndex !== null && !isQuestionModified) {
            toast('No changes detected.', { icon: 'ℹ️' });
            resetModalState();
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

        // ── OFFLINE ADD QUESTION FLOW ──
        if (offlineState.isOffline) {
            if (editIndex !== null) {
                toast.error('Question editing is not supported offline. Only new questions can be added offline.');
                return;
            }

            try {
                const res = await queueQuestionAddition({
                    department: departmentTab,
                    category: activeCategory,
                    question: finalQuestion,
                });

                const newLib = { ...libraryData };
                if (!newLib[departmentTab]) newLib[departmentTab] = {};
                if (!newLib[departmentTab][activeCategory]) newLib[departmentTab][activeCategory] = [];

                newLib[departmentTab][activeCategory] = [
                    ...newLib[departmentTab][activeCategory],
                    res.queuedQuestion,
                ];

                setLibraryData(newLib);
                setPendingSyncCount(getPendingQuestionCount());
                resetModalState();
                toast.success('Question saved offline. It will sync when internet returns.');
            } catch (err) {
                console.error('Failed to queue offline question:', err);
                toast.error('Could not save question offline.');
            }
            return;
        }

        // ── ONLINE ADD QUESTION FLOW ──
        const newLib = { ...libraryData };
        if (!newLib[departmentTab]) newLib[departmentTab] = {};
        if (!newLib[departmentTab][activeCategory]) newLib[departmentTab][activeCategory] = [];

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
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
        const qToEdit = libraryData[departmentTab][activeCategory][index];
        const initData = {
            q: qToEdit.q || '',
            type: qToEdit.type || 'text',
            options: qToEdit.options ? qToEdit.options.join(', ') : '',
            extra: qToEdit.extra || '',
            parentQ: qToEdit.parentQ || '',
            condition: qToEdit.condition || ''
        };
        setNewQ(initData);
        setInitialQ(initData);
        setEditIndex(index);
        setShowAddModal(true);
    };

    const handleDeleteQuestion = async (cat, index) => {
        if (offlineState.isOffline) {
            toast.error('You are currently offline. Question Library changes cannot be saved until internet is restored.');
            return;
        }
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
            'checkbox-text-group': 'CHECK+TEXT',
            'gender-toggle': 'GENDER',
            'row': 'ROW'
        };
        return map[type] || 'CLINICAL';
    };

    const getDeptIcon = (dept) => {
        const d = (dept || '').toLowerCase();
        if (d.includes('ent') || d.includes('ear') || d.includes('throat')) return "assistive-listening-systems";
        if (d.includes('cardio') || d.includes('heart')) return "heartbeat";
        if (d.includes('ortho') || d.includes('bone') || d.includes('joint')) return "bone";
        if (d.includes('pediat') || d.includes('baby') || d.includes('child')) return "baby";
        if (d.includes('gyn') || d.includes('obs') || d.includes('women')) return "dna";
        if (d.includes('derm') || d.includes('skin') || d.includes('hair')) return "flask";
        if (d.includes('opht') || d.includes('eye') || d.includes('vision')) return "eye";
        if (d.includes('neuro') || d.includes('brain') || d.includes('nerve')) return "brain";
        if (d.includes('gastro') || d.includes('stomach') || d.includes('digest')) return "cubes";
        if (d.includes('pulm') || d.includes('chest') || d.includes('respir') || d.includes('lung')) return "microchip";
        if (d.includes('dent') || d.includes('oral') || d.includes('tooth')) return "stethoscope";
        return "stethoscope";
    };

    const renderQuestionCard = (item, index, cat) => {
        let inputPreview = null;

        if (item.type === "select") {
            inputPreview = (
                <View style={[styles.disabledInput, { width: 180 }]}>
                    <Text style={styles.disabledInputText}>{getUIText('selectOption', currentLang)}</Text>
                    <FontAwesome5 name="chevron-down" size={10} color="#94a3b8" />
                </View>
            );
        } else if (item.type === "yes-no") {
            inputPreview = (
                <View style={[styles.disabledInput, { width: 160 }]}>
                    <Text style={styles.disabledInputText}>{getUIText('selectShort', currentLang)}</Text>
                    <FontAwesome5 name="chevron-down" size={10} color="#94a3b8" />
                </View>
            );
        } else if (item.type === "date") {
            inputPreview = (
                <View style={[styles.disabledInput, { width: 200 }]}>
                    <Text style={styles.disabledInputText}>YYYY-MM-DD</Text>
                    <FontAwesome5 name="calendar-alt" size={12} color="#94a3b8" />
                </View>
            );
        } else if (item.type === "checkbox-group") {
            inputPreview = (
                <View style={styles.qlCheckboxGrid}>
                    {(item.options || []).map(opt => (
                        <View key={opt} style={styles.checkboxLabelWrapper}>
                            <View style={styles.fakeCheckbox} />
                            <Text style={styles.checkboxLabelText}>{getTranslatedClinicalText(opt, currentLang)}</Text>
                        </View>
                    ))}
                </View>
            );
        } else if (item.type === "textarea") {
            inputPreview = (
                <View style={[styles.disabledInput, { height: 60, alignItems: 'flex-start' }]}>
                    <Text style={styles.disabledInputText}>{getUIText('doctorNotes', currentLang)}</Text>
                </View>
            );
        } else if (item.type === "checkbox-date-group" || item.type === "checkbox-text-group") {
            inputPreview = (
                <View style={styles.qlComplexGroup}>
                    {(item.options || []).map(opt => (
                        <View style={styles.qlComplexRow} key={opt}>
                            <View style={styles.checkboxLabelWrapper}>
                                <View style={styles.fakeCheckbox} />
                                <Text style={styles.checkboxLabelText}>{getTranslatedClinicalText(opt, currentLang)}</Text>
                            </View>
                            {opt !== 'None' && (
                                <View style={[styles.disabledInput, { width: 130, paddingVertical: 4, height: 32 }]}>
                                    <Text style={[styles.disabledInputText, { fontSize: 11 }]}>
                                        {item.type === 'checkbox-date-group' ? 'YYYY-MM-DD' : getUIText('inputPlaceholder', currentLang)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))}
                    <View style={styles.qlExtraField}>
                        <Text style={styles.qlExtraFieldLabel}>
                            {getTranslatedClinicalText(item.extra, currentLang) || getUIText('detailsPlaceholder', currentLang)}:
                        </Text>
                        <View style={[styles.disabledInput, { marginTop: 4 }]}>
                            <Text style={styles.disabledInputText}>{getUIText('detailsPlaceholder', currentLang)}</Text>
                        </View>
                    </View>
                </View>
            );
        } else {
            inputPreview = (
                <View style={styles.disabledInput}>
                    <Text style={styles.disabledInputText}>{getUIText('enterResponse', currentLang)}</Text>
                </View>
            );
        }

        const isCondition = Boolean(item.parentQ && item.condition);

        return (
            <View style={styles.qlQuestionCard} key={index}>
                <View style={styles.qlQuestionHeader}>
                    <View style={styles.qlQBadge}>
                        <Text style={styles.qlQNumber}>Q{index + 1}</Text>
                    </View>
                    <View style={styles.qlQuestionMain}>
                        <Text style={styles.qlQuestionText}>{getTranslatedClinicalText(item.q, currentLang)}</Text>
                        <View style={styles.qlQuestionMeta}>
                            <View style={styles.qlQuestionTypeBadge}>
                                <Text style={styles.qlQuestionTypeBadgeText}>{getTypeLabel(item.type)}</Text>
                            </View>
                            {Boolean(item._offlinePending || item._syncStatus === 'pending') && (
                                <View style={styles.qlPendingBadge}>
                                    <FontAwesome5 name="clock" size={10} color="#b45309" />
                                    <Text style={styles.qlPendingBadgeText}>Pending Sync</Text>
                                </View>
                            )}
                            {Boolean(item._syncStatus === 'failed' || item._syncStatus === 'needs_attention') && (
                                <View style={styles.qlFailedBadge}>
                                    <FontAwesome5 name="exclamation-triangle" size={10} color="#b91c1c" />
                                    <Text style={styles.qlFailedBadgeText}>Needs Sync</Text>
                                </View>
                            )}
                            {isCondition && (
                                <View style={styles.qlConditionBadge}>
                                    <FontAwesome5 name="bolt" size={10} color="#eab308" />
                                    <Text style={styles.qlConditionBadgeText}>
                                        {getUIText('onlyShownIf', currentLang)
                                            .replace('{parentQ}', getTranslatedClinicalText(item.parentQ, currentLang))
                                            .replace('{condition}', item.condition)}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.qlInputPreview}>
                            {inputPreview}
                        </View>
                    </View>
                </View>

                <View style={styles.qlQuestionFooter}>
                    <TouchableOpacity
                        style={[styles.qlBtnEditQ, offlineState.isOffline && styles.qlBtnDisabled]}
                        onPress={() => handleEditQuestion(index)}
                        disabled={offlineState.isOffline}
                    >
                        <FontAwesome5 name="pen" size={10} color={offlineState.isOffline ? "#94a3b8" : "#475569"} />
                        <Text style={[styles.qlBtnEditQText, offlineState.isOffline && { color: "#94a3b8" }]}>
                            {getUIText('edit', currentLang)}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.qlBtnDelQ, offlineState.isOffline && styles.qlBtnDisabled]}
                        onPress={() => handleDeleteQuestion(cat, index)}
                        disabled={offlineState.isOffline}
                    >
                        <FontAwesome5 name="trash" size={10} color={offlineState.isOffline ? "#94a3b8" : "#ef4444"} />
                        <Text style={[styles.qlBtnDelQText, offlineState.isOffline && { color: "#94a3b8" }]}>
                            {getUIText('delete', currentLang)}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <FontAwesome5 name="microchip" size={42} color="#0d9488" style={{ marginBottom: 16 }} />
                <Text style={styles.loadingText}>{getUIText('initializing', currentLang)}</Text>
            </View>
        );
    }

    const allDeptKeys = Object.keys(libraryData);
    const visibleDepartments = allowedDepartments && allowedDepartments.length > 0
        ? allDeptKeys.filter(dept => allowedDepartments.includes(dept))
        : allDeptKeys;

    const currentDept = (departmentTab && (visibleDepartments.includes(departmentTab) || libraryData[departmentTab]))
        ? departmentTab
        : (visibleDepartments[0] || allDeptKeys[0] || 'ENT');

    const currentCategories = libraryData[currentDept] || {};
    const categoryKeys = Object.keys(currentCategories);
    const activeCat = (activeCategory && categoryKeys.includes(activeCategory))
        ? activeCategory
        : (categoryKeys[0] || '');

    const questionsInActiveCategory = currentCategories[activeCat] || [];

    return (
        <View style={styles.qlAdminBody}>
            <ScrollView contentContainerStyle={styles.qlAppContainer} showsVerticalScrollIndicator={false}>

                {/* ─── 0. BREADCRUMBS ─── */}
                <View style={styles.breadcrumbRow}>
                    <Text style={styles.breadcrumbLink}>Super Admin</Text>
                    <Text style={styles.breadcrumbSep}>/</Text>
                    <Text style={styles.breadcrumbCurrent}>Question Library</Text>
                </View>

                {/* ─── 1. HEADER & TOOLBAR ─── */}
                <View style={[styles.qlAppHeader, !isDesktop && styles.qlAppHeaderMobile]}>
                    <View style={styles.qlHeaderTitles}>
                        <Text style={styles.qlHeaderTitlesH1}>{getUIText('pageTitle', currentLang)}</Text>
                        <Text style={styles.qlHeaderTitlesP}>{getUIText('pageSubtitle', currentLang)}</Text>
                    </View>
                    <View style={styles.qlHeaderActions}>
                        <TouchableOpacity
                            style={[styles.qlBtn, styles.qlBtnRefresh, refreshing && styles.qlBtnDisabled]}
                            onPress={handleRefresh}
                            disabled={refreshing}
                        >
                            <FontAwesome5 name="sync-alt" size={12} color="#2563eb" />
                            <Text style={styles.qlBtnRefreshText}>
                                {refreshing ? getUIText('refreshing', currentLang) : getUIText('refresh', currentLang)}
                            </Text>
                        </TouchableOpacity>

                        <LanguageSelector currentLang={currentLang} onLanguageChange={handleLanguageChange} />

                        <TouchableOpacity
                            style={[styles.qlBtn, styles.qlBtnPreview]}
                            onPress={() => { setPreviewIntake({}); setShowPreview(true); }}
                        >
                            <FontAwesome5 name="eye" size={12} color="#475569" />
                            <Text style={styles.qlBtnPreviewText}>{getUIText('preview', currentLang)}</Text>
                        </TouchableOpacity>

                        {pendingSyncCount > 0 && (
                            <TouchableOpacity
                                style={[styles.qlBtn, styles.qlBtnPendingSync, isSyncingOfflineQueue && styles.qlBtnDisabled]}
                                onPress={async () => {
                                    if (offlineState.isOffline) {
                                        toast.info(`${pendingSyncCount} question(s) saved offline. Will sync when internet is restored.`);
                                        return;
                                    }
                                    toast.info('Synchronizing offline questions...');
                                    await triggerSyncPendingQuestions();
                                }}
                                disabled={isSyncingOfflineQueue}
                            >
                                <FontAwesome5 name={isSyncingOfflineQueue ? "sync-alt" : "clock"} size={11} color="#b45309" />
                                <Text style={styles.qlBtnPendingSyncText}>
                                    {isSyncingOfflineQueue ? 'Syncing...' : `${pendingSyncCount} Pending Sync`}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.qlBtn,
                                styles.qlBtnSave,
                                (saving || offlineState.isOffline) && styles.qlBtnSaveDisabled
                            ]}
                            onPress={handleSave}
                            disabled={saving || offlineState.isOffline}
                        >
                            <FontAwesome5
                                name={offlineState.isOffline ? "wifi-slash" : "cloud-upload-alt"}
                                size={12}
                                color="#ffffff"
                            />
                            <Text style={styles.qlBtnSaveText}>
                                {saving
                                    ? getUIText('syncing', currentLang)
                                    : offlineState.isOffline
                                        ? 'Offline (Read-Only)'
                                        : getUIText('saveDeploy', currentLang)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ─── 2. DEPARTMENT TABS ─── */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qlDeptTabs}>
                    {visibleDepartments.map(dept => {
                        const isActive = currentDept === dept;
                        return (
                            <TouchableOpacity
                                key={dept}
                                style={[styles.qlTab, isActive && styles.qlTabActive]}
                                onPress={() => {
                                    setDepartmentTab(dept);
                                    const cats = Object.keys(libraryData[dept] || {});
                                    setActiveCategory(cats.length > 0 ? cats[0] : '');
                                }}
                            >
                                <FontAwesome5
                                    name={getDeptIcon(dept)}
                                    size={12}
                                    color={isActive ? '#ffffff' : '#64748b'}
                                />
                                <Text style={[styles.qlTabText, isActive && styles.qlTabTextActive]}>
                                    {getTranslatedDepartment(dept, currentLang)}
                                </Text>
                                {isActive && allowedDepartments === null && (
                                    <View style={styles.tabActionsQuick}>
                                        <TouchableOpacity
                                            style={styles.tabActionIcon}
                                            onPress={() => handleEditDepartment(dept)}
                                            disabled={offlineState.isOffline}
                                        >
                                            <FontAwesome5 name="pen" size={10} color="#ffffff" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.tabActionIcon}
                                            onPress={() => handleDeleteDepartment(dept)}
                                            disabled={offlineState.isOffline}
                                        >
                                            <FontAwesome5 name="trash" size={10} color="#ffffff" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    {allowedDepartments === null && (
                        <TouchableOpacity
                            style={[styles.qlTab, styles.qlTabDashed, offlineState.isOffline && styles.qlTabDisabled]}
                            onPress={handleAddDepartmentClick}
                            disabled={offlineState.isOffline}
                        >
                            <FontAwesome5 name="plus" size={12} color="#0d9488" />
                            <Text style={styles.qlTabDashedText}>{getUIText('addDept', currentLang)}</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>

                {/* ─── 3. WORKSPACE GRID ─── */}
                {offlineState.noCache ? (
                    <OfflineEmptyState
                        title="No Cached Question Library"
                        message="No offline Question Library data is stored on this device. Connect to the network and tap Retry to synchronize."
                        onRetry={() => fetchLibrary(true)}
                        retrying={loading}
                    />
                ) : (
                    <View style={[styles.qlWorkspaceGrid, !isDesktop && styles.qlWorkspaceGridMobile]}>
                        {/* LEFT SIDEBAR */}
                        <View style={[styles.qlSidebar, !isDesktop && styles.qlSidebarMobile]}>
                            <View style={styles.qlAddCategoryBox}>
                                <TextInput
                                    style={styles.qlAddCategoryInput}
                                    placeholder={getUIText('enterCatPlaceholder', currentLang)}
                                    placeholderTextColor="#94a3b8"
                                    value={newCatName}
                                    onChangeText={setNewCatName}
                                    onSubmitEditing={() => handleAddCategory()}
                                    editable={!offlineState.isOffline}
                                />
                                <TouchableOpacity
                                    style={[styles.qlBtnAddCat, offlineState.isOffline && styles.qlBtnDisabled]}
                                    onPress={() => handleAddCategory()}
                                    disabled={offlineState.isOffline}
                                >
                                    <FontAwesome5 name="plus" size={12} color="#ffffff" />
                                    <Text style={styles.qlBtnAddCatText}>{getUIText('addCategory', currentLang)}</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.qlCategoryList} nestedScrollEnabled={true}>
                                {categoryKeys.map(cat => {
                                    const isActive = cat === activeCat;
                                    return (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.qlCategoryItem, isActive && styles.qlCategoryItemActive]}
                                            onPress={() => setActiveCategory(cat)}
                                        >
                                            <View style={styles.catItemLeft}>
                                                <Text style={styles.catFolderIcon}>{isActive ? '📂' : '📁'}</Text>
                                                <Text
                                                    style={[styles.catText, isActive && styles.catTextActive]}
                                                    numberOfLines={1}
                                                >
                                                    {getTranslatedCategory(cat, currentLang)}
                                                </Text>
                                            </View>
                                            <View style={styles.catItemRight}>
                                                <TouchableOpacity
                                                    style={styles.qlCatActionBtn}
                                                    onPress={() => handleEditCategory(cat)}
                                                    disabled={offlineState.isOffline}
                                                >
                                                    <FontAwesome5 name="pen" size={10} color="#64748b" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.qlCatActionBtn}
                                                    onPress={() => handleDeleteCategory(cat)}
                                                    disabled={offlineState.isOffline}
                                                >
                                                    <FontAwesome5 name="trash" size={10} color="#ef4444" />
                                                </TouchableOpacity>
                                                <FontAwesome5
                                                    name="chevron-right"
                                                    size={11}
                                                    color={isActive ? '#0d9488' : '#cbd5e1'}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                                {categoryKeys.length === 0 && (
                                    <View style={styles.qlNoCats}>
                                        <Text style={styles.qlNoCatsText}>{getUIText('noCats', currentLang)}</Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>

                        {/* RIGHT MAIN CANVAS */}
                        <View style={[styles.qlMainCanvas, !isDesktop && styles.qlMainCanvasMobile]}>
                            <View style={styles.qlCanvasContent}>
                                {!activeCat ? (
                                    <View style={styles.qlCanvasEmpty}>
                                        <FontAwesome5 name="cubes" size={52} color="#0d9488" style={{ marginBottom: 12 }} />
                                        <Text style={styles.qlCanvasEmptyText}>{getUIText('selectCatPrompt', currentLang)}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.qlCanvasActive}>
                                        <View style={styles.qlCanvasHeader}>
                                            <View style={styles.qlCanvasHeaderLeft}>
                                                <Text style={styles.qlCanvasHeaderH2}>
                                                    {getTranslatedCategory(activeCat, currentLang)}
                                                </Text>
                                                <View style={styles.qlItemCountBadge}>
                                                    <Text style={styles.qlItemCountBadgeText}>
                                                        {questionsInActiveCategory.length} {getUIText('questionsCount', currentLang)}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.qlBtnAddQ}
                                                onPress={() => {
                                                    setEditIndex(null);
                                                    setInitialQ(null);
                                                    setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' });
                                                    setShowAddModal(true);
                                                }}
                                            >
                                                <FontAwesome5 name="plus" size={12} color="#ffffff" />
                                                <Text style={styles.qlBtnAddQText}>{getUIText('addQuestion', currentLang)}</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <ScrollView contentContainerStyle={styles.qlQuestionStream} nestedScrollEnabled={true}>
                                            {questionsInActiveCategory.map((q, idx) => renderQuestionCard(q, idx, activeCat))}
                                            {questionsInActiveCategory.length === 0 && (
                                                <View style={styles.qlDataStreamEmpty}>
                                                    <Text style={styles.streamText}>{getUIText('noQuestions', currentLang)}</Text>
                                                    <Text style={styles.streamSubText}>{getUIText('clickAddQuestion', currentLang)}</Text>
                                                </View>
                                            )}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ─── DEPARTMENT MODAL ─── */}
            <Modal visible={showDeptModal} transparent animationType="fade" onRequestClose={() => setShowDeptModal(false)}>
                <View style={styles.qlModalOverlay}>
                    <View style={styles.qlModalContent}>
                        <View style={styles.qlModalHeaderTop}>
                            <Text style={styles.qlModalHeaderH3}>{getUIText('addDept', currentLang)}</Text>
                            <TouchableOpacity style={styles.modalClose} onPress={() => setShowDeptModal(false)}>
                                <FontAwesome5 name="times" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ marginTop: 16 }}>
                            <Text style={styles.qlModalLabel}>{getUIText('selectPredefined', currentLang)}</Text>
                            <ScrollView style={styles.predefinedDeptList}>
                                {predefinedDepartments.map(d => (
                                    <TouchableOpacity
                                        key={d}
                                        onPress={() => { setSelectedDept(d); setCustomDept(''); }}
                                        style={[
                                            styles.predefinedDeptItem,
                                            selectedDept === d && styles.predefinedDeptItemSelected
                                        ]}
                                    >
                                        <Text style={[styles.predefinedDeptItemText, selectedDept === d && styles.predefinedDeptItemTextSelected]}>
                                            {getTranslatedDepartment(d, currentLang)} ({d})
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <Text style={styles.qlModalDivider}>{getUIText('or', currentLang)}</Text>

                        <View>
                            <Text style={styles.qlModalLabel}>{getUIText('customDeptName', currentLang)}</Text>
                            <TextInput
                                style={styles.qlModalInput}
                                placeholder={getUIText('customDeptPlaceholder', currentLang)}
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
                                <Text style={styles.qlModalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.qlModalBtn, styles.qlModalBtnSubmit]} onPress={confirmAddDepartment}>
                                <Text style={styles.qlModalBtnSubmitText}>{getUIText('addDept', currentLang)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── ADD / EDIT QUESTION MODAL ─── */}
            <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={resetModalState}>
                <View style={styles.qlModalOverlay}>
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
                        <View style={[styles.qlModalContent, { maxWidth: 540, alignSelf: 'center', width: '100%' }]}>
                            <View style={styles.qlModalHeaderTop}>
                                <Text style={styles.qlModalHeaderH3}>
                                    {editIndex !== null ? getUIText('editQuestion', currentLang) : getUIText('addQuestion', currentLang)}
                                </Text>
                                <TouchableOpacity style={styles.modalClose} onPress={resetModalState}>
                                    <FontAwesome5 name="times" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginTop: 16 }}>
                                <Text style={styles.qlModalLabel}>{getUIText('questionLabel', currentLang)} *</Text>
                                <TextInput
                                    style={styles.qlModalInput}
                                    placeholder={getUIText('questionLabelPlaceholder', currentLang)}
                                    placeholderTextColor="#94a3b8"
                                    value={newQ.q}
                                    onChangeText={(val) => setNewQ({ ...newQ, q: val })}
                                />
                            </View>

                            <View style={{ marginTop: 14 }}>
                                <Text style={styles.qlModalLabel}>{getUIText('questionType', currentLang)}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {QUESTION_TYPES.map(qt => {
                                            const isSelected = newQ.type === qt.value;
                                            return (
                                                <TouchableOpacity
                                                    key={qt.value}
                                                    style={[styles.typeSelectPill, isSelected && styles.typeSelectPillActive]}
                                                    onPress={() => setNewQ({ ...newQ, type: qt.value })}
                                                >
                                                    <Text style={[styles.typeSelectPillText, isSelected && styles.typeSelectPillTextActive]}>
                                                        {getUIText(qt.labelKey, currentLang)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>

                            {['select', 'checkbox-group', 'checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                                <View style={{ marginTop: 14 }}>
                                    <Text style={styles.qlModalLabel}>{getUIText('optionsLabel', currentLang)}</Text>
                                    <TextInput
                                        style={styles.qlModalInput}
                                        placeholder={getUIText('optionsPlaceholder', currentLang)}
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.options}
                                        onChangeText={(val) => setNewQ({ ...newQ, options: val })}
                                    />
                                </View>
                            )}

                            {['checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                                <View style={{ marginTop: 14 }}>
                                    <Text style={styles.qlModalLabel}>{getUIText('extraFieldTitle', currentLang)}</Text>
                                    <TextInput
                                        style={styles.qlModalInput}
                                        placeholder={getUIText('extraFieldPlaceholder', currentLang)}
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.extra}
                                        onChangeText={(val) => setNewQ({ ...newQ, extra: val })}
                                    />
                                </View>
                            )}

                            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <FontAwesome5 name="bolt" size={12} color="#eab308" />
                                    <Text style={styles.qlModalLabel}>{getUIText('conditionalDisplay', currentLang)}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TextInput
                                        style={[styles.qlModalInput, { flex: 1 }]}
                                        placeholder={getUIText('parentQuestionLabel', currentLang)}
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.parentQ}
                                        onChangeText={(val) => setNewQ({ ...newQ, parentQ: val })}
                                    />
                                    <TextInput
                                        style={[styles.qlModalInput, { flex: 1 }]}
                                        placeholder={getUIText('whenParentEquals', currentLang)}
                                        placeholderTextColor="#94a3b8"
                                        value={newQ.condition}
                                        onChangeText={(val) => setNewQ({ ...newQ, condition: val })}
                                    />
                                </View>
                            </View>

                            <View style={styles.qlModalActions}>
                                <TouchableOpacity style={[styles.qlModalBtn, styles.qlModalBtnCancel]} onPress={resetModalState}>
                                    <Text style={styles.qlModalBtnCancelText}>{getUIText('cancel', currentLang)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.qlModalBtn,
                                        styles.qlModalBtnSubmit,
                                        editIndex !== null && !isQuestionModified && { opacity: 0.55 }
                                    ]}
                                    onPress={handleAddQuestion}
                                    disabled={editIndex !== null && !isQuestionModified}
                                >
                                    <Text style={styles.qlModalBtnSubmitText}>
                                        {editIndex !== null ? getUIText('updateQuestion', currentLang) : getUIText('addQuestion', currentLang)}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* ─── DOCTOR LIVE FORM PREVIEW MODAL ─── */}
            <Modal visible={showPreview} transparent animationType="slide" onRequestClose={() => setShowPreview(false)}>
                <View style={styles.qlModalOverlay}>
                    <View style={[styles.qlModalContent, { maxHeight: '85%', maxWidth: 680, alignSelf: 'center', width: '100%' }]}>
                        <View style={styles.qlModalHeaderTop}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <FontAwesome5 name="eye" size={16} color="#2563eb" />
                                <Text style={styles.qlModalHeaderH3}>{getUIText('doctorPreviewTitle', currentLang)}</Text>
                            </View>
                            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPreview(false)}>
                                <FontAwesome5 name="times" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ marginTop: 14 }}>
                            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                                {getUIText('previewSubtitle', currentLang)}{' '}
                                <Text style={{ color: '#0f4c47', fontWeight: 'bold' }}>
                                    {getTranslatedDepartment(currentDept, currentLang)}
                                </Text>
                            </Text>

                            {Object.keys(currentCategories).map(cat => (
                                <View key={cat} style={styles.previewCatBox}>
                                    <Text style={styles.previewCatTitle}>
                                        📂 {getTranslatedCategory(cat, currentLang)}
                                    </Text>
                                    <View style={{ gap: 12 }}>
                                        {(currentCategories[cat] || []).map((q, qIdx) => (
                                            <View key={qIdx}>
                                                <Text style={styles.previewQLabel}>{getTranslatedClinicalText(q.q, currentLang)}</Text>
                                                {q.type === 'textarea' ? (
                                                    <TextInput
                                                        multiline
                                                        numberOfLines={2}
                                                        placeholder={getUIText('doctorNotes', currentLang)}
                                                        placeholderTextColor="#94a3b8"
                                                        style={[styles.previewInput, { height: 60, textAlignVertical: 'top' }]}
                                                    />
                                                ) : q.type === 'yes-no' || q.type === 'select' ? (
                                                    <View style={[styles.previewInput, { width: 170, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                                                        <Text style={{ fontSize: 12.5, color: '#94a3b8' }}>{getUIText('selectOption', currentLang)}</Text>
                                                        <FontAwesome5 name="chevron-down" size={10} color="#94a3b8" />
                                                    </View>
                                                ) : (
                                                    <TextInput
                                                        placeholder={getUIText('enterResponse', currentLang)}
                                                        placeholderTextColor="#94a3b8"
                                                        style={styles.previewInput}
                                                    />
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
        backgroundColor: '#f8fafc',
        flex: 1,
        width: '100%',
        minHeight: '100%',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: 40,
    },
    loadingText: {
        fontWeight: '800',
        letterSpacing: 0.5,
        color: '#0d9488',
        fontSize: 14,
    },
    qlAppContainer: {
        paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
        paddingTop: 12,
        paddingBottom: 36,
        gap: 12,
    },

    // ─── Breadcrumbs ───
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    breadcrumbLink: {
        fontSize: 12.5,
        color: '#64748b',
        fontWeight: '600',
    },
    breadcrumbSep: {
        fontSize: 12,
        color: '#94a3b8',
    },
    breadcrumbCurrent: {
        fontSize: 12.5,
        color: '#0f4c47',
        fontWeight: '700',
    },

    // ─── Header ───
    qlAppHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        paddingVertical: 4,
    },
    qlAppHeaderMobile: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    qlHeaderTitles: {
        flex: 1,
        minWidth: 260,
    },
    qlHeaderTitlesH1: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f4c47',
        letterSpacing: -0.3,
    },
    qlHeaderTitlesP: {
        fontSize: 13,
        color: '#1a7a6e',
        fontWeight: '600',
        marginTop: 2,
    },
    qlHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    qlBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    qlBtnDisabled: {
        opacity: 0.55,
    },
    qlBtnRefresh: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    qlBtnRefreshText: {
        color: '#2563eb',
        fontWeight: '700',
        fontSize: 13,
    },
    qlBtnPreview: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    qlBtnPreviewText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 13,
    },
    qlBtnSave: {
        backgroundColor: '#0d9488', // Gradient teal base
        borderColor: '#0d9488',
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    qlBtnSaveDisabled: {
        opacity: 0.6,
        backgroundColor: '#64748b',
        borderColor: '#64748b',
    },
    qlBtnSaveText: {
        color: '#ffffff',
        fontWeight: '750',
        fontSize: 13,
    },

    // ─── Department Tabs ───
    qlDeptTabs: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        paddingVertical: 4,
    },
    qlTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    qlTabActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 3,
    },
    qlTabDisabled: {
        opacity: 0.5,
    },
    qlTabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    qlTabTextActive: {
        color: '#ffffff',
    },
    qlTabDashed: {
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.04)',
    },
    qlTabDashedText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0d9488',
    },
    tabActionsQuick: {
        flexDirection: 'row',
        gap: 6,
        marginLeft: 6,
    },
    tabActionIcon: {
        padding: 2,
    },

    // ─── Workspace Grid ───
    qlWorkspaceGrid: {
        flexDirection: 'row',
        gap: 24,
        alignItems: 'flex-start',
        minHeight: 520,
    },
    qlWorkspaceGridMobile: {
        flexDirection: 'column',
        gap: 20,
    },

    // ─── Left Sidebar ───
    qlSidebar: {
        width: 320,
        gap: 16,
    },
    qlSidebarMobile: {
        width: '100%',
    },
    qlAddCategoryBox: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#0d9488',
        borderRadius: 18,
        padding: 16,
        gap: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    qlAddCategoryInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: 'rgba(30, 96, 164, 0.2)',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        fontSize: 13.5,
        color: '#0f172a',
    },
    qlBtnAddCat: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0d9488',
        paddingVertical: 11,
        borderRadius: 10,
    },
    qlBtnAddCatText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.3,
    },
    qlCategoryList: {
        maxHeight: 520,
    },
    qlCategoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    qlCategoryItemActive: {
        borderColor: '#2563eb',
        borderLeftWidth: 4.5,
        borderLeftColor: '#2563eb',
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
        flex: 1,
    },
    catTextActive: {
        color: '#2563eb',
    },
    catItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    qlCatActionBtn: {
        padding: 4,
    },
    qlNoCats: {
        padding: 24,
        alignItems: 'center',
    },
    qlNoCatsText: {
        color: '#94a3b8',
        fontSize: 13,
    },

    // ─── Right Main Canvas ───
    qlMainCanvas: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 22,
        padding: 24,
        minHeight: 520,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
    },
    qlMainCanvasMobile: {
        width: '100%',
    },
    qlCanvasContent: {
        flex: 1,
    },
    qlCanvasEmpty: {
        flex: 1,
        minHeight: 380,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    qlCanvasEmptyText: {
        color: '#2563eb',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    qlCanvasActive: {
        flex: 1,
    },
    qlCanvasHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1.5,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 16,
        marginBottom: 18,
    },
    qlCanvasHeaderLeft: {
        flex: 1,
    },
    qlCanvasHeaderH2: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2563eb',
    },
    qlItemCountBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(13, 148, 136, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 4,
    },
    qlItemCountBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0d9488',
    },
    qlBtnAddQ: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#2563eb',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 2,
    },
    qlBtnAddQText: {
        color: '#ffffff',
        fontWeight: '750',
        fontSize: 13,
    },
    qlQuestionStream: {
        gap: 14,
    },
    qlDataStreamEmpty: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
    },
    streamText: {
        fontSize: 13.5,
        fontWeight: '600',
        color: '#334155',
    },
    streamSubText: {
        fontSize: 12.5,
        color: '#64748b',
        marginTop: 6,
    },

    // ─── Question Card ───
    qlQuestionCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    qlQuestionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    qlQBadge: {
        backgroundColor: '#f0f7ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingVertical: 2.5,
        paddingHorizontal: 8,
        borderRadius: 7,
        marginTop: 1,
    },
    qlQNumber: {
        fontSize: 12,
        fontWeight: '750',
        color: '#0284c7',
        letterSpacing: 0.3,
    },
    qlQuestionMain: {
        flex: 1,
        gap: 6,
    },
    qlQuestionText: {
        fontSize: 14.5,
        fontWeight: '600',
        color: '#1e293b',
        lineHeight: 20,
    },
    qlQuestionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    qlQuestionTypeBadge: {
        backgroundColor: 'rgba(13, 148, 136, 0.09)',
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.2)',
        paddingVertical: 2.5,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    qlQuestionTypeBadgeText: {
        fontSize: 10,
        fontWeight: '750',
        color: '#0d9488',
        letterSpacing: 0.4,
    },
    qlPendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#fef3c7',
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingVertical: 2.5,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    qlPendingBadgeText: {
        fontSize: 10.5,
        fontWeight: '750',
        color: '#b45309',
        letterSpacing: 0.3,
    },
    qlFailedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        paddingVertical: 2.5,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    qlFailedBadgeText: {
        fontSize: 10.5,
        fontWeight: '750',
        color: '#b91c1c',
        letterSpacing: 0.3,
    },
    qlBtnPendingSync: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
    },
    qlBtnPendingSyncText: {
        color: '#b45309',
        fontWeight: '700',
        fontSize: 12.5,
    },
    qlConditionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingVertical: 2.5,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    qlConditionBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400e',
    },
    qlInputPreview: {
        marginTop: 8,
    },
    disabledInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    disabledInputText: {
        fontSize: 13,
        color: '#64748b',
    },
    qlCheckboxGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 4,
    },
    checkboxLabelWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    fakeCheckbox: {
        width: 15,
        height: 15,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
    },
    checkboxLabelText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '500',
    },
    qlComplexGroup: {
        gap: 8,
        marginTop: 4,
    },
    qlComplexRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    qlExtraField: {
        marginTop: 6,
    },
    qlExtraFieldLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    qlQuestionFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    qlBtnEditQ: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    qlBtnEditQText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    qlBtnDelQ: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    qlBtnDelQText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ef4444',
    },

    // ─── Modals ───
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
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        width: '100%',
        maxWidth: 440,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
        elevation: 8,
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
    predefinedDeptList: {
        maxHeight: 130,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
    },
    predefinedDeptItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#ffffff',
    },
    predefinedDeptItemSelected: {
        backgroundColor: '#e0f2fe',
    },
    predefinedDeptItemText: {
        fontSize: 13,
        color: '#0f172a',
    },
    predefinedDeptItemTextSelected: {
        fontWeight: '700',
        color: '#0284c7',
    },
    typeSelectPill: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
    },
    typeSelectPillActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    typeSelectPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    typeSelectPillTextActive: {
        color: '#ffffff',
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
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    qlModalBtnSubmit: {
        backgroundColor: '#0d9488',
    },
    qlModalBtnSubmitText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    // ─── Preview Modal ───
    previewCatBox: {
        marginBottom: 16,
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    previewCatTitle: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0f172a',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 6,
        marginBottom: 10,
    },
    previewQLabel: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 4,
    },
    previewInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        fontSize: 12.5,
        color: '#0f172a',
    },
});

export default AdminQuestionLibrary;
