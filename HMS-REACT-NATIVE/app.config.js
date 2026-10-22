const fs = require('fs');
const path = require('path');

function getTenantFromFile() {
  try {
    const tenantPath = path.join(__dirname, 'src', 'tenant.js');
    if (fs.existsSync(tenantPath)) {
      const content = fs.readFileSync(tenantPath, 'utf8');
      const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
      const slugMatch = content.match(/slug:\s*["']([^"']+)["']/);
      const tenantIdMatch = content.match(/tenantId:\s*["']([^"']+)["']/);
      return {
        name: nameMatch ? nameMatch[1] : null,
        slug: slugMatch ? slugMatch[1] : null,
        tenantId: tenantIdMatch ? tenantIdMatch[1] : null,
      };
    }
  } catch (e) {}
  return {};
}

const isValidAppId = (id) =>
  typeof id === 'string' &&
  /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(id.trim());

module.exports = ({ config }) => {
  const tenantFromFile = getTenantFromFile();

  const hospitalName =
    process.env.EXPO_PUBLIC_HOSPITAL_NAME ||
    process.env.HOSPITAL_NAME ||
    tenantFromFile.name ||
    config.name ||
    'Medical365';

  const tenantSlug =
    process.env.EXPO_PUBLIC_TENANT_SLUG ||
    process.env.TENANT_SLUG ||
    tenantFromFile.slug ||
    hospitalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
    'medical365';

  const tenantId =
    process.env.EXPO_PUBLIC_TENANT_ID ||
    process.env.TENANT_ID ||
    tenantFromFile.tenantId ||
    null;

  const safeAppIdSegment = tenantSlug.replace(/[^a-z0-9]/g, '').toLowerCase() || 'app';

  // Package ID resolution in strict order of authority:
  // 1. Explicitly supplied, validated APPLICATION_ID from env (e.g. CI workflow or disambiguated backend ID)
  // 2. Pre-configured android.package in config (e.g. written to app.json by CI workflow), as long as it's not the neutral fallback
  // 3. Deterministic local white-label fallback: com.medical365.<safeAppIdSegment>
  // 4. Default generic platform package: com.medical365.app
  let applicationId;
  if (process.env.APPLICATION_ID && isValidAppId(process.env.APPLICATION_ID)) {
    applicationId = process.env.APPLICATION_ID.trim();
  } else if (
    config.android &&
    config.android.package &&
    isValidAppId(config.android.package) &&
    config.android.package !== 'com.medical365.app'
  ) {
    applicationId = config.android.package.trim();
  } else if (hospitalName !== 'Medical365' || safeAppIdSegment !== 'medical365') {
    applicationId = `com.medical365.${safeAppIdSegment}`;
  } else {
    applicationId = (config.android && config.android.package) || 'com.medical365.app';
  }

  const iconPath = config.icon || './assets/icon.png';
  const adaptiveForeground =
    (config.android && config.android.adaptiveIcon && config.android.adaptiveIcon.foregroundImage) ||
    './assets/adaptive-icon.png';
  const adaptiveBg =
    (config.android && config.android.adaptiveIcon && config.android.adaptiveIcon.backgroundColor) ||
    '#ffffff';

  const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  const easProjectId =
    process.env.EAS_PROJECT_ID ||
    (config.extra && config.extra.eas && config.extra.eas.projectId) ||
    null;

  if (easProjectId && !UUID_REGEX.test(String(easProjectId).trim())) {
    throw new Error(
      `[OTA CONFIG ERROR] Configured EAS_PROJECT_ID "${easProjectId}" is invalid: expected 36-character UUID format.`
    );
  }

  const updatesUrl =
    process.env.EXPO_UPDATES_URL ||
    (easProjectId ? `https://u.expo.dev/${String(easProjectId).trim()}` : (config.updates && config.updates.url) || null);

  if (easProjectId && process.env.EXPO_UPDATES_URL) {
    const expectedUrl = `https://u.expo.dev/${String(easProjectId).trim()}`;
    if (process.env.EXPO_UPDATES_URL.trim() !== expectedUrl) {
      throw new Error(
        `[OTA CONFIG ERROR] EXPO_UPDATES_URL (${process.env.EXPO_UPDATES_URL}) does not match authoritative project URL (${expectedUrl}).`
      );
    }
  }

  const updateChannel =
    process.env.EXPO_CHANNEL ||
    process.env.EAS_UPDATE_CHANNEL ||
    (config.updates && config.updates.requestHeaders && config.updates.requestHeaders['expo-channel-name']) ||
    'production';

  if (process.env.REQUIRE_OTA_CONFIG === 'true') {
    if (!easProjectId) {
      throw new Error(
        '[OTA CONFIG ERROR] Mandatory OTA configuration missing: EAS_PROJECT_ID is required for OTA-capable release builds.'
      );
    }
    if (!updatesUrl) {
      throw new Error(
        '[OTA CONFIG ERROR] Mandatory OTA configuration missing: updates.url could not be resolved.'
      );
    }
    if (!config.runtimeVersion) {
      throw new Error(
        '[OTA CONFIG ERROR] Mandatory OTA configuration missing: runtimeVersion must be configured.'
      );
    }
    if (!updateChannel) {
      throw new Error(
        '[OTA CONFIG ERROR] Mandatory OTA configuration missing: expo-channel-name is not configured.'
      );
    }
  }

  const versionCode =
    (process.env.VERSION_CODE && /^[1-9][0-9]*$/.test(String(process.env.VERSION_CODE).trim()))
      ? parseInt(String(process.env.VERSION_CODE).trim(), 10)
      : ((config.android && config.android.versionCode) || 1);

  const resolvedVersionName =
    (process.env.VERSION_NAME && String(process.env.VERSION_NAME).trim()) ||
    (config && config.version) ||
    null;

  const isStrictRuntimeCheck =
    process.env.REQUIRE_OTA_CONFIG === 'true' ||
    process.env.STRICT_RUNTIME_CHECK === 'true';

  if (!resolvedVersionName || !/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(resolvedVersionName)) {
    if (isStrictRuntimeCheck) {
      throw new Error(
        `[OTA CONFIG ERROR] Valid semantic versionName is required for runtimeVersion policy 'appVersion', resolved: '${resolvedVersionName}'`
      );
    }
  }

  const versionName = resolvedVersionName || '1.0.0';

  return {
    ...config,
    name: hospitalName,
    slug: tenantSlug,
    version: versionName,
    icon: iconPath,
    updates: {
      ...(config.updates || {}),
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      ...(updatesUrl ? { url: updatesUrl } : {}),
      requestHeaders: {
        ...((config.updates && config.updates.requestHeaders) || {}),
        'expo-channel-name': updateChannel,
      },
    },
    runtimeVersion: config.runtimeVersion || { policy: 'appVersion' },
    android: {
      ...(config.android || {}),
      package: applicationId,
      versionCode: versionCode,
      icon: (config.android && config.android.icon) || iconPath,
      adaptiveIcon: {
        backgroundColor: adaptiveBg,
        foregroundImage: adaptiveForeground,
      },
    },
    extra: {
      ...(config.extra || {}),
      hospitalName,
      tenantSlug,
      tenantId,
      applicationId,
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};
