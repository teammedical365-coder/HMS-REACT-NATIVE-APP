/**
 * verify-ota-tenant-neutrality.js
 * 
 * Fail-closed security preflight for OTA publishing.
 * Validates that the publishing environment, bundle inputs, and exported assets are strictly tenant-neutral.
 * Prevents tenant-specific configuration, environment variables, or local override files
 * from leaking into shared production OTA JavaScript bundles.
 * 
 * Safety invariants enforced:
 * 1. No tenant-specific environment variables in publish environment.
 * 2. No active tenant assignments in any .env* configuration file.
 * 3. src/tenant.js exports neutral/null defaults, not hardcoded hospital constants.
 * 4. Authoritative EAS Project ID format validation (valid 36-character UUID).
 * 5. Explicitly supplied update URL must not point to a different project.
 * 6. Updates configuration, channel header, and runtime version validity in app.json.
 * 7. eas.json production profile maps to 'production' update channel.
 * 8. Optional/Exported JS bundle scanning for embedded tenant identifiers.
 * 
 * NEVER prints secret or variable values to logs.
 */

const fs = require('fs');
const path = require('path');

const PROHIBITED_ENV_VARS = [
  'EXPO_PUBLIC_TENANT_ID',
  'EXPO_PUBLIC_TENANT_SLUG',
  'EXPO_PUBLIC_HOSPITAL_NAME',
  'BUILD_TENANT_ID',
  'BUILD_TENANT_SLUG',
  'HARDCODED_TENANT',
  'TENANT_ID',
  'TENANT_SLUG',
  'HOSPITAL_NAME',
  'APPLICATION_ID',
];

const ENV_FILES_TO_CHECK = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.development',
  '.env.development.local',
  '.env.staging',
  '.env.staging.local',
];

const KNOWN_HOSPITAL_IDS = [
  '6a7eb46c01e0f4ea3817854b',
  '6ab801f7c1cfbb4c2b578561',
  '6ad31d63f8f8b7ed40b397aa',
];

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Scans a bundle content string for tenant-specific identifiers, hardcoded hospital IDs,
 * or compiled tenant constants.
 * 
 * Documented neutral allowances:
 * - 'com.medical365.app' (the generic platform package)
 * - 'medical365' (default neutral slug / app name)
 * - 'Hospital Portal' (neutral UI fallback placeholder)
 * - 'admin' (central platform role / domain)
 */
function scanBundleContent(bundleContent, sourceLabel = 'bundle') {
  const errors = [];
  if (!bundleContent || typeof bundleContent !== 'string') return errors;

  // 1. Check for compiled HARDCODED_TENANT with active string literal values
  const compiledTenantIdMatch = bundleContent.match(/HARDCODED_TENANT\s*=\s*\{[^}]*tenantId:\s*["']([^"']+)["']/);
  if (compiledTenantIdMatch && compiledTenantIdMatch[1].trim() !== '') {
    errors.push(`Compiled HARDCODED_TENANT with non-null tenantId detected in ${sourceLabel}. Values were suppressed.`);
  }

  const compiledSlugMatch = bundleContent.match(/HARDCODED_TENANT\s*=\s*\{[^}]*slug:\s*["']([^"']+)["']/);
  if (compiledSlugMatch && compiledSlugMatch[1].trim() !== '') {
    errors.push(`Compiled HARDCODED_TENANT with non-null slug detected in ${sourceLabel}. Values were suppressed.`);
  }

  // 2. Check for known hospital tenant 24-hex ObjectIds
  for (const id of KNOWN_HOSPITAL_IDS) {
    if (bundleContent.includes(id)) {
      errors.push(`Known hospital tenant ObjectId detected in ${sourceLabel}. Values were suppressed for security.`);
      break;
    }
  }

  return errors;
}

function runPreflight(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const env = options.env || process.env;
  const errors = [];

  // 1. Check for prohibited tenant environment variables
  const detectedVars = [];
  for (const varName of PROHIBITED_ENV_VARS) {
    const val = env[varName];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      detectedVars.push(varName);
    }
  }

  if (detectedVars.length > 0) {
    errors.push(
      `Tenant-specific variable(s) detected in publishing environment: [${detectedVars.join(', ')}]. ` +
      `Shared OTA bundle must be strictly tenant-neutral. Values were suppressed for security.`
    );
  }

  // 2. Check all .env* configuration files for active (uncommented) tenant assignments
  for (const file of ENV_FILES_TO_CHECK) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const detectedInFile = [];
        for (const v of PROHIBITED_ENV_VARS) {
          // Check for uncommented assignment: e.g. EXPO_PUBLIC_TENANT_ID=xyz
          const regex = new RegExp(`^\\s*${v}\\s*=\\s*\\S+`, 'm');
          if (regex.test(content)) {
            detectedInFile.push(v);
          }
        }
        if (detectedInFile.length > 0) {
          errors.push(
            `Unsafe active tenant configuration detected in ${file}: [${detectedInFile.join(', ')}]. ` +
            `Comment out or remove these tenant variables before publishing shared OTA updates. Values were suppressed for security.`
          );
        }
      } catch (err) {
        errors.push(`Failed to inspect environment file ${file}: ${err.message}`);
      }
    }
  }

  // 3. Inspect src/tenant.js
  const tenantJsPath = path.join(rootDir, 'src', 'tenant.js');
  if (fs.existsSync(tenantJsPath)) {
    try {
      const tenantContent = fs.readFileSync(tenantJsPath, 'utf8');
      // Look for hardcoded string literals in tenantId, slug, or name
      const hardcodedIdMatch = tenantContent.match(/tenantId:\s*["']([^"']+)["']/);
      const hardcodedSlugMatch = tenantContent.match(/slug:\s*["']([^"']+)["']/);
      const hardcodedNameMatch = tenantContent.match(/name:\s*["']([^"']+)["']/);

      if (hardcodedIdMatch && hardcodedIdMatch[1].trim() !== '') {
        errors.push('src/tenant.js contains hardcoded non-null tenantId. Shared OTA bundle must have neutral tenant defaults.');
      }
      if (hardcodedSlugMatch && hardcodedSlugMatch[1].trim() !== '') {
        errors.push('src/tenant.js contains hardcoded non-null slug. Shared OTA bundle must have neutral tenant defaults.');
      }
      if (hardcodedNameMatch && hardcodedNameMatch[1].trim() !== '') {
        errors.push('src/tenant.js contains hardcoded non-null name. Shared OTA bundle must have neutral tenant defaults.');
      }
    } catch (err) {
      errors.push(`Failed to inspect src/tenant.js: ${err.message}`);
    }
  }

  // 4. Validate EAS Project ID if supplied or required
  const appJsonPath = path.join(rootDir, 'app.json');
  let appJsonConfig = null;
  if (fs.existsSync(appJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      appJsonConfig = parsed.expo || parsed;
    } catch (err) {
      errors.push(`Failed to parse app.json: ${err.message}`);
    }
  }

  const easProjectId =
    env.EAS_PROJECT_ID ||
    (appJsonConfig && appJsonConfig.extra && appJsonConfig.extra.eas && appJsonConfig.extra.eas.projectId) ||
    null;

  if (easProjectId) {
    if (!UUID_REGEX.test(String(easProjectId).trim())) {
      errors.push(`Configured EAS Project ID format is invalid: expected 36-character UUID format.`);
    }
    // Verify explicitly configured updates.url does not point to a different project
    if (appJsonConfig && appJsonConfig.updates && appJsonConfig.updates.url) {
      const expectedUrl = `https://u.expo.dev/${easProjectId.trim()}`;
      if (appJsonConfig.updates.url.trim() !== expectedUrl) {
        errors.push(`Configured updates.url (${appJsonConfig.updates.url}) does not match authoritative project URL (${expectedUrl}).`);
      }
    }
  } else if (options.requireProjectId) {
    errors.push('Authoritative EAS Project ID is required but was not found in environment or app.json.');
  }

  // 5. Validate updates configuration in app.json
  if (appJsonConfig) {
    if (!appJsonConfig.updates || appJsonConfig.updates.enabled !== true) {
      errors.push('app.json updates.enabled must be set to true.');
    }
    if (!appJsonConfig.runtimeVersion) {
      errors.push('app.json runtimeVersion must be configured for OTA updates.');
    }
    const channelHeader =
      appJsonConfig.updates &&
      appJsonConfig.updates.requestHeaders &&
      appJsonConfig.updates.requestHeaders['expo-channel-name'];
    if (!channelHeader) {
      errors.push("app.json updates.requestHeaders['expo-channel-name'] must be configured.");
    }
  }

  // 6. Validate eas.json production profile & channel mapping
  const easJsonPath = path.join(rootDir, 'eas.json');
  if (fs.existsSync(easJsonPath)) {
    try {
      const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
      const prodChannel = easJson.build?.production?.channel;
      if (!prodChannel || prodChannel !== 'production') {
        errors.push(`eas.json production build profile must map to 'production' update channel (found: '${prodChannel}').`);
      }
    } catch (e) {
      errors.push(`Failed to parse eas.json: ${e.message}`);
    }
  }

  // 7. Optional bundle file inspection if bundlePath provided
  if (options.bundlePath) {
    if (fs.existsSync(options.bundlePath)) {
      try {
        const bundleContent = fs.readFileSync(options.bundlePath, 'utf8');
        const bundleErrors = scanBundleContent(bundleContent, options.bundlePath);
        errors.push(...bundleErrors);
      } catch (err) {
        errors.push(`Failed to read bundle file ${options.bundlePath}: ${err.message}`);
      }
    } else {
      errors.push(`Specified bundle file does not exist: ${options.bundlePath}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let bundlePath = null;
  const bundleIdx = args.indexOf('--scan-bundle');
  if (bundleIdx !== -1 && args[bundleIdx + 1]) {
    bundlePath = args[bundleIdx + 1];
  }

  const result = runPreflight({
    requireProjectId: process.env.STRICT_PROJECT_CHECK === 'true',
    bundlePath,
  });

  if (!result.success) {
    console.error('::error::[OTA PREFLIGHT FAILED] Tenant-neutral publishing safety violation:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('[OTA PREFLIGHT PASSED] Environment and bundle inputs are strictly tenant-neutral.');
    process.exit(0);
  }
}

module.exports = {
  runPreflight,
  scanBundleContent,
  PROHIBITED_ENV_VARS,
  ENV_FILES_TO_CHECK,
  KNOWN_HOSPITAL_IDS,
  UUID_REGEX,
};
