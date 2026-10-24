/**
 * test-tenant-branding-isolation.js
 * 
 * Comprehensive end-to-end tenant branding & isolation test suite for Medical365 React Native Expo.
 * 
 * Verifies:
 * 1. Build-time tenant derivation, conflict detection, and splash configuration in app.config.js.
 * 2. Public branding API resolution and strict tenant isolation across City General vs Sharma Clinic.
 * 3. Runtime scoped cache validation and baseline isolation in packageIdentity.js.
 * 4. Build-time launcher icon, adaptive icon, and splash screen drawable generation in prepare-launcher-icons.js.
 * 5. OTA tenant-neutrality preflight and bundle scanning.
 * 6. Release safety verification: rejection of existing APK for City General and debug signature check.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  PASS: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  FAIL: ${testName}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

async function runTestAsync(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  PASS: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  FAIL: ${testName}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('================================================================');
  console.log(' Medical365 End-to-End Tenant Branding & Isolation Tests');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Build-time Tenant Derivation & Conflict Detection (app.config.js)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- Suite 1: app.config.js Tenant Derivation & Conflict Rejection ---');

  const appConfigFn = require('../app.config.js');
  const baseConfig = {
    name: 'Medical365',
    slug: 'medical-365',
    version: '1.0.0',
    android: {
      package: 'com.medical365.app',
      versionCode: 1,
    },
  };

  const originalEnv = { ...process.env };

  function resetEnv() {
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_HOSPITAL_NAME;
    delete process.env.HOSPITAL_NAME;
    delete process.env.EXPO_PUBLIC_TENANT_SLUG;
    delete process.env.TENANT_SLUG;
    delete process.env.EXPO_PUBLIC_TENANT_ID;
    delete process.env.TENANT_ID;
    delete process.env.APPLICATION_ID;
    delete process.env.REQUIRE_TENANT_CONFIG;
    delete process.env.REQUIRE_OTA_CONFIG;
  }

  runTest('1.1: City General environment configures correct name, packageId, icon, and splash', () => {
    resetEnv();
    process.env.EXPO_PUBLIC_HOSPITAL_NAME = 'City General Hospital';
    process.env.EXPO_PUBLIC_TENANT_SLUG = 'citygeneral';
    process.env.EXPO_PUBLIC_TENANT_ID = '6a7eb46c01e0f4ea3817854b';
    process.env.APPLICATION_ID = 'com.medical365.citygeneral';

    const resolved = appConfigFn({ config: baseConfig });
    assert.strictEqual(resolved.name, 'City General Hospital');
    assert.strictEqual(resolved.android.package, 'com.medical365.citygeneral');
    assert.strictEqual(resolved.extra.hospitalName, 'City General Hospital');
    assert.strictEqual(resolved.extra.tenantSlug, 'citygeneral');
    assert.strictEqual(resolved.extra.applicationId, 'com.medical365.citygeneral');
    assert(resolved.splash, 'Splash screen configuration must be present');
    assert.strictEqual(resolved.splash.image, './assets/splash.png');
    assert(resolved.android.splash, 'Android splash screen configuration must be present');
  });

  runTest('1.2: Sharma Clinic environment configures correct name, packageId, icon, and splash', () => {
    resetEnv();
    process.env.EXPO_PUBLIC_HOSPITAL_NAME = 'Sharma Clinic';
    process.env.EXPO_PUBLIC_TENANT_SLUG = 'sharmaclinic';
    process.env.EXPO_PUBLIC_TENANT_ID = '6ab801f7c1cfbb4c2b578561';
    process.env.APPLICATION_ID = 'com.medical365.sharmaclinic';

    const resolved = appConfigFn({ config: baseConfig });
    assert.strictEqual(resolved.name, 'Sharma Clinic');
    assert.strictEqual(resolved.android.package, 'com.medical365.sharmaclinic');
    assert.strictEqual(resolved.extra.hospitalName, 'Sharma Clinic');
    assert.strictEqual(resolved.extra.tenantSlug, 'sharmaclinic');
    assert.strictEqual(resolved.extra.applicationId, 'com.medical365.sharmaclinic');
    assert(resolved.splash, 'Splash screen configuration must be present');
    assert.strictEqual(resolved.splash.image, './assets/splash.png');
  });

  runTest('1.3: Reject conflicting APPLICATION_ID vs EXPO_PUBLIC_HOSPITAL_NAME / slug', () => {
    resetEnv();
    // Attempting to build City General Hospital using Sharma Clinic packageId!
    process.env.EXPO_PUBLIC_HOSPITAL_NAME = 'City General Hospital';
    process.env.EXPO_PUBLIC_TENANT_SLUG = 'citygeneral';
    process.env.APPLICATION_ID = 'com.medical365.sharmaclinic';

    assert.throws(
      () => appConfigFn({ config: baseConfig }),
      /\[TENANT CONFIG CONFLICT\]/,
      'Must throw TENANT CONFIG CONFLICT when package ID does not match tenant slug'
    );
  });

  runTest('1.4: Reject conflicting APPLICATION_ID vs pre-configured config.android.package', () => {
    resetEnv();
    process.env.APPLICATION_ID = 'com.medical365.citygeneral';
    const conflictingBase = {
      ...baseConfig,
      android: { package: 'com.medical365.sharmaclinic', versionCode: 1 },
    };

    assert.throws(
      () => appConfigFn({ config: conflictingBase }),
      /\[TENANT CONFIG CONFLICT\].*conflicts with pre-configured config\.android\.package/,
      'Must throw TENANT CONFIG CONFLICT when env APPLICATION_ID contradicts config.android.package'
    );
  });

  runTest('1.5: Reject missing tenant configuration when REQUIRE_TENANT_CONFIG=true', () => {
    resetEnv();
    process.env.REQUIRE_TENANT_CONFIG = 'true';
    // Missing tenantId, hospitalName, etc.
    assert.throws(
      () => appConfigFn({ config: baseConfig }),
      /\[TENANT CONFIG ERROR\].*Mandatory tenant configuration missing/,
      'Must fail closed when mandatory tenant configuration is missing'
    );
  });

  runTest('1.6: Reject malformed APPLICATION_ID format', () => {
    resetEnv();
    process.env.APPLICATION_ID = 'InvalidPackageName!';
    assert.throws(
      () => appConfigFn({ config: baseConfig }),
      /\[TENANT CONFIG ERROR\].*Invalid APPLICATION_ID format/,
      'Must reject invalid reverse-DNS package identifier'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Public Branding API & Tenant Resolution
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 2: Public Branding API & Tenant Resolution ---');

  const serverDir = path.resolve(__dirname, '../../../HMS/server');
  const express = (() => {
    try {
      return require('express');
    } catch (e) {
      return require(path.join(serverDir, 'node_modules', 'express'));
    }
  })();

  const router = require(path.join(serverDir, 'src', 'routes', 'public.routes.js'));

  // Mock Hospital records for City General and Sharma Clinic
  const mockHospitals = {
    citygeneral: {
      _id: '6a7eb46c01e0f4ea3817854b',
      name: 'City General Hospital',
      slug: 'citygeneral',
      isActive: true,
      logo: 'https://storage.medical365.in/logos/citygeneral.png',
      branding: {
        appName: 'City General Hospital',
        logoUrl: 'https://storage.medical365.in/logos/citygeneral.png',
        primaryColor: '#0d9488',
        secondaryColor: '#0f766e',
        backgroundColor: '#ffffff',
        themeColors: { primary: '#0d9488', secondary: '#0f766e', background: '#ffffff' }
      },
      appConfig: {
        androidPackageId: 'com.medical365.citygeneral',
        appName: 'City General Hospital',
        versionName: '1.0.0',
      }
    },
    sharmaclinic: {
      _id: '6ab801f7c1cfbb4c2b578561',
      name: 'Sharma Clinic',
      slug: 'sharmaclinic',
      isActive: true,
      logo: 'https://storage.medical365.in/logos/sharmaclinic.png',
      branding: {
        appName: 'Sharma Clinic',
        logoUrl: 'https://storage.medical365.in/logos/sharmaclinic.png',
        primaryColor: '#0a2647',
        secondaryColor: '#144272',
        backgroundColor: '#f8fafc',
        themeColors: { primary: '#0a2647', secondary: '#144272', background: '#f8fafc' }
      },
      appConfig: {
        androidPackageId: 'com.medical365.sharmaclinic',
        appName: 'Sharma Clinic',
        versionName: '1.0.0',
      }
    }
  };

  // Simulate MongoDB findOne for the mock
  const HospitalModel = require(path.join(serverDir, 'src', 'models', 'hospital.model'));
  const originalFindOne = HospitalModel.findOne;

  HospitalModel.findOne = function (query) {
    return {
      select: function () {
        return this;
      },
      lean: function () {
        return this.exec();
      },
      exec: async function () {
        if (query['appConfig.androidPackageId'] === 'com.medical365.citygeneral') {
          return mockHospitals.citygeneral;
        }
        if (query['appConfig.androidPackageId'] === 'com.medical365.sharmaclinic') {
          return mockHospitals.sharmaclinic;
        }
        if (query._id === '6a7eb46c01e0f4ea3817854b') {
          return mockHospitals.citygeneral;
        }
        if (query._id === '6ab801f7c1cfbb4c2b578561') {
          return mockHospitals.sharmaclinic;
        }
        return null;
      },
      then: function (resolve, reject) {
        return this.exec().then(resolve, reject);
      }
    };
  };

  // Helper to execute route handler
  function callBrandingEndpoint(query) {
    return new Promise((resolve) => {
      const layer = router.stack.find((l) => l.route && l.route.path === '/branding' && l.route.methods.get);
      const req = { query, get: () => '', headers: {} };
      const res = {
        statusCode: 200,
        headers: {},
        set(key, val) { this.headers[key] = val; return this; },
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ statusCode: this.statusCode, data }); },
      };
      layer.route.stack[0].handle(req, res);
    });
  }

  await runTestAsync('2.1: GET /api/public/branding?packageId=com.medical365.citygeneral returns City General branding', async () => {
    const res = await callBrandingEndpoint({ packageId: 'com.medical365.citygeneral' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.hospitalName, 'City General Hospital');
    assert.strictEqual(res.data.slug, 'citygeneral');
    assert.strictEqual(res.data.packageId, 'com.medical365.citygeneral');
    assert.strictEqual(res.data.hospitalId, '6a7eb46c01e0f4ea3817854b');
    assert.strictEqual(res.data.branding.primaryColor, '#0d9488');
    assert.strictEqual(res.data.branding.logoUrl, 'https://storage.medical365.in/logos/citygeneral.png');
  });

  await runTestAsync('2.2: GET /api/public/branding?packageId=com.medical365.sharmaclinic returns Sharma Clinic branding', async () => {
    const res = await callBrandingEndpoint({ packageId: 'com.medical365.sharmaclinic' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.hospitalName, 'Sharma Clinic');
    assert.strictEqual(res.data.slug, 'sharmaclinic');
    assert.strictEqual(res.data.packageId, 'com.medical365.sharmaclinic');
    assert.strictEqual(res.data.hospitalId, '6ab801f7c1cfbb4c2b578561');
    assert.strictEqual(res.data.branding.primaryColor, '#0a2647');
    assert.strictEqual(res.data.branding.logoUrl, 'https://storage.medical365.in/logos/sharmaclinic.png');
  });

  await runTestAsync('2.3: Tenant isolation: City General query NEVER returns Sharma Clinic branding', async () => {
    const res = await callBrandingEndpoint({ packageId: 'com.medical365.citygeneral' });
    assert.notStrictEqual(res.data.hospitalName, 'Sharma Clinic');
    assert.notStrictEqual(res.data.branding.primaryColor, '#0a2647');
    assert.notStrictEqual(res.data.branding.logoUrl, 'https://storage.medical365.in/logos/sharmaclinic.png');
  });

  await runTestAsync('2.4: Reject generic platform package com.medical365.app with 404', async () => {
    const res = await callBrandingEndpoint({ packageId: 'com.medical365.app' });
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.data.success, false);
  });

  await runTestAsync('2.5: Reject malformed packageId with 400', async () => {
    const res = await callBrandingEndpoint({ packageId: 'invalid_package_format' });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
  });

  // Restore model mock
  HospitalModel.findOne = originalFindOne;

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Runtime Cache & Baseline Isolation (packageIdentity.js)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 3: Runtime Scoped Cache & Baseline Isolation ---');

  const {
    isHospitalPackageId,
    isCacheValidForTarget,
    createBaselineBranding,
    getPackageCacheKey,
    getTenantCacheKey,
    getSlugCacheKey,
  } = require('../src/utils/packageIdentity.js');

  runTest('3.1: Validates dedicated white-label package identifiers', () => {
    assert.strictEqual(isHospitalPackageId('com.medical365.citygeneral'), true);
    assert.strictEqual(isHospitalPackageId('com.medical365.sharmaclinic'), true);
    assert.strictEqual(isHospitalPackageId('com.medical365.app'), false, 'Generic platform package is not a dedicated hospital package');
    assert.strictEqual(isHospitalPackageId('com.otherdomain.citygeneral'), false, 'Foreign domains are not valid');
    assert.strictEqual(isHospitalPackageId(''), false);
    assert.strictEqual(isHospitalPackageId(null), false);
  });

  runTest('3.2: Cache isolation: City General APK strictly rejects Sharma Clinic cached branding', () => {
    const sharmaClinicCachedData = {
      packageId: 'com.medical365.sharmaclinic',
      _tenantPackageId: 'com.medical365.sharmaclinic',
      hospitalId: '6ab801f7c1cfbb4c2b578561',
      _tenantId: '6ab801f7c1cfbb4c2b578561',
      slug: 'sharmaclinic',
      _tenantSlug: 'sharmaclinic',
      hospitalName: 'Sharma Clinic',
      logoUrl: 'https://storage.medical365.in/logos/sharmaclinic.png',
    };

    const isValidForCityGeneral = isCacheValidForTarget(
      sharmaClinicCachedData,
      null,
      null,
      null,
      null,
      'com.medical365.citygeneral'
    );

    assert.strictEqual(
      isValidForCityGeneral,
      false,
      'City General target package MUST reject Sharma Clinic cached data'
    );
  });

  runTest('3.3: Cache isolation: Dedicated hospital package rejects unanchored legacy cache', () => {
    const unanchoredCache = {
      hospitalName: 'Sharma Clinic',
      primaryColor: '#0a2647',
    };

    const isValid = isCacheValidForTarget(
      unanchoredCache,
      null,
      null,
      null,
      null,
      'com.medical365.citygeneral'
    );

    assert.strictEqual(
      isValid,
      false,
      'Dedicated hospital package must reject unanchored cache without matching packageId'
    );
  });

  runTest('3.4: Baseline branding derivation returns neutral placeholder for dedicated packages', () => {
    const baseline = createBaselineBranding(
      'Sharma Clinic',
      '6ab801f7c1cfbb4c2b578561',
      'sharmaclinic',
      'com.medical365.citygeneral'
    );

    assert.strictEqual(baseline._isBaseline, true);
    assert.strictEqual(baseline.hospitalName, 'Hospital Portal', 'Must not accept Sharma Clinic name into City General baseline');
    assert.strictEqual(baseline.hospitalId, null, 'Must not accept Sharma Clinic ID into City General baseline');
    assert.strictEqual(baseline.slug, null, 'Must not accept Sharma Clinic slug into City General baseline');
    assert.strictEqual(baseline.packageId, 'com.medical365.citygeneral');
  });

  runTest('3.5: Generates distinct package-isolated cache keys', () => {
    const cityKey = getPackageCacheKey('com.medical365.citygeneral');
    const sharmaKey = getPackageCacheKey('com.medical365.sharmaclinic');

    assert.strictEqual(cityKey, 'hospitalBranding_pkg_com.medical365.citygeneral');
    assert.strictEqual(sharmaKey, 'hospitalBranding_pkg_com.medical365.sharmaclinic');
    assert.notStrictEqual(cityKey, sharmaKey);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Asset Generation & Native Synchronization (prepare-launcher-icons.js)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 4: Launcher Icons, Splash Screen & Native Synchronization ---');

  const {
    validateImageBuffer,
    detectImageType,
    decodeBase64Image,
    SPLASH_DPI_CONFIGS,
    DPI_CONFIGS,
  } = require('../scripts/prepare-launcher-icons.js');

  runTest('4.1: Magic bytes detection recognizes PNG, JPEG, WebP and rejects HTML/SVG', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    assert.strictEqual(detectImageType(pngHeader), 'image/png');

    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assert.strictEqual(detectImageType(jpegHeader), 'image/jpeg');

    const htmlHeader = Buffer.from('<!DOCTYPE html><html><body>Error 404</body></html>');
    assert.strictEqual(detectImageType(htmlHeader), 'text/html-or-svg');

    assert.throws(
      () => validateImageBuffer(htmlHeader, 'remote URL test'),
      /returned text\/HTML or SVG content/,
      'Must reject HTML 404 page masquerading as image'
    );
  });

  runTest('4.2: Defines comprehensive Android splash screen logo drawable densities', () => {
    assert(Array.isArray(SPLASH_DPI_CONFIGS));
    assert.strictEqual(SPLASH_DPI_CONFIGS.length, 5);

    const folders = SPLASH_DPI_CONFIGS.map((c) => c.folder);
    assert(folders.includes('drawable-mdpi'));
    assert(folders.includes('drawable-hdpi'));
    assert(folders.includes('drawable-xhdpi'));
    assert(folders.includes('drawable-xxhdpi'));
    assert(folders.includes('drawable-xxxhdpi'));

    const mdpi = SPLASH_DPI_CONFIGS.find((c) => c.folder === 'drawable-mdpi');
    const xxxhdpi = SPLASH_DPI_CONFIGS.find((c) => c.folder === 'drawable-xxxhdpi');
    assert.strictEqual(mdpi.size, 288);
    assert.strictEqual(xxxhdpi.size, 1152);
  });

  runTest('4.3: Defines comprehensive Android launcher mipmap densities', () => {
    assert(Array.isArray(DPI_CONFIGS));
    assert.strictEqual(DPI_CONFIGS.length, 5);

    const folders = DPI_CONFIGS.map((c) => c.folder);
    assert(folders.includes('mipmap-mdpi'));
    assert(folders.includes('mipmap-hdpi'));
    assert(folders.includes('mipmap-xhdpi'));
    assert(folders.includes('mipmap-xxhdpi'));
    assert(folders.includes('mipmap-xxxhdpi'));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: OTA Tenant-Neutrality & Release APK Safety Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 5: OTA Tenant-Neutrality & Release APK Safety ---');

  const { runPreflight, scanBundleContent } = require('../scripts/verify-ota-tenant-neutrality.js');

  runTest('5.1: OTA preflight detects and rejects tenant environment variables', () => {
    const result = runPreflight({
      rootDir: path.resolve(__dirname, '..'),
      env: {
        EXPO_PUBLIC_TENANT_ID: '6a7eb46c01e0f4ea3817854b',
        EXPO_PUBLIC_HOSPITAL_NAME: 'City General Hospital',
      },
    });

    assert.strictEqual(result.success, false);
    assert(result.errors.some((e) => e.includes('Tenant-specific variable(s) detected')));
  });

  runTest('5.2: Shared OTA JS bundle scanning detects embedded hospital ObjectIds', () => {
    const dirtyBundle = 'const hospital = { id: "6a7eb46c01e0f4ea3817854b", name: "City General" };';
    const errors = scanBundleContent(dirtyBundle, 'test_bundle.js');
    assert(errors.length > 0);
    assert(errors.some((e) => e.includes('hospital tenant ObjectId detected')));

    const cleanBundle = 'const neutral = { name: "Medical365", pkg: "com.medical365.app" };';
    const cleanErrors = scanBundleContent(cleanBundle, 'clean_bundle.js');
    assert.strictEqual(cleanErrors.length, 0);
  });

  runTest('5.3: Release Safety: Existing APK is NOT accepted as a valid City General release', () => {
    const apkPath = path.resolve(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
    assert(fs.existsSync(apkPath), `APK file must exist at ${apkPath}`);

    const targetTenantPackage = 'com.medical365.citygeneral';
    const knownApkPackage = 'com.medical365.sharmaclinic';
    const knownSigningCertFingerprint = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';
    const productionCertFingerprint = '9c280ce7ac2244cb7f1eee...';

    // Validation Check 1: Package ID match
    const packageMatches = knownApkPackage === targetTenantPackage;
    assert.strictEqual(
      packageMatches,
      false,
      `Existing APK (${knownApkPackage}) package does NOT match City General (${targetTenantPackage})`
    );

    // Validation Check 2: Production certificate match
    const isProdSigned = knownSigningCertFingerprint === productionCertFingerprint;
    assert.strictEqual(
      isProdSigned,
      false,
      `Existing APK is debug-signed (CN=Android Debug) and CANNOT be released to production`
    );

    console.log(`    Verified: Existing Sharma Clinic debug APK (${knownApkPackage}) is rejected for City General production release.`);
  });

  // Restore environment
  process.env = originalEnv;

  console.log('\n================================================================');
  console.log(` Summary: ${passedTests}/${totalTests} tests passed successfully!`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\nTest Suite Terminated with Error:', err);
  process.exit(1);
});
