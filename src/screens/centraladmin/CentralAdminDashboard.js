import React, { useState, useEffect } from 'react';
import { View, ScrollView, SafeAreaView, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

// Import the Styles and Child Components
import { styles } from '../../components/centraladmin/CentralAdminDashboardStyles';
import CentralAdminTabs from '../../components/centraladmin/CentralAdminTabs';
import CentralAdminPricingCards from '../../components/centraladmin/CentralAdminPricingCards';
import CentralAdminHospitalList from '../../components/centraladmin/CentralAdminHospitalList';
import CentralAdminForms from '../../components/centraladmin/CentralAdminForms';

export default function CentralAdminDashboard() {
  const navigation = useNavigation();
  const route = useRoute();

  // State Management
  const [activeTab, setActiveTab] = useState('hospitals');
  const [loading, setLoading] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  useEffect(() => {
    // Check for openTab from navigation state only when it changes
    if (route.params?.openTab) {
      setActiveTab(route.params.openTab);
      navigation.setParams({ openTab: undefined });
    }
  }, [route.params?.openTab, navigation]);

  useEffect(() => {
    // Fetch hospitals based on active plan (dummy fetch for now)
    fetchHospitals(activeTab);
  }, [activeTab]);

  const fetchHospitals = async (tab) => {
    setLoading(true);
    // Dummy delay simulating API call
    setTimeout(() => {
      // Dummy data representing hospitals
      if (tab === 'hospitals') {
        setHospitals([
          { _id: '1', name: 'Apollo Main Branch', city: 'Mumbai', state: 'MH', phone: '9876543210', email: 'contact@apollo.com', slug: 'apollo' },
          { _id: '2', name: 'Max Super Speciality', city: 'Delhi', state: 'DL', phone: '9876543211', email: 'hello@max.com', slug: 'max', customDomain: 'portal.max.com' }
        ]);
      } else {
        setHospitals([]);
      }
      setLoading(false);
    }, 500);
  };

  const handleSaveHospital = () => {
    setSavingHospital(true);
    setTimeout(() => {
      setSuccess('Hospital saved successfully');
      setSavingHospital(false);
      setShowHospitalForm(false);
      setEditHospital(null);
      fetchHospitals(activeTab);
    }, 1000);
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
      <ScrollView contentContainerStyle={styles.centralAdminContainer} showsVerticalScrollIndicator={false}>
        
        {/* Child Component 1: Header and Tabs */}
        <CentralAdminTabs 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onRevenueAnalyticsPress={() => navigation.navigate('SystemRevenueDashboard')}
        />

        {/* Global Notifications */}
        {error ? <Text style={{ color: 'red', marginBottom: 10 }}>⚠️ {error}</Text> : null}
        {success ? <Text style={{ color: 'green', marginBottom: 10 }}>✅ {success}</Text> : null}

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
        />

        {/* Child Component 4: Hospital List Grid */}
        <CentralAdminHospitalList 
          loading={loading}
          hospitals={hospitals}
          activeTab={activeTab}
          showHospitalForm={showHospitalForm}
          showHospitalAdminForm={showHospitalAdminForm}
          editHospital={editHospital}
          onSelectHospital={(h) => console.log('Selected:', h.name)}
          onEditHospital={(h) => {
            setEditHospital(h);
            setHospitalForm({ ...hospitalForm, name: h.name, city: h.city, slug: h.slug });
            setShowHospitalForm(true);
          }}
          onDeleteHospital={(id) => console.log('Delete:', id)}
          onBrandingHospital={(h) => console.log('Branding:', h.name)}
        />

      </ScrollView>
    </SafeAreaView>
  );
}
