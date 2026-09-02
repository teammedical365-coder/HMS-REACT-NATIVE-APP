import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';

const Input = ({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    keyboardType = 'default',
    error,
    editable = true,
    multiline = false,
    numberOfLines = 1,
    style,
}) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View
                style={[
                    styles.inputContainer,
                    error && styles.inputContainerError,
                    multiline && styles.multilineContainer,
                ]}
            >
                <TextInput
                    style={[
                        styles.input,
                        multiline && styles.multilineInput,
                        style,
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#cbd5e1"
                    secureTextEntry={secureTextEntry && !showPassword}
                    keyboardType={keyboardType}
                    editable={editable}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                />
                {secureTextEntry && (
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Text style={styles.togglePassword}>
                            {showPassword ? 'Hide' : 'Show'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 16 },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        paddingRight: 12,
    },
    inputContainerError: { borderColor: '#ef4444' },
    multilineContainer: { alignItems: 'flex-start' },
    input: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1e293b',
    },
    multilineInput: { minHeight: 80, paddingTop: 10 },
    togglePassword: { fontSize: 13, color: '#14b8a6', fontWeight: '600' },
    error: { fontSize: 12, color: '#ef4444', marginTop: 6 },
});

export default Input;