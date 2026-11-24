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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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

      // If an explicit login/signup call is already provisioning docs, avoid racing it
      if (!manualAuthInFlightRef.current) {
        try {
          const docs = await ensurePlayerProfileDocs(firebaseUser);
          setProfile(docs.profile);
          setPrivateAccount(docs.privateAccount);
        } catch (err) {
          setAuthSyncError(err instanceof Error ? err.message : 'Unable to load kingdom profile.');
        }
      }

      setAuthStatus('authenticated');
      dismissBootSplashOverlay();
    });

    return () => unsubscribe();
  }, []);

  // Periodic + focus session token expiration validation
  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;

    const validateSessionToken = async () => {
      const current = auth.currentUser;
      if (!current) {
        setAuthStatus('unauthenticated');
        return;
      }
      try {
        const result = await current.getIdTokenResult();
        const expiresAtMs = Date.parse(result.expirationTime);
        if (!Number.isNaN(expiresAtMs) && Date.now() >= expiresAtMs) {
          await current.getIdToken(true);
        }
      } catch {
        // Token revoked or session invalidated
        await signOutPlayerSession().catch(() => {});
      }
    };

    const onFocus = () => {
      void validateSessionToken();
    };
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      void validateSessionToken();
    }, 60_000);

    return () => {
      window.removeEventListener('focus', onFocus);
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
      return next;
    },
    [profile, user]
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
      return next;
    },
    [privateAccount, user]
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
