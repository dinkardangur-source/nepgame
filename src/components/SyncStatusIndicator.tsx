import React, { useEffect, useRef, useState } from 'react';
import { useOfflineSyncStatus } from '../services/offlineSyncService';

function formatRelativeAge(ts: number | null): string {
  if (!ts) return 'Not yet synced';
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ts).toLocaleDateString();
}

const SyncCloudCheckIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
    <path d="m9 15 2.2 2.2L16 12.5" />
  </svg>
);

const SyncArrowsIcon: React.FC<{ color: string; spin?: boolean }> = ({ color, spin }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={spin ? { animation: 'erotSyncSpin 1s linear infinite' } : undefined}
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const OfflineVaultIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2l20 20" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M5 12.5a10 10 0 0 1 5.17-2.69" />
    <path d="M19 12.5a10 10 0 0 0-2.69-1.93" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

export const SyncStatusButton: React.FC<{
  uid: string | null;
  onShowToast?: (msg: string) => void;
}> = ({ uid, onShowToast }) => {
  const {
    isOnline,
    status,
    pendingChangesCount,
    pendingActions,
    lastLocalSaveAt,
    lastCloudSyncAt,
    lastError,
    justSynced,
    swOfflineReady,
    syncNow,
  } = useOfflineSyncStatus(uid);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [popoverOpen]);

  const handleManualSync = async () => {
    if (!isOnline) {
      onShowToast?.('Offline Mode: Kingdom changes are saved locally and will sync on reconnect.');
      return;
    }
    const ok = await syncNow();
    if (ok) {
      onShowToast?.('Kingdom progress synced with Royal Archives.');
    }
  };

  let label = 'Synced';
  let bg = 'linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(10, 16, 28, 0.96))';
  let borderTopColor = 'rgba(52, 211, 153, 0.55)';
  let borderBottomColor = '#065f46';
  let textColor = '#a7f3d0';
  let iconNode: React.ReactNode = <SyncCloudCheckIcon color="#34d399" />;

  if (status === 'syncing') {
    label = pendingChangesCount > 0 ? `Syncing (${pendingChangesCount})` : 'Syncing...';
    bg = 'linear-gradient(180deg, #0c4a6e, #082f49)';
    borderTopColor = '#38bdf8';
    borderBottomColor = '#0369a1';
    textColor = '#e0f2fe';
    iconNode = <SyncArrowsIcon color="#38bdf8" spin />;
  } else if (!isOnline || status === 'offline') {
    label = pendingChangesCount > 0 ? `Offline · ${pendingChangesCount}` : 'Offline';
    bg = 'linear-gradient(180deg, #92400e, #78350f)';
    borderTopColor = '#fbbf24';
    borderBottomColor = '#451a03';
    textColor = '#fef3c7';
    iconNode = <OfflineVaultIcon color="#fde047" />;
  } else if (status === 'error') {
    label = 'Retry Sync';
    bg = 'linear-gradient(180deg, #991b1b, #7f1d1d)';
    borderTopColor = '#f87171';
    borderBottomColor = '#450a0a';
    textColor = '#fee2e2';
    iconNode = <SyncArrowsIcon color="#fca5a5" />;
  } else if (status === 'pending') {
    label = pendingChangesCount > 0 ? `Sync (${pendingChangesCount})` : 'Sync';
    bg = 'linear-gradient(180deg, #b45309, #78350f)';
    borderTopColor = '#fde047';
    borderBottomColor = '#451a03';
    textColor = '#fef08a';
    iconNode = <SyncArrowsIcon color="#fde047" />;
  } else if (justSynced) {
    label = 'Synced';
    bg = 'linear-gradient(180deg, #065f46, #064e3b)';
    borderTopColor = '#6ee7b7';
    borderBottomColor = '#022c22';
    textColor = '#ecfdf5';
    iconNode = <SyncCloudCheckIcon color="#6ee7b7" />;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setPopoverOpen((prev) => !prev)}
        title={
          isOnline
            ? 'Kingdom Cloud Sync Status — Click for details or manual sync'
            : 'Offline Mode — Changes saved locally and queued for reconnect sync'
        }
        style={{
          padding: '4px 8px',
          borderRadius: '7px',
          background: bg,
          borderTop: `1px solid ${borderTopColor}`,
          borderLeft: `1px solid ${borderTopColor}`,
          borderRight: `1px solid ${borderTopColor}`,
          borderBottom: `3px solid ${borderBottomColor}`,
          boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
          color: textColor,
          font: "800 11px 'Barlow Condensed', sans-serif",
          letterSpacing: '0.03em',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap',
          touchAction: 'manipulation',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {iconNode}
        <span>{label}</span>
      </button>

      {popoverOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '264px',
            maxWidth: 'calc(100vw - 24px)',
            zIndex: 120,
            background: 'rgba(10, 16, 28, 0.98)',
            borderTop: '1.5px solid #dfba6e',
            borderLeft: '1.5px solid #dfba6e',
            borderRight: '1.5px solid #dfba6e',
            borderBottom: '3.5px solid #78350f',
            borderRadius: '10px',
            padding: '10px 12px',
            boxShadow: '0 14px 36px rgba(0,0,0,0.88)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {iconNode}
              <span style={{ font: "800 12.5px 'Barlow Condensed', sans-serif", color: '#fef08a', letterSpacing: '0.04em' }}>
                KINGDOM ARCHIVE SYNC
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
              aria-label="Close sync details"
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 8px', fontSize: '11px', color: '#cbd5e1' }}>
            <span style={{ color: '#94a3b8' }}>Connection</span>
            <span style={{ fontWeight: 700, color: isOnline ? '#6ee7b7' : '#fbbf24' }}>
              {isOnline ? 'Online' : 'Offline (Local Vault)'}
            </span>

            <span style={{ color: '#94a3b8' }}>Offline Cache</span>
            <span style={{ fontWeight: 700, color: swOfflineReady ? '#7dd3fc' : '#94a3b8' }}>
              {swOfflineReady ? 'Ready' : 'Active Session'}
            </span>

            <span style={{ color: '#94a3b8' }}>Last Local Save</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#e2e8f0' }}>
              {formatRelativeAge(lastLocalSaveAt)}
            </span>

            <span style={{ color: '#94a3b8' }}>Last Cloud Sync</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#e2e8f0' }}>
              {formatRelativeAge(lastCloudSyncAt)}
            </span>
          </div>

          {pendingChangesCount > 0 && (
            <div
              style={{
                background: 'rgba(146, 64, 14, 0.25)',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                borderRadius: '7px',
                padding: '6px 8px',
                fontSize: '10.5px',
                color: '#fef3c7',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: pendingActions.length > 0 ? '3px' : 0 }}>
                {pendingChangesCount} offline change{pendingChangesCount > 1 ? 's' : ''} queued for sync
              </div>
              {pendingActions.length > 0 && (
                <div style={{ color: '#fde68a', opacity: 0.9, lineHeight: 1.35 }}>
                  {pendingActions.slice(0, 3).join(' · ')}
                </div>
              )}
            </div>
          )}

          {lastError && isOnline && (
            <div style={{ fontSize: '10.5px', color: '#fca5a5', lineHeight: 1.35 }}>
              {lastError}
            </div>
          )}

          <button
            type="button"
            disabled={!isOnline || status === 'syncing'}
            onClick={() => void handleManualSync()}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '7px',
              background: !isOnline
                ? 'rgba(51, 65, 85, 0.7)'
                : status === 'syncing'
                  ? 'linear-gradient(180deg, #0369a1, #075985)'
                  : 'linear-gradient(180deg, #16a34a, #15803d)',
              borderTop: `1px solid ${!isOnline ? 'rgba(148,163,184,0.35)' : '#86efac'}`,
              borderLeft: `1px solid ${!isOnline ? 'rgba(148,163,184,0.35)' : '#86efac'}`,
              borderRight: `1px solid ${!isOnline ? 'rgba(148,163,184,0.35)' : '#86efac'}`,
              borderBottom: `2.5px solid ${!isOnline ? '#1e293b' : '#14532d'}`,
              color: !isOnline ? '#94a3b8' : '#fef08a',
              font: "800 11.5px 'Barlow Condensed', sans-serif",
              letterSpacing: '0.04em',
              cursor: !isOnline || status === 'syncing' ? 'default' : 'pointer',
            }}
          >
            {!isOnline
              ? 'SAVED LOCALLY — AUTO-SYNCS ON RECONNECT'
              : status === 'syncing'
                ? 'SYNCING ROYAL ARCHIVES...'
                : 'SYNC NOW'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes erotSyncSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export const OfflineReconnectBanner: React.FC<{
  uid: string | null;
  onShowToast?: (msg: string) => void;
}> = ({ uid, onShowToast }) => {
  const { isOnline, status, pendingChangesCount, justSynced, syncNow } = useOfflineSyncStatus(uid);

  const visible = !isOnline || status === 'syncing' || status === 'error' || status === 'pending' || justSynced;
  if (!visible) return null;

  let text = 'Offline Mode · Kingdom Actions Saved Locally';
  let bg = 'rgba(120, 53, 15, 0.94)';
  let border = '#fbbf24';
  let color = '#fef3c7';
  let icon: React.ReactNode = <OfflineVaultIcon color="#fde047" />;
  let clickable = false;

  if (status === 'syncing') {
    text =
      pendingChangesCount > 0
        ? `Reconnected · Syncing ${pendingChangesCount} Kingdom Change${pendingChangesCount > 1 ? 's' : ''}...`
        : 'Syncing Kingdom Progress...';
    bg = 'rgba(12, 74, 110, 0.94)';
    border = '#38bdf8';
    color = '#e0f2fe';
    icon = <SyncArrowsIcon color="#38bdf8" spin />;
  } else if (!isOnline) {
    text =
      pendingChangesCount > 0
        ? `Offline Mode · ${pendingChangesCount} Change${pendingChangesCount > 1 ? 's' : ''} Saved Locally`
        : 'Offline Mode · Kingdom Management Ready';
  } else if (status === 'error' || status === 'pending') {
    text =
      status === 'error'
        ? 'Sync Interrupted · Tap to Retry Sync'
        : `${pendingChangesCount} Offline Change${pendingChangesCount === 1 ? '' : 's'} Ready · Tap to Sync`;
    bg = status === 'error' ? 'rgba(127, 29, 29, 0.94)' : 'rgba(120, 53, 15, 0.94)';
    border = status === 'error' ? '#f87171' : '#fde047';
    color = status === 'error' ? '#fee2e2' : '#fef08a';
    icon = <SyncArrowsIcon color={border} />;
    clickable = true;
  } else if (justSynced) {
    text = 'Reconnected · Kingdom Synced';
    bg = 'rgba(6, 78, 59, 0.94)';
    border = '#34d399';
    color = '#d1fae5';
    icon = <SyncCloudCheckIcon color="#34d399" />;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!clickable) return;
        void syncNow().then((ok) => {
          if (ok) onShowToast?.('Kingdom progress synced with Royal Archives.');
        });
      }}
      style={{
        position: 'fixed',
        bottom: '74px',
        left: '12px',
        zIndex: 80,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '8px',
        padding: '5px 10px',
        color,
        font: "700 11.5px 'Barlow Condensed', sans-serif",
        letterSpacing: '0.03em',
        boxShadow: '0 4px 14px rgba(0,0,0,0.68)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: clickable ? 'pointer' : 'default',
        pointerEvents: clickable ? 'auto' : 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
};
