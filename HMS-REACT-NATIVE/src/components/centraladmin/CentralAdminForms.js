import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Image, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { styles } from './CentralAdminDashboardStyles';
import DropdownSelect from '../common/DropdownSelect';
import HospitalAdminHUDForm from '../HospitalAdminHUDForm';

export default function CentralAdminForms({
  showHospitalForm,
  showHospitalAdminForm,
  editHospital,
  hospitalForm,
  setHospitalForm,
  handleSaveHospital,
  savingHospital,
  onClose,
  availableDepartments,
  onAddCustomDept,
  onCreateAdmin,
  hospitals = [],
  // Simple Clinic Form Props (1:1 Web Parity)
  showClinicForm,
  editClinic,
  clinicForm = { name: '', slug: '', address: '', city: '', state: '', phone: '', email: '', website: '', defaultFee: 0 },
  setClinicForm,
  handleSaveClinic,
  savingClinic = false,
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const formRowStyle = { flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20 };

  const [deptDropdownOpen, setDeptDropdownOpen] = React.useState(false);
  const [newDeptInput, setNewDeptInput] = React.useState('');
  const [adminForm, setAdminForm] = React.useState({ 
    name: '', email: '', phone: '', password: '', hospitalId: '', file: null, age: '', aadhaarNumber: '' 
  });
  const [adminFormError, setAdminFormError] = React.useState('');

  React.useEffect(() => {
    if (showHospitalAdminForm) {
      setAdminForm({ name: '', email: '', phone: '', password: '', hospitalId: '', file: null, age: '', aadhaarNumber: '' });
      setAdminFormError('');
    }
  }, [showHospitalAdminForm]);

  if (!showHospitalForm && !showHospitalAdminForm && !showClinicForm) {
    return null;
  }

  if (showClinicForm) {
    return (
      <View style={{ width: '100%', marginVertical: 20 }}>
        <View style={[styles.chMainCard, isMobile && { padding: 14, borderRadius: 16 }]}>
          <View style={[styles.chCardHeader, isMobile && { gap: 10 }]}>
            <View style={{
              width: 54, height: 54, backgroundColor: '#fdf2f8',
              borderWidth: 1.5, borderColor: '#fbcfe8', borderRadius: 14,
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 24 }}>🏪</Text>
            </View>
            
            <View style={styles.chTitleCol}>
              <Text style={styles.chTitleText}>
                {editClinic ? 'Edit Starter Clinic' : 'Create Starter Clinic'}
              </Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                {editClinic ? 'Update clinic details and consultation fee' : 'Small clinic managed by 1 doctor. All features included.'}
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={onClose}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
            >
              <Text style={{ fontSize: 16, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 20 }}>
            {/* Row 1: Name and Slug */}
            <View style={formRowStyle}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Clinic Name <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="e.g. City Care Clinic" 
                  value={clinicForm.name}
                  onChangeText={t => setClinicForm(prev => ({ ...prev, name: t }))}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Subdomain Prefix <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="e.g. citycare" 
                  value={clinicForm.slug}
                  onChangeText={t => setClinicForm(prev => ({ ...prev, slug: t.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                />
              </View>
            </View>

            {/* Row 2: City, State, Phone */}
            <View style={formRowStyle}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>City <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="e.g. Mumbai" 
                  value={clinicForm.city} 
                  onChangeText={t => setClinicForm(prev => ({ ...prev, city: t }))} 
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>State <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="e.g. Maharashtra" 
                  value={clinicForm.state} 
                  onChangeText={t => setClinicForm(prev => ({ ...prev, state: t }))} 
                />
              </View>
              <View style={{ flex: 1.2, gap: 6 }}>
                <Text style={styles.chLabel}>Phone <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="10-digit mobile number" 
                  maxLength={10} 
                  keyboardType="phone-pad" 
                  value={clinicForm.phone} 
                  onChangeText={t => setClinicForm(prev => ({ ...prev, phone: t.replace(/\D/g, '') }))} 
                />
              </View>
            </View>

            {/* Row 3: Email and Consultation Fee */}
            <View style={formRowStyle}>
              <View style={{ flex: 1.2, gap: 6 }}>
                <Text style={styles.chLabel}>Email Address <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="clinic@email.com" 
                  keyboardType="email-address" 
                  autoCapitalize="none"
                  value={clinicForm.email} 
                  onChangeText={t => setClinicForm(prev => ({ ...prev, email: t }))} 
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Consultation Fee (₹)</Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="e.g. 300" 
                  keyboardType="numeric" 
                  value={clinicForm.defaultFee !== undefined && clinicForm.defaultFee !== null ? String(clinicForm.defaultFee) : ''} 
                  onChangeText={t => setClinicForm(prev => ({ ...prev, defaultFee: Number(t.replace(/\D/g, '')) }))} 
                />
              </View>
            </View>

            {/* Row 4: Address */}
            <View style={{ gap: 6 }}>
              <Text style={styles.chLabel}>Address <Text style={{ color: '#059669' }}>*</Text></Text>
              <TextInput 
                style={styles.chInput} 
                placeholder="Enter complete clinic address" 
                value={clinicForm.address} 
                onChangeText={t => setClinicForm(prev => ({ ...prev, address: t }))} 
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.chSubmitBtn, { backgroundColor: '#db2777' }]} 
              onPress={handleSaveClinic}
              disabled={savingClinic}
            >
              <Text style={styles.chSubmitBtnText}>
                {savingClinic ? 'Saving...' : editClinic ? '✅ Update Clinic' : '✅ Create Clinic'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (showHospitalAdminForm) {
    const hospitalOptions = (hospitals || []).map(h => ({
      label: `${h.name || 'Unnamed'}${h.city ? ` (${h.city})` : ''}`,
      value: h._id || h.id
    }));

    const pickAvatar = async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'image/*',
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          setAdminForm(prev => ({ ...prev, file: result.assets[0] }));
        }
      } catch (err) {
        console.log('Error picking avatar:', err);
      }
    };

    return (
      <View style={{ width: '100%', marginVertical: 20 }}>
        <View style={styles.chMainCard}>
          <View style={styles.chCardHeader}>
            <View style={{
              width: 54, height: 54, backgroundColor: '#eff6ff',
              borderWidth: 1.5, borderColor: '#bfdbfe', borderRadius: 14,
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 24, color: '#2563eb' }}>👨‍💼</Text>
            </View>
            
            <View style={styles.chTitleCol}>
              <Text style={styles.chTitleText}>Create Hospital Admin</Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                Provision a new administrator account for a hospital
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={onClose}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
            >
              <Text style={{ fontSize: 16, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 20 }}>
            {/* Hospital Selector */}
            <View style={{ gap: 6 }}>
              <Text style={styles.chLabel}>Select Hospital <Text style={{ color: '#059669' }}>*</Text></Text>
              <DropdownSelect 
                options={hospitalOptions}
                value={adminForm.hospitalId}
                onChange={val => {
                  setAdminForm(prev => ({ ...prev, hospitalId: val }));
                  setAdminFormError('');
                }}
                placeholder="-- Select a Hospital --"
                searchable
              />
            </View>

            <View style={formRowStyle}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Admin Name <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="e.g. John Doe" 
                  value={adminForm.name}
                  onChangeText={t => setAdminForm(prev => ({ ...prev, name: t }))}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Phone <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="10-digit mobile number" 
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={adminForm.phone}
                  onChangeText={t => setAdminForm(prev => ({ ...prev, phone: t.replace(/\D/g, '') }))}
                />
              </View>
            </View>

            <View style={formRowStyle}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Email Address <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="admin@hospital.com" 
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={adminForm.email}
                  onChangeText={t => setAdminForm(prev => ({ ...prev, email: t }))}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Temporary Password <Text style={{ color: '#059669' }}>*</Text></Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="Enter secure password" 
                  secureTextEntry
                  value={adminForm.password}
                  onChangeText={t => setAdminForm(prev => ({ ...prev, password: t }))}
                />
              </View>
            </View>

            {/* Age & Aadhaar Row (Web Parity) */}
            <View style={formRowStyle}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.chLabel}>Age</Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="e.g. 35" 
                  keyboardType="numeric"
                  maxLength={3}
                  value={adminForm.age}
                  onChangeText={t => setAdminForm(prev => ({ ...prev, age: t.replace(/\D/g, '') }))}
                />
              </View>
              <View style={{ flex: 1.5, gap: 6 }}>
                <Text style={styles.chLabel}>Aadhaar Number</Text>
                <TextInput 
                  style={styles.chInput} 
                  placeholder="12-digit Aadhaar number" 
                  keyboardType="numeric"
                  maxLength={12}
                  value={adminForm.aadhaarNumber}
                  onChangeText={t => setAdminForm(prev => ({ ...prev, aadhaarNumber: t.replace(/\D/g, '') }))}
                />
              </View>
            </View>

            {/* Profile Photo Picker (Web Parity) */}
            <View style={{ gap: 6 }}>
              <Text style={styles.chLabel}>Admin Profile Photo</Text>
              <TouchableOpacity 
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderWidth: 1.5,
                  borderColor: '#cbd5e1',
                  borderStyle: 'dashed',
                  borderRadius: 10,
                  backgroundColor: '#f8fafc',
                  gap: 12,
                }}
                onPress={pickAvatar}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>📷</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                    {adminForm.file ? adminForm.file.name : 'Click to select profile photo'}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b' }}>
                    {adminForm.file ? 'Photo selected. Will upload automatically.' : 'PNG, JPG, or WEBP up to 5MB'}
                  </Text>
                </View>
                {adminForm.file && (
                  <TouchableOpacity onPress={() => setAdminForm(prev => ({ ...prev, file: null }))}>
                    <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {adminFormError ? (
              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>{adminFormError}</Text>
            ) : null}

            <TouchableOpacity 
              style={[styles.chSubmitBtn, { backgroundColor: '#2563eb' }]} 
              onPress={async () => {
                if (!adminForm.hospitalId) {
                  setAdminFormError('Please select a hospital');
                  return;
                }
                if (!adminForm.name.trim() || !adminForm.email.trim() || !adminForm.password.trim()) {
                  setAdminFormError('Name, email, and password are required');
                  return;
                }
                if (onCreateAdmin) {
                  await onCreateAdmin(adminForm);
                }
              }}
            >
              <Text style={styles.chSubmitBtnText}>Create Admin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // CREATE / EDIT HOSPITAL FORM
  return (
    <View style={{ width: '100%', marginVertical: 20 }}>
      {/* Left Main Form Card */}
      <View style={styles.chMainCard}>
        <View style={styles.chCardHeader}>
          <View style={{
            width: 54, height: 54, backgroundColor: '#ecfdf5',
            borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 14,
            alignItems: 'center', justifyContent: 'center'
          }}>
            <Text style={{ fontSize: 24, color: '#059669' }}>🏥</Text>
          </View>
          
          <View style={styles.chTitleCol}>
            <Text style={styles.chTitleText}>
              {editHospital ? 'Edit Hospital' : 'Create New Hospital'}
            </Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {editHospital ? 'Update hospital details and configurations' : 'Add a new hospital to the system'}
            </Text>
          </View>
          
          <TouchableOpacity 
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
          >
            <Text style={{ fontSize: 16, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 20 }}>
          {/* Row 1 */}
          <View style={formRowStyle}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.chLabel}>Hospital Name <Text style={{ color: '#059669' }}>*</Text></Text>
              <TextInput 
                style={styles.chInput} 
                placeholder="e.g. City General Hospital" 
                value={hospitalForm.name}
                onChangeText={t => setHospitalForm({ ...hospitalForm, name: t })}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.chLabel}>Subdomain Prefix <Text style={{ color: '#059669' }}>*</Text></Text>
              <TextInput 
                style={styles.chInput} 
                placeholder="e.g. citycare" 
                value={hospitalForm.slug}
                onChangeText={t => setHospitalForm({ ...hospitalForm, slug: t.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
            </View>
          </View>

          {/* Row 2: City, State, Phone */}
          <View style={formRowStyle}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.chLabel}>City <Text style={{ color: '#059669' }}>*</Text></Text>
              <TextInput style={styles.chInput} placeholder="e.g. Mumbai" value={hospitalForm.city} onChangeText={t => setHospitalForm({ ...hospitalForm, city: t })} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.chLabel}>State <Text style={{ color: '#059669' }}>*</Text></Text>
              <TextInput style={styles.chInput} placeholder="e.g. Maharashtra" value={hospitalForm.state} onChangeText={t => setHospitalForm({ ...hospitalForm, state: t })} />
            </View>
            <View style={{ flex: 1.2, gap: 6 }}>
              <Text style={styles.chLabel}>Phone <Text style={{ color: '#059669' }}>*</Text></Text>
              <TextInput style={styles.chInput} placeholder="Hospital contact number" maxLength={10} keyboardType="phone-pad" value={hospitalForm.phone} onChangeText={t => setHospitalForm({ ...hospitalForm, phone: t.replace(/\D/g, '') })} />
            </View>
          </View>

          {/* Row 3: Email & Website */}
          <View style={formRowStyle}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.chLabel}>Email <Text style={{ color: '#059669' }}>*</Text></Text>
              <TextInput style={styles.chInput} placeholder="example@gmail.com" keyboardType="email-address" value={hospitalForm.email} onChangeText={t => setHospitalForm({ ...hospitalForm, email: t })} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.chLabel}>Website</Text>
              <TextInput style={styles.chInput} placeholder="e.g. www.cityhospital.com" value={hospitalForm.website} onChangeText={t => setHospitalForm({ ...hospitalForm, website: t })} />
            </View>
          </View>

          {/* Row 4: Address */}
          <View style={{ gap: 6 }}>
            <Text style={styles.chLabel}>Address <Text style={{ color: '#059669' }}>*</Text></Text>
            <TextInput style={styles.chInput} placeholder="Enter complete address" value={hospitalForm.address} onChangeText={t => setHospitalForm({ ...hospitalForm, address: t })} />
          </View>

          {/* Row 5: Departments Selection */}
          <View style={{ gap: 8 }}>
            <Text style={styles.chLabel}>Departments</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(availableDepartments || []).map(dept => {
                const isSelected = (hospitalForm.departments || []).includes(dept);
                return (
                  <TouchableOpacity
                    key={dept}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: isSelected ? '#059669' : '#f1f5f9',
                      borderWidth: 1,
                      borderColor: isSelected ? '#059669' : '#cbd5e1'
                    }}
                    onPress={() => {
                      const cur = hospitalForm.departments || [];
                      const updated = isSelected ? cur.filter(d => d !== dept) : [...cur, dept];
                      setHospitalForm({ ...hospitalForm, departments: updated });
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#ffffff' : '#475569' }}>
                      {dept} {isSelected ? '✓' : '+'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TextInput
                style={[styles.chInput, { flex: 1, height: 38 }]}
                placeholder="Add custom department..."
                value={newDeptInput}
                onChangeText={setNewDeptInput}
              />
              <TouchableOpacity
                style={{ backgroundColor: '#059669', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 }}
                onPress={() => {
                  if (newDeptInput.trim()) {
                    const trimmed = newDeptInput.trim();
                    const cur = hospitalForm.departments || [];
                    if (!cur.includes(trimmed)) {
                      setHospitalForm({ ...hospitalForm, departments: [...cur, trimmed] });
                    }
                    if (onAddCustomDept) onAddCustomDept(trimmed);
                    setNewDeptInput('');
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* White-Label Settings */}
          <View style={{ marginTop: 24, padding: 20, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1e293b' }}>White-Label & Branding Settings</Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Configure custom domains, themes, and logos for this hospital.</Text>
              </View>
              <Switch
                value={hospitalForm.whiteLabelEnabled}
                onValueChange={(val) => setHospitalForm({ ...hospitalForm, whiteLabelEnabled: val })}
                trackColor={{ false: '#cbd5e1', true: '#34d399' }}
                thumbColor={hospitalForm.whiteLabelEnabled ? '#059669' : '#f8fafc'}
              />
            </View>

            {hospitalForm.whiteLabelEnabled && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 16 }}>
                <View style={formRowStyle}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.chLabel}>Custom Domain</Text>
                    <TextInput style={styles.chInput} placeholder="portal.cityhospital.com" value={hospitalForm.customDomain || ''} onChangeText={t => setHospitalForm({ ...hospitalForm, customDomain: t })} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.chLabel}>App Name</Text>
                    <TextInput style={styles.chInput} placeholder="e.g. City Care" value={hospitalForm.brandingSchema?.appName || ''} onChangeText={t => setHospitalForm({ ...hospitalForm, brandingSchema: { ...hospitalForm.brandingSchema, appName: t } })} />
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={styles.chLabel}>Logo URL</Text>
                  <TextInput style={styles.chInput} placeholder="https://example.com/logo.png" value={hospitalForm.brandingSchema?.logoUrl || ''} onChangeText={t => setHospitalForm({ ...hospitalForm, brandingSchema: { ...hospitalForm.brandingSchema, logoUrl: t } })} />
                </View>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.chSubmitBtn} 
            onPress={handleSaveHospital}
            disabled={savingHospital}
          >
            <Text style={styles.chSubmitBtnText}>
              {savingHospital ? 'Saving...' : editHospital ? 'Update Hospital' : 'Create Hospital'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
