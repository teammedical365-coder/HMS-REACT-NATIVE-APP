import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const RebookModal = ({ visible, onClose }) => {
    if (!visible) return null;
    return (
        <View style={styles.overlay}>
            <View style={styles.card}>
                <Text style={styles.title}>Rebook Appointment</Text>
                <TouchableOpacity onPress={onClose} style={styles.btn}>
                    <Text style={{color: 'white'}}>Close</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    card: { backgroundColor: 'white', padding: 20, borderRadius: 12 },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    btn: { backgroundColor: '#3b82f6', padding: 10, borderRadius: 8, alignItems: 'center' }
});

export default RebookModal;
