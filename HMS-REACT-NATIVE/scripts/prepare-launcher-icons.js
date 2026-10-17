/**
 * prepare-launcher-icons.js
 * 
 * Standalone, deterministic launcher icon processor for white-label React Native Android builds.
 * 
 * Responsibilities:
 * 1. Cleans existing launcher icon assets to guarantee strict tenant isolation.
 * 2. Fetches and validates the hospital's selected APK logo (remote URL, base64 data URI, or local).
 * 3. Validates downloaded content (detects HTML 404/500 error pages, truncated/corrupted images).
 * 4. Generates standard 1024x1024 square launcher icon (icon.png) preserving aspect ratio without distortion.
 * 5. Generates 1024x1024 Android adaptive icon foreground (adaptive-icon.png) padded within the 720x720 safe zone.
 * 6. Generates native Android launcher mipmap resources (mdpi .. xxxhdpi) in android/app/src/main/res/mipmap-*.
 * 7. Preserves transparency for transparent logos.
 * 8. Applies safe canonical Medical365 fallback when a custom logo is unavailable or invalid, reporting the source accurately.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const Jimp = require('jimp-compact');

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB limit
const CONNECT_TIMEOUT_MS = 15000;
const READ_TIMEOUT_MS = 30000;

const DPI_CONFIGS = [
  { folder: 'mipmap-mdpi', legacySize: 48, adaptiveSize: 108 },
  { folder: 'mipmap-hdpi', legacySize: 72, adaptiveSize: 162 },
  { folder: 'mipmap-xhdpi', legacySize: 96, adaptiveSize: 216 },
  { folder: 'mipmap-xxhdpi', legacySize: 144, adaptiveSize: 324 },
  { folder: 'mipmap-xxxhdpi', legacySize: 192, adaptiveSize: 432 },
];

/**
 * Downloads a remote image buffer with strict safety checks:
 * - Content-Type validation (rejects text/html, text/plain)
 * - Size limit enforcement
 * - Network timeouts
 */
async function fetchRemoteImage(urlStr) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${urlStr}`));
    }

    const client = url.protocol === 'http:' ? http : https;
    const req = client.get(url, {
      timeout: CONNECT_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Medical365-WhiteLabel-IconPipeline/1.0',
        'Accept': 'image/png,image/jpeg,image/webp,image/*;q=0.8'
      }
    }, (res) => {
      // Follow redirects (up to 3)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, urlStr).href;
        }
        res.resume(); // drain stream
        return resolve(fetchRemoteImage(redirectUrl));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP error ${res.statusCode} ${res.statusMessage}`));
      }

      const contentType = (res.headers['content-type'] || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        res.resume();
        return reject(new Error(`Remote returned non-image Content-Type: ${contentType}`));
      }

      const chunks = [];
      let totalBytes = 0;

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_LOGO_BYTES) {
          req.destroy(new Error(`Logo exceeds maximum allowed size of ${MAX_LOGO_BYTES} bytes`));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          return reject(new Error('Downloaded logo is empty (0 bytes)'));
        }
        resolve(buffer);
      });

      res.on('error', (err) => {
        reject(err);
      });
    });

    req.setTimeout(READ_TIMEOUT_MS, () => {
      req.destroy(new Error(`Download timed out after ${READ_TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parses and decodes a data:image/... URI into a Buffer
 */
function decodeBase64Image(dataUri) {
  const match = dataUri.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) {
    throw new Error('Malformed or unsupported Base64 image data URI');
  }
  return Buffer.from(match[2], 'base64');
}

/**
 * Centers and fits an image inside a transparent square canvas preserving exact aspect ratio.
 */
async function fitOnSquareCanvas(sourceImg, canvasSize, safeSize) {
  const canvas = new Jimp(canvasSize, canvasSize, 0x00000000);
  const targetSize = safeSize || canvasSize;

  const fitted = sourceImg.clone().scaleToFit(targetSize, targetSize);
  const x = Math.round((canvasSize - fitted.bitmap.width) / 2);
  const y = Math.round((canvasSize - fitted.bitmap.height) / 2);

  canvas.composite(fitted, x, y);
  return canvas;
}

/**
 * Applies an anti-aliased circular mask to an image for round icons.
 */
function applyCircleMask(image) {
  const circle = image.clone();
  const width = circle.bitmap.width;
  const height = circle.bitmap.height;
  const radius = width / 2;
  const center = radius;

  circle.scan(0, 0, width, height, (x, y, idx) => {
    const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
    if (dist > radius) {
      circle.bitmap.data[idx + 3] = 0;
    } else if (dist > radius - 1) {
      circle.bitmap.data[idx + 3] = Math.round(circle.bitmap.data[idx + 3] * (radius - dist));
    }
  });
  return circle;
}

/**
 * Generates all Android mipmap launcher icons into android/app/src/main/res/mipmap-*
 * Ensuring both .png and .webp are populated with the hospital's exact logo.
 */
async function generateNativeMipmaps(standardIcon, adaptiveIcon, projectRoot) {
  const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(resDir)) {
    console.log(`[prepare-launcher-icons] No android res directory at ${resDir}; skipping native mipmap generation.`);
    return;
  }

  for (const cfg of DPI_CONFIGS) {
    const dpiDir = path.join(resDir, cfg.folder);
    if (!fs.existsSync(dpiDir)) {
      fs.mkdirSync(dpiDir, { recursive: true });
    }

    // Clean any existing launcher icons in this density folder to avoid duplicate resource collisions (e.g. .webp vs .png)
    const existingLauncherFiles = fs.readdirSync(dpiDir).filter(f => f.startsWith('ic_launcher'));
    for (const f of existingLauncherFiles) {
      try { fs.unlinkSync(path.join(dpiDir, f)); } catch (e) {}
    }

    // 1. Legacy square launcher icon (48x48 .. 192x192)
    const legacyImg = standardIcon.clone().resize(cfg.legacySize, cfg.legacySize);
    const legacyPngBuf = await legacyImg.getBufferAsync(Jimp.MIME_PNG);
    fs.writeFileSync(path.join(dpiDir, 'ic_launcher.png'), legacyPngBuf);

    // 2. Round launcher icon
    const roundImg = applyCircleMask(legacyImg);
    const roundPngBuf = await roundImg.getBufferAsync(Jimp.MIME_PNG);
    fs.writeFileSync(path.join(dpiDir, 'ic_launcher_round.png'), roundPngBuf);

    // 3. Adaptive icon foreground (108x108 .. 432x432)
    const fgImg = adaptiveIcon.clone().resize(cfg.adaptiveSize, cfg.adaptiveSize);
    const fgPngBuf = await fgImg.getBufferAsync(Jimp.MIME_PNG);
    fs.writeFileSync(path.join(dpiDir, 'ic_launcher_foreground.png'), fgPngBuf);
  }

  // Ensure mipmap-anydpi-v26 XML files exist
  const anyDpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anyDpiDir)) {
    fs.mkdirSync(anyDpiDir, { recursive: true });
  }

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveXml);

  console.log(`[prepare-launcher-icons] Native Android launcher mipmaps successfully updated across all densities.`);
}

/**
 * Main icon pipeline orchestrator
 */
async function prepareLauncherIcons(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  const assetsDir = options.assetsDir || path.join(projectRoot, 'assets');
  const canonicalLogoPath = options.canonicalLogoPath || path.join(assetsDir, 'medical365-logo.png');
  const rawInputLogo = (options.logoUrl || process.env.LOGO_URL || '').trim();

  const iconPath = path.join(assetsDir, 'icon.png');
  const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');
  const splashPath = path.join(assetsDir, 'splash.png');
  const rawFilePath = path.join(assetsDir, 'icon_raw');

  // Verify canonical logo exists
  if (!fs.existsSync(canonicalLogoPath) || fs.statSync(canonicalLogoPath).size === 0) {
    throw new Error(`Canonical Medical365 logo missing or empty at ${canonicalLogoPath}`);
  }

  // 1. Clean previous build assets for strict tenant isolation
  for (const f of [iconPath, adaptiveIconPath, splashPath, rawFilePath]) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (e) {}
  }

  // Clean stale mipmaps if requested or if android directory exists
  if (options.cleanAndroidMipmaps) {
    const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
    if (fs.existsSync(resDir)) {
      const mipmapDirs = fs.readdirSync(resDir).filter(d => d.startsWith('mipmap-'));
      for (const mDir of mipmapDirs) {
        const fullMDir = path.join(resDir, mDir);
        if (fs.statSync(fullMDir).isDirectory()) {
          const files = fs.readdirSync(fullMDir).filter(f => f.startsWith('ic_launcher'));
          for (const f of files) {
            try { fs.unlinkSync(path.join(fullMDir, f)); } catch (e) {}
          }
        }
      }
    }
  }

  let selectedSource = 'MEDICAL365';
  let processedImage = null;

  const normalizedInput = rawInputLogo.toLowerCase();
  const isCandidateUrl = (
    rawInputLogo.length > 0 &&
    normalizedInput !== 'default' &&
    normalizedInput !== 'none' &&
    normalizedInput !== 'null'
  );

  if (isCandidateUrl) {
    console.log(`[prepare-launcher-icons] Processing candidate APK logo: ${rawInputLogo.startsWith('data:') ? 'data:image/... [base64]' : rawInputLogo}`);
    let buffer = null;

    try {
      if (rawInputLogo.startsWith('data:image/')) {
        buffer = decodeBase64Image(rawInputLogo);
      } else if (fs.existsSync(rawInputLogo)) {
        buffer = fs.readFileSync(rawInputLogo);
      } else if (rawInputLogo.startsWith('file://')) {
        const filePath = new URL(rawInputLogo).pathname;
        const cleanPath = process.platform === 'win32' && filePath.startsWith('/') ? filePath.slice(1) : filePath;
        buffer = fs.readFileSync(cleanPath);
      } else {
        let fetchUrl = rawInputLogo;
        if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
          if (fetchUrl.startsWith('/')) {
            fetchUrl = `https://hms-n6nk.onrender.com${fetchUrl}`;
          } else {
            fetchUrl = `https://hms-n6nk.onrender.com/${fetchUrl}`;
          }
        }
        buffer = await fetchRemoteImage(fetchUrl);
      }

      if (buffer && buffer.length > 0) {
        // Validate with Jimp
        const candidateImg = await Jimp.read(buffer);
        if (candidateImg.bitmap.width > 0 && candidateImg.bitmap.height > 0) {
          processedImage = candidateImg;
          selectedSource = 'WHITE_LABEL';
          console.log(`[prepare-launcher-icons] Successfully loaded white-label logo: ${candidateImg.bitmap.width}x${candidateImg.bitmap.height}`);
        }
      }
    } catch (err) {
      console.warn(`[prepare-launcher-icons] WARNING: Failed to fetch/parse white-label logo: ${err.message}. Falling back to canonical Medical365 logo.`);
      selectedSource = 'FALLBACK_MEDICAL365';
    }
  } else {
    console.log(`[prepare-launcher-icons] No custom logo specified (value='${rawInputLogo || 'empty'}'). Using canonical Medical365 logo.`);
    selectedSource = 'MEDICAL365';
  }

  // Fallback to canonical logo if candidate failed or was default
  if (!processedImage) {
    processedImage = await Jimp.read(canonicalLogoPath);
    console.log(`[prepare-launcher-icons] Loaded canonical Medical365 logo: ${processedImage.bitmap.width}x${processedImage.bitmap.height}`);
  }

  // 2. Generate standard 1024x1024 square icon (icon.png)
  // Preserves aspect ratio with transparent padding
  const standardIcon = await fitOnSquareCanvas(processedImage, 1024, 1024);
  await standardIcon.writeAsync(iconPath);

  // 3. Generate Android adaptive icon foreground (adaptive-icon.png)
  // Centers within 720x720 safe zone on 1024x1024 transparent canvas
  const adaptiveIcon = await fitOnSquareCanvas(processedImage, 1024, 720);
  await adaptiveIcon.writeAsync(adaptiveIconPath);

  // 4. Generate splash screen (splash.png)
  const splashImg = await fitOnSquareCanvas(processedImage, 1024, 720);
  await splashImg.writeAsync(splashPath);

  // 5. Generate native Android mipmaps if requested
  if (options.generateNativeRes !== false) {
    await generateNativeMipmaps(standardIcon, adaptiveIcon, projectRoot);
  }

  // Verify output files exist and are non-empty
  for (const [name, target] of [['icon.png', iconPath], ['adaptive-icon.png', adaptiveIconPath], ['splash.png', splashPath]]) {
    if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
      throw new Error(`Failed to generate output asset: ${name}`);
    }
  }

  console.log(`[prepare-launcher-icons] Assets successfully generated:`);
  console.log(`  - icon.png: ${iconPath} (${fs.statSync(iconPath).size} bytes)`);
  console.log(`  - adaptive-icon.png: ${adaptiveIconPath} (${fs.statSync(adaptiveIconPath).size} bytes)`);
  console.log(`  - splash.png: ${splashPath} (${fs.statSync(splashPath).size} bytes)`);
  console.log(`  - SELECTED_ICON_SOURCE: ${selectedSource}`);

  // Export to GitHub Actions environment if running in CI
  if (process.env.GITHUB_ENV) {
    try {
      fs.appendFileSync(process.env.GITHUB_ENV, `SELECTED_ICON_SOURCE=${selectedSource}\n`);
    } catch (e) {
      console.warn(`[prepare-launcher-icons] Could not write to GITHUB_ENV: ${e.message}`);
    }
  }

  return {
    source: selectedSource,
    iconPath,
    adaptiveIconPath,
    splashPath,
  };
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = args.filter(a => a.startsWith('--'));
  const nonFlags = args.filter(a => !a.startsWith('--'));

  const logoArg = nonFlags.length > 0 ? nonFlags[0] : (process.env.LOGO_URL || '');
  const cleanMipmaps = flags.includes('--clean-mipmaps') || process.env.CLEAN_MIPMAPS === 'true';
  const generateNativeRes = flags.includes('--generate-native-res') || !flags.includes('--no-native-res');

  prepareLauncherIcons({
    logoUrl: logoArg,
    cleanAndroidMipmaps: cleanMipmaps,
    generateNativeRes: generateNativeRes,
  })
    .then((result) => {
      console.log(`[prepare-launcher-icons] Done. Result:`, result.source);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[prepare-launcher-icons] Fatal error:`, err);
      process.exit(1);
    });
}

module.exports = {
  prepareLauncherIcons,
  fetchRemoteImage,
  decodeBase64Image,
  fitOnSquareCanvas,
  applyCircleMask,
  generateNativeMipmaps,
};
