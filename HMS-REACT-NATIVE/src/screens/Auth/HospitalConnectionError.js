import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useBranding } from '../../context/BrandingContext';
import { getNativeApplicationId } from '../../utils/subdomain';

const HospitalConnectionError = () => {
  const { retryResolution, resolutionError, loading } = useBranding();
  const [retrying, setRetrying] = useState(false);
  const nativeAppId = getNativeApplicationId();

  const handleRetry = async () => {
    setRetrying(true);
    try {
      if (typeof retryResolution === 'function') {
        await retryResolution();
      }
    } catch (_) {
      // Error is caught and surfaced via BrandingContext resolutionError
    } finally {
      setRetrying(false);
    }
  };

  const isBusy = loading || retrying;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>

        <Text style={styles.title}>Hospital Connection Error</Text>

        <Text style={styles.message}>
          Unable to establish a secure connection to your hospital workspace.
          Please check your network connection and try again.
        </Text>

        {resolutionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorDetails} numberOfLines={3}>
              {String(resolutionError)}
            </Text>
          </View>
        ) : null}

        {nativeAppId ? (
          <View style={styles.packageBadge}>
            <Text style={styles.packageText}>Package: {nativeAppId}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.retryButton, isBusy && styles.retryButtonDisabled]}
          onPress={handleRetry}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {isBusy ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          This device is configured for dedicated hospital operations.
          Central platform fallback is disabled for security.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorDetails: {
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 16,
  },
  packageBadge: {
    backgroundColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 24,
  },
  packageText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#64748b',
  },
  retryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#0d9488',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 11,
    lineHeight: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default HospitalConnectionError;
