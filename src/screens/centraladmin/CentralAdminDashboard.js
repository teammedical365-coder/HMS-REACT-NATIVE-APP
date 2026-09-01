import React, { useState, useEffect } from 'react';
import { View, ScrollView, SafeAreaView, Text, Alert, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { styles } from '../../components/centraladmin/CentralAdminDashboardStyles';
import CentralAdminTabs from '../../components/centraladmin/CentralAdminTabs';
import CentralAdminPricingCards from '../../components/centraladmin/CentralAdminPricingCards';
import CentralAdminHospitalCards from '../../components/centraladmin/CentralAdminHospitalCards';
import CentralAdminForms from '../../components/centraladmin/CentralAdminForms';
import HospitalBrandingEditor from '../../components/HospitalBrandingEditor';
import RevenuePlanEditorModal from '../../components/centraladmin/RevenuePlanEditorModal';
import { hospitalAPI, simpleClinicAPI, revenueAPI, centralAdminAPI, hospitalAdminAPI } from '../../utils/api';

export default function CentralAdminDashboard() {
  const navigation = useNavigation(); 
  const route = useRoute();

  // State Management
  const [activeTab, setActiveTab] = useState('hospitals');
  const [loading, setLoading] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revenueData, setRevenueData] = useState(null);
  
  const [brandingHospital, setBrandingHospital] = useState(null);
  const [revenuePlanModalData, setRevenuePlanModalData] = useState(null);

  // Form states
  const [showHospitalForm, setShowHospitalForm] = useState(false);
  const [showHospitalAdminForm, setShowHospitalAdminForm] = useState(false);
  const [editHospital, setEditHospital] = useState(null);
  const [savingHospital, setSavingHospital] = useState(false);
  
  const [hospitalForm, setHospitalForm] = useState({ 
    name: '', slug: '', customDomain: '', address: '', city: '', state: '', 
    phone: '', email: '', website: '', departments: [], whiteLabelEnabled: false, 
    brandingSchema: { appName: '', logoUrl: '', customDomain: '', themeColors: { primary: '#14b8a6', secondary: '#0a2647', background: '#ffffff' } } 
  });

  // Derived state or dummy data for available departments
  const availableDepartments = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Surgery'];

  const configurationItems = [
    { title: 'Roles & Permissions', sub: 'Create and manage user roles', icon: <Feather name="key" size={20} color="#3b82f6" />, bg: '#eff6ff', color: '#3b82f6', route: 'AdminRoles' },
    { title: 'Question Library', sub: 'Configure assessment forms', icon: <Feather name="help-circle" size={20} color="#8b5cf6" />, bg: '#f5f3ff', color: '#8b5cf6', route: 'AdminQuestionLibrary' },
    { title: 'Lab Tests', sub: 'Manage lab test catalog', icon: <Feather name="activity" size={20} color="#d946ef" />, bg: '#fdf4ff', color: '#d946ef', route: 'LabTests' },
    { title: 'Test Packages', sub: 'Bundle lab tests into packages', icon: <Feather name="package" size={20} color="#22c55e" />, bg: '#f0fdf4', color: '#22c55e', route: 'TestPackages' },
    { title: 'Medicine Catalog', sub: 'Global medicine library', icon: <Feather name="heart" size={20} color="#ea580c" />, bg: '#fff7ed', color: '#ea580c', route: 'Medicines' },
    { title: 'Services', sub: 'Configure hospital services', icon: <Feather name="grid" size={20} color="#06b6d4" />, bg: '#ecfeff', color: '#06b6d4', route: 'Services' },
    { title: 'Consent Forms', sub: 'Manage templates for patient consent', icon: <Feather name="file-text" size={20} color="#64748b" />, bg: '#f1f5f9', color: '#64748b', route: 'ConsentManagement' },
  ];

  useEffect(() => {
    // Check for openTab from navigation state only when it changes
    if (route.params?.openTab) {
      setActiveTab(route.params.openTab);
      navigation.setParams({ openTab: undefined });
    }
  }, [route.params?.openTab, navigation]);

  useEffect(() => {
    fetchHospitals();
  }, []);

  useEffect(() => {
    if (activeTab === 'revenue-plans') {
      fetchRevenuePlans();
    }
  }, [activeTab]);

  const fetchRevenuePlans = async () => {
    setLoading(true);
    try {
      const response = await centralAdminAPI.getHospitalsRevenue();
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
      const hospitalsRes = await centralAdminAPI.getHospitals('');
      let clinicsRes = { data: [] };
      try {
        clinicsRes = await simpleClinicAPI.getClinics('');
      } catch (e) {
        console.log('Failed to fetch clinics:', e);
      }

      // Handle the fact that Axios might have already unpacked .data via interceptors
      const hospData = hospitalsRes?.data !== undefined ? hospitalsRes.data : hospitalsRes;
      const clinData = clinicsRes?.data !== undefined ? clinicsRes.data : clinicsRes;

      console.log('Raw Hospitals API Response:', hospData);
      console.log('Raw Clinics API Response:', clinData);

      const rawHospitals = Array.isArray(hospData)
        ? hospData
        : (hospData?.hospitals || hospData?.data || []);

      const rawClinics = Array.isArray(clinData)
        ? clinData
        : (clinData?.clinics || clinData?.simpleClinics || clinData?.data || []);

      const normalizedHospitals = rawHospitals.map(item => ({
        ...item,
        isSimpleClinic: false,
        plan: (item.plan || item.planName || item.subscriptionPlan || 'enterprise').toLowerCase().replace(/[\s-]/g, '_')
      }));

      const normalizedClinics = rawClinics.map(item => ({
        ...item,
        isSimpleClinic: true,
        name: item.name || item.clinicName || item.hospitalName || 'Clinic',
        plan: (item.plan || item.planName || item.subscriptionPlan || 'clinic_basic').toLowerCase().replace(/[\s-]/g, '_')
      }));

      const unifiedList = [...normalizedHospitals, ...normalizedClinics];
      console.log('Fetched raw hospitals & clinics total count:', unifiedList.length, unifiedList);
      setHospitals(unifiedList);
    } catch (err) {
      // Safe error handling: 404 or network errors default to empty array
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

  const handleSaveHospital = async () => {
    setSavingHospital(true);
    try {
      const payload = {
        ...hospitalForm,
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

  const handleCreateHospitalAdmin = async (adminValues) => {
    try {
      const payload = {
        ...adminValues,
        hospitalId: adminValues.hospitalId || '',
        age: adminValues.age || '',
        aadhaarNumber: adminValues.aadhaarNumber || '',
      };
      await hospitalAdminAPI.createHospitalAdmin(payload);
      setSuccess('Hospital admin created successfully');
      await fetchHospitals();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create hospital admin');
    }
  };

  const toggleAdminForm = () => {
    setShowHospitalAdminForm(!showHospitalAdminForm);
    setShowHospitalForm(false);
    setEditHospital(null);
  };

  const toggleHospitalForm = () => {
    setShowHospitalForm(!showHospitalForm);
    setShowHospitalAdminForm(false);
    setEditHospital(null);
    if (!showHospitalForm) {
      // reset form
      setHospitalForm({ 
        name: '', slug: '', customDomain: '', address: '', city: '', state: '', 
        phone: '', email: '', website: '', departments: [], whiteLabelEnabled: false, 
        brandingSchema: { appName: '', logoUrl: '', customDomain: '', themeColors: { primary: '#14b8a6', secondary: '#0a2647', background: '#ffffff' } } 
      });
    }
  };

  return (
    <SafeAreaView style={styles.centralAdminPage}>


      <ScrollView contentContainerStyle={[styles.centralAdminContainer, { padding: 20 }]} showsVerticalScrollIndicator={false} pointerEvents="box-none">
        
        {/* Child Component 1: Header and Tabs */}
        <CentralAdminTabs 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onRevenueAnalyticsPress={() => navigation.navigate('SystemRevenueDashboard')}
        />

        {/* Global Notifications */}
        {Boolean(error) ? <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}><Feather name="alert-triangle" size={16} color="red"/><Text style={{ color: 'red', marginLeft: 6 }}>{error}</Text></View> : null}
        {Boolean(success) ? <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}><Feather name="check-circle" size={16} color="green"/><Text style={{ color: 'green', marginLeft: 6 }}>{success}</Text></View> : null}

        {/* Child Component 2: Pricing Cards & Operational Provisions */}
        <CentralAdminPricingCards 
          activeTab={activeTab}
          showHospitalForm={showHospitalForm}
          showHospitalAdminForm={showHospitalAdminForm}
          editHospital={editHospital}
          onToggleAdminForm={toggleAdminForm}
          onToggleHospitalForm={toggleHospitalForm}
        />

        {/* Child Component 3: Forms for Hospital & Admin creation */}
        <CentralAdminForms 
          showHospitalForm={showHospitalForm}
          showHospitalAdminForm={showHospitalAdminForm}
          editHospital={editHospital}
          hospitalForm={hospitalForm}
          setHospitalForm={setHospitalForm}
          handleSaveHospital={handleSaveHospital}
          savingHospital={savingHospital}
          onClose={() => { setShowHospitalForm(false); setShowHospitalAdminForm(false); setEditHospital(null); }}
          availableDepartments={availableDepartments}
          onCreateAdmin={handleCreateHospitalAdmin}
        />

        {/* Child Component 4: Hospital List Grid */}
        {(activeTab !== 'revenue-plans' && activeTab !== 'configurations') && (
          <CentralAdminHospitalCards 
            loading={loading}
            hospitals={hospitals}
            activeTab={activeTab}
            showHospitalForm={showHospitalForm}
            showHospitalAdminForm={showHospitalAdminForm}
            editHospital={editHospital}
            onSelectHospital={(h) => {
              if (h?._id) {
                navigation.navigate('HospitalAdminStack', { hospitalId: h._id, hospital: h });
              }
            }}
            onEditHospital={(h) => {
              setEditHospital(h);
              setHospitalForm({ ...hospitalForm, name: h.name, city: h.city, slug: h.slug });
              setShowHospitalForm(true);
            }}
            onDeleteHospital={async (id) => {
              Alert.alert(
                'Delete Clinic',
                'Are you sure you want to delete this clinic? This action cannot be undone.',
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
            onBrandingHospital={(h) => setBrandingHospital(h)}
          />
        )}

        {/* Revenue Plans View */}
        {activeTab === 'revenue-plans' && (
          <View style={{ width: '100%', marginTop: 20 }}>
            {/* Top Summary Cards */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
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
            <View style={styles.tableContainer}>
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
                  onPress={() => console.log(`Navigating to ${item.route}`)}
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

      </ScrollView>

      {/* Modals */}
      {Boolean(brandingHospital) && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setBrandingHospital(null)}>
          <HospitalBrandingEditor hospital={brandingHospital} onClose={() => setBrandingHospital(null)} />
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
            await centralAdminAPI.updateHospitalPlan(revenuePlanModalData._id, payload);
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
  );
}
