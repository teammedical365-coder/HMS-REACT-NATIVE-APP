import React from 'react';
import { View, StyleSheet } from 'react-native';

const Card = ({ children, style, shadow = true }) => {
    return (
        <View style={[styles.card, shadow && styles.shadow, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
});

export default Card;