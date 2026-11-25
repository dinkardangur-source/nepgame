export const TARGET_APK_ASSET_NAME = 'Empire-of-the-Rising-Towers.apk';
const GITHUB_REPO_STORAGE_KEY = 'eotrt_github_repo_slug';
const DISMISSED_RELEASE_STORAGE_KEY = 'eotrt_dismissed_apk_update';
const REPO_SLUG_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DEFAULT_POLL_INTERVAL_MS = 30 * 60 * 1000;
const CHECK_COOLDOWN_MS = 60 * 1000;

export interface GitHubApkReleaseInfo {
  repoSlug: string;
  tagName: string;
  releaseName: string;
  versionName: string;
  versionCode: number;
  apkFileName: string;
  downloadUrl: string;
  releaseUrl: string;
  sizeBytes: number;
  sizeLabel: string;
  publishedAt: string;
  releaseNotes: string;
  isNewer: boolean;
}

export type GitHubUpdateStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'up-to-date'
  | 'unconfigured'
  | 'not-found'
  | 'error';

export interface GitHubUpdateCheckResult {
  status: GitHubUpdateStatus;
  hasUpdate: boolean;
  repoSlug: string;
  currentVersion: {
    versionName: string;
    versionCode: number;
  };
  latestRelease: GitHubApkReleaseInfo | null;
  checkedAt: number;
  errorMessage?: string;
}

type UpdateListener = (result: GitHubUpdateCheckResult) => void;

export function normalizeRepoSlug(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
  const candidate = (urlMatch ? urlMatch[1] : trimmed)
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  return REPO_SLUG_REGEX.test(candidate) ? candidate : '';
}

export function formatBytesToMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function parseVersionMeta(text: string): { versionName?: string; versionCode?: number } {
  const verMatch = text.match(/(?:^|[\s(])v?(\d+\.\d+\.\d+)(?:[\s)]|$|-)/i);
  const buildMatch = text.match(/(?:build\s*|\bb)(\d+)\b/i);
  return {
    versionName: verMatch ? verMatch[1] : undefined,
    versionCode: buildMatch ? parseInt(buildMatch[1], 10) : undefined,
  };
}

function isRemoteNewerThanCurrent(
  remoteVersionName: string,
  remoteVersionCode: number,
  currentVersionName: string,
  currentVersionCode: number
): boolean {
  if (remoteVersionCode > 0 && currentVersionCode > 0 && remoteVersionCode !== currentVersionCode) {
    return remoteVersionCode > currentVersionCode;
  }
  if (remoteVersionName) {
    return compareSemver(remoteVersionName, currentVersionName) > 0;
  }
  return false;
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs = 5000,
  headers?: Record<string, string>
): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers, cache: 'no-store' });
    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } finally {
    window.clearTimeout(timer);
  }
}

export class GitHubUpdateService {
  private listeners = new Set<UpdateListener>();
  private inFlightCheck: Promise<GitHubUpdateCheckResult> | null = null;
  private pollTimerId: number | null = null;
  private lastResult: GitHubUpdateCheckResult;

  constructor() {
    const current = this.getCurrentAppVersion();
    const repoSlug = this.getTargetRepo();
    this.lastResult = {
      status: repoSlug ? 'idle' : 'unconfigured',
      hasUpdate: false,
      repoSlug,
      currentVersion: current,
      latestRelease: null,
      checkedAt: 0,
    };
  }

  public getCurrentAppVersion(): { versionName: string; versionCode: number } {
    const versionName =
      typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : '1.0.0';
    const versionCode =
      typeof __APK_VERSION_CODE__ === 'number' && Number.isFinite(__APK_VERSION_CODE__)
        ? __APK_VERSION_CODE__
        : 1;
    return { versionName, versionCode };
  }

  public getTargetRepo(overrideRepo?: string): string {
    if (overrideRepo !== undefined) {
      return normalizeRepoSlug(overrideRepo);
    }

    const envRepo = normalizeRepoSlug(String(import.meta.env.VITE_GITHUB_REPO || ''));
    if (envRepo) return envRepo;

    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(GITHUB_REPO_STORAGE_KEY) || '';
        const validSaved = normalizeRepoSlug(saved);
        if (validSaved) return validSaved;
      } catch {
        // Ignore storage read restrictions
      }

      const host = window.location.hostname;
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (host.endsWith('.github.io') && pathParts.length > 0) {
        const owner = host.replace(/\.github\.io$/i, '');
        const inferred = normalizeRepoSlug(`${owner}/${pathParts[0]}`);
        if (inferred) return inferred;
      }
    }

    return '';
  }

  public setCustomRepo(input: string): string {
    const normalized = normalizeRepoSlug(input);
    if (typeof window !== 'undefined') {
      try {
        if (normalized) {
          window.localStorage.setItem(GITHUB_REPO_STORAGE_KEY, normalized);
        } else {
          window.localStorage.removeItem(GITHUB_REPO_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    }
    return normalized;
  }

  public getSnapshot(): GitHubUpdateCheckResult {
    return this.lastResult;
  }

  public subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.lastResult);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(result: GitHubUpdateCheckResult): void {
    this.lastResult = result;
    this.listeners.forEach((fn) => {
      try {
        fn(result);
      } catch {
        // Ignore individual subscriber errors
      }
    });
  }

  public getReleaseKey(release: Pick<GitHubApkReleaseInfo, 'versionName' | 'versionCode' | 'tagName'>): string {
    return `${release.versionName || release.tagName}#${release.versionCode || 0}`;
  }

  public isReleaseDismissed(release: GitHubApkReleaseInfo | null): boolean {
    if (!release || typeof window === 'undefined') return false;
    try {
      const dismissed = window.localStorage.getItem(DISMISSED_RELEASE_STORAGE_KEY);
      return dismissed === this.getReleaseKey(release);
    } catch {
      return false;
    }
  }

  public dismissUpdate(release: GitHubApkReleaseInfo): void {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DISMISSED_RELEASE_STORAGE_KEY, this.getReleaseKey(release));
      } catch {
        // Ignore storage errors
      }
    }
    this.emit({ ...this.lastResult });
  }

  public async checkForUpdates(options?: {
    force?: boolean;
    overrideRepo?: string;
  }): Promise<GitHubUpdateCheckResult> {
    const force = Boolean(options?.force);
    const repoSlug = this.getTargetRepo(options?.overrideRepo);
    const currentVersion = this.getCurrentAppVersion();

    if (!repoSlug) {
      const unconfigured: GitHubUpdateCheckResult = {
        status: 'unconfigured',
        hasUpdate: false,
        repoSlug: '',
        currentVersion,
        latestRelease: null,
        checkedAt: Date.now(),
      };
      this.emit(unconfigured);
      return unconfigured;
    }

    if (
      !force &&
      this.lastResult.repoSlug === repoSlug &&
      this.lastResult.checkedAt > 0 &&
      Date.now() - this.lastResult.checkedAt < CHECK_COOLDOWN_MS
    ) {
      return this.lastResult;
    }

    if (this.inFlightCheck && !options?.overrideRepo) {
      return this.inFlightCheck;
    }

    this.emit({
      ...this.lastResult,
      status: 'checking',
      repoSlug,
      currentVersion,
      errorMessage: undefined,
    });

    const run = (async (): Promise<GitHubUpdateCheckResult> => {
      try {
        const release = await this.queryLatestGitHubRelease(repoSlug, currentVersion);
        if (!release) {
          const notFoundResult: GitHubUpdateCheckResult = {
            status: 'not-found',
            hasUpdate: false,
            repoSlug,
            currentVersion,
            latestRelease: null,
            checkedAt: Date.now(),
          };
          this.emit(notFoundResult);
          return notFoundResult;
        }

        const result: GitHubUpdateCheckResult = {
          status: release.isNewer ? 'update-available' : 'up-to-date',
          hasUpdate: release.isNewer,
          repoSlug,
          currentVersion,
          latestRelease: release,
          checkedAt: Date.now(),
        };
        this.emit(result);
        return result;
      } catch (err: any) {
        const errResult: GitHubUpdateCheckResult = {
          status: 'error',
          hasUpdate: false,
          repoSlug,
          currentVersion,
          latestRelease: null,
          checkedAt: Date.now(),
          errorMessage: err?.message || 'Unable to reach GitHub Releases API.',
        };
        this.emit(errResult);
        return errResult;
      } finally {
        this.inFlightCheck = null;
      }
    })();

    this.inFlightCheck = run;
    return run;
  }

  private async queryLatestGitHubRelease(
    repoSlug: string,
    currentVersion: { versionName: string; versionCode: number }
  ): Promise<GitHubApkReleaseInfo | null> {
    const headers = { Accept: 'application/vnd.github+json' };
    const endpoints = [
      `https://api.github.com/repos/${repoSlug}/releases/latest`,
      `https://api.github.com/repos/${repoSlug}/releases/tags/latest`,
      `https://api.github.com/repos/${repoSlug}/releases?per_page=5`,
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetchJsonWithTimeout(endpoint, 5000, headers);
        if (!res.ok || !res.data) continue;

        const candidates = Array.isArray(res.data) ? res.data : [res.data];
        for (const release of candidates) {
          if (!release || release.draft) continue;
          const assets = Array.isArray(release.assets) ? release.assets : [];
          const exactApk = assets.find(
            (a: any) =>
              typeof a?.name === 'string' &&
              a.name.toLowerCase() === TARGET_APK_ASSET_NAME.toLowerCase()
          );
          const fallbackApk =
            exactApk ||
            assets.find(
              (a: any) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk')
            );

          if (!fallbackApk || !fallbackApk.browser_download_url) continue;

          const combinedMeta = `${release.name || ''} ${release.tag_name || ''} ${release.body || ''} ${fallbackApk.name || ''}`;
          const parsed = parseVersionMeta(combinedMeta);
          const versionName = parsed.versionName || currentVersion.versionName;
          const versionCode = parsed.versionCode || 0;
          const sizeBytes = Number(fallbackApk.size) || 0;
          const isNewer = isRemoteNewerThanCurrent(
            versionName,
            versionCode,
            currentVersion.versionName,
            currentVersion.versionCode
          );

          return {
            repoSlug,
            tagName: String(release.tag_name || 'latest'),
            releaseName: String(release.name || `${TARGET_APK_ASSET_NAME} ${versionName}`),
            versionName,
            versionCode,
            apkFileName: TARGET_APK_ASSET_NAME,
            downloadUrl: String(fallbackApk.browser_download_url),
            releaseUrl: String(release.html_url || `https://github.com/${repoSlug}/releases/latest`),
            sizeBytes,
            sizeLabel: formatBytesToMb(sizeBytes),
            publishedAt: String(fallbackApk.updated_at || release.published_at || ''),
            releaseNotes: String(release.body || '').trim(),
            isNewer,
          };
        }
      } catch {
        // Continue to next endpoint
      }
    }

    // Secondary fallback: check android-apk/latest.json committed directly to main/master branch
    for (const branch of ['main', 'master']) {
      try {
        const rawRes = await fetchJsonWithTimeout(
          `https://raw.githubusercontent.com/${repoSlug}/${branch}/android-apk/latest.json`,
          4000
        );
        if (!rawRes.ok || !rawRes.data?.apkFile) continue;
        const meta = rawRes.data;
        const versionName = String(meta.versionName || currentVersion.versionName);
        const versionCode = Number(meta.versionCode) || 0;
        const sizeBytes = Number(meta.apkSizeBytes) || 0;
        const isNewer = isRemoteNewerThanCurrent(
          versionName,
          versionCode,
          currentVersion.versionName,
          currentVersion.versionCode
        );

        return {
          repoSlug,
          tagName: branch,
          releaseName: `Empire of the Rising Towers v${versionName}`,
          versionName,
          versionCode,
          apkFileName: TARGET_APK_ASSET_NAME,
          downloadUrl: `https://github.com/${repoSlug}/raw/${branch}/android-apk/${encodeURIComponent(String(meta.apkFile))}`,
          releaseUrl: `https://github.com/${repoSlug}/releases/latest`,
          sizeBytes,
          sizeLabel: formatBytesToMb(sizeBytes),
          publishedAt: String(meta.updatedAt || ''),
          releaseNotes: '',
          isNewer,
        };
      } catch {
        // Try next branch
      }
    }

    return null;
  }

  public downloadUpdate(release?: GitHubApkReleaseInfo | null): boolean {
    const target = release || this.lastResult.latestRelease;
    if (!target?.downloadUrl || typeof document === 'undefined') return false;
    const anchor = document.createElement('a');
    anchor.href = target.downloadUrl;
    anchor.download = TARGET_APK_ASSET_NAME;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  }

  public startAutoUpdatePolling(intervalMs = DEFAULT_POLL_INTERVAL_MS): () => void {
    if (typeof window === 'undefined') return () => {};
    this.stopAutoUpdatePolling();

    const initialTimer = window.setTimeout(() => {
      void this.checkForUpdates();
    }, 1500);

    this.pollTimerId = window.setInterval(() => {
      void this.checkForUpdates({ force: true });
    }, intervalMs);

    return () => {
      window.clearTimeout(initialTimer);
      this.stopAutoUpdatePolling();
    };
  }

  public stopAutoUpdatePolling(): void {
    if (this.pollTimerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
  }
}

export const gitHubUpdateService = new GitHubUpdateService();
