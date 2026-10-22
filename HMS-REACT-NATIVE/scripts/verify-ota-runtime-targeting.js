/**
 * verify-ota-runtime-targeting.js
 * 
 * Validates and resolves the target runtime version cohort before publishing an OTA update.
 * 
 * Safety invariants:
 * 1. Expo's runtimeVersion policy 'appVersion' uses the app's 'version' as the runtime.
 *    OTA updates only reach client APKs built with an identical runtime version.
 * 2. Removes any hardcoded assumptions (e.g. 1.0.0); explicitly resolves and validates
 *    the intended target versionName/runtime before invoking `eas update`.
 * 3. Blocks publication if the requested target runtime cohort does not match the
 *    working tree's resolved configuration.
 * 4. Fails closed before publication if the runtime target is missing, malformed, or inconsistent.
 */

const fs = require('fs');
const path = require('path');

const SEMVER_REGEX = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/;

/**
 * Resolves and validates the target runtime version against app configuration.
 * 
 * @param {object} options
 * @param {string} [options.rootDir]
 * @param {string} [options.targetRuntime] - 'current' or explicit semver string
 * @param {object} [options.env]
 * @returns {{ success: boolean, resolvedRuntime: string, errors: string[] }}
 */
function resolveAndValidateRuntimeTarget(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const env = options.env || process.env;
  const rawTarget = options.targetRuntime !== undefined
    ? options.targetRuntime
    : (env.TARGET_RUNTIME_VERSION || env.TARGET_RUNTIME || 'current');

  const errors = [];

  // 1. Load app.json
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

  // 2. Evaluate app.config.js
  let resolvedConfig = null;
  const appConfigJsPath = path.join(rootDir, 'app.config.js');
  if (fs.existsSync(appConfigJsPath) && appJson) {
    const prevEnvName = process.env.VERSION_NAME;
    const prevStrict = process.env.STRICT_RUNTIME_CHECK;
    try {
      if (env.VERSION_NAME !== undefined) process.env.VERSION_NAME = env.VERSION_NAME;
      process.env.STRICT_RUNTIME_CHECK = 'true';
      delete require.cache[require.resolve(appConfigJsPath)];
      const getAppConfig = require(appConfigJsPath);
      resolvedConfig = typeof getAppConfig === 'function' ? getAppConfig({ config: appJson }) : getAppConfig;
    } catch (e) {
      errors.push(`Failed to evaluate app.config.js: ${e.message}`);
    } finally {
      if (prevEnvName !== undefined) process.env.VERSION_NAME = prevEnvName; else delete process.env.VERSION_NAME;
      if (prevStrict !== undefined) process.env.STRICT_RUNTIME_CHECK = prevStrict; else delete process.env.STRICT_RUNTIME_CHECK;
    }
  } else if (appJson) {
    resolvedConfig = appJson;
  }

  const workingTreeRuntime = resolvedConfig?.version || appJson?.version || null;

  // Validate working tree runtime version format
  if (!workingTreeRuntime || String(workingTreeRuntime).trim() === '') {
    errors.push('App configuration has no version defined. A valid semantic version is required.');
  } else if (!SEMVER_REGEX.test(String(workingTreeRuntime).trim())) {
    errors.push(`Resolved app version '${workingTreeRuntime}' is not a valid semantic version.`);
  }

  // Validate runtimeVersion policy
  const runtimeVersion = resolvedConfig?.runtimeVersion || appJson?.runtimeVersion;
  if (!runtimeVersion || runtimeVersion.policy !== 'appVersion') {
    errors.push(`runtimeVersion policy must be 'appVersion', received: ${JSON.stringify(runtimeVersion)}`);
  }

  // Determine target cohort
  const targetCohort = (rawTarget && String(rawTarget).trim() !== '' && String(rawTarget).trim().toLowerCase() !== 'current')
    ? String(rawTarget).trim()
    : workingTreeRuntime;

  if (!targetCohort || String(targetCohort).trim() === '') {
    errors.push('Missing target runtime version cohort.');
  } else if (!SEMVER_REGEX.test(targetCohort)) {
    errors.push(`Requested targetRuntimeVersion '${targetCohort}' is not a valid semantic version.`);
  } else if (workingTreeRuntime && targetCohort !== workingTreeRuntime) {
    errors.push(
      `Runtime version mismatch: Requested target cohort is '${targetCohort}', but working tree resolves to runtime '${workingTreeRuntime}'. ` +
      `Publication blocked to prevent deploying incompatible update across runtime cohorts.`
    );
  }

  return {
    success: errors.length === 0,
    resolvedRuntime: errors.length === 0 ? targetCohort : null,
    errors
  };
}

function main() {
  const args = process.argv.slice(2);
  let targetArg = 'current';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target-runtime' && args[i + 1]) {
      targetArg = args[i + 1];
      i++;
    }
  }

  console.log(`[OTA RUNTIME TARGETING] Validating target runtime cohort (requested: '${targetArg}')...`);
  const result = resolveAndValidateRuntimeTarget({ targetRuntime: targetArg });

  if (!result.success) {
    console.error('::error::[OTA RUNTIME TARGETING FAILED] Publication blocked due to runtime version errors:');
    result.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log(`[OTA RUNTIME TARGETING PASSED] Verified target runtime version cohort: '${result.resolvedRuntime}'`);

  // Export to GitHub Actions environment if running in workflow
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `RESOLVED_RUNTIME_VERSION=${result.resolvedRuntime}\n`);
    console.log(`[OTA RUNTIME TARGETING] Exported RESOLVED_RUNTIME_VERSION=${result.resolvedRuntime} to GITHUB_ENV`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  SEMVER_REGEX,
  resolveAndValidateRuntimeTarget
};
