import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  PrivateAccount,
  PlayerProfile,
  completeNativeGoogleCallbackUrl,
  ensurePlayerProfileDocs,
  refreshEmailVerification,
  registerWithEmail,
  resendVerification,
  sendPasswordReset,
  signInWithEmail,
  signInWithGooglePopup,
  signOutPlayerSession,
  updatePlayerAccountProfile,
  updatePrivacySettings,
  changeUserPassword,
} from '../services/playerAuthService';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';
export type AccountModalKind = 'profile' | 'settings' | 'password' | 'privacy' | null;

interface AuthContextValue {
  user: User | null;
  profile: PlayerProfile | null;
  privateAccount: PrivateAccount | null;
  authStatus: AuthStatus;
  welcomeBanner: string | null;
  signOutConfirmOpen: boolean;
  activeAccountModal: AccountModalKind;
  authSyncError: string | null;
  signInEmail: (params: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
  signUpEmail: (params: {
    username: string;
    email: string;
    password: string;
    kingdomName?: string;
  }) => Promise<void>;
  signInGoogle: (rememberMe?: boolean) => Promise<{ isNewUser: boolean }>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkEmailVerified: () => Promise<boolean>;
  updateAccountProfile: (updates: {
    username?: string;
    kingdomName?: string;
    avatarId?: string;
    level?: number;
  }) => Promise<PlayerProfile>;
  updatePrivacy: (updates: {
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
    showKingdomStats: boolean;
  }) => Promise<PrivateAccount>;
  updateAccountPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  openSignOutConfirm: () => void;
  cancelSignOutConfirm: () => void;
  confirmSignOut: () => Promise<void>;
  registerBeforeSignOutHook: (fn: (() => Promise<void>) | null) => void;
  openAccountModal: (kind: AccountModalKind) => void;
  closeAccountModal: () => void;
  clearWelcomeBanner: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function dismissBootSplashOverlay(): void {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById('app-boot-splash');
  if (!splash || splash.dataset.dismissed === '1') return;
  splash.dataset.dismissed = '1';
  splash.style.opacity = '0';
  window.setTimeout(() => {
    splash.remove();
  }, 260);
}

const AUTH_CACHE_PREFIX = 'erot_auth_cache_v1_';

function readCachedAuthDocs(uid: string): { profile: PlayerProfile; privateAccount: PrivateAccount | null } | null {
  try {
    const raw = localStorage.getItem(`${AUTH_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: PlayerProfile; privateAccount?: PrivateAccount | null };
    if (parsed?.profile && parsed.profile.uid === uid) {
      return { profile: parsed.profile, privateAccount: parsed.privateAccount ?? null };
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeCachedAuthDocs(uid: string, profile: PlayerProfile, privateAccount: PrivateAccount | null): void {
  try {
    localStorage.setItem(`${AUTH_CACHE_PREFIX}${uid}`, JSON.stringify({ profile, privateAccount }));
  } catch {
    // Ignore storage quota errors
  }
}

function buildFallbackProfile(firebaseUser: User): { profile: PlayerProfile; privateAccount: PrivateAccount } {
  const email = firebaseUser.email || '';
  const baseName =
    firebaseUser.displayName?.trim() ||
    (email ? email.split('@')[0] : '') ||
    'Commander';
  const sanitized = baseName.replace(/[^a-zA-Z0-9_ ]/g, '').trim() || 'Commander';
  const username = sanitized.slice(0, 24);
  const usernameLower = (username.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'commander').slice(0, 24);
  const isGoogle = firebaseUser.providerData.some((p) => p?.providerId === 'google.com');
  const nowIso = new Date().toISOString();
  return {
    profile: {
      uid: firebaseUser.uid,
      username,
      usernameLower,
      avatarId: 'hero_bhimsen',
      kingdomName: 'Royal Citadel',
      level: 1,
      provider: isGoogle ? 'google.com' : 'password',
      emailVerified: firebaseUser.emailVerified,
      createdAt: nowIso,
      lastLoginAt: nowIso,
    },
    privateAccount: {
      uid: firebaseUser.uid,
      email,
      allowFriendRequests: true,
      showOnlineStatus: true,
      showKingdomStats: true,
      updatedAt: nowIso,
    },
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [privateAccount, setPrivateAccount] = useState<PrivateAccount | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [welcomeBanner, setWelcomeBanner] = useState<string | null>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState<boolean>(false);
  const [activeAccountModal, setActiveAccountModal] = useState<AccountModalKind>(null);
  const [authSyncError, setAuthSyncError] = useState<string | null>(null);

  const beforeSignOutHookRef = useRef<(() => Promise<void>) | null>(null);
  const manualAuthInFlightRef = useRef<boolean>(false);

  const registerBeforeSignOutHook = useCallback((fn: (() => Promise<void>) | null) => {
    beforeSignOutHookRef.current = fn;
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active) return;

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setPrivateAccount(null);
        setAuthStatus('unauthenticated');
        setSignOutConfirmOpen(false);
        setActiveAccountModal(null);
        dismissBootSplashOverlay();
        return;
      }

      setUser(firebaseUser);
      setAuthSyncError(null);

      // Hydrate immediately from per-UID cache or Firebase User snapshot so UI enters game with zero network stall
      if (!manualAuthInFlightRef.current) {
        const cached = readCachedAuthDocs(firebaseUser.uid);
        if (cached) {
          setProfile(cached.profile);
          if (cached.privateAccount) setPrivateAccount(cached.privateAccount);
        } else {
          const fallback = buildFallbackProfile(firebaseUser);
          setProfile(fallback.profile);
          setPrivateAccount(fallback.privateAccount);
        }
      }

      setAuthStatus('authenticated');

      // Sync authoritative Firestore player docs non-blockingly when online
      if (!manualAuthInFlightRef.current && (typeof navigator === 'undefined' || navigator.onLine)) {
        void ensurePlayerProfileDocs(firebaseUser)
          .then((docs) => {
            if (!active || auth.currentUser?.uid !== firebaseUser.uid) return;
            setProfile(docs.profile);
            setPrivateAccount(docs.privateAccount);
            writeCachedAuthDocs(firebaseUser.uid, docs.profile, docs.privateAccount);
          })
          .catch((err) => {
            if (!active) return;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;
            setAuthSyncError(err instanceof Error ? err.message : 'Unable to load kingdom profile.');
          });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Recover Google OAuth callback if Android restarted MainActivity from deep-link return
  useEffect(() => {
    const pendingUrl = window.AndroidAuthBridge?.consumePendingAuthUrl?.();
    if (!pendingUrl || auth.currentUser) return;
    manualAuthInFlightRef.current = true;
    void completeNativeGoogleCallbackUrl(pendingUrl)
      .then((res) => {
        setUser(res.user);
        setProfile(res.profile);
        setPrivateAccount(res.privateAccount);
        writeCachedAuthDocs(res.user.uid, res.profile, res.privateAccount);
        setWelcomeBanner(res.isNewUser ? 'YOUR KINGDOM BEGINS NOW.' : 'WELCOME BACK, COMMANDER.');
        setAuthStatus('authenticated');
      })
      .catch((err) => {
        setAuthSyncError(err instanceof Error ? err.message : 'Unable to finish Google Sign-In.');
      })
      .finally(() => {
        manualAuthInFlightRef.current = false;
      });
  }, []);

  // Periodic + focus + reconnect session token validation (survives offline play)
  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;

    const REVOKED_AUTH_CODES = new Set([
      'auth/user-token-expired',
      'auth/invalid-user-token',
      'auth/token-expired',
      'auth/user-disabled',
      'auth/user-not-found',
    ]);

    const validateSessionToken = async (refreshProfileOnSuccess = false) => {
      const current = auth.currentUser;
      if (!current) {
        setAuthStatus('unauthenticated');
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      try {
        const result = await current.getIdTokenResult();
        const expiresAtMs = Date.parse(result.expirationTime);
        if (!Number.isNaN(expiresAtMs) && Date.now() >= expiresAtMs) {
          await current.getIdToken(true);
        }
        if (refreshProfileOnSuccess && !manualAuthInFlightRef.current) {
          void ensurePlayerProfileDocs(current)
            .then((docs) => {
              if (auth.currentUser?.uid !== current.uid) return;
              setProfile(docs.profile);
              setPrivateAccount(docs.privateAccount);
              writeCachedAuthDocs(current.uid, docs.profile, docs.privateAccount);
              setAuthSyncError(null);
            })
            .catch(() => {});
        }
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        if (REVOKED_AUTH_CODES.has(code)) {
          await signOutPlayerSession().catch(() => {});
        }
      }
    };

    const onFocus = () => {
      void validateSessionToken(false);
    };
    const onOnline = () => {
      void validateSessionToken(true);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(() => {
      void validateSessionToken(false);
    }, 60_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [authStatus, user]);

  const signInEmail = useCallback(
    async (params: { email: string; password: string; rememberMe: boolean }) => {
      manualAuthInFlightRef.current = true;
      try {
        const res = await signInWithEmail(params);
        setUser(res.user);
        setProfile(res.profile);
        setPrivateAccount(res.privateAccount);
        writeCachedAuthDocs(res.user.uid, res.profile, res.privateAccount);
        setWelcomeBanner('WELCOME BACK, COMMANDER.');
        setAuthStatus('authenticated');
      } finally {
        manualAuthInFlightRef.current = false;
      }
    },
    []
  );

  const signUpEmail = useCallback(
    async (params: {
      username: string;
      email: string;
      password: string;
      kingdomName?: string;
    }) => {
      manualAuthInFlightRef.current = true;
      try {
        const res = await registerWithEmail(params);
        setUser(res.user);
        setProfile(res.profile);
        setPrivateAccount(res.privateAccount);
        writeCachedAuthDocs(res.user.uid, res.profile, res.privateAccount);
        setWelcomeBanner('YOUR KINGDOM BEGINS NOW.');
        setAuthStatus('authenticated');
      } finally {
        manualAuthInFlightRef.current = false;
      }
    },
    []
  );

  const signInGoogle = useCallback(async (rememberMe = true) => {
    manualAuthInFlightRef.current = true;
    try {
      const res = await signInWithGooglePopup(rememberMe);
      setUser(res.user);
      setProfile(res.profile);
      setPrivateAccount(res.privateAccount);
      writeCachedAuthDocs(res.user.uid, res.profile, res.privateAccount);
      setWelcomeBanner(res.isNewUser ? 'YOUR KINGDOM BEGINS NOW.' : 'WELCOME BACK, COMMANDER.');
      setAuthStatus('authenticated');
      return { isNewUser: res.isNewUser };
    } finally {
      manualAuthInFlightRef.current = false;
    }
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    await sendPasswordReset(email);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    await resendVerification();
  }, []);

  const checkEmailVerified = useCallback(async () => {
    const verified = await refreshEmailVerification();
    if (auth.currentUser) {
      setUser(auth.currentUser);
    }
    setProfile((prev) => (prev ? { ...prev, emailVerified: verified } : prev));
    return verified;
  }, []);

  const updateAccountProfile = useCallback(
    async (updates: {
      username?: string;
      kingdomName?: string;
      avatarId?: string;
      level?: number;
    }) => {
      if (!user || !profile) throw new Error('Not authenticated.');
      const next = await updatePlayerAccountProfile(user.uid, profile, updates);
      setProfile(next);
      writeCachedAuthDocs(user.uid, next, privateAccount);
      return next;
    },
    [privateAccount, profile, user]
  );

  const updatePrivacy = useCallback(
    async (updates: {
      allowFriendRequests: boolean;
      showOnlineStatus: boolean;
      showKingdomStats: boolean;
    }) => {
      if (!user || !privateAccount) throw new Error('Not authenticated.');
      const next = await updatePrivacySettings(user.uid, privateAccount, updates);
      setPrivateAccount(next);
      if (profile) writeCachedAuthDocs(user.uid, profile, next);
      return next;
    },
    [privateAccount, profile, user]
  );

  const updateAccountPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await changeUserPassword(currentPassword, newPassword);
  }, []);

  const openSignOutConfirm = useCallback(() => {
    setSignOutConfirmOpen(true);
  }, []);

  const cancelSignOutConfirm = useCallback(() => {
    setSignOutConfirmOpen(false);
  }, []);

  const confirmSignOut = useCallback(async () => {
    try {
      if (beforeSignOutHookRef.current) {
        await beforeSignOutHookRef.current().catch(() => {});
      }
      await signOutPlayerSession();
    } finally {
      setSignOutConfirmOpen(false);
      setActiveAccountModal(null);
      setWelcomeBanner(null);
      setUser(null);
      setProfile(null);
      setPrivateAccount(null);
      setAuthStatus('unauthenticated');
    }
  }, []);

  const openAccountModal = useCallback((kind: AccountModalKind) => {
    setActiveAccountModal(kind);
  }, []);

  const closeAccountModal = useCallback(() => {
    setActiveAccountModal(null);
  }, []);

  const clearWelcomeBanner = useCallback(() => {
    setWelcomeBanner(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      privateAccount,
      authStatus,
      welcomeBanner,
      signOutConfirmOpen,
      activeAccountModal,
      authSyncError,
      signInEmail,
      signUpEmail,
      signInGoogle,
      sendResetEmail,
      resendVerificationEmail,
      checkEmailVerified,
      updateAccountProfile,
      updatePrivacy,
      updateAccountPassword,
      openSignOutConfirm,
      cancelSignOutConfirm,
      confirmSignOut,
      registerBeforeSignOutHook,
      openAccountModal,
      closeAccountModal,
      clearWelcomeBanner,
    }),
    [
      activeAccountModal,
      authStatus,
      authSyncError,
      cancelSignOutConfirm,
      checkEmailVerified,
      clearWelcomeBanner,
      closeAccountModal,
      confirmSignOut,
      openAccountModal,
      openSignOutConfirm,
      privateAccount,
      profile,
      registerBeforeSignOutHook,
      resendVerificationEmail,
      sendResetEmail,
      signInEmail,
      signInGoogle,
      signOutConfirmOpen,
      signUpEmail,
      updateAccountPassword,
      updateAccountProfile,
      updatePrivacy,
      user,
      welcomeBanner,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
