import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

const Button = ({
    onPress,
    title,
    loading = false,
    disabled = false,
    variant = 'primary',
    size = 'md',
    style,
    textStyle,
}) => {
    const variants = {
        primary: { backgroundColor: '#14b8a6' },
        secondary: { backgroundColor: '#0a2647' },
        danger: { backgroundColor: '#ef4444' },
        ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#14b8a6' },
    };

    const sizes = {
        sm: { paddingVertical: 8, paddingHorizontal: 12 },
        md: { paddingVertical: 12, paddingHorizontal: 16 },
        lg: { paddingVertical: 16, paddingHorizontal: 20 },
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                variants[variant],
                sizes[size],
                (disabled || loading) && styles.disabled,
                style,
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'ghost' ? '#14b8a6' : '#ffffff'} />
            ) : (
                <Text
                    style={[styles.text, variant === 'ghost' && styles.ghostText, textStyle]}
                >
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    ghostText: {
        color: '#14b8a6',
    },
    disabled: {
        opacity: 0.5,
    },
});

export default Button;