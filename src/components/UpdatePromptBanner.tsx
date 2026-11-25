import React, { useEffect, useState } from 'react';
import royalCrestImg from '../assets/images/royal_crest_ui.webp';
import {
  GitHubUpdateCheckResult,
  gitHubUpdateService,
  TARGET_APK_ASSET_NAME,
} from '../services/GitHubUpdateService';

export const UpdatePromptBanner: React.FC = () => {
  const [state, setState] = useState<GitHubUpdateCheckResult>(() =>
    gitHubUpdateService.getSnapshot()
  );
  const [downloadedNotice, setDownloadedNotice] = useState(false);

  useEffect(() => {
    const unsubscribe = gitHubUpdateService.subscribe((next) => {
      setState(next);
    });
    const stopPolling = gitHubUpdateService.startAutoUpdatePolling();
    return () => {
      unsubscribe();
      stopPolling();
    };
  }, []);

  const release = state.latestRelease;
  if (!state.hasUpdate || !release || gitHubUpdateService.isReleaseDismissed(release)) {
    return null;
  }

  const handleDownload = () => {
    const started = gitHubUpdateService.downloadUpdate(release);
    if (started) {
      setDownloadedNotice(true);
      window.setTimeout(() => {
        gitHubUpdateService.dismissUpdate(release);
      }, 2400);
    }
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Application Update Available"
      style={{
        position: 'fixed',
        right: '14px',
        bottom: '14px',
        zIndex: 130,
        width: 'min(390px, calc(100vw - 24px))',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 13, 22, 0.98) 100%)',
        borderTop: '1.5px solid #dfba6e',
        borderLeft: '1.5px solid #dfba6e',
        borderRight: '1.5px solid #dfba6e',
        borderBottom: '4px solid #78350f',
        borderRadius: '14px',
        padding: '14px 16px',
        boxShadow: '0 18px 48px rgba(0, 0, 0, 0.85)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src={royalCrestImg}
          alt="Empire of the Rising Towers Crest"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            objectFit: 'cover',
            flexShrink: 0,
            background: '#0a0e14',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "800 15px 'Barlow Condensed', sans-serif",
              color: '#fef08a',
              letterSpacing: '0.03em',
            }}
          >
            New Android Update Ready
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#cbd5e1',
              fontVariantNumeric: 'tabular-nums',
              marginTop: '2px',
            }}
          >
            v{release.versionName}
            {release.versionCode > 0 ? ` · Build ${release.versionCode}` : ''}
            {release.sizeLabel ? ` · ${release.sizeLabel}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => gitHubUpdateService.dismissUpdate(release)}
          aria-label="Dismiss Update Prompt"
          style={{
            minWidth: '40px',
            minHeight: '40px',
            display: 'grid',
            placeItems: 'center',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '16px',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45 }}>
        {downloadedNotice
          ? `Downloading ${TARGET_APK_ASSET_NAME}...`
          : `A newer release of ${TARGET_APK_ASSET_NAME} is published on GitHub (current v${state.currentVersion.versionName}).`}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleDownload}
          className="hud-pressable"
          style={{
            flex: '1 1 180px',
            minHeight: '44px',
            padding: '8px 14px',
            borderRadius: '9px',
            background: 'linear-gradient(180deg, #059669, #065f46)',
            borderTop: '1.5px solid #34d399',
            borderLeft: '1.5px solid #34d399',
            borderRight: '1.5px solid #34d399',
            borderBottom: '3px solid #022c22',
            color: '#fef08a',
            font: "800 14px 'Barlow Condensed', sans-serif",
            letterSpacing: '0.03em',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          Download Update
        </button>

        <a
          href={release.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            minHeight: '44px',
            padding: '0 12px',
            borderRadius: '9px',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            color: '#bae6fd',
            font: "700 13px 'Barlow Condensed', sans-serif",
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          Release Notes
        </a>
      </div>
    </aside>
  );
};
