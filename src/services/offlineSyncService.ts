import { useCallback, useEffect, useState } from 'react';

export type SyncLifecycleState = 'synced' | 'offline' | 'pending' | 'syncing' | 'error';

export interface OfflineSyncMeta {
  dirty: boolean;
  pendingChangesCount: number;
  pendingActions: string[];
  lastLocalSaveAt: number | null;
  lastCloudSyncAt: number | null;
  lastError: string | null;
}

export interface SyncStatusSnapshot extends OfflineSyncMeta {
  uid: string | null;
  isOnline: boolean;
  status: SyncLifecycleState;
  justSynced: boolean;
  swOfflineReady: boolean;
}

const SYNC_META_PREFIX = 'erot_offline_sync_meta_v1_';
const MAX_PENDING_ACTION_LABELS = 6;
const JUST_SYNCED_BANNER_MS = 5000;

const DEFAULT_META: OfflineSyncMeta = {
  dirty: false,
  pendingChangesCount: 0,
  pendingActions: [],
  lastLocalSaveAt: null,
  lastCloudSyncAt: null,
  lastError: null,
};

function readMetaFromStorage(uid: string | null): OfflineSyncMeta {
  if (!uid || typeof localStorage === 'undefined') return { ...DEFAULT_META };
  try {
    const raw = localStorage.getItem(`${SYNC_META_PREFIX}${uid}`);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<OfflineSyncMeta>;
    return {
      dirty: Boolean(parsed.dirty),
      pendingChangesCount:
        typeof parsed.pendingChangesCount === 'number' && parsed.pendingChangesCount >= 0
          ? Math.round(parsed.pendingChangesCount)
          : 0,
      pendingActions: Array.isArray(parsed.pendingActions)
        ? parsed.pendingActions.map(String).slice(0, MAX_PENDING_ACTION_LABELS)
        : [],
      lastLocalSaveAt: typeof parsed.lastLocalSaveAt === 'number' ? parsed.lastLocalSaveAt : null,
      lastCloudSyncAt: typeof parsed.lastCloudSyncAt === 'number' ? parsed.lastCloudSyncAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return { ...DEFAULT_META };
  }
}

function writeMetaToStorage(uid: string | null, meta: OfflineSyncMeta): void {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${SYNC_META_PREFIX}${uid}`, JSON.stringify(meta));
  } catch {
    // Ignore storage quota errors
  }
}

class OfflineSyncManager {
  private metaByUid = new Map<string, OfflineSyncMeta>();
  private syncingUids = new Set<string>();
  private justSyncedTimers = new Map<string, number>();
  private justSyncedUids = new Set<string>();
  private lastActionLabelAt = new Map<string, number>();
  private syncHandlers = new Map<string, () => Promise<boolean>>();
  private inFlightSyncs = new Map<string, Promise<boolean>>();
  private listeners = new Set<() => void>();
  private swOfflineReady = false;
  private initializedListeners = false;

  constructor() {
    this.ensureGlobalListeners();
  }

  private ensureGlobalListeners() {
    if (this.initializedListeners || typeof window === 'undefined') return;
    this.initializedListeners = true;

    this.swOfflineReady = Boolean(
      window.__EROT_SW_OFFLINE_READY__ || navigator.serviceWorker?.controller
    );

    window.addEventListener('online', () => {
      this.notifyListeners();
      // Auto-flush any registered active user session on reconnect
      this.syncHandlers.forEach((_handler, uid) => {
        const meta = this.getMeta(uid);
        if (meta.dirty || meta.pendingChangesCount > 0 || meta.lastError) {
          void this.triggerSync(uid);
        }
      });
    });

    window.addEventListener('offline', () => {
      this.notifyListeners();
    });

    window.addEventListener('erot-sw-status', ((ev: CustomEvent<{ offlineReady?: boolean }>) => {
      if (typeof ev?.detail?.offlineReady === 'boolean') {
        this.swOfflineReady = ev.detail.offlineReady;
        this.notifyListeners();
      }
    }) as EventListener);
  }

  private getMeta(uid: string | null): OfflineSyncMeta {
    if (!uid) return { ...DEFAULT_META };
    let meta = this.metaByUid.get(uid);
    if (!meta) {
      meta = readMetaFromStorage(uid);
      this.metaByUid.set(uid, meta);
    }
    return meta;
  }

  private setMeta(uid: string, next: OfflineSyncMeta) {
    this.metaByUid.set(uid, next);
    writeMetaToStorage(uid, next);
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb());
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public hasPendingOfflineChanges(uid: string | null): boolean {
    if (!uid) return false;
    const meta = this.getMeta(uid);
    return meta.dirty || meta.pendingChangesCount > 0;
  }

  public getSnapshot(uid: string | null): SyncStatusSnapshot {
    const meta = this.getMeta(uid);
    const online = this.isOnline();
    const isSyncing = Boolean(uid && this.syncingUids.has(uid));
    const justSynced = Boolean(uid && this.justSyncedUids.has(uid));

    let status: SyncLifecycleState = 'synced';
    if (isSyncing) {
      status = 'syncing';
    } else if (!online) {
      status = 'offline';
    } else if (meta.lastError) {
      status = 'error';
    } else if (meta.dirty || meta.pendingChangesCount > 0) {
      status = 'pending';
    }

    return {
      ...meta,
      uid,
      isOnline: online,
      status,
      justSynced,
      swOfflineReady: this.swOfflineReady,
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public registerSyncHandler(uid: string, handler: () => Promise<boolean>): () => void {
    this.syncHandlers.set(uid, handler);
    return () => {
      if (this.syncHandlers.get(uid) === handler) {
        this.syncHandlers.delete(uid);
      }
    };
  }

  public recordLocalSave(
    uid: string,
    opts?: { actionLabel?: string; forceDirty?: boolean }
  ): void {
    const prev = this.getMeta(uid);
    const shouldMarkDirty = Boolean(opts?.forceDirty) || !this.isOnline();
    const nextActions = [...prev.pendingActions];
    if (shouldMarkDirty && opts?.actionLabel && nextActions[0] !== opts.actionLabel) {
      nextActions.unshift(opts.actionLabel);
    }

    const recentLabelAt = this.lastActionLabelAt.get(uid) ?? 0;
    const labeledRecently = Date.now() - recentLabelAt < 1800;
    const nextCount = shouldMarkDirty
      ? labeledRecently
        ? Math.max(1, prev.pendingChangesCount)
        : Math.max(1, prev.pendingChangesCount + 1)
      : prev.pendingChangesCount;

    this.setMeta(uid, {
      ...prev,
      dirty: prev.dirty || shouldMarkDirty,
      pendingChangesCount: nextCount,
      pendingActions: nextActions.slice(0, MAX_PENDING_ACTION_LABELS),
      lastLocalSaveAt: Date.now(),
    });
  }

  public queueOfflineActionLabel(uid: string, actionLabel: string): void {
    if (!uid || !actionLabel) return;
    this.lastActionLabelAt.set(uid, Date.now());
    const prev = this.getMeta(uid);
    const nextActions = [
      actionLabel,
      ...prev.pendingActions.filter((item) => item !== actionLabel),
    ].slice(0, MAX_PENDING_ACTION_LABELS);

    this.setMeta(uid, {
      ...prev,
      dirty: true,
      pendingChangesCount: prev.pendingChangesCount + 1,
      pendingActions: nextActions,
      lastLocalSaveAt: Date.now(),
    });
  }

  public markSyncStarted(uid: string): void {
    this.syncingUids.add(uid);
    const prev = this.getMeta(uid);
    if (prev.lastError) {
      this.setMeta(uid, { ...prev, lastError: null });
    } else {
      this.notifyListeners();
    }
  }

  public markSyncSucceeded(uid: string, highlightReconnected = false): void {
    this.syncingUids.delete(uid);
    const prev = this.getMeta(uid);
    const hadPending = prev.dirty || prev.pendingChangesCount > 0 || highlightReconnected;

    if (hadPending && typeof window !== 'undefined') {
      const existingTimer = this.justSyncedTimers.get(uid);
      if (existingTimer) window.clearTimeout(existingTimer);
      this.justSyncedUids.add(uid);
      const timer = window.setTimeout(() => {
        this.justSyncedUids.delete(uid);
        this.justSyncedTimers.delete(uid);
        this.notifyListeners();
      }, JUST_SYNCED_BANNER_MS);
      this.justSyncedTimers.set(uid, timer);
    }

    this.setMeta(uid, {
      ...prev,
      dirty: false,
      pendingChangesCount: 0,
      pendingActions: [],
      lastCloudSyncAt: Date.now(),
      lastError: null,
    });
  }

  public markSyncFailed(uid: string, errorMessage: string): void {
    this.syncingUids.delete(uid);
    const prev = this.getMeta(uid);
    this.setMeta(uid, {
      ...prev,
      dirty: true,
      lastError: this.isOnline() ? errorMessage : null,
    });
  }

  public async triggerSync(uid: string): Promise<boolean> {
    if (!uid) return false;
    if (!this.isOnline()) {
      this.notifyListeners();
      return false;
    }

    const existing = this.inFlightSyncs.get(uid);
    if (existing) return existing;

    const handler = this.syncHandlers.get(uid);
    if (!handler) return false;

    const promise = (async () => {
      this.markSyncStarted(uid);
      try {
        const ok = await handler();
        if (ok) {
          this.markSyncSucceeded(uid, true);
        }
        return ok;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to sync kingdom state.';
        this.markSyncFailed(uid, msg);
        return false;
      } finally {
        this.inFlightSyncs.delete(uid);
        this.syncingUids.delete(uid);
        this.notifyListeners();
      }
    })();

    this.inFlightSyncs.set(uid, promise);
    return promise;
  }
}

export const offlineSyncService = new OfflineSyncManager();

export function useOfflineSyncStatus(uid: string | null) {
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot>(() =>
    offlineSyncService.getSnapshot(uid)
  );

  useEffect(() => {
    setSnapshot(offlineSyncService.getSnapshot(uid));
    return offlineSyncService.subscribe(() => {
      setSnapshot(offlineSyncService.getSnapshot(uid));
    });
  }, [uid]);

  const syncNow = useCallback(async () => {
    if (!uid) return false;
    return offlineSyncService.triggerSync(uid);
  }, [uid]);

  return {
    ...snapshot,
    syncNow,
  };
}
