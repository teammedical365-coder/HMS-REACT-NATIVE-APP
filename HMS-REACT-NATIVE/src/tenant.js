// White-label tenant configuration
// Driven by build-time environment variables or build injection.
// For dedicated white-label builds, the CI/CD pipeline or build script injects explicit values here.
export const HARDCODED_TENANT = {
    tenantId: process.env.EXPO_PUBLIC_TENANT_ID || null,
    slug: process.env.EXPO_PUBLIC_TENANT_SLUG || null,
    name: process.env.EXPO_PUBLIC_HOSPITAL_NAME || null,
};
