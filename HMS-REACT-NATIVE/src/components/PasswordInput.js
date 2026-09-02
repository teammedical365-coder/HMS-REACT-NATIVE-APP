import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons'; // Assuming Expo or vector icons is available

const PasswordInput = ({ style, ...props }) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <View style={[styles.container, style]}>
            <TextInput
                {...props}
                style={styles.input}
                secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
                style={styles.iconContainer} 
                onPress={() => setShowPassword(!showPassword)}
            >
                <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#94a3b8" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        backgroundColor: 'white',
    },
    input: {
        flex: 1,
        padding: 12,
        paddingRight: 40,
        fontSize: 16,
    },
    iconContainer: {
        position: 'absolute',
        right: 12,
        height: '100%',
        justifyContent: 'center',
    }
});

export default PasswordInput;
