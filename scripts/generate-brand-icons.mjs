import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const imgAssetsDir = path.join(rootDir, 'src', 'assets', 'images');
const srcCrestPath = path.join(imgAssetsDir, 'royal_crest_master.png');
const srcFortressPath = path.join(imgAssetsDir, 'login_himalayan_fortress_1795507273124.jpg');
const publicDir = path.join(rootDir, 'public');
const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');

const BG_COLOR = { r: 10, g: 14, b: 20, alpha: 1 }; // #0a0e14
const BG_HEX = '#0a0e14';

function createRoundedRectMask(size, radiusRatio = 0.21) {
  const r = Math.max(2, Math.round(size * radiusRatio));
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/>
    </svg>
  `;
  return Buffer.from(svg);
}

function createCircleClipMask(size) {
  const half = size / 2;
  const r = half - 0.5;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${half}" cy="${half}" r="${r}" fill="white"/>
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * Extracts the inner rounded-square royal crest cleanly (trimming any outer screenshot margin),
 * upscales cleanly with lanczos3, and clips outer corner pixels so edges sit seamlessly on #0a0e14.
 */
async function extractCleanCrestSquare(targetSize, { roundCornerClip = true } = {}) {
  const meta = await sharp(srcCrestPath).metadata();
  const w = meta.width || 140;
  const h = meta.height || 136;

  // For the 140x136 master badge, the gold squircle rim spans x: 9..131, y: 7..129 (123x123).
  const isDefaultMaster = w === 140 && h === 136;
  const cropBox = isDefaultMaster
    ? { left: 9, top: 7, width: 123, height: 123 }
    : (() => {
        const side = Math.min(w, h);
        const trim = Math.round(side * 0.05);
        const dim = Math.max(32, side - trim * 2);
        return {
          left: Math.floor((w - dim) / 2),
          top: Math.floor((h - dim) / 2),
          width: dim,
          height: dim,
        };
      })();

  let pipeline = sharp(srcCrestPath)
    .extract(cropBox)
    .resize(targetSize, targetSize, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha();

  if (targetSize >= 64) {
    pipeline = pipeline.sharpen({ sigma: 0.6, m1: 0.4, m2: 1.2 });
  }

  let buf = await pipeline.png().toBuffer();

  if (roundCornerClip) {
    const mask = createRoundedRectMask(targetSize, 0.215);
    buf = await sharp(buf)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  return buf;
}

async function renderCrestOnBackground(
  size,
  crestScale = 0.94,
  { transparent = false, circleClip = false, format = 'png', quality = 90 } = {}
) {
  const crestSize = Math.min(size, Math.max(12, Math.round(size * crestScale)));
  const crestBuf = await extractCleanCrestSquare(crestSize, { roundCornerClip: true });

  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : BG_COLOR,
    },
  });

  const composited = await base
    .composite([{ input: crestBuf, gravity: 'center' }])
    .png()
    .toBuffer();

  if (circleClip) {
    const circleMask = createCircleClipMask(size);
    return sharp(composited)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  if (!transparent) {
    const out = sharp(composited).removeAlpha();
    if (format === 'webp') {
      return out.webp({ quality, effort: 5 }).toBuffer();
    }
    return out.png({ compressionLevel: 9, palette: size <= 256 }).toBuffer();
  }
  return composited;
}

async function renderSplash(width, height) {
  const shortSide = Math.min(width, height);
  const crestSize = Math.round(shortSide * 0.56);
  const crestBuf = await extractCleanCrestSquare(crestSize, { roundCornerClip: true });

  const glowSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="48%" r="55%">
          <stop offset="0%" stop-color="#17232c" stop-opacity="1"/>
          <stop offset="55%" stop-color="#0d131b" stop-opacity="1"/>
          <stop offset="100%" stop-color="${BG_HEX}" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bgGlow)"/>
    </svg>
  `);

  return sharp(glowSvg)
    .composite([{ input: crestBuf, gravity: 'center' }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function packPngsAsIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dirEntries = [];
  let offset = 6 + entries.length * 16;

  for (const { size, data } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(data.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirEntries.push(dir);
    offset += data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...entries.map((e) => e.data)]);
}

async function optimizeWebAppImages() {
  // Tightly framed, featherweight Royal Crest UI asset
  fs.writeFileSync(
    path.join(imgAssetsDir, 'royal_crest_ui.webp'),
    await renderCrestOnBackground(256, 0.96, { format: 'webp', quality: 92 })
  );

  // Compressed login fortress scene
  if (fs.existsSync(srcFortressPath)) {
    await sharp(srcFortressPath)
      .resize({ width: 1280, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
      .webp({ quality: 80, effort: 5 })
      .toFile(path.join(imgAssetsDir, 'login_fortress_opt.webp'));
  }

  // Lightweight hero portrait WebPs
  const heroFiles = [
    ['hero_bhimsen_thapa_1795354185737.jpg', 'hero_bhimsen_thapa.webp'],
    ['hero_bhakti_thapa_1795354185265.jpg', 'hero_bhakti_thapa.webp'],
    ['hero_balbhadra_kunwar_1795354188069.jpg', 'hero_balbhadra_kunwar.webp'],
    ['hero_yogamaya_devi_1795354186352.jpg', 'hero_yogamaya_devi.webp'],
    ['hero_damodar_pande_1795354185705.jpg', 'hero_damodar_pande.webp'],
  ];
  for (const [srcName, outName] of heroFiles) {
    const srcPath = path.join(imgAssetsDir, srcName);
    if (fs.existsSync(srcPath)) {
      await sharp(srcPath)
        .resize(512, 512, { fit: 'cover', position: 'top', kernel: sharp.kernel.lanczos3 })
        .webp({ quality: 82, effort: 5 })
        .toFile(path.join(imgAssetsDir, outName));
    }
  }
}

async function main() {
  if (!fs.existsSync(srcCrestPath)) {
    throw new Error(`Missing source crest artwork at ${srcCrestPath}`);
  }

  await optimizeWebAppImages();

  // 1. Web & PWA Icons (public/)
  const favicon16 = await renderCrestOnBackground(16, 0.98);
  const favicon32 = await renderCrestOnBackground(32, 0.98);
  const favicon48 = await renderCrestOnBackground(48, 0.96);
  const icoBuffer = packPngsAsIco([
    { size: 16, data: favicon16 },
    { size: 32, data: favicon32 },
    { size: 48, data: favicon48 },
  ]);

  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), favicon32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(rootDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), await renderCrestOnBackground(180, 0.92));
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), await renderCrestOnBackground(192, 0.94));
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), await renderCrestOnBackground(512, 0.94));
  // Maskable icon preserves ~14% safe-zone padding on all sides (0.72 centered on #0a0e14)
  fs.writeFileSync(
    path.join(publicDir, 'pwa-maskable-512x512.png'),
    await renderCrestOnBackground(512, 0.72, { transparent: false })
  );
  // Compact boot crest image for index.html splash screen
  fs.writeFileSync(
    path.join(publicDir, 'boot-crest.png'),
    await renderCrestOnBackground(256, 0.96)
  );

  // 2. Android Mipmap Launcher Icons
  const mipmapSizes = [
    { dir: 'mipmap-mdpi', icon: 48, fg: 108 },
    { dir: 'mipmap-hdpi', icon: 72, fg: 162 },
    { dir: 'mipmap-xhdpi', icon: 96, fg: 216 },
    { dir: 'mipmap-xxhdpi', icon: 144, fg: 324 },
    { dir: 'mipmap-xxxhdpi', icon: 192, fg: 432 },
  ];

  for (const { dir, icon, fg } of mipmapSizes) {
    const outDir = path.join(resDir, dir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), await renderCrestOnBackground(icon, 0.94));
    fs.writeFileSync(
      path.join(outDir, 'ic_launcher_round.png'),
      await renderCrestOnBackground(icon, 0.8, { transparent: false, circleClip: true })
    );
    fs.writeFileSync(
      path.join(outDir, 'ic_launcher_foreground.png'),
      await renderCrestOnBackground(fg, 0.64, { transparent: true })
    );
  }

  // 3. Android Portrait & Landscape Splash Drawables
  const splashes = [
    { dir: 'drawable', w: 480, h: 320 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  for (const { dir, w, h } of splashes) {
    const outDir = path.join(resDir, dir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'splash.png'), await renderSplash(w, h));
  }

  console.log('[generate-brand-icons] Generated all web, PWA, UI, Android mipmap, and splash icons from royal_crest_master.png.');
}

main().catch((err) => {
  console.error('[generate-brand-icons] Failed:', err);
  process.exit(1);
});
