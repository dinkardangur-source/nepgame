import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const versionFile = path.join(rootDir, 'apk-version.json');
const gradleFile = path.join(rootDir, 'android', 'app', 'build.gradle');
const packageJsonFile = path.join(rootDir, 'package.json');

const syncOnly = process.argv.includes('--sync');

let current = { versionCode: 1, versionName: '1.0.0' };
if (fs.existsSync(versionFile)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    if (typeof parsed.versionCode === 'number' && typeof parsed.versionName === 'string') {
      current = parsed;
    }
  } catch (err) {
    console.warn('[bump-apk-version] Failed reading apk-version.json, using defaults:', err);
  }
}

let nextCode = current.versionCode;
let nextName = current.versionName;

if (!syncOnly) {
  nextCode = current.versionCode + 1;
  const parts = current.versionName.split('.').map((n) => parseInt(n, 10));
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    parts[2] += 1;
    nextName = `${parts[0]}.${parts[1]}.${parts[2]}`;
  } else if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    nextName = `${parts[0]}.${parts[1]}.1`;
  } else {
    nextName = `1.0.${nextCode - 1}`;
  }
}

const nextData = { versionCode: nextCode, versionName: nextName };
fs.writeFileSync(versionFile, `${JSON.stringify(nextData, null, 2)}\n`, 'utf8');

if (fs.existsSync(packageJsonFile)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
  pkg.version = nextName;
  fs.writeFileSync(packageJsonFile, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

if (fs.existsSync(gradleFile)) {
  let gradle = fs.readFileSync(gradleFile, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${nextName}"`);
  fs.writeFileSync(gradleFile, gradle, 'utf8');
}

console.log(`[APK Version] ${syncOnly ? 'Synced' : 'Bumped'} -> versionName=${nextName} (versionCode=${nextCode})`);
