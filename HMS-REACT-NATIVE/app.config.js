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

  return {
    ...config,
    name: hospitalName,
    slug: tenantSlug,
    android: {
      ...(config.android || {}),
      package: applicationId,
    },
    extra: {
      ...(config.extra || {}),
      hospitalName,
      tenantSlug,
      tenantId,
      applicationId,
    },
  };
};
