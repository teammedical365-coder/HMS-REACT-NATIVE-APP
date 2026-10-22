/**
 * verify-base-apk-ota-config.js
 * 
 * Enforces mandatory Expo OTA Updates configuration in the base-APK release build path.
 * Runs before and after `npx expo prebuild` and fails before Gradle compilation if any
 * mandatory OTA configuration is missing, malformed, or inconsistent.
 * 
 * Safety checks:
 * 1. Authoritative EAS_PROJECT_ID format validation (valid 36-character UUID).
 * 2. Resolved updates.url agrees with EAS_PROJECT_ID (no silent divergence).
 * 3. runtimeVersion is configured (e.g. policy 'appVersion').
 * 4. expo-updates is enabled.
 * 5. Native request header expo-channel-name is configured for direct Gradle compilation.
 * 6. (Post-prebuild): android/app/src/main/AndroidManifest.xml contains required native meta-data.
 * 
 * NEVER prints secret values to logs.
 */

const fs = require('fs');
const path = require('path');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const PLACEHOLDER_PROJECT_IDS = [
  '00000000-0000-0000-0000-000000000000',
  'YOUR_EAS_PROJECT_ID',
  'your-project-id',
];

function isPlaceholderProjectId(id) {
  if (!id || typeof id !== 'string') return true;
  const trimmed = id.trim();
  if (PLACEHOLDER_PROJECT_IDS.includes(trimmed)) return true;
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(trimmed)) return true;
  return false;
}

function verifyPreBuildConfig(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const env = options.env || process.env;
  const isReleaseMode = options.isReleaseMode !== undefined
    ? options.isReleaseMode
    : (env.REQUIRE_OTA_CONFIG === 'true');
  const requireProjectId = options.requireProjectId !== undefined
    ? options.requireProjectId
    : (options.isReleaseMode === false ? false : true);
  const errors = [];

  // Check EAS_PROJECT_ID
  const easProjectId = env.EAS_PROJECT_ID || null;
  if (!easProjectId || String(easProjectId).trim() === '') {
    if (requireProjectId) {
      errors.push('Mandatory EAS_PROJECT_ID is missing from environment. Base APK release must specify authoritative EAS_PROJECT_ID.');
    }
  } else if (isPlaceholderProjectId(easProjectId)) {
    errors.push(`Configured EAS_PROJECT_ID "${easProjectId}" is a placeholder and cannot be used for base APK release.`);
  } else if (!UUID_REGEX.test(String(easProjectId).trim())) {
    errors.push(`Configured EAS_PROJECT_ID is invalid: expected 36-character UUID format.`);
  }

  // Load app.json
  const appJsonPath = path.join(rootDir, 'app.json');
  let appJson = null;
  if (!fs.existsSync(appJsonPath)) {
    errors.push(`app.json not found at ${appJsonPath}`);
  } else {
    try {
      const parsed = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      appJson = parsed.expo || parsed;
    } catch (e) {
      errors.push(`Failed to parse app.json: ${e.message}`);
    }
  }

  // Evaluate app.config.js
  let resolvedConfig = null;
  const appConfigJsPath = path.join(rootDir, 'app.config.js');
  if (fs.existsSync(appConfigJsPath) && appJson) {
    const prevEas = process.env.EAS_PROJECT_ID;
    const prevUpdatesUrl = process.env.EXPO_UPDATES_URL;
    try {
      if (env.EAS_PROJECT_ID !== undefined) process.env.EAS_PROJECT_ID = env.EAS_PROJECT_ID;
      if (env.EXPO_UPDATES_URL !== undefined) process.env.EXPO_UPDATES_URL = env.EXPO_UPDATES_URL;
      const getAppConfig = require(appConfigJsPath);
      resolvedConfig = getAppConfig({ config: appJson });
    } catch (e) {
      errors.push(`Failed to evaluate app.config.js: ${e.message}`);
    } finally {
      if (prevEas !== undefined) process.env.EAS_PROJECT_ID = prevEas;
      else delete process.env.EAS_PROJECT_ID;
      if (prevUpdatesUrl !== undefined) process.env.EXPO_UPDATES_URL = prevUpdatesUrl;
      else delete process.env.EXPO_UPDATES_URL;
    }
  } else if (appJson) {
    resolvedConfig = appJson;
  }

  if (resolvedConfig) {
    // 1. updates.enabled
    if (!resolvedConfig.updates || resolvedConfig.updates.enabled !== true) {
      errors.push('expo-updates is not enabled in configuration (updates.enabled must be true).');
    }

    // 2. updates.url
    if (easProjectId && UUID_REGEX.test(String(easProjectId).trim()) && !isPlaceholderProjectId(easProjectId)) {
      const expectedUrl = `https://u.expo.dev/${String(easProjectId).trim()}`;
      if (!resolvedConfig.updates || resolvedConfig.updates.url !== expectedUrl) {
        errors.push(`Resolved updates.url (${resolvedConfig.updates?.url}) does not match authoritative project URL (${expectedUrl}).`);
      }
    }

    // 3. runtimeVersion
    if (!resolvedConfig.runtimeVersion) {
      errors.push('runtimeVersion is missing from configuration. Must specify runtimeVersion policy or string.');
    }

    // 4. updates.requestHeaders['expo-channel-name']
    const channelHeader = resolvedConfig.updates?.requestHeaders?.['expo-channel-name'];
    if (!channelHeader || String(channelHeader).trim() === '') {
      errors.push("Native channel request header updates.requestHeaders['expo-channel-name'] is missing or empty.");
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

function verifyPostPrebuildNativeManifest(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const env = options.env || process.env;
  const isReleaseMode = options.isReleaseMode !== undefined
    ? options.isReleaseMode
    : (env.REQUIRE_OTA_CONFIG === 'true');
  const errors = [];

  const manifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    errors.push(`Native AndroidManifest.xml not found at ${manifestPath}. Run expo prebuild first.`);
    return { success: false, errors };
  }

  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');

    // Reject any manifest containing known placeholder project URLs or IDs
    if (
      manifestContent.includes('00000000-0000-0000-0000-000000000000') ||
      manifestContent.includes('YOUR_EAS_PROJECT_ID')
    ) {
      errors.push('Native AndroidManifest.xml contains an unconfigured placeholder EXPO_UPDATE_URL. Release builds must package a verified EAS project URL.');
    }

    // 1. Check EXPO_UPDATE_URL meta-data
    const hasUpdateUrlMeta = manifestContent.includes('expo.modules.updates.EXPO_UPDATE_URL');
    if (!hasUpdateUrlMeta) {
      if (isReleaseMode) {
        errors.push('AndroidManifest.xml is missing expo.modules.updates.EXPO_UPDATE_URL meta-data.');
      }
    } else {
      const easProjectId = env.EAS_PROJECT_ID || '';
      if (!easProjectId) {
        if (isReleaseMode) {
          errors.push('Mandatory EAS_PROJECT_ID is missing from environment during post-prebuild verification.');
        }
      } else if (isPlaceholderProjectId(easProjectId)) {
        errors.push(`Configured EAS_PROJECT_ID "${easProjectId}" is a placeholder and cannot be used for base APK release.`);
      } else if (!UUID_REGEX.test(easProjectId.trim())) {
        errors.push(`Configured EAS_PROJECT_ID is invalid: expected 36-character UUID format.`);
      } else {
        const expectedUrl = `https://u.expo.dev/${easProjectId.trim()}`;
        if (!manifestContent.includes(expectedUrl)) {
          errors.push(`AndroidManifest.xml EXPO_UPDATE_URL does not contain expected project URL (${expectedUrl}).`);
        }
      }
    }

    // 2. Check UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY meta-data with expo-channel-name
    const hasHeadersMeta = manifestContent.includes('expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY');
    const hasChannelHeader = manifestContent.includes('expo-channel-name');
    if (!hasHeadersMeta || !hasChannelHeader) {
      if (isReleaseMode || hasUpdateUrlMeta) {
        errors.push('AndroidManifest.xml is missing expo-channel-name in UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY meta-data.');
      }
    }

    // 3. Check updates enabled / check-on-launch meta-data
    const hasCheckOnLaunch = manifestContent.includes('expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH');
    const hasEnabled = manifestContent.includes('expo.modules.updates.ENABLED');
    if (!hasCheckOnLaunch && !hasEnabled) {
      errors.push('AndroidManifest.xml is missing Expo Updates check-on-launch or enabled meta-data.');
    }
  } catch (err) {
    errors.push(`Failed to read AndroidManifest.xml: ${err.message}`);
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isPostPrebuild = args.includes('--post-prebuild');
  const isPreBuild = args.includes('--pre-build') || !isPostPrebuild;

  if (isPreBuild) {
    console.log('[OTA BASE-APK VERIFICATION] Inspecting pre-build OTA configuration...');
    const result = verifyPreBuildConfig();
    if (!result.success) {
      console.error('::error::[OTA PRE-BUILD VERIFICATION FAILED] Mandatory OTA release configuration missing or invalid:');
      result.errors.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }
    console.log('[OTA PRE-BUILD VERIFICATION PASSED] Mandatory OTA configuration is present and valid.');
  }

  if (isPostPrebuild) {
    console.log('[OTA BASE-APK VERIFICATION] Inspecting generated native AndroidManifest.xml for Expo Updates meta-data...');
    const result = verifyPostPrebuildNativeManifest();
    if (!result.success) {
      console.error('::error::[OTA NATIVE MANIFEST VERIFICATION FAILED] Native AndroidManifest.xml missing required OTA meta-data:');
      result.errors.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }
    console.log('[OTA NATIVE MANIFEST VERIFICATION PASSED] Native AndroidManifest.xml contains valid Expo Updates meta-data.');
  }
}

module.exports = {
  verifyPreBuildConfig,
  verifyPostPrebuildNativeManifest,
  isPlaceholderProjectId,
  UUID_REGEX,
};
