import {
  formatBytesToMb,
  gitHubUpdateService,
  normalizeRepoSlug,
  TARGET_APK_ASSET_NAME,
} from '../services/GitHubUpdateService';

export const DEFAULT_APK_FILENAME = TARGET_APK_ASSET_NAME;

export interface ApkDownloadTarget {
  available: boolean;
  source: 'github' | 'local' | 'unavailable';
  fileName: string;
  versionName: string;
  versionCode: number;
  sizeBytes: number;
  sizeLabel: string;
  downloadUrl: string;
  releaseUrl?: string;
  publishedAt?: string;
  repoSlug?: string;
  isNewer?: boolean;
}

export interface ApkResolutionResult {
  activeTarget: ApkDownloadTarget;
  githubTarget: ApkDownloadTarget | null;
  localTarget: ApkDownloadTarget | null;
  repoSlug: string;
  checkedAt: number;
  updateAvailable: boolean;
}

export function normalizeGithubRepoSlug(input: string): string {
  return normalizeRepoSlug(input);
}

export function getConfiguredGithubRepo(): string {
  return gitHubUpdateService.getTargetRepo();
}

export function setConfiguredGithubRepo(input: string): string {
  return gitHubUpdateService.setCustomRepo(input);
}

export function formatApkSize(bytes: number): string {
  return formatBytesToMb(bytes);
}

async function fetchLocalApkTarget(): Promise<ApkDownloadTarget | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch('/api/apk-info', { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.available || !data.downloadUrl) return null;
    const sizeBytes = Number(data.sizeBytes) || 0;
    return {
      available: true,
      source: 'local',
      fileName: data.fileName || DEFAULT_APK_FILENAME,
      versionName: String(data.versionName || __APP_VERSION__ || '1.0.0'),
      versionCode: Number(data.versionCode) || Number(__APK_VERSION_CODE__) || 1,
      sizeBytes,
      sizeLabel: formatApkSize(sizeBytes),
      downloadUrl: String(data.downloadUrl),
      publishedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function resolveLatestApkDownload(overrideRepoSlug?: string): Promise<ApkResolutionResult> {
  const repoSlug = gitHubUpdateService.getTargetRepo(overrideRepoSlug);

  const [localTarget, ghCheck] = await Promise.all([
    fetchLocalApkTarget(),
    repoSlug
      ? gitHubUpdateService.checkForUpdates({ force: true, overrideRepo: repoSlug })
      : Promise.resolve(null),
  ]);

  let githubTarget: ApkDownloadTarget | null = null;
  if (ghCheck?.latestRelease) {
    const rel = ghCheck.latestRelease;
    githubTarget = {
      available: true,
      source: 'github',
      fileName: rel.apkFileName,
      versionName: rel.versionName,
      versionCode: rel.versionCode,
      sizeBytes: rel.sizeBytes,
      sizeLabel: rel.sizeLabel,
      downloadUrl: rel.downloadUrl,
      releaseUrl: rel.releaseUrl,
      publishedAt: rel.publishedAt,
      repoSlug: rel.repoSlug,
      isNewer: rel.isNewer,
    };
  } else if (repoSlug) {
    githubTarget = {
      available: true,
      source: 'github',
      fileName: DEFAULT_APK_FILENAME,
      versionName: String(__APP_VERSION__ || '1.0.0'),
      versionCode: Number(__APK_VERSION_CODE__) || 1,
      sizeBytes: 0,
      sizeLabel: '',
      downloadUrl: `https://github.com/${repoSlug}/releases/latest/download/${DEFAULT_APK_FILENAME}`,
      releaseUrl: `https://github.com/${repoSlug}/releases/latest`,
      repoSlug,
      isNewer: false,
    };
  }

  let activeTarget: ApkDownloadTarget = {
    available: false,
    source: 'unavailable',
    fileName: DEFAULT_APK_FILENAME,
    versionName: String(__APP_VERSION__ || '1.0.0'),
    versionCode: Number(__APK_VERSION_CODE__) || 1,
    sizeBytes: 0,
    sizeLabel: '',
    downloadUrl: '',
  };

  if (githubTarget && localTarget) {
    const ghNewerOrVerified =
      githubTarget.versionCode > localTarget.versionCode ||
      (githubTarget.versionCode === localTarget.versionCode && Boolean(githubTarget.sizeBytes));
    activeTarget = ghNewerOrVerified ? githubTarget : localTarget;
  } else if (githubTarget) {
    activeTarget = githubTarget;
  } else if (localTarget) {
    activeTarget = localTarget;
  }

  return {
    activeTarget,
    githubTarget,
    localTarget,
    repoSlug,
    checkedAt: Date.now(),
    updateAvailable: Boolean(ghCheck?.hasUpdate),
  };
}

export function triggerApkDownload(downloadUrl: string, fileName = DEFAULT_APK_FILENAME): void {
  if (!downloadUrl || typeof document === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
