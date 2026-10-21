/**
 * configure-release-signing.js
 * 
 * Ensures that android/app/build.gradle contains the secure production release signing
 * configuration even after `npx expo prebuild --clean` regenerates the android directory.
 */

const fs = require('fs');
const path = require('path');

function configureReleaseSigning() {
  const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

  if (!fs.existsSync(gradlePath)) {
    console.error(`[configure-release-signing] ERROR: build.gradle not found at ${gradlePath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(gradlePath, 'utf8');

  if (content.includes('ANDROID_KEYSTORE_PATH') && content.includes('signingConfigs.release')) {
    console.log('[configure-release-signing] Production release signing block already configured in build.gradle.');
    return;
  }

  console.log('[configure-release-signing] Patching android/app/build.gradle with production signing configuration...');

  const releaseSigningBlock = `        release {
            def propKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH") ?: findProperty("ANDROID_KEYSTORE_PATH")
            def propKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: findProperty("ANDROID_KEYSTORE_PASSWORD")
            def propKeyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: findProperty("ANDROID_KEY_ALIAS")
            def propKeyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: findProperty("ANDROID_KEY_PASSWORD")
            def isProductionBuild = (System.getenv("PRODUCTION_RELEASE_BUILD") == "true") || (findProperty("productionReleaseBuild") == "true")

            if (propKeystorePath && propKeystorePassword && propKeyAlias && propKeyPassword) {
                def keystoreFile = file(propKeystorePath)
                if (!keystoreFile.exists()) {
                    throw new GradleException("[Signing Security] Production keystore file does not exist at path: \${propKeystorePath}")
                }
                storeFile = keystoreFile
                storePassword = propKeystorePassword
                keyAlias = propKeyAlias
                keyPassword = propKeyPassword
                println "[Signing Security] Configured release build with production keystore: \${keystoreFile.name} (alias: \${propKeyAlias})"
            } else if (isProductionBuild) {
                throw new GradleException("[Signing Security] PRODUCTION_RELEASE_BUILD is true, but required production signing environment variables are missing (ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD).")
            } else {
                // Legacy / local development fallback: use debug.keystore
                storeFile = file('debug.keystore')
                storePassword = 'android'
                keyAlias = 'androiddebugkey'
                keyPassword = 'android'
                println "[Signing Security] No production signing credentials provided; using debug.keystore for release build (legacy/dev mode)."
            }
        }`;

  // 1. Add release signingConfig if missing
  if (!content.includes('ANDROID_KEYSTORE_PATH')) {
    const signingConfigsRegex = /signingConfigs\s*\{([\s\S]*?debug\s*\{[\s\S]*?\})([\s\S]*?)\}/;
    if (signingConfigsRegex.test(content)) {
      content = content.replace(signingConfigsRegex, (match, debugBlock) => {
        return `signingConfigs {${debugBlock}\n${releaseSigningBlock}\n    }`;
      });
    } else {
      console.warn('[configure-release-signing] Could not match signingConfigs block pattern.');
    }
  }

  // 2. Ensure buildTypes.release uses signingConfig signingConfigs.release
  content = content.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );

  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log('[configure-release-signing] Successfully ensured production release signing in build.gradle.');
}

if (require.main === module) {
  configureReleaseSigning();
}

module.exports = { configureReleaseSigning };
