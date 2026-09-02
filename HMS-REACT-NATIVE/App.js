import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

// --- STORES & CONTEXTS ---
import { store } from './src/store/store';
import { BrandingProvider } from './src/context/BrandingContext';
import { AuthProvider } from './src/context/AuthContext';

// --- ROOT NAVIGATOR ---
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <View style={{ flex: 1, width: '100%', height: '100%' }}>
        <ReduxProvider store={store}>
          <BrandingProvider>
            <AuthProvider>
              <SafeAreaProvider>
                <NavigationContainer>
                    <AppNavigator />
                </NavigationContainer>
              </SafeAreaProvider>
            </AuthProvider>
          </BrandingProvider>
        </ReduxProvider>
    </View>
  );
}