import React, { useState, useEffect } from 'react';
import { View, ScrollView, SafeAreaView, Text, Alert, Modal, TouchableOpacity, TextInput, useWindowDimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { styles } from '../../components/centraladmin/CentralAdminDashboardStyles';
import CentralAdminTabs from '../../components/centraladmin/CentralAdminTabs';
import CentralAdminPricingCards from '../../components/centraladmin/CentralAdminPricingCards';
import CentralAdminHospitalCards from '../../components/centraladmin/CentralAdminHospitalCards';
import CentralAdminHospitalDetails from '../../components/centraladmin/CentralAdminHospitalDetails';
import CentralAdminClinicDetails from '../../components/centraladmin/CentralAdminClinicDetails';
import CentralAdminForms from '../../components/centraladmin/CentralAdminForms';
import HospitalBrandingEditor from '../../components/HospitalBrandingEditor';
import RevenuePlanEditorModal from '../../components/centraladmin/RevenuePlanEditorModal';
import AdminLabs from '../admin/AdminLabs';
import AdminPharmacy from '../admin/AdminPharmacy';
import { 
  hospitalAPI, 
  simpleClinicAPI, 
  revenueAPI, 
  hospitalAdminAPI, 
  questionLibraryAPI, 
  uploadAPI, 
  adminAPI 
} from '../../utils/api';
import { isSafeImageUrl } from '../../utils/resourceSecurity';

export default function CentralAdminDashboard() {
  const navigation = useNavigation(); 
  const route = useRoute();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1280;
  const isLaptop = width >= 1024 && width < 1280;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;
  const isSmallPhone = width < 480;
  const isTinyPhone = width < 390;

  // State Management
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [activeTab, setActiveTab] = useState('hospitals');
  const [loading, setLoading] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revenueData, setRevenueData] = useState(null);
  
  const [brandingHospital, setBrandingHospital] = useState(null);
  // Controlled per-hospital version counters for image cache busting.
  // Incremented on every successful branding save — Image key = `logoUrl-vN`
  // so it remounts even when the same URL is pasted twice.
  const [brandingVersions, setBrandingVersions] = useState({});
  const [revenuePlanModalData, setRevenuePlanModalData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form states - Hospital
  const [showHospitalForm, setShowHospitalForm] = useState(false);
  const [showHospitalAdminForm, setShowHospitalAdminForm] = useState(false);
  const [editHospital, setEditHospital] = useState(null);
  const [savingHospital, setSavingHospital] = useState(false);
  
  const [hospitalForm, setHospitalForm] = useState({ 
    name: '', slug: '', customDomain: '', address: '', city: '', state: '', 
    phone: '', email: '', website: '', departments: [], whiteLabelEnabled: false, 
    brandingSchema: { appName: '', logoUrl: '', customDomain: '', themeColors: { primary: '#14b8a6', secondary: '#0a2647', background: '#ffffff' } } 
  });

  // Form states - Starter Clinic (1:1 Web Parity)
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [clinicForm, setClinicForm] = useState({ 
    name: '', slug: '', address: '', city: '', state: '', phone: '', email: '', website: '', defaultFee: 0 
  });
  const [editClinic, setEditClinic] = useState(null);
  const [savingClinic, setSavingClinic] = useState(false);

  // System Analytics for real KPIs (1:1 Web Parity)
  const [systemAnalytics, setSystemAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Dynamic departments derived from Question Library & custom additions
  const [qlDepartments, setQlDepartments] = useState([]);
  const [customDepartments, setCustomDepartments] = useState([]);
  const availableDepartments = Array.from(new Set([
    ...qlDepartments,
    'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Surgery',
    'General Medicine', 'Gynecology', 'Dermatology', 'ENT', 'Ophthalmology',
    'Dental', 'Emergency', 'ICU', 'Radiology', 'Pathology', 'Psychiatry',
    ...(hospitals || []).flatMap(h => Array.isArray(h?.departments) ? h.departments : []),
    ...customDepartments
  ])).filter(Boolean);

  const configurationItems = [
    { title: 'Roles & Permissions', sub: 'Create and manage user roles', icon: <Feather name="key" size={20} color="#3b82f6" />, bg: '#eff6ff', color: '#3b82f6', route: 'AdminRoles' },
    { title: 'Question Library', sub: 'Configure assessment forms', icon: <Feather name="help-circle" size={20} color="#8b5cf6" />, bg: '#f5f3ff', color: '#8b5cf6', route: 'AdminQuestionLibrary' },
    { title: 'Lab Tests', sub: 'Manage lab test catalog', icon: <Feather name="activity" size={20} color="#d946ef" />, bg: '#fdf4ff', color: '#d946ef', route: 'AdminLabTests' },
    { title: 'Test Packages', sub: 'Bundle lab tests into packages', icon: <Feather name="package" size={20} color="#22c55e" />, bg: '#f0fdf4', color: '#22c55e', route: 'AdminTestPackages' },
    { title: 'Medicine Catalog', sub: 'Global medicine library', icon: <Feather name="heart" size={20} color="#ea580c" />, bg: '#fff7ed', color: '#ea580c', route: 'AdminMedicines' },
    { title: 'Services', sub: 'Configure hospital services', icon: <Feather name="grid" size={20} color="#06b6d4" />, bg: '#ecfeff', color: '#06b6d4', route: 'AdminServices' },
    { title: 'Consent Forms', sub: 'Manage templates for patient consent', icon: <Feather name="file-text" size={20} color="#64748b" />, bg: '#f1f5f9', color: '#64748b', route: 'ConsentManagement' },
    { title: 'Labs', sub: 'Manage lab departments', icon: <Feather name="activity" size={20} color="#0ea5e9" />, bg: '#f0f9ff', color: '#0ea5e9', tab: 'labs' },
    { title: 'Pharmacy', sub: 'Manage pharmacy departments', icon: <Feather name="grid" size={20} color="#f43f5e" />, bg: '#fff1f2', color: '#f43f5e', tab: 'pharmacy' },
  ];

  useEffect(() => {
    // Check for openTab from navigation state only when it changes
    if (route.params?.openTab) {
      setActiveTab(route.params.openTab);
      navigation.setParams({ openTab: undefined });
    }
  }, [route.params?.openTab, navigation]);

  useEffect(() => {
    if (route.params?.hospital) {
      setSelectedHospital(route.params.hospital);
    } else if (route.params?.hospitalId && hospitals.length > 0) {
      const found = hospitals.find(h => (h._id || h.id) === route.params.hospitalId);
      if (found) setSelectedHospital(found);
    }
  }, [route.params?.hospital, route.params?.hospitalId, hospitals]);

  useEffect(() => {
    fetchHospitals();
    fetchSystemAnalytics();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await questionLibraryAPI.getLibrary();
      const dataObj = res?.data?.data || res?.data;
      if (dataObj && typeof dataObj === 'object') {
        const depts = Object.keys(dataObj);
        if (depts.length > 0) {
          setQlDepartments(depts);
        }
      }
    } catch (err) {
      console.warn('Failed to load global question library departments:', err);
    }
  };

  const fetchSystemAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await revenueAPI.getSystemAnalytics();
      if (res && res.success) {
        setSystemAnalytics(res);
      }
    } catch (err) {
      console.warn('Failed to load system analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'revenue-plans') {
      fetchRevenuePlans();
    }
  }, [activeTab]);

  const fetchRevenuePlans = async () => {
    setLoading(true);
    try {
      const response = await revenueAPI.getHospitalsRevenue();
      const payload = Array.isArray(response) ? response : (response?.hospitals || response?.data || []);
      setRevenueData(payload);
    } catch (err) {
      console.error('Error fetching revenue plans:', err);
      setError('Failed to fetch revenue plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const hospitalsRes = await hospitalAPI.getHospitals('all');
      let clinicsRes = { clinics: [] };
      try {
        clinicsRes = await simpleClinicAPI.getClinics('starter');
      } catch (e) {
        console.log('Failed to fetch clinics:', e);
      }

      // Handle the fact that Axios might have already unpacked .data via interceptors
      const hospData = hospitalsRes?.data !== undefined ? hospitalsRes.data : hospitalsRes;
      const clinData = clinicsRes?.data !== undefined ? clinicsRes.data : clinicsRes;

      const rawHospitals = Array.isArray(hospData)
        ? hospData
        : (hospData?.hospitals || hospData?.data || []);

      const rawClinics = Array.isArray(clinData)
        ? clinData
        : (clinData?.clinics || clinData?.simpleClinics || clinData?.data || []);

      const normalizedHospitals = rawHospitals.map(item => ({
        ...item,
        brandingSchema: item.brandingSchema ? {
          ...item.brandingSchema,
          logoUrl: isSafeImageUrl(item.brandingSchema.logoUrl) ? item.brandingSchema.logoUrl : '',
        } : item.brandingSchema,
        branding: item.branding ? {
          ...item.branding,
          logoUrl: isSafeImageUrl(item.branding.logoUrl) ? item.branding.logoUrl : '',
        } : item.branding,
        isSimpleClinic: item.clinicType === 'clinic',
        clinicType: item.clinicType === 'clinic' ? 'clinic' : (item.clinicType || 'hospital'),
        plan: (item.plan || item.planName || item.subscriptionPlan || 'enterprise').toLowerCase().replace(/[\s-]/g, '_')
      }));

      const normalizedClinics = rawClinics.map(item => ({
        ...item,
        brandingSchema: item.brandingSchema ? {
          ...item.brandingSchema,
          logoUrl: isSafeImageUrl(item.brandingSchema.logoUrl) ? item.brandingSchema.logoUrl : '',
        } : item.brandingSchema,
        branding: item.branding ? {
          ...item.branding,
          logoUrl: isSafeImageUrl(item.branding.logoUrl) ? item.branding.logoUrl : '',
        } : item.branding,
        isSimpleClinic: true,
        clinicType: 'clinic',
        name: item.name || item.clinicName || item.hospitalName || 'Clinic',
        plan: (item.plan || item.planName || item.subscriptionPlan || item.clinicPlan || 'starter').toLowerCase().replace(/[\s-]/g, '_')
      }));

      const unifiedList = [...normalizedHospitals, ...normalizedClinics];
      setHospitals(unifiedList);
    } catch (err) {
      if (err.response?.status === 404) {
        setHospitals([]);
      } else {
        console.error('Error fetching hospitals:', err?.message || err);
        setError(err.response?.data?.message || 'Failed to fetch hospitals');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError('');
    setSuccess('');
    try {
      await Promise.all([fetchHospitals(), fetchSystemAnalytics()]);
      setSuccess('Dashboard data refreshed!');
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSaveHospital = async () => {
    setSavingHospital(true);
    try {
      const payload = {
        ...hospitalForm,
        brandingSchema: hospitalForm.brandingSchema ? {
          ...hospitalForm.brandingSchema,
          logoUrl: isSafeImageUrl(hospitalForm.brandingSchema?.logoUrl) ? hospitalForm.brandingSchema.logoUrl : '',
        } : hospitalForm.brandingSchema,
        plan: activeTab === 'multi-speciality' ? 'multi_speciality_starter' : activeTab === 'clinic-basic' ? 'clinic_basic' : 'enterprise',
      };
      if (editHospital) {
        await hospitalAPI.updateHospital(editHospital._id, payload);
      } else {
        await hospitalAPI.createHospital(payload);
      }
      setSuccess('Hospital saved successfully');
      setShowHospitalForm(false);
      setEditHospital(null);
      await fetchHospitals();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save hospital');
    } finally {
      setSavingHospital(false);
    }
  };

  // Starter Clinic CRUD (1:1 Web Parity)
  const handleSaveClinic = async () => {
    if (!clinicForm.name.trim()) {
      setError('Clinic name is required');
      return;
    }
    setSavingClinic(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...clinicForm,
        plan: 'starter',
      };
      if (editClinic) {
        const clinicId = editClinic._id || editClinic.id;
        const res = await simpleClinicAPI.updateClinic(clinicId, payload);
        if (res?.success !== false) {
          setSuccess('Clinic updated successfully.');
          setShowClinicForm(false);
          setEditClinic(null);
          await fetchHospitals();
        } else {
          setError(res?.message || 'Failed to update clinic');
        }
      } else {
        const res = await simpleClinicAPI.createClinic(payload);
        if (res?.success !== false) {
          setSuccess('Clinic created successfully!');
          setShowClinicForm(false);
          setClinicForm({ name: '', slug: '', address: '', city: '', state: '', phone: '', email: '', website: '', defaultFee: 0 });
          await fetchHospitals();
        } else {
          setError(res?.message || 'Failed to create clinic');
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to save clinic');
    } finally {
      setSavingClinic(false);
    }
  };

  const handleDeleteClinic = (id) => {
    Alert.alert(
      'Delete Clinic?',
      'WARNING: This will permanently delete this clinic and its records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await simpleClinicAPI.deleteClinic(id);
              if (res?.success !== false) {
                setSuccess('Clinic deleted successfully.');
                await fetchHospitals();
              } else {
                setError(res?.message || 'Failed to delete clinic');
              }
            } catch (err) {
              setError(err?.response?.data?.message || 'Failed to delete clinic');
            }
          },
        },
      ]
    );
  };

  const handleCreateHospitalAdmin = async (adminValues) => {
    try {
      if (!adminValues?.hospitalId) {
        setError('Please select a hospital for the admin');
        return;
      }
      const payload = {
        name: adminValues.name,
        email: adminValues.email,
        phone: adminValues.phone,
        password: adminValues.password,
        hospitalId: adminValues.hospitalId,
        age: adminValues.age ? Number(adminValues.age) : undefined,
        aadhaarNumber: adminValues.aadhaarNumber || undefined,
      };
      const res = await hospitalAdminAPI.createHospitalAdmin(payload);
      
      // Upload admin avatar if file was selected (1:1 Web Parity)
      if (adminValues.file && (res?.user?.id || res?.user?._id)) {
        try {
          const userId = res.user.id || res.user._id;
          const formData = new FormData();
          formData.append('images', {
            uri: adminValues.file.uri,
            name: adminValues.file.name || 'avatar.jpg',
            type: adminValues.file.mimeType || 'image/jpeg',
          });
          const uploadRes = await uploadAPI.uploadImages(formData);
          if (uploadRes?.success && uploadRes?.files?.length > 0) {
            await adminAPI.updateUser(userId, { avatar: uploadRes.files[0].url });
          }
        } catch (uploadErr) {
          console.warn('Avatar upload failed (non-fatal):', uploadErr);
        }
      }

      setSuccess(`✅ Hospital Admin account created! Login: ${adminValues.email}`);
      setShowHospitalAdminForm(false);
      await fetchHospitals();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create hospital admin');
    }
  };

  const toggleAdminForm = () => {
    setShowHospitalAdminForm(!showHospitalAdminForm);
    setShowHospitalForm(false);
    setShowClinicForm(false);
    setEditHospital(null);
    setEditClinic(null);
  };

  const toggleHospitalForm = () => {
    setShowHospitalForm(!showHospitalForm);
    setShowHospitalAdminForm(false);
    setShowClinicForm(false);
    setEditHospital(null);
    setEditClinic(null);
    if (!showHospitalForm) {
      setHospitalForm({ 
        name: '', slug: '', customDomain: '', address: '', city: '', state: '', 
        phone: '', email: '', website: '', departments: [], whiteLabelEnabled: false, 
        brandingSchema: { appName: '', logoUrl: '', customDomain: '', themeColors: { primary: '#14b8a6', secondary: '#0a2647', background: '#ffffff' } } 
      });
    }
  };

  const toggleClinicForm = () => {
    setShowClinicForm(!showClinicForm);
    setShowHospitalForm(false);
    setShowHospitalAdminForm(false);
    setEditClinic(null);
    setEditHospital(null);
    if (!showClinicForm) {
      setClinicForm({ name: '', slug: '', address: '', city: '', state: '', phone: '', email: '', website: '', defaultFee: 0 });
    }
  };

  // Web Parity: When a clinic/hospital is selected, render clinic-specific details or hospital details
  if (selectedHospital) {
    // Only genuine starter / simple-clinics (clinicType === 'clinic') are Simple Clinics.
    // Clinic Basic is a Hospital (clinicType !== 'clinic') and uses CentralAdminHospitalDetails.
    const isClinic = selectedHospital?.clinicType === 'clinic' || selectedHospital?.isSimpleClinic === true || selectedHospital?.plan === 'starter';

    return (
      <SafeAreaView style={[styles.centralAdminPage, { flex: 1, width: '100%', height: '100%' }]}>
        {isClinic ? (
          <CentralAdminClinicDetails 
            clinic={selectedHospital} 
            onBack={() => {
              setSelectedHospital(null);
              fetchHospitals();
            }}
            onDeleteSuccess={() => {
              setSelectedHospital(null);
              fetchHospitals();
            }}
          />
        ) : (
          <CentralAdminHospitalDetails 
            hospital={selectedHospital} 
            onBack={() => setSelectedHospital(null)} 
          />
        )}
      </SafeAreaView>
    );
  }

  // Web Parity lines 2890-2895
  const totalHospitals = systemAnalytics?.summary?.totalEntities ?? hospitals.length;
  const totalDoctors = (systemAnalytics?.hospitals?.length ? systemAnalytics.hospitals.length * 14 : (hospitals.length * 12 + 6)) || 0;
  const totalAppointments = (systemAnalytics?.monthlyBreakdown?.reduce((s, m) => s + (m.total > 0 ? Math.round(m.total / 300) : 0), 0)) || (hospitals.length > 0 ? hospitals.length * 85 : 0);
  const totalPatients = (systemAnalytics?.summary?.perPatient?.currentMonthRevenue ? Math.round(systemAnalytics.summary.perPatient.currentMonthRevenue / 50) : (hospitals.length * 200)) || 0;
  const totalRevenue = systemAnalytics?.summary?.totalCurrentMonthRevenue || 0;

  return (
    <LinearGradient
      colors={['#f0fdf9', '#e0f2fe', '#fdf2f8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, width: '100%', height: '100%' }}
    >
      <SafeAreaView style={[styles.centralAdminPage, { backgroundColor: 'transparent', flex: 1, width: '100%', height: '100%' }]}>

        <ScrollView 
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={[
            styles.centralAdminContainer, 
            { 
              paddingHorizontal: isMobile ? 12 : 24, 
              paddingTop: isMobile ? 14 : 20, 
              paddingBottom: isMobile ? 40 : 60 
            }
          ]} 
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
        
        {/* Child Component 1: Header and Tabs */}
        <CentralAdminTabs 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onRevenueAnalyticsPress={() => navigation.navigate('SystemRevenueDashboard')}
          onRefreshPress={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Global Notifications */}
        {Boolean(error) ? <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}><Feather name="alert-triangle" size={16} color="red"/><Text style={{ color: 'red', marginLeft: 6 }}>{error}</Text></View> : null}
        {Boolean(success) ? <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}><Feather name="check-circle" size={16} color="green"/><Text style={{ color: 'green', marginLeft: 6 }}>{success}</Text></View> : null}

        {/* Child Component 2: Pricing Cards & Operational Provisions */}
        <CentralAdminPricingCards 
          activeTab={activeTab}
          showHospitalForm={activeTab === 'simple-clinics' ? showClinicForm : showHospitalForm}
          showHospitalAdminForm={showHospitalAdminForm}
          editHospital={activeTab === 'simple-clinics' ? editClinic : editHospital}
          onToggleAdminForm={toggleAdminForm}
          onToggleHospitalForm={activeTab === 'simple-clinics' ? toggleClinicForm : toggleHospitalForm}
        />

        {/* Child Component 3: Forms for Hospital, Clinic & Admin creation */}
        <CentralAdminForms 
          showHospitalForm={showHospitalForm}
          showHospitalAdminForm={showHospitalAdminForm}
          editHospital={editHospital}
          hospitalForm={hospitalForm}
          setHospitalForm={setHospitalForm}
          handleSaveHospital={handleSaveHospital}
          savingHospital={savingHospital}
          onClose={() => { 
            setShowHospitalForm(false); 
            setShowHospitalAdminForm(false); 
            setShowClinicForm(false);
            setEditHospital(null); 
            setEditClinic(null);
          }}
          availableDepartments={availableDepartments}
          onAddCustomDept={(newDept) => setCustomDepartments(prev => [...prev, newDept])}
          onCreateAdmin={handleCreateHospitalAdmin}
          hospitals={hospitals}
          // Simple Clinic Form Props (1:1 Web Parity)
          showClinicForm={showClinicForm}
          editClinic={editClinic}
          clinicForm={clinicForm}
          setClinicForm={setClinicForm}
          handleSaveClinic={handleSaveClinic}
          savingClinic={savingClinic}
        />

        {/* Child Component 4: Hospital & Clinic List Grid */}
        {(activeTab !== 'revenue-plans' && activeTab !== 'configurations' && activeTab !== 'labs' && activeTab !== 'pharmacy') && (
          <CentralAdminHospitalCards 
            loading={loading}
            hospitals={hospitals}
            activeTab={activeTab}
            showHospitalForm={showHospitalForm}
            showHospitalAdminForm={showHospitalAdminForm}
            editHospital={editHospital}
            showClinicForm={showClinicForm}
            editClinic={editClinic}
            onSelectHospital={(h) => {
              if (h?._id || h?.id) {
                setSelectedHospital(h);
              }
            }}
            onEditHospital={(h) => {
              setEditHospital(h);
              setHospitalForm({
                name: h.name || '',
                slug: h.slug || '',
                customDomain: h.customDomain || '',
                address: h.address || '',
                city: h.city || '',
                state: h.state || '',
                phone: h.phone || '',
                email: h.email || '',
                website: h.website || '',
                departments: h.departments || [],
                whiteLabelEnabled: h.whiteLabelEnabled || false,
                brandingSchema: {
                  appName: h.brandingSchema?.appName || '',
                  logoUrl: h.brandingSchema?.logoUrl || '',
                  customDomain: h.brandingSchema?.customDomain || '',
                  themeColors: {
                    primary: h.brandingSchema?.themeColors?.primary || '#14b8a6',
                    secondary: h.brandingSchema?.themeColors?.secondary || '#0a2647',
                    background: h.brandingSchema?.themeColors?.background || '#ffffff',
                  },
                },
              });
              setShowHospitalForm(true);
            }}
            onDeleteHospital={async (id) => {
              Alert.alert(
                'Delete Hospital',
                'WARNING: This will permanently delete the hospital and ALL related data. This action CANNOT be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await hospitalAPI.deleteHospital(id);
                        setSuccess('Hospital deleted successfully');
                        await fetchHospitals();
                      } catch (error) {
                        setError(error?.response?.data?.message || 'Failed to delete hospital');
                      }
                    },
                  },
                ]
              );
            }}
            onEditClinic={(c) => {
              setEditClinic(c);
              setClinicForm({
                name: c.name || '',
                slug: c.slug || '',
                address: c.address || '',
                city: c.city || '',
                state: c.state || '',
                phone: c.phone || '',
                email: c.email || '',
                website: c.website || '',
                defaultFee: c.defaultFee !== undefined ? c.defaultFee : 0,
              });
              setShowClinicForm(true);
            }}
            onDeleteClinic={handleDeleteClinic}
            onBrandingHospital={(h) => setBrandingHospital(h)}
            brandingVersions={brandingVersions}
          />
        )}

        {/* Revenue Plans View */}
        {activeTab === 'revenue-plans' && (
          <View style={{ width: '100%', marginTop: 20 }}>
            {/* Top Summary Cards */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ marginBottom: 24 }}>
              <View style={styles.revenueCardsContainer}>
                <View style={[styles.revenueSummaryCard, { backgroundColor: '#ede9fe' }]}>
                  <Feather name="user" size={24} color="#6366f1" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.revenueCardTitle, { color: '#6366f1' }]}>Model B - Per Patient</Text>
                    <Text style={styles.revenueCardSub}>Charge per new patient registered monthly</Text>
                  </View>
                </View>
                
                <View style={[styles.revenueSummaryCard, { backgroundColor: '#d1fae5' }]}>
                  <Feather name="calendar" size={24} color="#10b981" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.revenueCardTitle, { color: '#10b981' }]}>Model A - Fixed Monthly</Text>
                    <Text style={styles.revenueCardSub}>Flat fee every billing cycle</Text>
                  </View>
                </View>
                
                <View style={[styles.revenueSummaryCard, { backgroundColor: '#fef3c7' }]}>
                  <Feather name="key" size={24} color="#f59e0b" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.revenueCardTitle, { color: '#f59e0b' }]}>Model C - Per Login</Text>
                    <Text style={styles.revenueCardSub}>Charge per login session (coming soon)</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Data Table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ width: '100%' }}>
              <View style={[styles.tableContainer, { minWidth: 700 }]}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>#</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>NAME</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TYPE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>REVENUE MODEL</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>RATE/FEE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>ACTION</Text>
                </View>

                {revenueData && revenueData.length > 0 ? (
                  revenueData.map((item, idx) => (
                    <View key={item._id || idx} style={styles.tableRow}>
                      <Text style={[styles.tableCellText, { flex: 0.5, color: '#64748b' }]}>{idx + 1}</Text>
                      <Text style={[styles.tableCellText, { flex: 2, fontWeight: '600' }]}>{item.name}</Text>
                      <View style={{ flex: 1, alignItems: 'flex-start' }}>
                        <Text style={item.plan && item.plan.includes('clinic') ? styles.badgeClinic : styles.badgeHospital}>
                          {item.plan && item.plan.includes('clinic') ? 'Clinic' : 'Hospital'}
                        </Text>
                      </View>
                      <Text style={[styles.tableCellText, { flex: 1.5 }]}>
                        {item.revenueConfig?.model || 'Fixed Monthly'}
                      </Text>
                      <Text style={[styles.tableCellText, { flex: 1.5, fontWeight: '700' }]}>
                        ₹{item.revenueConfig?.platformFee || '0'} /mo
                      </Text>
                      <View style={{ flex: 1, alignItems: 'flex-start' }}>
                        <TouchableOpacity style={styles.btnEditPlan} onPress={() => setRevenuePlanModalData(item)}>
                          <Text style={styles.btnEditPlanText}>Edit Plan</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  !loading && (
                    <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="info" size={24} color="#64748b" style={{marginBottom: 8}} />
                      <Text style={{ fontSize: 14, color: '#64748b' }}>No revenue configurations found.</Text>
                    </View>
                  )
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Configurations View */}
        {activeTab === 'configurations' && (
          <View style={{ width: '100%', marginTop: 20 }}>
            {/* Header Section */}
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
              <Feather name="settings" size={24} color="#1e293b" />
              <Text style={[styles.configHeader, {marginLeft: 8}]}>System Configurations</Text>
            </View>
            <Text style={styles.configSubHeader}>Manage global settings — roles, question libraries, lab tests, medicines, services, and test packages.</Text>
            
            {/* Grid Section */}
            <View style={styles.configGridContainer}>
              {configurationItems.map((item, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.configCard}
                  onPress={() => item.tab ? setActiveTab(item.tab) : navigation.navigate(item.route)}
                >
                  <View style={[styles.configIconBox, { backgroundColor: item.bg }]}>
                    {item.icon}
                  </View>
                  <View style={styles.configTextContainer}>
                    <Text style={styles.configTitle}>{item.title}</Text>
                    <Text style={styles.configSub}>{item.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Labs Tab View (1:1 Web Parity lines 4288-4293) */}
        {activeTab === 'labs' && (
          <View style={{ width: '100%', marginTop: 14 }}>
            <TouchableOpacity 
              style={styles.btnBackConfig} 
              onPress={() => setActiveTab('configurations')}
            >
              <Feather name="arrow-left" size={16} color="#2563eb" />
              <Text style={styles.btnBackConfigText}>← Back to Configurations</Text>
            </TouchableOpacity>
            <AdminLabs />
          </View>
        )}

        {/* Pharmacy Tab View (1:1 Web Parity lines 4296-4301) */}
        {activeTab === 'pharmacy' && (
          <View style={{ width: '100%', marginTop: 14 }}>
            <TouchableOpacity 
              style={styles.btnBackConfig} 
              onPress={() => setActiveTab('configurations')}
            >
              <Feather name="arrow-left" size={16} color="#2563eb" />
              <Text style={styles.btnBackConfigText}>← Back to Configurations</Text>
            </TouchableOpacity>
            <AdminPharmacy />
          </View>
        )}

      </ScrollView>

      {/* Modals */}
      {Boolean(brandingHospital) && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => { setBrandingHospital(null); fetchHospitals(); }}>
          <HospitalBrandingEditor 
            hospital={brandingHospital} 
            onClose={() => { setBrandingHospital(null); fetchHospitals(); }}
            onSaveSuccess={async (updatedBranding) => {
              // 1. Immediately update the specific hospital in state so the
              //    card re-renders with the new logo without waiting for fetchHospitals
              if (brandingHospital && updatedBranding) {
                const brandingHospitalId = brandingHospital._id || brandingHospital.id;
                setHospitals(prev => prev.map(h => {
                  const hId = h._id || h.id;
                  if (hId === brandingHospitalId) {
                    return { ...h, branding: updatedBranding };
                  }
                  return h;
                }));
                // 2. Increment the version counter for this hospital.
                //    This forces the Image in CentralAdminHospitalCards to remount
                //    (cache bust) even if the URL string is identical between saves.
                setBrandingVersions(prev => ({
                  ...prev,
                  [brandingHospitalId]: (prev[brandingHospitalId] || 0) + 1,
                }));
              }
              // 3. Also refetch for full consistency
              await fetchHospitals();
              setSuccess('Branding updated successfully!');
            }}
          />
        </Modal>
      )}

      <RevenuePlanEditorModal 
        visible={Boolean(revenuePlanModalData)} 
        hospital={revenuePlanModalData} 
        onClose={() => setRevenuePlanModalData(null)}
        onSave={async (data) => {
          try {
            if (!revenuePlanModalData?._id) return;
            const payload = {
              revenueModel: data.revenueModel || revenuePlanModalData.revenueModel || 'per_patient',
              ratePerPatient: data.ratePerPatient !== undefined ? Number(data.ratePerPatient) : undefined,
              monthlyFee: data.monthlyFee !== undefined ? Number(data.monthlyFee) : undefined,
              ratePerLogin: data.ratePerLogin !== undefined ? Number(data.ratePerLogin) : undefined,
              billingCycle: data.billingCycle || 'monthly',
            };
            await revenueAPI.setHospitalPlan(revenuePlanModalData._id, payload);
            setSuccess(`Revenue plan updated for ${revenuePlanModalData.name}`);
            await fetchRevenuePlans();
          } catch (error) {
            setError(error?.response?.data?.message || 'Failed to update revenue plan');
          } finally {
            setRevenuePlanModalData(null);
          }
        }}
      />
      </SafeAreaView>
    </LinearGradient>
  );
}

