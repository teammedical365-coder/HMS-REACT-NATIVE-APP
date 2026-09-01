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
    { title: 'Roles & Permissions', sub: 'Create and manage user roles', icon: '🔑', bg: '#eff6ff', color: '#3b82f6', route: 'Roles' },
    { title: 'Question Library', sub: 'Configure assessment forms', icon: '❓', bg: '#f5f3ff', color: '#8b5cf6', route: 'QuestionLibrary' },
    { title: 'Lab Tests', sub: 'Manage lab test catalog', icon: '🧪', bg: '#fdf4ff', color: '#d946ef', route: 'LabTests' },
    { title: 'Test Packages', sub: 'Bundle lab tests into packages', icon: '📦', bg: '#f0fdf4', color: '#22c55e', route: 'TestPackages' },
    { title: 'Medicine Catalog', sub: 'Global medicine library', icon: '💊', bg: '#fff7ed', color: '#ea580c', route: 'Medicines' },
    { title: 'Services', sub: 'Configure hospital services', icon: '🩺', bg: '#ecfeff', color: '#06b6d4', route: 'Services' },
    { title: 'Consent Forms', sub: 'Manage templates for patient consent', icon: '📄', bg: '#f1f5f9', color: '#64748b', route: 'ConsentForms' },
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
      const hospitalResponse = await centralAdminAPI.getHospitals('');
      const hospitalList = Array.isArray(hospitalResponse) ? hospitalResponse : (hospitalResponse?.hospitals || hospitalResponse?.data || []);

      let allHospitals = Array.isArray(hospitalList) ? [...hospitalList] : [];
      try {
        const clinicsData = await simpleClinicAPI.getClinics('');
        const clinicList = Array.isArray(clinicsData) ? clinicsData : (clinicsData?.clinics || clinicsData?.data || []);
        allHospitals = [...allHospitals, ...(Array.isArray(clinicList) ? clinicList : [])];
      } catch (e) {
        // Ignore missing clinics endpoint; not all tenants have a simple clinic collection.
      }

      setHospitals(allHospitals);
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
      {/* ── TOP NAVBAR ── */}
      <View style={styles.navbarContainer} pointerEvents="box-none">
        {/* Left Section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={0.7} pointerEvents="auto">
            <Feather name="menu" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>Superadmin</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563eb', letterSpacing: 0.5 }}>/ MANAGE STAFF</Text>
        </View>

        {/* Middle Search Section */}
        <View style={styles.searchContainer} pointerEvents="box-none">
          <Feather name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients, doctors, MRN..."
            placeholderTextColor="#94a3b8"
            pointerEvents="auto"
          />
        </View>

        {/* Right Section */}
        <View style={styles.rightNavControls} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.notificationWrapper}
            activeOpacity={0.7}
            pointerEvents="auto"
          >
            <View style={styles.notificationBadge} pointerEvents="none" />
            <Feather name="bell" size={22} color="#475569" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.userAvatar}
            activeOpacity={0.7}
            pointerEvents="auto"
          >
            <Text style={styles.userAvatarText}>PH</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.centralAdminContainer, { padding: 20 }]} showsVerticalScrollIndicator={false} pointerEvents="box-none">
        
        {/* Child Component 1: Header and Tabs */}
        <CentralAdminTabs 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onRevenueAnalyticsPress={() => navigation.navigate('SystemRevenueDashboard')}
        />

        {/* Global Notifications */}
        {Boolean(error) ? <Text style={{ color: 'red', marginBottom: 10 }}>⚠️ {error}</Text> : null}
        {Boolean(success) ? <Text style={{ color: 'green', marginBottom: 10 }}>✅ {success}</Text> : null}

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
                  <Text style={{ fontSize: 24 }}>👤</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.revenueCardTitle, { color: '#6366f1' }]}>Model B - Per Patient</Text>
                    <Text style={styles.revenueCardSub}>Charge per new patient registered monthly</Text>
                  </View>
                </View>
                
                <View style={[styles.revenueSummaryCard, { backgroundColor: '#d1fae5' }]}>
                  <Text style={{ fontSize: 24 }}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.revenueCardTitle, { color: '#10b981' }]}>Model A - Fixed Monthly</Text>
                    <Text style={styles.revenueCardSub}>Flat fee every billing cycle</Text>
                  </View>
                </View>
                
                <View style={[styles.revenueSummaryCard, { backgroundColor: '#fef3c7' }]}>
                  <Text style={{ fontSize: 24 }}>🔑</Text>
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
                    <Text style={{ fontSize: 24, marginBottom: 8 }}>ℹ️</Text>
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
            <Text style={styles.configHeader}>⚙️ System Configurations</Text>
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
                    <Text style={{ fontSize: 20 }}>{item.icon}</Text>
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
