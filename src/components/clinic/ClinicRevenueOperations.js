import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

const ClinicRevenueOperations = () => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .clinic-card */}
            <View style={styles.clinicCard}>
                {/* Translating web class: .clinic-card h3 */}
                <Text style={styles.clinicCardH3}>Revenue & Operations</Text>
                
                {/* Translating web class: .clinic-form-grid */}
                <View style={styles.clinicFormGrid}>
                    
                    {/* Operations / Quick Actions */}
                    <View style={styles.formColumn}>
                        {/* Translating web class: .clinic-form-group */}
                        <View style={styles.clinicFormGroup}>
                            <Text style={styles.formGroupLabel}>Generate Invoice</Text>
                            {/* Translating web class: .clinic-input */}
                            <TextInput 
                                style={styles.clinicInput} 
                                placeholder="Patient MRN or Name" 
                                placeholderTextColor="#94a3b8" 
                            />
                        </View>
                        
                        <View style={styles.clinicFormGroup}>
                            <Text style={styles.formGroupLabel}>Amount (₹)</Text>
                            <TextInput 
                                style={styles.clinicInput} 
                                placeholder="0.00" 
                                keyboardType="numeric"
                                placeholderTextColor="#94a3b8" 
                            />
                        </View>
                        
                        {/* Translating web class: .clinic-btn-primary */}
                        <TouchableOpacity style={styles.clinicBtnPrimary}>
                            <Text style={styles.clinicBtnPrimaryText}>Create Bill</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Quick Reports */}
                    <View style={styles.formColumn}>
                        <View style={styles.clinicFormGroup}>
                            <Text style={styles.formGroupLabel}>Quick Reports</Text>
                            {/* Translating web class: .clinic-btn-secondary */}
                            <TouchableOpacity style={styles.clinicBtnSecondary}>
                                <Text style={styles.clinicBtnSecondaryText}>Download Daily Summary</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.clinicBtnSecondary, { marginTop: 10 }]}>
                                <Text style={styles.clinicBtnSecondaryText}>View Collections</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 16 },

    // Translating web class: .clinic-card
    clinicCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 24,
        marginBottom: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    // Translating web class: .clinic-card h3
    clinicCardH3: {
        fontSize: 16, // 1rem
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 20
    },

    // Translating web class: .clinic-form-grid
    clinicFormGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24
    },
    formColumn: {
        flex: 1,
        minWidth: 250,
        gap: 16
    },

    // Translating web class: .clinic-form-group
    clinicFormGroup: {
        flexDirection: 'column',
        gap: 5
    },
    // Translating web class: .clinic-form-group label
    formGroupLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.04
    },

    // Translating web class: .clinic-input
    clinicInput: {
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        fontSize: 15,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        width: '100%'
    },

    // Translating web class: .clinic-btn-primary
    clinicBtnPrimary: {
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 8,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8
    },
    clinicBtnPrimaryText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14
    },

    // Translating web class: .clinic-btn-secondary
    clinicBtnSecondary: {
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    clinicBtnSecondaryText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 14
    }
});

export default ClinicRevenueOperations;
