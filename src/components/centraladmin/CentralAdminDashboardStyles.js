import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const colors = {
  bg: '#f0fdf9',
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
};

export const styles = StyleSheet.create({
  // .centraladmin-page
  centralAdminPage: {
    flex: 1,
    backgroundColor: '#f0fdf9', // Simplified gradient: #f0fdf9 -> #e0f2fe -> #fdf2f8
    padding: 20,
    paddingBottom: 60,
  },
  // .centraladmin-container
  centralAdminContainer: {
    width: '100%',
  },
  // .cad-header-row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    flexWrap: 'wrap',
  },
  // .cad-title-group
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  // .cad-title-icon-box
  titleIconBox: {
    width: 48,
    height: 48,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#0284c7', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  // .cad-title-text-col
  titleTextCol: {
    flexDirection: 'column',
    gap: 2,
  },
  // .cad-main-title
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0284c7', // Simplified gradient text
    letterSpacing: -0.5,
  },
  // .cad-main-subtitle
  mainSubtitle: {
    fontSize: 14,
    color: colors.slateMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  // .cad-revenue-analytics-btn
  revenueAnalyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 14 },
      android: { elevation: 4 },
    }),
  },
  // .cad-revenue-analytics-btn text
  revenueAnalyticsBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  // .cad-tabs-nav-container
  tabsNavContainer: {
    width: '100%',
    marginBottom: 22,
  },
  // .cad-tabs-scroll-wrapper
  tabsScrollWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 6,
    paddingTop: 2,
  },
  // .cad-tab-pill
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    ...Platform.select({
      ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  // .cad-tab-pill text
  tabPillText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  // .cad-tab-pill.active
  tabPillActiveGreen: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  tabPillTextActiveGreen: {
    color: '#059669',
    fontWeight: '800',
  },
  // .cad-tab-pill.tab-theme-blue.active
  tabPillActiveBlue: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  tabPillTextActiveBlue: {
    color: '#0284c7',
    fontWeight: '800',
  },
  // .cad-featured-plan-section
  featuredPlanSection: {
    marginBottom: 24,
  },
  // .cad-plan-header-row
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 20,
  },
  // .cad-plan-title-col
  planTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  // .cad-plan-badge-icon
  planBadgeIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // .cad-plan-section-title
  planSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
  },
  // .cad-plan-section-sub
  planSectionSub: {
    fontSize: 13.5,
    color: colors.slateMuted,
    marginTop: 2,
  },
  // .cad-plan-actions-row
  planActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  // .cad-btn-secondary
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
  },
  btnSecondaryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  // .cad-btn-primary
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  // .cad-plan-cards-grid
  planCardsGrid: {
    flexDirection: width > 1024 ? 'row' : 'column',
    gap: 20,
    marginBottom: 24,
  },
  // .cad-plan-info-card
  planInfoCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0e1f9',
    borderRadius: 18,
    padding: 24,
    flexDirection: 'column',
  },
  // .cad-info-card-header
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  // .cad-info-plan-name
  infoPlanName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
  },
  // .cad-info-plan-price
  infoPlanPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  // .cad-info-provision-heading
  infoProvisionHeading: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  // .cad-info-features-grid
  infoFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoFeatureItemCol: {
    width: '48%',
  },
  // .cad-feature-item
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  featureItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  // .cad-addon-card
  addonCard: {
    flex: 1.25,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0e1f9',
    borderRadius: 18,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  // .cad-addon-content-col
  addonContentCol: {
    flex: 1,
    flexDirection: 'column',
  },
  // .cad-addon-tag
  addonTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  addonTagText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.primary,
  },
  // .cad-hospitals-grid
  hospitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 16,
  },
  // .cad-hospital-card
  hospitalCard: {
    width: width > 768 ? '48%' : '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#dbeafe',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  // .cad-hospital-card-header
  hospitalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  // .cad-hospital-logo-box
  hospitalLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // .cad-hospital-info
  hospitalInfo: {
    flex: 1,
  },
  // .cad-hospital-name
  hospitalName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
  },
  // .cad-hospital-tagline
  hospitalTagline: {
    fontSize: 12,
    color: colors.slateLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  // .cad-hospital-card-footer
  hospitalCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    flexDirection: 'column',
    gap: 10,
  },
  // .cad-hospital-btn-group
  hospitalBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // .cad-btn-sm-branding
  loginAsBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  loginAsBtnText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700',
  },
  btnSmBranding: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  btnSmBrandingText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  // .cad-btn-sm-edit
  btnSmEdit: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  btnSmEditText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  // .cad-empty-banner
  emptyBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  emptyBannerText: {
    color: '#1e40af',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // .cad-ch-main-card
  chMainCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
  },
  // .cad-ch-card-header
  chCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  // .cad-ch-title-col
  chTitleCol: {
    flex: 1,
  },
  chTitleText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
  },
  // .cad-ch-input
  chInput: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  // .cad-ch-label
  chLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  // .cad-ch-submit-btn
  chSubmitBtn: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#059669',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  chSubmitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  }
});
