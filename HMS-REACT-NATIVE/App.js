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
import { installWebResourceGuard } from './src/utils/resourceSecurity';

// Immediate web guard activation to prevent cross-origin blob requests
installWebResourceGuard();

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'hms-web-custom-scrollbars';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          /* Input outline reset */
          input:focus, textarea:focus, select:focus {
            outline: none !important;
            outline-style: none !important;
          }
          *:focus-visible {
            outline: none !important;
          }

          /* Global & Page Web Scrollbar (Exact Web Match from CentralAdminDashboard.css lines 6203-6238) */
          * {
            scrollbar-width: thin;
            scrollbar-color: #94a3b8 #f1f5f9;
          }

          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 12px;
            margin: 2px 0;
          }

          ::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 12px;
            border: 2px solid #f1f5f9;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }

          /* Table Horizontal Scrollbar (Exact Web Match from .h-detail-staff-table-wrap lines 5533-5550) */
          [data-scrollbar="table"]::-webkit-scrollbar,
          .table-scroll-view::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }

          [data-scrollbar="table"]::-webkit-scrollbar-track,
          .table-scroll-view::-webkit-scrollbar-track {
            background: #f8fafc;
            border-radius: 4px;
          }

          [data-scrollbar="table"]::-webkit-scrollbar-thumb,
          .table-scroll-view::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }

          [data-scrollbar="table"]::-webkit-scrollbar-thumb:hover,
          .table-scroll-view::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }

          html, body {
            scroll-behavior: smooth;
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