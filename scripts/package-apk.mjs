import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'apk-version.json');
const srcApk = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const outDir = path.join(rootDir, 'android-apk');

if (!fs.existsSync(srcApk)) {
  console.error(`[package-apk] Missing built APK at ${srcApk}`);
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
  if (entry.endsWith('.apk')) {
    fs.unlinkSync(path.join(outDir, entry));
  }
}

const latestApk = path.join(outDir, 'Himalayan-Realms-debug.apk');
const versionedName = `Himalayan-Realms-v${versionName}-b${versionCode}-debug.apk`;
const versionedApk = path.join(outDir, versionedName);

fs.copyFileSync(srcApk, latestApk);
fs.copyFileSync(srcApk, versionedApk);

const sizeMb = (fs.statSync(versionedApk).size / (1024 * 1024)).toFixed(2);
console.log(`[APK Packaged] ${versionedName} & Himalayan-Realms-debug.apk (${sizeMb} MB)`);
