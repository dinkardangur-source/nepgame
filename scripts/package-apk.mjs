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
  if (entry.endsWith('.apk') || entry.endsWith('.aab')) {
    fs.unlinkSync(path.join(outDir, entry));
  }
}

const packaged = [];

function copyPair(srcPath, rollingName, versionedName) {
  const rollingDest = path.join(outDir, rollingName);
  const versionedDest = path.join(outDir, versionedName);
  fs.copyFileSync(srcPath, rollingDest);
  fs.copyFileSync(srcPath, versionedDest);
  const sizeMb = (fs.statSync(versionedDest).size / (1024 * 1024)).toFixed(2);
  packaged.push(`${versionedName} & ${rollingName} (${sizeMb} MB)`);
}

if (hasDebugApk) {
  copyPair(
    debugApkSrc,
    'Himalayan-Realms-debug.apk',
    `Himalayan-Realms-v${versionName}-b${versionCode}-debug.apk`
  );
}
if (hasReleaseApk) {
  copyPair(
    releaseApkSrc,
    'Himalayan-Realms-release.apk',
    `Himalayan-Realms-v${versionName}-b${versionCode}-release.apk`
  );
}
if (hasDebugAab) {
  copyPair(
    debugAabSrc,
    'Himalayan-Realms-debug.aab',
    `Himalayan-Realms-v${versionName}-b${versionCode}-debug.aab`
  );
}
if (hasReleaseAab) {
  copyPair(
    releaseAabSrc,
    'Himalayan-Realms-release.aab',
    `Himalayan-Realms-v${versionName}-b${versionCode}-release.aab`
  );
}

console.log(`[Android Packaged] ${packaged.join(' | ')}`);
