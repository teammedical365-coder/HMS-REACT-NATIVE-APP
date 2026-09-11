import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
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
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'rn-web-input-focus-reset';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          input:focus, textarea:focus, select:focus {
            outline: none !important;
            outline-style: none !important;
          }
          *:focus-visible {
            outline: none !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

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