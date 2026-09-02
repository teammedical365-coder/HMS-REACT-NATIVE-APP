import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const colors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryLight: '#eff6ff',
  primaryBorder: '#bfdbfe',
  navy: '#0f172a',
  slateDark: '#1e293b',
  slateMuted: '#64748b',
  slateLight: '#94a3b8',
  border: '#e2e8f0',
  borderSubtle: '#edf2f7',
  success: '#16a34a',
  successBg: '#f0fdf4',
  error: '#dc2626',
  errorBg: '#fee2e2',
};

export const signupStyles = StyleSheet.create({
  // Root Layout
  authPage: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },

  // Card Layout
  authCard: {
    width: '100%',
    maxWidth: 1100,
    backgroundColor: colors.surface,
    borderRadius: 24,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 650,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
    borderColor: colors.border,
    borderWidth: 1,
  },

  // Left: Form Container
  authFormContainer: {
    flex: 1.2,
    padding: 40,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  // Right: Visual Container
  authVisual: {
    flex: 1,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    display: width < 900 ? 'none' : 'flex',
  },
  authContent: {
    maxWidth: 380,
    zIndex: 2,
  },

  // Back Button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  backButtonIcon: {
    fontSize: 16,
    marginRight: 6,
    color: colors.slateMuted,
    fontWeight: '700',
  },
  backButtonText: {
    color: colors.slateMuted,
    fontSize: 14,
    fontWeight: '600',
  },

  // Header
  authHeader: {
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.slateMuted,
    lineHeight: 20,
  },

  // Error Message
  errorMessage: {
    backgroundColor: colors.errorBg,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Form Container
  authForm: {
    width: '100%',
  },

  // Form Group
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slateDark,
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  // Input Wrapper
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  // Input
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.navy,
    fontWeight: '500',
    paddingVertical: 12,
  },
  passwordInputCustom: {
    flex: 1,
    fontSize: 14,
    color: colors.navy,
    fontWeight: '500',
    paddingVertical: 12,
  },

  // Buttons
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  btnBlock: {
    width: '100%',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Footer/Switch
  authFooter: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    color: colors.slateMuted,
    fontWeight: '500',
  },
  switchLink: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Visual Branding (Right Side)
  visualTitle: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 15,
    lineHeight: 48,
  },
  visualSubtitle: {
    color: '#ccfbf1',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});
