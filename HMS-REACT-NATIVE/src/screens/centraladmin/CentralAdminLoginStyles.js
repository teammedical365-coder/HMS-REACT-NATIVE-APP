import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

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
  warning: '#d97706',
  warningBg: '#fef3c7',
};

export const loginStyles = StyleSheet.create({
  // Root Layout
  safeArea: {
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
  card: {
    width: '100%',
    maxWidth: 1000,
    backgroundColor: colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 600,
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

  // Left Column: Form
  leftColumn: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    minHeight: 600,
  },

  // Right Column: Visual/Branding
  rightColumn: {
    flex: 0.85,
    backgroundColor: '#06b6d4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    display: width < 900 ? 'none' : 'flex',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  rightContent: {
    maxWidth: 300,
    zIndex: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rightTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
    lineHeight: 48,
  },
  rightSubtitle: {
    fontSize: 16,
    color: '#ccfbf1',
    lineHeight: 24,
    fontWeight: '500',
  },

  // Back Button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  backButtonText: {
    color: colors.slateMuted,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Form Container
  formContainer: {
    width: '100%',
  },

  // Logo
  logo: {
    height: 40,
    width: 120,
    marginBottom: 28,
  },

  // Session Banner
  sessionBanner: {
    backgroundColor: colors.warningBg,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  sessionBannerText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Title & Subtitle
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.slateMuted,
    marginBottom: 24,
    lineHeight: 20,
  },

  // Error Banner
  errorBanner: {
    backgroundColor: colors.errorBg,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Form Group
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slateDark,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
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
    backgroundColor: '#f0f9ff',
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.navy,
    fontWeight: '500',
  },
  passwordInputCustom: {
    flex: 1,
    fontSize: 14,
    color: colors.navy,
    fontWeight: '500',
  },

  // OTP Input
  otpInput: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 18,
    letterSpacing: 5,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.navy,
  },
  otpInputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  // Submit Button
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  submitBtnLoading: {
    opacity: 0.8,
  },

  // Verify OTP Button (Green)
  verifyBtn: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  verifyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Back to Login Button
  backToLoginBtn: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backToLoginText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Footer
  footer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slateLight,
    letterSpacing: 1,
  },

  // OTP Screen Styles
  otpScreenContainer: {
    width: '100%',
  },
  otpTitle: {
    marginBottom: 10,
    fontWeight: '700',
    color: colors.navy,
    fontSize: 18,
  },
  otpSubtitle: {
    marginBottom: 20,
    color: colors.slateMuted,
    fontSize: 14,
    lineHeight: 20,
  },

  // Loading/Disabled States
  disabled: {
    opacity: 0.6,
  },
});
