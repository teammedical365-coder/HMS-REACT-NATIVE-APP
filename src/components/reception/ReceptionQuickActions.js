import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

const ReceptionQuickActions = () => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .search-section */}
            <View style={styles.searchSection}>
                {/* Translating web class: .search-section input[type="text"] */}
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search patients by MRN, Name, or Phone..."
                    placeholderTextColor="#6b7280"
                />
            </View>

            {/* Translating web class: .availability-widget */}
            <View style={styles.availabilityWidget}>
                <Text style={styles.availabilityWidgetH3}>Quick Registration & Billing</Text>
                
                {/* Translating web class: .widget-controls */}
                <View style={styles.widgetControls}>
                    {/* Translating web class: .widget-controls input */}
                    <TextInput 
                        style={styles.widgetInput}
                        placeholder="Patient Name"
                        placeholderTextColor="#6b7280"
                    />
                    <TextInput 
                        style={styles.widgetInput}
                        placeholder="Phone Number"
                        keyboardType="phone-pad"
                        placeholderTextColor="#6b7280"
                    />
                    
                    {/* Translating web class: .reception-dashboard .btn-save */}
                    <TouchableOpacity style={styles.btnSave}>
                        <Text style={styles.btnSaveText}>Register Patient</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 20 },

    // Translating web class: .search-section
    searchSection: {
        backgroundColor: '#ffffff', // var(--surface-0)
        borderRadius: 16, // var(--radius-lg)
        borderWidth: 1,
        borderColor: '#e5e7eb', // var(--gray-200)
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        padding: 20,
        marginBottom: 20
    },
    searchInput: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 18,
        paddingLeft: 46, // Space for a search icon (if added later)
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        borderRadius: 12, // var(--radius-md)
        fontSize: 14.4, // 0.9rem
        backgroundColor: '#f9fafb', // var(--surface-1)
        color: '#1f2937' // var(--gray-800)
    },

    // Translating web class: .availability-widget
    availabilityWidget: {
        backgroundColor: '#ffffff', // var(--surface-0)
        paddingVertical: 22,
        paddingHorizontal: 24,
        borderRadius: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderLeftWidth: 4,
        borderLeftColor: '#14b8a6' // var(--brand-500)
    },
    availabilityWidgetH3: {
        fontSize: 16, // 1rem
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 16
    },

    // Translating web class: .widget-controls
    widgetControls: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    widgetInput: {
        flex: 1,
        minWidth: 120,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        fontSize: 14, // 0.875rem
        color: '#1f2937',
        backgroundColor: '#ffffff'
    },

    // Translating web class: .reception-dashboard .btn-save
    btnSave: {
        backgroundColor: '#14b8a6', // mapping var(--gradient-brand) fallback
        paddingVertical: 11,
        paddingHorizontal: 24,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#14b8a6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnSaveText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14
    }
});

export default ReceptionQuickActions;
