import React, { useCallback, useEffect, useState } from 'react';
import royalCrestImg from '../assets/images/royal_crest_ui.webp';
import {
  ApkResolutionResult,
  DEFAULT_APK_FILENAME,
  getConfiguredGithubRepo,
  normalizeGithubRepoSlug,
  resolveLatestApkDownload,
  setConfiguredGithubRepo,
  triggerApkDownload,
} from '../utils/apkDownloadResolver';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable?: boolean;
  isInstalled?: boolean;
  isIOS?: boolean;
  isAndroid?: boolean;
  onInstallPWA?: () => Promise<boolean>;
  onShowToast?: (msg: string) => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  isInstallable = false,
  isInstalled = false,
  isIOS = false,
  isAndroid = false,
  onInstallPWA,
  onShowToast,
}) => {
  const [resolution, setResolution] = useState<ApkResolutionResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [repoInput, setRepoInput] = useState(() => getConfiguredGithubRepo());
  const [repoMessage, setRepoMessage] = useState<string | null>(null);
  const [showRepoConfig, setShowRepoConfig] = useState(false);

  const checkUpdates = useCallback(async (overrideSlug?: string) => {
    setIsChecking(true);
    try {
      const result = await resolveLatestApkDownload(overrideSlug);
      setResolution(result);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const saved = getConfiguredGithubRepo();
    setRepoInput(saved);
    setRepoMessage(null);
    void checkUpdates(saved);
  }, [isOpen, checkUpdates]);

  if (!isOpen) return null;

  const active = resolution?.activeTarget;
  const localTarget = resolution?.localTarget;
  const githubTarget = resolution?.githubTarget;
  const displayVersion = active?.versionName || String(__APP_VERSION__ || '1.0.0');
  const displayCode = active?.versionCode || Number(__APK_VERSION_CODE__) || 1;
  const linkedRepo = resolution?.repoSlug || getConfiguredGithubRepo();

  const handleDownloadPrimary = () => {
    if (!active || !active.available || !active.downloadUrl) {
      onShowToast?.('APK build is not yet published. Link your GitHub repo or build locally.');
      return;
    }
    triggerApkDownload(active.downloadUrl, DEFAULT_APK_FILENAME);
    onShowToast?.(`Downloading ${DEFAULT_APK_FILENAME} (v${active.versionName})...`);
  };

  const handleSaveRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoInput.trim();
    if (!trimmed) {
      setConfiguredGithubRepo('');
      setRepoMessage('Cleared custom GitHub repository link.');
      await checkUpdates('');
      return;
    }
    const normalized = normalizeGithubRepoSlug(trimmed);
    if (!normalized) {
      setRepoMessage('Enter a valid GitHub repo like username/empire-of-the-rising-towers');
      return;
    }
    setConfiguredGithubRepo(normalized);
    setRepoInput(normalized);
    setRepoMessage(`Synced with github.com/${normalized}`);
    await checkUpdates(normalized);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.88)',
        zIndex: 120,
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Empire of the Rising Towers Android APK Download"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
          borderTop: '2px solid #dfba6e',
          borderLeft: '2px solid #dfba6e',
          borderRight: '2px solid #dfba6e',
          borderBottom: '5px solid #78350f',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          touchAction: 'pan-y',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(223,186,110,0.22)',
            paddingBottom: '12px',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <img
              src={royalCrestImg}
              alt="Empire of the Rising Towers Crest"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '11px',
                objectFit: 'cover',
                flexShrink: 0,
                background: '#0a0e14',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  font: "800 18px 'Barlow Condensed', sans-serif",
                  color: '#fef08a',
                  letterSpacing: '0.03em',
                }}
              >
                EMPIRE OF THE RISING TOWERS — ANDROID APK
              </h2>
              <div
                style={{
                  fontSize: '11.5px',
                  color: '#cbd5e1',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '2px',
                }}
              >
                UNITE THE KINGDOM · v{displayVersion} · Build {displayCode}
                {active?.sizeLabel ? ` · ${active.sizeLabel}` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Android APK Modal"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'grid',
              placeItems: 'center',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            ✕
          </button>
        </div>

        {/* File & Source Summary Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.24)',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#e2e8f0',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>
            File: <strong style={{ color: '#fef08a' }}>{DEFAULT_APK_FILENAME}</strong>
          </span>
          <span style={{ color: active?.available ? '#86efac' : '#fbbf24', fontWeight: 700 }}>
            {isChecking
              ? 'Checking latest update...'
              : resolution?.updateAvailable
                ? 'Update Ready on GitHub'
                : active?.source === 'github'
                  ? 'Source: GitHub Latest Release'
                  : active?.source === 'local'
                    ? 'Source: Bundled Server APK'
                    : 'Source: Awaiting Build'}
          </span>
        </div>

        {/* Primary APK Download Action */}
        <button
          type="button"
          onClick={handleDownloadPrimary}
          disabled={isChecking && !active?.available}
          className="hud-pressable"
          style={{
            width: '100%',
            minHeight: '48px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: active?.available
              ? 'linear-gradient(180deg, #059669, #065f46)'
              : 'linear-gradient(180deg, #334155, #1e293b)',
            borderTop: active?.available ? '1.5px solid #34d399' : '1.5px solid #64748b',
            borderLeft: active?.available ? '1.5px solid #34d399' : '1.5px solid #64748b',
            borderRight: active?.available ? '1.5px solid #34d399' : '1.5px solid #64748b',
            borderBottom: active?.available ? '3.5px solid #022c22' : '3.5px solid #0f172a',
            color: active?.available ? '#fef08a' : '#cbd5e1',
            font: "800 15px 'Barlow Condensed', sans-serif",
            letterSpacing: '0.04em',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {isChecking && !active?.available
            ? 'Checking Latest APK Release...'
            : active?.available
              ? `Download ${DEFAULT_APK_FILENAME} (v${displayVersion})`
              : 'Download APK (Build or Link GitHub First)'}
        </button>

        {/* Secondary Source Links & Refresh */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => checkUpdates()}
            disabled={isChecking}
            style={{
              minHeight: '36px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#e2e8f0',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {isChecking ? 'Checking...' : 'Check for Update'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {githubTarget?.releaseUrl && (
              <a
                href={githubTarget.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7dd3fc', fontSize: '12px', fontWeight: 600, textDecoration: 'underline' }}
              >
                GitHub Releases
              </a>
            )}
            {active?.source === 'github' && localTarget?.available && (
              <a
                href={localTarget.downloadUrl}
                download={DEFAULT_APK_FILENAME}
                style={{ color: '#86efac', fontSize: '12px', fontWeight: 600, textDecoration: 'underline' }}
              >
                Local APK Fallback
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowRepoConfig((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fde047',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 4px',
                textDecoration: 'underline',
                touchAction: 'manipulation',
              }}
            >
              {linkedRepo ? 'Edit GitHub Repo' : 'Link GitHub Repo'}
            </button>
          </div>
        </div>

        {/* Automatic GitHub Repo Linker */}
        {(showRepoConfig || !linkedRepo) && (
          <form
            onSubmit={handleSaveRepo}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45 }}>
              Link your GitHub repository so every push automatically updates this download button with the newest{' '}
              <code>{DEFAULT_APK_FILENAME}</code> release.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="owner/empire-of-the-rising-towers"
                aria-label="GitHub Repository Slug"
                style={{
                  flex: '1 1 200px',
                  minHeight: '40px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#020617',
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  color: '#f8fafc',
                  fontSize: '12.5px',
                }}
              />
              <button
                type="submit"
                style={{
                  minHeight: '40px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(180deg, #0284c7, #0369a1)',
                  border: '1px solid #38bdf8',
                  color: '#fff',
                  font: "700 13px 'Barlow Condensed', sans-serif",
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                Save &amp; Sync
              </button>
            </div>
            {repoMessage && (
              <div style={{ fontSize: '11.5px', color: '#86efac' }}>{repoMessage}</div>
            )}
          </form>
        )}

        {/* PWA Fullscreen Install Option */}
        {!isInstalled && isInstallable && onInstallPWA ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await onInstallPWA();
              if (ok) {
                onClose();
                onShowToast?.('Empire of the Rising Towers added to Home Screen!');
              }
            }}
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '10px 14px',
              borderRadius: '9px',
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(52, 211, 153, 0.45)',
              color: '#a7f3d0',
              font: "700 13.5px 'Barlow Condensed', sans-serif",
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Install Fullscreen Web App (PWA)
          </button>
        ) : (
          <div
            style={{
              background: 'rgba(6, 78, 59, 0.25)',
              border: '1px solid rgba(52,211,153,0.28)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#d1fae5',
              lineHeight: 1.5,
            }}
          >
            {isIOS ? (
              <>
                <b>iPhone / iPad:</b> Tap <b>Share</b> in Safari and choose <b>Add to Home Screen</b>.
              </>
            ) : isAndroid ? (
              <>
                <b>Android Install:</b> Download <code>{DEFAULT_APK_FILENAME}</code> above and tap to install. If upgrading from an older test build shows a package conflict once, uninstall the old build first—all updates from now on share the same signing key.
              </>
            ) : (
              <>
                <b>Package ID:</b> <code>com.himalayanrealms.strategy</code> · Consistently signed &amp; auto-updated on every GitHub push as <code>{DEFAULT_APK_FILENAME}</code>.
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
