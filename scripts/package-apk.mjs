import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'apk-version.json');
const outDir = path.join(rootDir, 'android-apk');

const debugApkSrc = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const releaseApkSrc = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const debugAabSrc = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'bundle', 'debug', 'app-debug.aab');
const releaseAabSrc = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');

const hasDebugApk = fs.existsSync(debugApkSrc);
const hasReleaseApk = fs.existsSync(releaseApkSrc);
const hasDebugAab = fs.existsSync(debugAabSrc);
const hasReleaseAab = fs.existsSync(releaseAabSrc);

if (!hasDebugApk && !hasReleaseApk && !hasDebugAab && !hasReleaseAab) {
  console.error('[package-apk] Missing built APK or AAB outputs under android/app/build/outputs/');
  process.exit(1);
}

let versionCode = 1;
let versionName = '1.0.0';
if (fs.existsSync(versionFile)) {
  const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  if (typeof parsed.versionCode === 'number') versionCode = parsed.versionCode;
  if (typeof parsed.versionName === 'string') versionName = parsed.versionName;
}

fs.mkdirSync(outDir, { recursive: true });
for (const entry of fs.readdirSync(outDir)) {
  if (entry.endsWith('.apk') || entry.endsWith('.aab') || entry === 'latest.json') {
    fs.unlinkSync(path.join(outDir, entry));
  }
}

const packaged = [];

function copyPair(srcPath, rollingName, versionedName) {
  const rollingDest = path.join(outDir, rollingName);
  const versionedDest = path.join(outDir, versionedName);
  fs.copyFileSync(srcPath, rollingDest);
  fs.copyFileSync(srcPath, versionedDest);
  const sizeBytes = fs.statSync(versionedDest).size;
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
  packaged.push(`${rollingName} & ${versionedName} (${sizeMb} MB)`);
  return sizeBytes;
}

let primaryApkBytes = 0;
const primaryApkName = 'Empire-of-the-Rising-Towers.apk';
const versionedApkName = `Empire-of-the-Rising-Towers-v${versionName}-b${versionCode}.apk`;

// Primary APK: prefer release APK if present, else debug APK, packaged cleanly as Empire-of-the-Rising-Towers.apk + versioned copy
const primaryApkSrc = hasReleaseApk ? releaseApkSrc : debugApkSrc;
if (primaryApkSrc && fs.existsSync(primaryApkSrc)) {
  primaryApkBytes = copyPair(primaryApkSrc, primaryApkName, versionedApkName);
}

let primaryAabName = null;
if (hasReleaseAab) {
  primaryAabName = 'Empire-of-the-Rising-Towers.aab';
  copyPair(
    releaseAabSrc,
    primaryAabName,
    `Empire-of-the-Rising-Towers-v${versionName}-b${versionCode}.aab`
  );
} else if (hasDebugAab) {
  primaryAabName = 'Empire-of-the-Rising-Towers-debug.aab';
  copyPair(
    debugAabSrc,
    primaryAabName,
    `Empire-of-the-Rising-Towers-v${versionName}-b${versionCode}-debug.aab`
  );
}

const latestManifest = {
  appName: 'Empire of the Rising Towers',
  packageId: 'com.himalayanrealms.strategy',
  versionName,
  versionCode,
  apkFile: primaryApkBytes > 0 ? primaryApkName : null,
  versionedApkFile: primaryApkBytes > 0 ? versionedApkName : null,
  apkSizeBytes: primaryApkBytes,
  aabFile: primaryAabName,
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, 'latest.json'), `${JSON.stringify(latestManifest, null, 2)}\n`, 'utf8');

console.log(`[Android Packaged] ${packaged.join(' | ')}`);
