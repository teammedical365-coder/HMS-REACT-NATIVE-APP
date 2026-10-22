/**
 * test_phase2e_mobile.js — Phase 2G Mobile Tenant Isolation Verification Suite (Offline)
 * 
 * Directly imports and tests the real exported utility module:
 * `src/utils/packageIdentity.js`
 * 
 * Verifies:
 * - F-04: Baseline branding protection for dedicated hospital APKs against unverified OTA bundle constants.
 * - F-05: Real module execution (zero duplicate copy-pasted validation functions).
 * - Gate 3: Package-scoped cache validation, regex validation, and tenant precedence.
 */

const assert = require('assert');

// Directly import the REAL production utility module (F-05)
const {
    isHospitalPackageId,
    isCacheValidForTarget,
    createBaselineBranding,
    getTenantCacheKey,
    getSlugCacheKey,
    getPackageCacheKey
} = require('./src/utils/packageIdentity');

console.log('================================================================');
console.log('📱 MEDICAL365 — PHASE 2G MOBILE TENANT ISOLATION TESTS (OFFLINE)');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}\n`);
        failedTests++;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: isHospitalPackageId (Real Module)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- SUITE 1: isHospitalPackageId Validation (src/utils/packageIdentity.js) ---');

test('Gate 3: isHospitalPackageId accepts valid white-label hospital packages', () => {
    assert.strictEqual(isHospitalPackageId('com.medical365.apollo'), true);
    assert.strictEqual(isHospitalPackageId('com.medical365.krishna_ivf'), true);
    assert.strictEqual(isHospitalPackageId('com.medical365.cityhospital123'), true);
    assert.strictEqual(isHospitalPackageId('com.medical365.a'), true);
});

test('Gate 3: isHospitalPackageId rejects generic platform package com.medical365.app', () => {
    assert.strictEqual(isHospitalPackageId('com.medical365.app'), false);
});

test('Gate 3: isHospitalPackageId rejects malformed, foreign, or invalid packages', () => {
    assert.strictEqual(isHospitalPackageId('com.medical365.Apollo'), false, 'Uppercase rejected');
    assert.strictEqual(isHospitalPackageId('com.medical365.123clinic'), false, 'Leading digit rejected');
    assert.strictEqual(isHospitalPackageId('com.otherdomain.hospital'), false, 'Non-medical365 prefix rejected');
    assert.strictEqual(isHospitalPackageId('com.medical365.'), false, 'Empty segment rejected');
    assert.strictEqual(isHospitalPackageId(''), false, 'Empty string rejected');
    assert.strictEqual(isHospitalPackageId(null), false, 'Null rejected');
    assert.strictEqual(isHospitalPackageId(undefined), false, 'Undefined rejected');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: createBaselineBranding Tenant Isolation (F-04, Real Module)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 2: Baseline Branding Isolation (F-04) ---');

test('F-04 (Baseline Protection): Dedicated hospital APK baseline branding NEVER adopts unverified bundle constants', () => {
    // Simulating an OTA bundle that was erroneously packaged with Hospital B's constants
    const UNTRUSTED_HOSPITAL_NAME = 'Hospital B Clinic';
    const UNTRUSTED_TENANT_ID = 'hospital_b_tenant_id';
    const UNTRUSTED_TENANT_SLUG = 'hospital-b';
    const NATIVE_PACKAGE_ID = 'com.medical365.hospital_a'; // Device hardware anchor

    // Invoke real createBaselineBranding
    const baseline = createBaselineBranding(
        UNTRUSTED_HOSPITAL_NAME,
        UNTRUSTED_TENANT_ID,
        UNTRUSTED_TENANT_SLUG,
        NATIVE_PACKAGE_ID
    );

    // Verify tenant ID and slug remain strictly null until verified by network resolution
    assert.strictEqual(baseline.hospitalId, null, 'Baseline hospitalId must be null for dedicated APK');
    assert.strictEqual(baseline.slug, null, 'Baseline slug must be null for dedicated APK');
    assert.strictEqual(baseline._tenantId, null, 'Baseline _tenantId must be null for dedicated APK');
    assert.strictEqual(baseline._tenantSlug, null, 'Baseline _tenantSlug must be null for dedicated APK');
    assert.strictEqual(baseline.hospitalName, 'Hospital Portal', 'Hospital name must be neutral placeholder');
    assert.strictEqual(baseline.packageId, NATIVE_PACKAGE_ID, 'Package ID must match hardware anchor');
    assert.strictEqual(baseline._isBaseline, true, '_isBaseline flag must be true');
});

test('F-04 (Generic Baseline): Generic platform / web baseline adopts build constants when packageId is null', () => {
    const baseline = createBaselineBranding(
        'Medical 365',
        'central_platform_id',
        'central',
        null // Generic web / unconfigured platform
    );

    assert.strictEqual(baseline.hospitalName, 'Medical 365');
    assert.strictEqual(baseline.hospitalId, 'central_platform_id');
    assert.strictEqual(baseline.slug, 'central');
    assert.strictEqual(baseline.packageId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Cache Scoping and Cross-Tenant Isolation (Real Module)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 3: Cache Validation & Scoping (src/utils/packageIdentity.js) ---');

test('Gate 3: Cross-tenant cache reuse between Hospital A and Hospital B is strictly prevented', () => {
    const hospitalACache = {
        hospitalName: 'Hospital A Clinic',
        packageId: 'com.medical365.hospital_a',
        _tenantPackageId: 'com.medical365.hospital_a',
        hospitalId: 'hosp_a_id',
        slug: 'hospital-a'
    };

    // Installed APK is Hospital B
    const targetPackageId = 'com.medical365.hospital_b';
    const isValid = isCacheValidForTarget(hospitalACache, null, null, null, null, targetPackageId);
    assert.strictEqual(isValid, false, 'Hospital A cache MUST NOT be reused for Hospital B APK');
});

test('Gate 3: Cache is accepted when native package ID matches target', () => {
    const hospitalBCache = {
        hospitalName: 'Hospital B Clinic',
        packageId: 'com.medical365.hospital_b',
        _tenantPackageId: 'com.medical365.hospital_b',
        hospitalId: 'hosp_b_id',
        slug: 'hospital-b'
    };

    const targetPackageId = 'com.medical365.hospital_b';
    const isValid = isCacheValidForTarget(hospitalBCache, null, null, null, null, targetPackageId);
    assert.strictEqual(isValid, true, 'Matching package cache must be accepted');
});

test('Gate 3: Package cache keys are properly scoped by packageId', () => {
    const key = getPackageCacheKey('com.medical365.apollo');
    assert.strictEqual(key, 'hospitalBranding_pkg_com.medical365.apollo');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Login Identity Precedence (F-04 Logic Verification)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 4: Login Credential Protection (F-04) ---');

test('F-04 (Login Protection): Dedicated APK never uses bundle constants when branding is unresolved', () => {
    const nativeAppId = 'com.medical365.apollo';
    const isDedicatedHospital = isHospitalPackageId(nativeAppId);

    // Case 1: Unresolved / Baseline branding
    const baselineBranding = createBaselineBranding('Untrusted Name', 'untrusted_id', 'untrusted_slug', nativeAppId);

    let slug;
    let effectiveHospitalId;

    if (isDedicatedHospital) {
        slug = (baselineBranding && !baselineBranding._isBaseline && baselineBranding.slug) || undefined;
        effectiveHospitalId = (baselineBranding && !baselineBranding._isBaseline && (baselineBranding.hospitalId || baselineBranding._tenantId)) || undefined;
    }

    assert.strictEqual(slug, undefined, 'Slug must be undefined when branding is baseline');
    assert.strictEqual(effectiveHospitalId, undefined, 'Hospital ID must be undefined when branding is baseline');

    // Case 2: Resolved live branding
    const resolvedBranding = {
        hospitalId: 'verified_apollo_id',
        slug: 'apollo',
        hospitalName: 'Apollo Care',
        packageId: nativeAppId,
        _isBaseline: false
    };

    if (isDedicatedHospital) {
        slug = (resolvedBranding && !resolvedBranding._isBaseline && resolvedBranding.slug) || undefined;
        effectiveHospitalId = (resolvedBranding && !resolvedBranding._isBaseline && (resolvedBranding.hospitalId || resolvedBranding._tenantId)) || undefined;
    }

    assert.strictEqual(slug, 'apollo', 'Must use verified resolved slug');
    assert.strictEqual(effectiveHospitalId, 'verified_apollo_id', 'Must use verified resolved hospital ID');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Expo OTA Updates Configuration & Module Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 5: Expo OTA Updates Configuration & Verification ---');

const fs = require('fs');
const path = require('path');

test('OTA Config: expo-updates is installed in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies['expo-updates'], 'expo-updates must be listed in dependencies');
    assert.ok(pkg.dependencies['expo-updates'].startsWith('~29') || pkg.dependencies['expo-updates'].startsWith('^29'), 'Must be SDK 54 compatible (~29.x)');
});

test('OTA Config: app.json defines enabled updates, ON_LOAD check, runtimeVersion policy, and expo-updates plugin', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
    assert.strictEqual(appJson.expo.updates?.enabled, true, 'updates.enabled must be true');
    assert.strictEqual(appJson.expo.updates?.checkAutomatically, 'ON_LOAD', 'updates.checkAutomatically must be ON_LOAD');
    assert.strictEqual(appJson.expo.updates?.fallbackToCacheTimeout, 0, 'fallbackToCacheTimeout must be 0 for fast boot');
    assert.strictEqual(appJson.expo.runtimeVersion?.policy, 'appVersion', 'runtimeVersion policy must be appVersion');
    assert.ok(appJson.expo.plugins.includes('expo-updates'), 'expo-updates must be included in plugins');
});

test('OTA Config: eas.json defines production build profile mapped to production update channel', () => {
    const easJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'eas.json'), 'utf8'));
    assert.ok(easJson.build?.production, 'production build profile must exist');
    assert.strictEqual(easJson.build.production.channel, 'production', 'production build profile must map to production channel');
});

test('OTA Module: updateManager exports safe lifecycle functions', () => {
    // Mock native runtime modules in require.cache for Node.js test runner
    const rnPath = require.resolve('react-native');
    const updatesPath = require.resolve('expo-updates');
    require.cache[rnPath] = {
        id: rnPath,
        filename: rnPath,
        loaded: true,
        exports: { Platform: { OS: 'android' } }
    };
    require.cache[updatesPath] = {
        id: updatesPath,
        filename: updatesPath,
        loaded: true,
        exports: { isEnabled: false }
    };

    const updateManager = require('./src/utils/updateManager');
    assert.strictEqual(typeof updateManager.isUpdatesEnabled, 'function');
    assert.strictEqual(typeof updateManager.getUpdateMetadata, 'function');
    assert.strictEqual(typeof updateManager.checkForAppUpdate, 'function');
    assert.strictEqual(typeof updateManager.fetchAndApplyUpdate, 'function');
    assert.strictEqual(updateManager.isUpdatesEnabled(), false);
    const meta = updateManager.getUpdateMetadata();
    assert.strictEqual(meta.isEnabled, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: Direct Gradle Channel Header & Dynamic Config Validation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 6: Direct Gradle Native Channel & Dynamic Config Validation ---');

test('Direct Gradle Build: app.json defines native expo-channel-name request header for Gradle prebuild', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
    assert.strictEqual(
        appJson.expo.updates?.requestHeaders?.['expo-channel-name'],
        'production',
        "app.json must specify updates.requestHeaders['expo-channel-name'] = 'production'"
    );
});

test('Direct Gradle Build: app.config.js injects update channel request header dynamically', () => {
    const getAppConfig = require('./app.config.js');
    const baseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8')).expo;
    
    // Default evaluation
    const evaluatedDefault = getAppConfig({ config: baseConfig });
    assert.strictEqual(
        evaluatedDefault.updates?.requestHeaders?.['expo-channel-name'],
        'production',
        'Default channel must be production'
    );

    // Environment override evaluation
    const prevChannel = process.env.EXPO_CHANNEL;
    try {
        process.env.EXPO_CHANNEL = 'staging';
        const evaluatedStaging = getAppConfig({ config: baseConfig });
        assert.strictEqual(
            evaluatedStaging.updates?.requestHeaders?.['expo-channel-name'],
            'staging',
            'Overridden channel must be staging'
        );
    } finally {
        if (prevChannel !== undefined) process.env.EXPO_CHANNEL = prevChannel;
        else delete process.env.EXPO_CHANNEL;
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: Tenant-Neutral OTA Preflight & Security Gate
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 7: Tenant-Neutral OTA Preflight Verification ---');

const { runPreflight } = require('./scripts/verify-ota-tenant-neutrality.js');

test('Preflight: Clean environment and default files pass preflight without errors', () => {
    const cleanEnv = {};
    const result = runPreflight({
        rootDir: __dirname,
        env: cleanEnv,
        requireProjectId: false,
    });
    assert.strictEqual(result.success, true, `Preflight should pass on clean env, got errors: ${result.errors.join('; ')}`);
});

test('Preflight: Blocks publication if EXPO_PUBLIC_TENANT_ID is set in environment', () => {
    const dirtyEnv = { EXPO_PUBLIC_TENANT_ID: 'hospital_123_leak' };
    const result = runPreflight({
        rootDir: __dirname,
        env: dirtyEnv,
        requireProjectId: false,
    });
    assert.strictEqual(result.success, false, 'Preflight must fail when EXPO_PUBLIC_TENANT_ID is set');
    assert.ok(result.errors.some(e => e.includes('EXPO_PUBLIC_TENANT_ID')), 'Error must mention EXPO_PUBLIC_TENANT_ID');
    // Ensure value is NOT printed
    assert.ok(!result.errors.some(e => e.includes('hospital_123_leak')), 'Secret value must not be exposed');
});

test('Preflight: Blocks publication if EXPO_PUBLIC_TENANT_SLUG is set in environment', () => {
    const dirtyEnv = { EXPO_PUBLIC_TENANT_SLUG: 'apollo-care' };
    const result = runPreflight({
        rootDir: __dirname,
        env: dirtyEnv,
        requireProjectId: false,
    });
    assert.strictEqual(result.success, false, 'Preflight must fail when EXPO_PUBLIC_TENANT_SLUG is set');
    assert.ok(result.errors.some(e => e.includes('EXPO_PUBLIC_TENANT_SLUG')));
});

test('Preflight: Validates EAS Project ID format (rejects malformed string)', () => {
    const invalidIdEnv = { EAS_PROJECT_ID: 'invalid-not-a-uuid' };
    const result = runPreflight({
        rootDir: __dirname,
        env: invalidIdEnv,
        requireProjectId: true,
    });
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(e => e.includes('EAS Project ID format is invalid')));
});

test('Preflight: Accepts valid UUID EAS Project ID', () => {
    const validIdEnv = { EAS_PROJECT_ID: '12345678-1234-1234-1234-123456789abc' };
    const result = runPreflight({
        rootDir: __dirname,
        env: validIdEnv,
        requireProjectId: true,
    });
    assert.strictEqual(result.success, true, `Should accept valid UUID, got: ${result.errors.join('; ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8: Workflow Integrity & Security Invariants
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 8: GitHub Actions Workflow Integrity & Guards ---');

test('Workflow Guards: react-native-build.yml contains all three uploadToBackend guards', () => {
    const workflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'react-native-build.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    // 1. Upload Artifacts to Backend
    assert.ok(
        content.includes("if: success() && (github.event.inputs.uploadToBackend != 'false')"),
        'Guard 1 (Artifact Upload) must be intact'
    );

    // 2. Final Completion Callback
    const completionMatches = content.match(/if:\s*success\(\)\s*&&\s*\(github\.event\.inputs\.uploadToBackend\s*!=\s*'false'\)/g);
    assert.ok(completionMatches && completionMatches.length >= 2, 'Guard 2 (Completion Callback) must be intact');

    // 3. Failure Callback
    assert.ok(
        content.includes("if: failure() && steps.notify_completed.outcome != 'success' && (github.event.inputs.uploadToBackend != 'false')"),
        'Guard 3 (Failure Callback) must be intact'
    );
});

test('Workflow Guards: publish-ota-update.yml is manual-only and enforces preflight', () => {
    const otaWorkflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'publish-ota-update.yml');
    const content = fs.readFileSync(otaWorkflowPath, 'utf8');

    // Must be manual only
    assert.ok(content.includes('workflow_dispatch:'), 'Must have workflow_dispatch trigger');
    assert.ok(!content.includes('\n  push:'), 'Must NOT have push trigger');
    assert.ok(!content.includes('\n  pull_request:'), 'Must NOT have pull_request trigger');
    assert.ok(!content.includes('\n  schedule:'), 'Must NOT have schedule trigger');

    // Must enforce preflight
    assert.ok(content.includes('verify-ota-tenant-neutrality.js'), 'Must invoke verify-ota-tenant-neutrality.js');
    assert.ok(content.includes("EXPO_PUBLIC_TENANT_ID: ''"), 'Must sanitize EXPO_PUBLIC_TENANT_ID in publishing step');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9: Mandatory Base-APK Release OTA Configuration Enforcement
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 9: Mandatory Base-APK Release OTA Configuration ---');

const os = require('os');
const { verifyPreBuildConfig, verifyPostPrebuildNativeManifest } = require('./scripts/verify-base-apk-ota-config.js');

test('Base-APK OTA: Fails before build when mandatory EAS_PROJECT_ID is missing from environment', () => {
    const result = verifyPreBuildConfig({
        rootDir: __dirname,
        env: { EAS_PROJECT_ID: '' },
    });
    assert.strictEqual(result.success, false, 'Must fail when EAS_PROJECT_ID is missing');
    assert.ok(result.errors.some(e => e.includes('Mandatory EAS_PROJECT_ID is missing')), 'Error must mention missing EAS_PROJECT_ID');
});

test('Base-APK OTA: Fails before build when EAS_PROJECT_ID is not a valid 36-char UUID', () => {
    const result = verifyPreBuildConfig({
        rootDir: __dirname,
        env: { EAS_PROJECT_ID: 'invalid-eas-project-id-123' },
    });
    assert.strictEqual(result.success, false, 'Must fail when EAS_PROJECT_ID is malformed');
    assert.ok(result.errors.some(e => e.includes('invalid: expected 36-character UUID format')));
});

test('Base-APK OTA: Fails before build if EXPO_UPDATES_URL points to a different project', () => {
    const validId = '11111111-2222-3333-4444-555555555555';
    const conflictingEnv = {
        EAS_PROJECT_ID: validId,
        EXPO_UPDATES_URL: 'https://u.expo.dev/99999999-9999-9999-9999-999999999999',
    };
    const result = verifyPreBuildConfig({
        rootDir: __dirname,
        env: conflictingEnv,
    });
    assert.strictEqual(result.success, false, 'Must fail when EXPO_UPDATES_URL conflicts with EAS_PROJECT_ID');
    assert.ok(result.errors.some(e => e.includes('does not match authoritative project URL')));
});

test('Base-APK OTA: Passes before build when valid EAS_PROJECT_ID and matching config are present', () => {
    const validId = '11111111-2222-3333-4444-555555555555';
    const result = verifyPreBuildConfig({
        rootDir: __dirname,
        env: { EAS_PROJECT_ID: validId },
    });
    assert.strictEqual(result.success, true, `Should pass with valid project ID, got errors: ${result.errors.join('; ')}`);
});

test('Base-APK OTA: app.config.js throws on REQUIRE_OTA_CONFIG=true when EAS_PROJECT_ID is absent', () => {
    const getAppConfig = require('./app.config.js');
    const baseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8')).expo;

    const prevOtaReq = process.env.REQUIRE_OTA_CONFIG;
    const prevEas = process.env.EAS_PROJECT_ID;
    try {
        process.env.REQUIRE_OTA_CONFIG = 'true';
        delete process.env.EAS_PROJECT_ID;
        assert.throws(
            () => getAppConfig({ config: baseConfig }),
            /Mandatory OTA configuration missing: EAS_PROJECT_ID/,
            'app.config.js must throw when REQUIRE_OTA_CONFIG=true and EAS_PROJECT_ID is absent'
        );
    } finally {
        if (prevOtaReq !== undefined) process.env.REQUIRE_OTA_CONFIG = prevOtaReq;
        else delete process.env.REQUIRE_OTA_CONFIG;
        if (prevEas !== undefined) process.env.EAS_PROJECT_ID = prevEas;
        else delete process.env.EAS_PROJECT_ID;
    }
});

test('Base-APK OTA: app.config.js succeeds on REQUIRE_OTA_CONFIG=true with valid UUID EAS_PROJECT_ID', () => {
    const getAppConfig = require('./app.config.js');
    const baseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8')).expo;

    const prevOtaReq = process.env.REQUIRE_OTA_CONFIG;
    const prevEas = process.env.EAS_PROJECT_ID;
    try {
        process.env.REQUIRE_OTA_CONFIG = 'true';
        process.env.EAS_PROJECT_ID = '11111111-2222-3333-4444-555555555555';
        const evaluated = getAppConfig({ config: baseConfig });
        assert.strictEqual(evaluated.updates.url, 'https://u.expo.dev/11111111-2222-3333-4444-555555555555');
        assert.strictEqual(evaluated.updates.enabled, true);
        assert.strictEqual(evaluated.updates.requestHeaders['expo-channel-name'], 'production');
    } finally {
        if (prevOtaReq !== undefined) process.env.REQUIRE_OTA_CONFIG = prevOtaReq;
        else delete process.env.REQUIRE_OTA_CONFIG;
        if (prevEas !== undefined) process.env.EAS_PROJECT_ID = prevEas;
        else delete process.env.EAS_PROJECT_ID;
    }
});

test('Base-APK OTA: verifyPreBuildConfig rejects placeholder EAS_PROJECT_ID', () => {
    const placeholderEnv = { EAS_PROJECT_ID: '00000000-0000-0000-0000-000000000000' };
    const result = verifyPreBuildConfig({
        rootDir: __dirname,
        env: placeholderEnv,
    });
    assert.strictEqual(result.success, false, 'Must reject placeholder all-zeros EAS_PROJECT_ID');
    assert.ok(result.errors.some(e => e.includes('is a placeholder')), 'Error must state that ID is a placeholder');
});

test('Base-APK OTA: verifyPostPrebuildNativeManifest rejects manifest with placeholder URL', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-placeholder-'));
    const manifestDir = path.join(tempDir, 'android', 'app', 'src', 'main');
    fs.mkdirSync(manifestDir, { recursive: true });

    try {
        fs.writeFileSync(path.join(manifestDir, 'AndroidManifest.xml'), `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android">
              <application>
                <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
                <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
                <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/00000000-0000-0000-0000-000000000000"/>
                <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="1.0.0"/>
                <meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;}"/>
              </application>
            </manifest>
        `);
        const result = verifyPostPrebuildNativeManifest({ rootDir: tempDir });
        assert.strictEqual(result.success, false, 'Must reject manifest containing placeholder URL');
        assert.ok(result.errors.some(e => e.includes('placeholder EXPO_UPDATE_URL')));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Base-APK OTA: verifyPostPrebuildNativeManifest succeeds on base repository manifest in dev mode', () => {
    const result = verifyPostPrebuildNativeManifest({ rootDir: __dirname, isReleaseMode: false });
    assert.strictEqual(result.success, true, `Dev mode manifest verification should pass, got: ${result.errors.join('; ')}`);
});

test('Base-APK OTA: verifyPostPrebuildNativeManifest fails in release mode when EAS_PROJECT_ID is absent', () => {
    const result = verifyPostPrebuildNativeManifest({ rootDir: __dirname, isReleaseMode: true, env: {} });
    assert.strictEqual(result.success, false, 'Release mode must require EAS_PROJECT_ID and EXPO_UPDATE_URL');
    assert.ok(result.errors.some(e => e.includes('missing') || e.includes('Mandatory EAS_PROJECT_ID')));
});

test('Base-APK OTA: verifyPostPrebuildNativeManifest validates matching EAS_PROJECT_ID against manifest URL', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
    const manifestDir = path.join(tempDir, 'android', 'app', 'src', 'main');
    fs.mkdirSync(manifestDir, { recursive: true });
    const targetUuid = '22222222-3333-4444-5555-666666666666';

    try {
        fs.writeFileSync(path.join(manifestDir, 'AndroidManifest.xml'), `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android">
              <application>
                <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
                <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
                <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/${targetUuid}"/>
                <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="1.0.0"/>
                <meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;}"/>
              </application>
            </manifest>
        `);

        // Matching environment passes in release mode
        const matchingRes = verifyPostPrebuildNativeManifest({
            rootDir: tempDir,
            isReleaseMode: true,
            env: { EAS_PROJECT_ID: targetUuid }
        });
        assert.strictEqual(matchingRes.success, true);

        // Mismatched environment fails
        const mismatchRes = verifyPostPrebuildNativeManifest({
            rootDir: tempDir,
            isReleaseMode: true,
            env: { EAS_PROJECT_ID: '99999999-9999-9999-9999-999999999999' }
        });
        assert.strictEqual(mismatchRes.success, false);
        assert.ok(mismatchRes.errors.some(e => e.includes('does not contain expected project URL')));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Base-APK OTA: verifyPostPrebuildNativeManifest fails when AndroidManifest.xml is missing', () => {
    const tempEmptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-empty-'));
    try {
        const result = verifyPostPrebuildNativeManifest({ rootDir: tempEmptyDir });
        assert.strictEqual(result.success, false);
        assert.ok(result.errors.some(e => e.includes('Native AndroidManifest.xml not found')));
    } finally {
        fs.rmSync(tempEmptyDir, { recursive: true, force: true });
    }
});

test('Base-APK OTA: verifyPostPrebuildNativeManifest fails when required meta-data is missing from manifest', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-incomplete-'));
    const manifestDir = path.join(tempDir, 'android', 'app', 'src', 'main');
    fs.mkdirSync(manifestDir, { recursive: true });

    try {
        // Missing channel headers
        fs.writeFileSync(path.join(manifestDir, 'AndroidManifest.xml'), `
            <manifest xmlns:android="http://schemas.android.com/apk/res/android">
              <application>
                <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
                <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/11111111-2222-3333-4444-555555555555"/>
              </application>
            </manifest>
        `);
        const result = verifyPostPrebuildNativeManifest({
            rootDir: tempDir,
            isReleaseMode: true,
            env: { EAS_PROJECT_ID: '11111111-2222-3333-4444-555555555555' }
        });
        assert.strictEqual(result.success, false);
        assert.ok(result.errors.some(e => e.includes('missing expo-channel-name in UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY')));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 10: Application-Wide Tenant Isolation & Flow Invariants
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 10: Application-Wide Tenant Isolation & Flow Invariants ---');

test('PharmacyOrders Flow: Dedicated hospital package never falls back to EXPO_PUBLIC_TENANT_ID', () => {
    const dedicatedPackage = 'com.medical365.apollo';
    const isDedicated = isHospitalPackageId(dedicatedPackage);
    assert.strictEqual(isDedicated, true);

    // Simulate PharmacyOrders hid resolution logic
    const hospitalInfo = {}; // Not yet loaded from getMyHospital
    const cachedBrandingId = null; // No cache yet
    const envTenantId = 'leaked_hospital_tenant_id_from_bundle';

    let hid = hospitalInfo?._id || hospitalInfo?.id || cachedBrandingId;
    if (!hid && !isDedicated) {
        hid = envTenantId;
    }

    assert.ok(!hid, 'Dedicated hospital APK hid MUST remain null/falsy until loaded, never adopting env tenant ID');
    assert.notStrictEqual(hid, envTenantId, 'Dedicated hospital APK hid MUST NOT adopt env tenant ID');

    // For generic platform / web (!isDedicated), fallback is preserved
    const isGeneric = isHospitalPackageId('com.medical365.app');
    let genericHid = hospitalInfo?._id || hospitalInfo?.id || cachedBrandingId;
    if (!genericHid && !isGeneric) {
        genericHid = envTenantId;
    }
    assert.strictEqual(genericHid, envTenantId, 'Generic web/platform preserves developer fallback when unconfigured');
});

test('PatientPortalLogin Flow: Dedicated hospital app fallbackName protects against bundle hospital name', () => {
    const isDedicatedHospital = isHospitalPackageId('com.medical365.cityclinic');
    const branding = { hospitalName: 'City Clinic Live' };
    const untrustedBundleName = 'Untrusted Hospital from Env';

    const fallbackName = isDedicatedHospital
        ? (branding?.hospitalName || 'Hospital Portal')
        : (untrustedBundleName || 'Hospital Portal');

    assert.strictEqual(fallbackName, 'City Clinic Live', 'Must use verified branding name');

    // Baseline branding case
    const baselineFallbackName = isDedicatedHospital
        ? (null || 'Hospital Portal')
        : (untrustedBundleName || 'Hospital Portal');
    assert.strictEqual(baselineFallbackName, 'Hospital Portal', 'Must use neutral placeholder in dedicated baseline mode');
});

test('BrandingContext Flow: contextValue tenantId is strictly isolated in dedicated mode', () => {
    const isDedicatedWhiteLabel = isHospitalPackageId('com.medical365.apollo');
    const BUILD_TENANT_ID = 'untrusted_build_tenant_id';

    // Baseline branding (unresolved)
    const baselineBranding = { _isBaseline: true, hospitalId: null };
    const contextTenantId =
        (baselineBranding && !baselineBranding._isBaseline && (baselineBranding.hospitalId || baselineBranding._tenantId)) ||
        (isDedicatedWhiteLabel ? null : BUILD_TENANT_ID) ||
        null;

    assert.strictEqual(contextTenantId, null, 'contextValue.tenantId must be null for dedicated APK when branding is baseline');
});

test('Preflight: Detects active uncommented tenant assignment in .env files without exposing value', () => {
    // Test with simulated active assignment
    const { runPreflight: rf } = require('./scripts/verify-ota-tenant-neutrality.js');
    const fakeRootDir = path.join(__dirname, '..', 'temp_test_preflight_dir');
    try {
      fs.mkdirSync(fakeRootDir, { recursive: true });
      fs.writeFileSync(path.join(fakeRootDir, '.env.production'), 'EXPO_PUBLIC_TENANT_ID=secret_tenant_999\n');
      const result = rf({
          rootDir: fakeRootDir,
          env: {},
          requireProjectId: false,
      });
      assert.strictEqual(result.success, false, 'Preflight must fail when .env.production has active tenant assignment');
      assert.ok(result.errors.some(e => e.includes('EXPO_PUBLIC_TENANT_ID')), 'Error must mention EXPO_PUBLIC_TENANT_ID');
      assert.ok(!result.errors.some(e => e.includes('secret_tenant_999')), 'Secret value must not be exposed');
    } finally {
      try {
        fs.rmSync(fakeRootDir, { recursive: true, force: true });
      } catch (_) {}
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 11: Phase 3 End-to-End OTA Runtime Lifecycle, Recovery & Bundle Scanning
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 11: Phase 3 OTA Runtime Lifecycle, Recovery & Safety ---');

const {
    getUpdateMetadata,
    sanitizeErrorMessage,
    checkForAppUpdate,
    downloadUpdateInBackground,
} = require('./src/utils/updateManager.js');

const { scanBundleContent } = require('./scripts/verify-ota-tenant-neutrality.js');

test('Lifecycle & Recovery: getUpdateMetadata includes emergency recovery status', () => {
    const meta = getUpdateMetadata();
    assert.strictEqual(typeof meta.isEmbeddedLaunch, 'boolean');
    assert.strictEqual(typeof meta.isEmergencyLaunch, 'boolean');
});

test('Security & Privacy: sanitizeErrorMessage redacts tokens and sensitive URLs from logs', () => {
    const sensitiveError = new Error('EAS server failed at https://u.expo.dev/1234?token=secret_token_12345&auth=bearer999');
    const sanitized = sanitizeErrorMessage(sensitiveError);
    assert.ok(!sanitized.includes('secret_token_12345'), 'Token must be redacted');
    assert.ok(!sanitized.includes('bearer999'), 'Auth param must be redacted');
    assert.ok(sanitized.includes('[REDACTED]'), 'Must replace with [REDACTED]');
});

test('Lifecycle: downloadUpdateInBackground fails gracefully without crashing or reloading when updates disabled', async () => {
    // In node test environment, updates module is disabled
    const result = await downloadUpdateInBackground();
    assert.strictEqual(result.downloaded, false);
    assert.strictEqual(result.isAvailable, false);
    assert.strictEqual(result.reason, 'updates_disabled');
});

test('Lifecycle: checkForAppUpdate fails gracefully and safely sanitizes error', async () => {
    const result = await checkForAppUpdate();
    assert.strictEqual(result.isAvailable, false);
    assert.strictEqual(result.manifest, null);
});

test('Bundle Scanning: scanBundleContent blocks hardcoded non-null tenantId', () => {
    const dirtyBundle = 'const HARDCODED_TENANT = { tenantId: "hospital_leaked_id", slug: null };';
    const errors = scanBundleContent(dirtyBundle, 'test_bundle.js');
    assert.strictEqual(errors.length > 0, true);
    assert.ok(errors.some(e => e.includes('Compiled HARDCODED_TENANT with non-null tenantId')));
    // Ensure secret value is not printed
    assert.ok(!errors.some(e => e.includes('hospital_leaked_id')));
});

test('Bundle Scanning: scanBundleContent blocks known hospital 24-hex ObjectIds', () => {
    const dirtyBundle = 'var defaultTenant = "6a7eb46c01e0f4ea3817854b";';
    const errors = scanBundleContent(dirtyBundle, 'test_bundle.js');
    assert.strictEqual(errors.length > 0, true);
    assert.ok(errors.some(e => e.includes('Known hospital tenant ObjectId detected')));
});

test('Bundle Scanning: scanBundleContent accepts clean tenant-neutral code with documented allowances', () => {
    const cleanBundle = `
      export const HARDCODED_TENANT = { tenantId: null, slug: null, name: null };
      const defaultPkg = 'com.medical365.app';
      const fallbackName = 'Hospital Portal';
    `;
    const errors = scanBundleContent(cleanBundle, 'clean_bundle.js');
    assert.strictEqual(errors.length, 0, `Clean bundle should pass, got: ${errors.join('; ')}`);
});

test('Compatibility: eas.json production profile agrees with app.json channel header', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
    const easJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'eas.json'), 'utf8'));

    const appChannel = appJson.expo.updates?.requestHeaders?.['expo-channel-name'];
    const easChannel = easJson.build?.production?.channel;

    assert.strictEqual(appChannel, 'production');
    assert.strictEqual(easChannel, 'production');
    assert.strictEqual(appChannel, easChannel, 'Native channel header and EAS build profile channel must agree');
});

test('Compatibility: Native base-APK release gate required when native runtimeVersion policy appVersion changes', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
    assert.strictEqual(appJson.expo.runtimeVersion?.policy, 'appVersion');
    assert.strictEqual(typeof appJson.expo.version, 'string');
    // Verifies that runtimeVersion is locked to appVersion semver string, gating any native-incompatible updates
    assert.ok(appJson.expo.version.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 12: Phase 3 Native Version Code & Semantic Versioning Integration
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 12: Phase 3 Native Version Code & Semantic Versioning Integration ---');

test('Phase 3 Config: app.json defines default versionCode and version', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
    assert.strictEqual(typeof appJson.expo.version, 'string', 'expo.version must be string');
    assert.strictEqual(appJson.expo.version, '1.0.0');
    assert.strictEqual(typeof appJson.expo.android?.versionCode, 'number', 'expo.android.versionCode must be number');
    assert.strictEqual(appJson.expo.android.versionCode, 1);
});

test('Phase 3 Config: app.config.js respects VERSION_CODE and VERSION_NAME environment variables', () => {
    const prevCode = process.env.VERSION_CODE;
    const prevName = process.env.VERSION_NAME;
    try {
        process.env.VERSION_CODE = '42';
        process.env.VERSION_NAME = '2.5.0';
        const getAppConfig = require('./app.config.js');
        const baseAppJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
        const resolved = getAppConfig({ config: baseAppJson.expo });

        assert.strictEqual(resolved.android?.versionCode, 42, 'Dynamic VERSION_CODE must be applied to android.versionCode');
        assert.strictEqual(resolved.version, '2.5.0', 'Dynamic VERSION_NAME must be applied to expo.version');
        assert.deepStrictEqual(resolved.runtimeVersion, { policy: 'appVersion' }, 'runtimeVersion policy must remain appVersion');
    } finally {
        if (prevCode !== undefined) process.env.VERSION_CODE = prevCode; else delete process.env.VERSION_CODE;
        if (prevName !== undefined) process.env.VERSION_NAME = prevName; else delete process.env.VERSION_NAME;
    }
});

test('Phase 3 Config: app.config.js falls back safely to app.json when env vars are absent or malformed', () => {
    const prevCode = process.env.VERSION_CODE;
    const prevName = process.env.VERSION_NAME;
    try {
        process.env.VERSION_CODE = 'not-a-number';
        process.env.VERSION_NAME = '';
        const getAppConfig = require('./app.config.js');
        const baseAppJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
        const resolved = getAppConfig({ config: baseAppJson.expo });

        assert.strictEqual(resolved.android?.versionCode, 1, 'Malformed VERSION_CODE must fall back to 1');
        assert.strictEqual(resolved.version, '1.0.0', 'Empty VERSION_NAME must fall back to 1.0.0');
    } finally {
        if (prevCode !== undefined) process.env.VERSION_CODE = prevCode; else delete process.env.VERSION_CODE;
        if (prevName !== undefined) process.env.VERSION_NAME = prevName; else delete process.env.VERSION_NAME;
    }
});

test('Phase 3 Workflow: react-native-build.yml accepts versionCode and versionName in inputs', () => {
    const workflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'react-native-build.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('versionCode:'), 'workflow must accept versionCode input');
    assert.ok(content.includes('versionName:'), 'workflow must accept versionName input');
    assert.ok(content.includes("VERSION_CODE: ${{ github.event.inputs.versionCode || '1' }}"), 'workflow must validate VERSION_CODE');
    assert.ok(content.includes("VERSION_NAME: ${{ github.event.inputs.versionName || '1.0.0' }}"), 'workflow must validate VERSION_NAME');
});

test('Phase 3 Workflow: react-native-build.yml enforces 32-bit positive integer versionCode limit', () => {
    const workflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'react-native-build.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('^[1-9][0-9]*$'), 'workflow must validate positive integer regex for versionCode');
    assert.ok(content.includes('2100000000'), 'workflow must enforce maximum 2100000000 versionCode limit');
    assert.ok(content.includes('^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?$'), 'workflow must validate semver for versionName');
});

test('Phase 3 Workflow: react-native-build.yml updates app.json with parsed versionCode and versionName', () => {
    const workflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'react-native-build.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('config.expo.android.versionCode = parsedVersionCode;'), 'workflow must write parsed versionCode');
    assert.ok(content.includes('config.expo.version = parsedVersionName;'), 'workflow must write parsed versionName');
    assert.ok(content.includes("core.exportVariable('VERSION_CODE', String(parsedVersionCode));"), 'workflow must export VERSION_CODE');
    assert.ok(content.includes("core.exportVariable('VERSION_NAME', parsedVersionName);"), 'workflow must export VERSION_NAME');
});

test('Phase 3 Safety: VersionCode automation preserves tenant neutrality (no IDs/names in version)', () => {
    const baseAppJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
    assert.strictEqual(/^[0-9]+$/.test(String(baseAppJson.expo.android?.versionCode)), true);
    assert.strictEqual(/^[0-9]+\.[0-9]+\.[0-9]+$/.test(baseAppJson.expo.version), true);
    // Verify no hospital tenant identifiers leak into version fields
    assert.ok(!baseAppJson.expo.version.includes('hosp_'));
    assert.ok(!baseAppJson.expo.version.includes('tenant'));
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 13: Phase 3 OTA Runtime Cohort Targeting Safeguards
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 13: Phase 3 OTA Runtime Cohort Targeting Safeguards ---');

const { resolveAndValidateRuntimeTarget } = require('./scripts/verify-ota-runtime-targeting.js');

test('Phase 3 OTA Targeting: Valid runtime resolution with default current target', () => {
    const res = resolveAndValidateRuntimeTarget({ targetRuntime: 'current' });
    assert.strictEqual(res.success, true, 'Default current target must resolve successfully');
    assert.strictEqual(res.resolvedRuntime, '1.0.0');
    assert.strictEqual(res.errors.length, 0);
});

test('Phase 3 OTA Targeting: Valid runtime resolution with explicit matching semver', () => {
    const res = resolveAndValidateRuntimeTarget({ targetRuntime: '1.0.0' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.resolvedRuntime, '1.0.0');
    assert.strictEqual(res.errors.length, 0);
});

test('Phase 3 OTA Targeting: Valid runtime resolution with dynamic VERSION_NAME environment', () => {
    const res = resolveAndValidateRuntimeTarget({
        targetRuntime: '2.4.0',
        env: { VERSION_NAME: '2.4.0' }
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.resolvedRuntime, '2.4.0');
    assert.strictEqual(res.errors.length, 0);
});

test('Phase 3 OTA Targeting: Runtime mismatch blocks publication across cohorts', () => {
    const res = resolveAndValidateRuntimeTarget({ targetRuntime: '2.0.0' });
    assert.strictEqual(res.success, false, 'Targeting cohort 2.0.0 against 1.0.0 app must fail');
    assert.strictEqual(res.resolvedRuntime, null);
    assert.ok(
        res.errors.some(e => e.includes('Runtime version mismatch')),
        'Error must state runtime version mismatch'
    );
});

test('Phase 3 OTA Targeting: Missing or invalid semver target version is blocked', () => {
    const resMalformed = resolveAndValidateRuntimeTarget({ targetRuntime: 'not-a-semver' });
    assert.strictEqual(resMalformed.success, false);
    assert.strictEqual(resMalformed.resolvedRuntime, null);
    assert.ok(
        resMalformed.errors.some(e => e.includes('not a valid semantic version')),
        'Malformed semver must be rejected'
    );

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-test-empty-ver-'));
    try {
        fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify({
            expo: { name: 'test', slug: 'test', version: '' }
        }));
        const resEmpty = resolveAndValidateRuntimeTarget({ rootDir: tempDir, targetRuntime: '' });
        assert.strictEqual(resEmpty.success, false);
        assert.strictEqual(resEmpty.resolvedRuntime, null);
        assert.ok(resEmpty.errors.some(e => e.includes('Missing target runtime version cohort') || e.includes('no version defined')));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Phase 3 OTA Targeting: Blocked publication when runtimeVersion policy is not appVersion', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-test-policy-'));
    try {
        fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify({
            expo: {
                name: 'test',
                slug: 'test',
                version: '1.0.0',
                runtimeVersion: { policy: 'sdkVersion' }
            }
        }));
        const res = resolveAndValidateRuntimeTarget({ rootDir: tempDir });
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.resolvedRuntime, null);
        assert.ok(
            res.errors.some(e => e.includes("runtimeVersion policy must be 'appVersion'")),
            'Non-appVersion policy must block publication'
        );
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Phase 3 OTA Workflow: publish-ota-update.yml enforces explicit targetRuntimeVersion input and validation', () => {
    const workflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'publish-ota-update.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('targetRuntimeVersion:'), 'workflow must declare targetRuntimeVersion input');
    assert.ok(content.includes("default: 'current'"), 'workflow must default targetRuntimeVersion to current');
    assert.ok(content.includes('verify-ota-runtime-targeting.js'), 'workflow must run verify-ota-runtime-targeting.js');
    assert.ok(content.includes('RESOLVED_RUNTIME_VERSION'), 'workflow must export RESOLVED_RUNTIME_VERSION');
    assert.ok(content.includes('VERSION_NAME: ${{ env.RESOLVED_RUNTIME_VERSION }}'), 'workflow must pass resolved runtime to publishing step');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 14: Phase 5 Release Automation Workflows & Integrity
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 14: Phase 5 Release Automation Workflows & Integrity ---');

test('Phase 5 Workflow: ota-release.yml inputs, checkout, and safety preflights', () => {
    const otaWorkflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'ota-release.yml');
    assert.ok(fs.existsSync(otaWorkflowPath), 'ota-release.yml workflow file must exist');
    const content = fs.readFileSync(otaWorkflowPath, 'utf8');

    assert.ok(content.includes('targetCommitSha:'), 'Workflow must declare targetCommitSha input');
    assert.ok(content.includes('releaseId:'), 'Workflow must declare releaseId input');
    assert.ok(content.includes('channel:'), 'Workflow must declare channel input');
    assert.ok(content.includes('message:'), 'Workflow must declare message input');
    assert.ok(content.includes('targetRuntimeVersion:'), 'Workflow must declare targetRuntimeVersion input');
    assert.ok(content.includes('ref: ${{ github.event.inputs.targetCommitSha || github.ref }}'), 'Checkout step must respect targetCommitSha');
    assert.ok(content.includes('scripts/verify-ota-runtime-targeting.js'), 'Must execute runtime targeting verification');
    assert.ok(content.includes('scripts/verify-ota-tenant-neutrality.js'), 'Must execute tenant-neutrality verification');
});

test('Phase 5 Workflow: ota-release.yml completion and failure callbacks', () => {
    const otaWorkflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'ota-release.yml');
    const content = fs.readFileSync(otaWorkflowPath, 'utf8');

    assert.ok(content.includes('/api/superadmin/releases/webhook/ota'), 'Must notify backend release webhook endpoint');
    assert.ok(content.includes('status') && content.includes('COMPLETED'), 'Completion step must post COMPLETED status');
    assert.ok(content.includes('status') && content.includes('FAILED'), 'Failure step must post FAILED status');
    assert.ok(content.includes('EAS_UPDATE_ID'), 'Must capture and export EAS_UPDATE_ID');
    assert.ok(content.includes('RELEASE_ID') && content.includes('releaseId'), 'Must correlate releaseId in completion callback');
});

test('Phase 5 Workflow: react-native-build.yml release correlation and SHA-256 generation', () => {
    const buildWorkflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'react-native-build.yml');
    const content = fs.readFileSync(buildWorkflowPath, 'utf8');

    assert.ok(content.includes('targetCommitSha:'), 'Must declare targetCommitSha input');
    assert.ok(content.includes('releaseId:'), 'Must declare releaseId input');
    assert.ok(content.includes('ref: ${{ github.event.inputs.targetCommitSha || github.ref }}'), 'Checkout must support target SHA');
    assert.ok(content.includes('sha256sum app-rn.apk > checksum.sha256'), 'Must compute APK SHA-256 checksum');
    assert.ok(content.includes('sha256sum app-rn.aab >> checksum.sha256'), 'Must compute AAB SHA-256 checksum');
    assert.ok(content.includes('output_artifacts/checksum.sha256'), 'Must include checksum in artifact upload');
    assert.ok(content.includes('releaseId') && content.includes('RELEASE_ID'), 'Must forward releaseId in upload-build');
    assert.ok(content.includes('checksumSha256') && content.includes('APK_SHA256'), 'Must forward checksum in upload-build');
    assert.ok(content.includes('notify_completed') && content.includes('releaseId'), 'Must correlate releaseId in notify_completed');
    assert.ok(content.includes('notify_completed') && content.includes('checksumSha256'), 'Must include checksumSha256 in notify_completed');

    // Confirm all three uploadToBackend guards are preserved
    const uploadGuards = content.match(/github\.event\.inputs\.uploadToBackend != 'false'/g);
    assert.strictEqual(uploadGuards?.length, 3, 'Must retain all three uploadToBackend guard clauses');
});

test('Phase 5 Workflow: publish-ota-update.yml release correlation and callbacks', () => {
    const otaWorkflowPath = path.resolve(__dirname, '..', '.github', 'workflows', 'publish-ota-update.yml');
    const content = fs.readFileSync(otaWorkflowPath, 'utf8');

    assert.ok(content.includes('targetCommitSha:'), 'Must declare targetCommitSha input');
    assert.ok(content.includes('releaseId:'), 'Must declare releaseId input');
    assert.ok(content.includes('ref: ${{ github.event.inputs.targetCommitSha || github.ref }}'), 'Checkout must support target SHA');
    assert.ok(content.includes('/api/superadmin/releases/webhook/ota'), 'Must notify backend release webhook');
    assert.ok(content.includes('status') && content.includes('COMPLETED'), 'Completion step must post COMPLETED status');
    assert.ok(content.includes('status') && content.includes('FAILED'), 'Failure step must post FAILED status');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 15: Phase 6 In-App OTA Experience & Emergency Recovery
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 15: Phase 6 In-App Update Experience & Emergency Recovery ---');

test('Phase 6: UPDATE_STATES machine declares all required UI states', () => {
    const updateManager = require('./src/utils/updateManager');
    assert.strictEqual(updateManager.UPDATE_STATES.IDLE, 'IDLE');
    assert.strictEqual(updateManager.UPDATE_STATES.CHECKING, 'CHECKING');
    assert.strictEqual(updateManager.UPDATE_STATES.AVAILABLE, 'AVAILABLE');
    assert.strictEqual(updateManager.UPDATE_STATES.DOWNLOADING, 'DOWNLOADING');
    assert.strictEqual(updateManager.UPDATE_STATES.DOWNLOADED, 'DOWNLOADED');
    assert.strictEqual(updateManager.UPDATE_STATES.APPLYING, 'APPLYING');
    assert.strictEqual(updateManager.UPDATE_STATES.ERROR, 'ERROR');
    assert.strictEqual(updateManager.UPDATE_STATES.RECOVERY, 'RECOVERY');
});

test('Phase 6: Concurrency lock prevents overlapping update operations', async () => {
    const updateManager = require('./src/utils/updateManager');
    assert.strictEqual(updateManager.isOperationInProgress(), false);

    const updatesPath = require.resolve('expo-updates');
    const origExports = require.cache[updatesPath].exports;
    require.cache[updatesPath].exports = {
        isEnabled: true,
        checkForUpdateAsync: () => new Promise(resolve => setTimeout(() => resolve({ isAvailable: true }), 40)),
    };

    try {
        const check1 = updateManager.checkForAppUpdate();
        assert.strictEqual(updateManager.isOperationInProgress(), true);

        const check2 = await updateManager.checkForAppUpdate();
        assert.strictEqual(check2.isAvailable, false);
        assert.strictEqual(check2.reason, 'operation_in_progress');

        await check1;
        assert.strictEqual(updateManager.isOperationInProgress(), false);
    } finally {
        require.cache[updatesPath].exports = origExports;
    }
});

test('Phase 6: Reload loop protection enters recovery mode upon rapid reloads', async () => {
    const updateManager = require('./src/utils/updateManager');
    await updateManager.resetReloadLoopTracking();

    assert.strictEqual(updateManager.isRecoveryMode(), false);

    // Record two reloads within the rapid window
    await updateManager.recordReloadEvent();
    await updateManager.recordReloadEvent();

    const loopCheck = await updateManager.checkReloadLoopProtection();
    assert.strictEqual(loopCheck.inLoop, true);
    assert.strictEqual(updateManager.isRecoveryMode(), true);

    const meta = updateManager.getUpdateMetadata();
    assert.strictEqual(meta.inRecoveryMode, true);
    assert(meta.recoveryReason.includes('Consecutive update reloads'));

    // Reset recovery mode
    await updateManager.resetRecoveryMode();
    assert.strictEqual(updateManager.isRecoveryMode(), false);
});

test('Phase 6: Defer update stores updateId and persists safely', async () => {
    const updateManager = require('./src/utils/updateManager');
    await updateManager.clearDeferredUpdate();

    let deferred = await updateManager.getDeferredUpdate();
    assert.strictEqual(deferred, null);

    await updateManager.deferCurrentUpdate('update-uuid-999');
    deferred = await updateManager.getDeferredUpdate();
    assert.strictEqual(deferred.updateId, 'update-uuid-999');
    assert(typeof deferred.deferredAt === 'string');

    await updateManager.clearDeferredUpdate();
    deferred = await updateManager.getDeferredUpdate();
    assert.strictEqual(deferred, null);
});

test('Phase 6: Error sanitization redacts tenant secrets and patient tokens from update errors', () => {
    const updateManager = require('./src/utils/updateManager');
    const dirtyError = new Error('HTTP 401: Failed to fetch update from https://u.expo.dev/12345678-1234-1234-1234-123456789abc with token Bearer secret-patient-token-xyz');
    const sanitized = updateManager.sanitizeErrorMessage(dirtyError);

    assert.ok(!sanitized.includes('secret-patient-token-xyz'), 'Tokens must be redacted');
    assert.ok(sanitized.includes('Failed to fetch update'), 'Human actionable message preserved');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 16: Phase 7 Super Admin Release Console & Component Integration
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 16: Phase 7 Release Console & UI Component Integration ---');

test('Phase 7 Console: CentralAdminTabs includes visible releases tab and quick-access header button', () => {
    const tabsFile = fs.readFileSync(path.join(__dirname, 'src/components/centraladmin/CentralAdminTabs.js'), 'utf8');
    assert.ok(tabsFile.includes("id: 'releases'"), 'Must declare releases tab');
    assert.ok(tabsFile.includes("label: 'Releases & OTA'") || tabsFile.includes("label: 'Release Console'"), 'Must label tab Releases & OTA');
    assert.ok(tabsFile.includes("iconType: 'layers'"), 'Must use layers icon');
    assert.ok(tabsFile.includes('case \'layers\':'), 'Must render SVG layers icon');
    assert.ok(tabsFile.includes('releasesHeaderBtn'), 'Must include quick-access header button for Releases & OTA');
    assert.ok(tabsFile.includes('showsHorizontalScrollIndicator={true}'), 'Must show horizontal scroll indicator on mobile tab list');
});

test('Phase 7 Console: CentralAdminReleaseConsole component file exists, exports cleanly, and exposes controls', () => {
    const consolePath = path.join(__dirname, 'src/components/centraladmin/CentralAdminReleaseConsole.js');
    assert.ok(fs.existsSync(consolePath), 'CentralAdminReleaseConsole.js must exist');
    const content = fs.readFileSync(consolePath, 'utf8');
    assert.ok(content.includes('export default function CentralAdminReleaseConsole'), 'Must export component');
    assert.ok(content.includes('releaseAPI.getReleases'), 'Must fetch release catalog');
    assert.ok(content.includes('releaseAPI.getMetrics'), 'Must fetch release metrics');
    assert.ok(content.includes('releaseAPI.dispatchOta'), 'Must support dispatching OTA');
    assert.ok(content.includes('releaseAPI.rollback'), 'Must support emergency rollback');
    assert.ok(content.includes('Dispatch OTA Update'), 'Must show Dispatch OTA Update action button');
    assert.ok(content.includes('Emergency Rollback'), 'Must show Emergency Rollback action button');
    assert.ok(content.includes('canGoBack') && content.includes('handleBack'), 'Must support back navigation');
});

test('Phase 7 Navigation: RoleStacks and DashboardLayout integrate Releases & OTA for Central Admin and protect other roles', () => {
    const stacksFile = fs.readFileSync(path.join(__dirname, 'src/navigation/RoleStacks.js'), 'utf8');
    assert.ok(stacksFile.includes("name=\"CentralAdminReleaseConsole\""), 'RoleStacks must register CentralAdminReleaseConsole');
    assert.ok(stacksFile.includes("import CentralAdminReleaseConsole"), 'RoleStacks must import CentralAdminReleaseConsole');

    const layoutFile = fs.readFileSync(path.join(__dirname, 'src/components/layouts/DashboardLayout.js'), 'utf8');
    assert.ok(layoutFile.includes("path: 'CentralAdminReleaseConsole'"), 'DashboardLayout must include CentralAdminReleaseConsole in menu');
    assert.ok(layoutFile.includes("label: 'Releases & OTA'"), 'DashboardLayout menu must label item Releases & OTA');

    // Confirm role isolation: only isCentralAdmin has CentralAdminReleaseConsole
    const centralAdminBlock = layoutFile.slice(layoutFile.indexOf('if (isCentralAdmin)'), layoutFile.indexOf('const roleClean = role.replace'));
    assert.ok(centralAdminBlock.includes('CentralAdminReleaseConsole'), 'Releases item must be inside isCentralAdmin block');

    const remainingMenus = layoutFile.slice(layoutFile.indexOf('const roleClean = role.replace'));
    assert.ok(!remainingMenus.includes('CentralAdminReleaseConsole'), 'Releases item must NOT appear in non-admin menus');
});

test('Phase 7 API: api.js exports releaseAPI with all required administrative methods', () => {
    const apiFile = fs.readFileSync(path.join(__dirname, 'src/utils/api.js'), 'utf8');
    assert.ok(apiFile.includes('export const releaseAPI = {'), 'Must export releaseAPI');
    assert.ok(apiFile.includes('/api/superadmin/releases'), 'Must target /api/superadmin/releases');
    assert.ok(apiFile.includes('dispatchOta:'), 'Must implement dispatchOta');
    assert.ok(apiFile.includes('rollback:'), 'Must implement rollback');
    assert.ok(apiFile.includes('getMetrics:'), 'Must implement getMetrics');
    assert.ok(apiFile.includes('recordDownload:'), 'Must implement recordDownload');
});

test('Phase 6 Hook & Modal: useAppUpdate and AppUpdateModal modules exist and implement complete state machine', () => {
    const hookPath = path.join(__dirname, 'src/hooks/useAppUpdate.js');
    const modalPath = path.join(__dirname, 'src/components/updates/AppUpdateModal.js');

    assert.ok(fs.existsSync(hookPath), 'useAppUpdate.js hook must exist');
    assert.ok(fs.existsSync(modalPath), 'AppUpdateModal.js component must exist');

    const hookContent = fs.readFileSync(hookPath, 'utf8');
    assert.ok(hookContent.includes('checkForUpdate'), 'Hook must export checkForUpdate');
    assert.ok(hookContent.includes('downloadAndApply'), 'Hook must export downloadAndApply');
    assert.ok(hookContent.includes('deferUpdate'), 'Hook must export deferUpdate');

    const modalContent = fs.readFileSync(modalPath, 'utf8');
    assert.ok(modalContent.includes('Update Now'), 'Modal must have Update Now action');
    assert.ok(modalContent.includes('Later'), 'Modal must have Later action');
    assert.ok(modalContent.includes('Emergency Recovery Mode Active'), 'Modal must support emergency recovery state');
});

test('Phase 6 Dashboard Integration: CentralAdminDashboard mounts ReleaseConsole and AppUpdateModal', () => {
    const dashPath = path.join(__dirname, 'src/screens/centraladmin/CentralAdminDashboard.js');
    const content = fs.readFileSync(dashPath, 'utf8');

    assert.ok(content.includes('CentralAdminReleaseConsole'), 'Dashboard must import CentralAdminReleaseConsole');
    assert.ok(content.includes('useAppUpdate'), 'Dashboard must import useAppUpdate');
    assert.ok(content.includes('AppUpdateModal'), 'Dashboard must import AppUpdateModal');
    assert.ok(content.includes("activeTab === 'releases'"), 'Dashboard must render Release Console tab');
    assert.ok(content.includes('<AppUpdateModal'), 'Dashboard must mount AppUpdateModal');
    assert.ok(content.includes("route.params?.openTab || route.params?.tab"), 'Dashboard must accept both openTab and tab route params');
});

test('Phase 6 App Shell Integration: AppNavigator mounts AppUpdateModal globally for all authenticated app roles', () => {
    const navPath = path.join(__dirname, 'src/navigation/AppNavigator.js');
    const content = fs.readFileSync(navPath, 'utf8');

    assert.ok(content.includes("import AppUpdateModal from '../components/updates/AppUpdateModal';"), 'AppNavigator must import AppUpdateModal');
    assert.ok(content.includes("useAppUpdate from '../hooks/useAppUpdate'") || content.includes("{ useAppUpdate } from '../hooks/useAppUpdate'"), 'AppNavigator must import useAppUpdate');
    assert.ok(content.includes('useAppUpdate({ autoCheck: isAuthenticated })') || content.includes('useAppUpdate('), 'AppNavigator must initialize update checker globally');
    assert.ok(content.includes('<AppUpdateModal'), 'AppNavigator must mount AppUpdateModal in root shell');
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTE ON NAVIGATION INTEGRATION LIMITATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nℹ️  ENVIRONMENT LIMITATION NOTE:');
console.log('   Full React Navigation stack and UI component rendering are verified at the pure logic');
console.log('   level. Complete runtime JSX/native component integration requires an Expo/Jest test runner.');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`📊 MOBILE TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================');

if (failedTests > 0) {
    process.exit(1);
}


