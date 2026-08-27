import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function WorkspaceLoginScreen({ navigation }) {
    const [workspaceCode, setWorkspaceCode] = useState('');

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Hospital Workspace</Text>
            <Text style={styles.subtitle}>Enter your unique hospital code to continue</Text>

            <TextInput
                style={styles.input}
                placeholder="e.g. CITY_HOSPITAL"
                value={workspaceCode}
                onChangeText={setWorkspaceCode}
                autoCapitalize="characters"
            />

            <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('Login')} // Yeh line aage LoginScreen par bhejegi
            >
                <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f8fafc',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 30,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#3b82f6',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
}); 