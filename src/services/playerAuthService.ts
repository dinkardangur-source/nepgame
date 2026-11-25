import {
  EmailAuthProvider,
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, auth, db, googleProvider, handleFirestoreError } from '../firebase';

// Blueprint-synchronized validation constants
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_ ]+$/;
export const USERNAME_LOWER_PATTERN = /^[a-z0-9_]+$/;
export const KINGDOM_NAME_MIN_LENGTH = 2;
export const KINGDOM_NAME_MAX_LENGTH = 40;
export const EMAIL_MAX_LENGTH = 254;
export const AVATAR_ID_MAX_LENGTH = 64;

export type AuthProviderKind = 'password' | 'google.com';

export interface PlayerProfile {
  uid: string;
  username: string;
  usernameLower: string;
  avatarId: string;
  kingdomName: string;
  level: number;
  provider: AuthProviderKind;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface PrivateAccount {
  uid: string;
  email: string;
  allowFriendRequests: boolean;
  showOnlineStatus: boolean;
  showKingdomStats: boolean;
  updatedAt: string;
}

export interface PasswordStrengthReport {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too Weak' | 'Weak' | 'Fair' | 'Strong' | 'Royal Fortress';
  valid: boolean;
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    symbol: boolean;
  };
}

// Client-side brute-force rate limiting state (memory + sessionStorage timestamp)
const RATE_LIMIT_WINDOW_MS = 30_000;
const MAX_ATTEMPTS_BEFORE_LOCK = 5;
const authAttemptTracker: Record<string, { failures: number; lockedUntil: number }> = {};

export function getRateLimitRemainingSeconds(actionKey: string): number {
  const entry = authAttemptTracker[actionKey];
  if (!entry) return 0;
  const rem = entry.lockedUntil - Date.now();
  return rem > 0 ? Math.ceil(rem / 1000) : 0;
}

function recordAuthFailure(actionKey: string): void {
  const entry = authAttemptTracker[actionKey] || { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_ATTEMPTS_BEFORE_LOCK) {
    entry.lockedUntil = Date.now() + RATE_LIMIT_WINDOW_MS;
    entry.failures = 0;
  }
  authAttemptTracker[actionKey] = entry;
}

function clearAuthFailures(actionKey: string): void {
  delete authAttemptTracker[actionKey];
}

export function normalizeUsernameSlug(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

export function validateUsernameInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'Username may contain letters, numbers, spaces, and underscores only.';
  }
  const slug = normalizeUsernameSlug(trimmed);
  if (slug.length < USERNAME_MIN_LENGTH || !USERNAME_LOWER_PATTERN.test(slug)) {
    return 'Username must include at least 3 alphanumeric characters.';
  }
  return null;
}

export function validateEmailInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > EMAIL_MAX_LENGTH) {
    return 'Please enter a valid email address.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter a valid email format (e.g. commander@realm.com).';
  }
  return null;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthReport {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const valid = checks.length && checks.upper && checks.lower && checks.digit;

  if (!checks.length || passed <= 1) {
    return { score: 0, label: 'Too Weak', valid, checks };
  }
  if (passed === 2) return { score: 1, label: 'Weak', valid, checks };
  if (passed === 3) return { score: 2, label: 'Fair', valid, checks };
  if (passed === 4) return { score: 3, label: 'Strong', valid, checks };
  return { score: 4, label: 'Royal Fortress', valid, checks };
}

export function mapAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const message = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Verify your credentials or use Forgot Password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in or reset your password.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 8 characters with uppercase, lowercase, and numbers.';
    case 'auth/invalid-email':
      return 'That email address is not formatted correctly.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing authentication.';
    case 'auth/cancelled-popup-request':
      return 'Google sign-in request was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email using a different sign-in method. Sign in with your original method first.';
    case 'auth/too-many-requests':
      return 'Too many attempts detected. Please wait a moment before trying again.';
    case 'auth/requires-recent-login':
      return 'For security, please re-enter your current password or sign in again before updating credentials.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Enable Email/Password).';
    case 'auth/unauthorized-domain':
      return 'This app domain is not authorized for Google Sign-In in Firebase Console. Please use Email & Password sign-in or open the hosted web URL.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This verification or password reset link is invalid or has expired. Please request a fresh link.';
    case 'auth/web-storage-unsupported':
      return 'Browser storage/cookies are blocked. Allow storage for this site or use Email & Password sign-in.';
    case 'auth/user-disabled':
      return 'This commander account has been disabled.';
    case 'auth/network-request-failed':
      return 'Network error communicating with authentication servers. Check your connection.';
    default:
      if (message.toLowerCase().includes('requested action is invalid')) {
        return 'Google Sign-In could not verify this domain or popup session. Please use Email & Password sign-in or open from the authorized web URL.';
      }
      if (message.includes('Firebase:') && message.includes('(')) {
        return message.replace(/^Firebase:\s*/i, '');
      }
      return message || 'Authentication failed. Please try again.';
  }
}

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const slug = normalizeUsernameSlug(username);
  if (!USERNAME_LOWER_PATTERN.test(slug) || slug.length < USERNAME_MIN_LENGTH) {
    return false;
  }
  const path = `usernames/${slug}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', slug));
    return !snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

async function reserveUniqueUsername(uid: string, desiredName: string): Promise<{
  username: string;
  usernameLower: string;
}> {
  const cleanName = desiredName.trim().slice(0, USERNAME_MAX_LENGTH) || 'Nepalese Commander';
  const baseSlug = normalizeUsernameSlug(cleanName) || 'commander';
  let candidateSlug = baseSlug.length >= 3 ? baseSlug : `${baseSlug}_hero`;
  let candidateName = cleanName.length >= 3 ? cleanName : `${cleanName} Hero`;

  // Check primary slug first; if taken, append short UID suffix for Google auto-provisioning
  const existing = await getDoc(doc(db, 'usernames', candidateSlug));
  if (existing.exists() && existing.data()?.uid !== uid) {
    const suffix = uid.slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, 'x');
    candidateSlug = `${candidateSlug.slice(0, USERNAME_MAX_LENGTH - 5)}_${suffix}`;
    candidateName = `${candidateName.slice(0, USERNAME_MAX_LENGTH - 5)}_${suffix}`;
  }

  const indexPath = `usernames/${candidateSlug}`;
  try {
    const check = await getDoc(doc(db, 'usernames', candidateSlug));
    if (!check.exists()) {
      await setDoc(doc(db, 'usernames', candidateSlug), {
        uid,
        username: candidateName,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, indexPath);
  }

  return { username: candidateName, usernameLower: candidateSlug };
}

export async function ensurePlayerProfileDocs(
  user: User,
  overrides?: { username?: string; kingdomName?: string; provider?: AuthProviderKind }
): Promise<{ profile: PlayerProfile; privateAccount: PrivateAccount }> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/account`;

  const providerId: AuthProviderKind =
    overrides?.provider ??
    (user.providerData.some((p) => p.providerId === 'google.com') ? 'google.com' : 'password');

  let userSnap;
  try {
    userSnap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!userSnap.exists()) {
    const rawName =
      overrides?.username?.trim() ||
      user.displayName?.trim() ||
      user.email?.split('@')[0] ||
      'Nepalese Commander';

    const { username, usernameLower } = await reserveUniqueUsername(uid, rawName);
    const kingdomName = (overrides?.kingdomName?.trim() || `${username}'s Bastion`).slice(
      0,
      KINGDOM_NAME_MAX_LENGTH
    );

    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        username,
        usernameLower,
        avatarId: 'hero_bhimsen_thapa',
        kingdomName,
        level: 1,
        provider: providerId,
        emailVerified: Boolean(user.emailVerified),
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    try {
      await setDoc(doc(db, 'users', uid, 'private', 'account'), {
        uid,
        email: (user.email || `${uid}@kingdom.local`).slice(0, EMAIL_MAX_LENGTH),
        allowFriendRequests: true,
        showOnlineStatus: true,
        showKingdomStats: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privatePath);
    }
  } else {
    // Update lastLoginAt & sync emailVerified
    try {
      await updateDoc(doc(db, 'users', uid), {
        emailVerified: Boolean(user.emailVerified),
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }

  // Re-read fresh documents to return canonical values
  let freshProfileSnap;
  let freshPrivateSnap;
  try {
    freshProfileSnap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
  try {
    freshPrivateSnap = await getDoc(doc(db, 'users', uid, 'private', 'account'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }

  const pData = freshProfileSnap.data() || {};
  const privData = freshPrivateSnap.data() || {};

  if (!freshPrivateSnap.exists()) {
    try {
      await setDoc(doc(db, 'users', uid, 'private', 'account'), {
        uid,
        email: (user.email || `${uid}@kingdom.local`).slice(0, EMAIL_MAX_LENGTH),
        allowFriendRequests: true,
        showOnlineStatus: true,
        showKingdomStats: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privatePath);
    }
  }

  return {
    profile: {
      uid,
      username: String(pData.username || user.displayName || 'Commander'),
      usernameLower: String(pData.usernameLower || 'commander'),
      avatarId: String(pData.avatarId || 'hero_bhimsen_thapa'),
      kingdomName: String(pData.kingdomName || 'Gorkha Bastion'),
      level: Number(pData.level || 1),
      provider: (pData.provider as AuthProviderKind) || providerId,
      emailVerified: Boolean(user.emailVerified || pData.emailVerified),
      createdAt: tsToIso(pData.createdAt),
      lastLoginAt: tsToIso(pData.lastLoginAt),
    },
    privateAccount: {
      uid,
      email: String(privData.email || user.email || ''),
      allowFriendRequests: privData.allowFriendRequests !== false,
      showOnlineStatus: privData.showOnlineStatus !== false,
      showKingdomStats: privData.showKingdomStats !== false,
      updatedAt: tsToIso(privData.updatedAt),
    },
  };
}

export async function registerWithEmail(params: {
  username: string;
  email: string;
  password: string;
  kingdomName?: string;
}): Promise<{ user: User; profile: PlayerProfile; privateAccount: PrivateAccount }> {
  const lockSec = getRateLimitRemainingSeconds('register');
  if (lockSec > 0) {
    throw new Error(`Too many registration attempts. Please wait ${lockSec}s.`);
  }

  const uErr = validateUsernameInput(params.username);
  if (uErr) throw new Error(uErr);
  const eErr = validateEmailInput(params.email);
  if (eErr) throw new Error(eErr);
  const pwReport = evaluatePasswordStrength(params.password);
  if (!pwReport.valid) {
    throw new Error('Password must be 8+ characters with uppercase, lowercase, and a digit.');
  }

  const available = await isUsernameAvailable(params.username);
  if (!available) {
    throw new Error('That Commander Username is already claimed. Please choose another.');
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    await updateProfile(cred.user, { displayName: params.username.trim() });
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Verification email dispatch errors should not prevent initial profile setup
    }
    const { profile, privateAccount } = await ensurePlayerProfileDocs(cred.user, {
      username: params.username.trim(),
      kingdomName: params.kingdomName?.trim(),
      provider: 'password',
    });
    clearAuthFailures('register');
    return { user: cred.user, profile, privateAccount };
  } catch (error) {
    recordAuthFailure('register');
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<{ user: User; profile: PlayerProfile; privateAccount: PrivateAccount }> {
  const lockSec = getRateLimitRemainingSeconds('login');
  if (lockSec > 0) {
    throw new Error(`Too many failed sign-in attempts. Locked for ${lockSec}s.`);
  }

  const eErr = validateEmailInput(params.email);
  if (eErr) throw new Error(eErr);
  if (!params.password) throw new Error('Please enter your password.');

  try {
    await setPersistence(
      auth,
      params.rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
    const cred = await signInWithEmailAndPassword(auth, params.email.trim(), params.password);
    const { profile, privateAccount } = await ensurePlayerProfileDocs(cred.user);
    clearAuthFailures('login');
    return { user: cred.user, profile, privateAccount };
  } catch (error) {
    recordAuthFailure('login');
    throw new Error(mapAuthErrorMessage(error));
  }
}

let cachedAuthorizedDomains: { domains: string[]; fetchedAt: number } | null = null;

async function fetchFirebaseAuthorizedDomains(): Promise<string[] | null> {
  if (cachedAuthorizedDomains && Date.now() - cachedAuthorizedDomains.fetchedAt < 5 * 60_000) {
    return cachedAuthorizedDomains.domains;
  }
  if (!firebaseConfig?.apiKey) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { authorizedDomains?: unknown };
    if (Array.isArray(data.authorizedDomains)) {
      const domains = data.authorizedDomains.map((d) => String(d).toLowerCase());
      cachedAuthorizedDomains = { domains, fetchedAt: Date.now() };
      return domains;
    }
    return null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function hostnameMatchesAuthorized(hostname: string, domains: string[]): boolean {
  const host = hostname.toLowerCase();
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isNativeAndroidApk(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidAuthBridge) return true;
  return (
    window.location.protocol === 'https:' &&
    window.location.hostname === 'localhost' &&
    /Android/i.test(navigator.userAgent)
  );
}

async function resolveReadyMobileAuthRelayUrl(authorizedDomains: string[] | null): Promise<string | null> {
  const rawCandidates = [
    import.meta.env.VITE_AUTH_BRIDGE_URL,
    'https://ais-pre-qmqd244uw7jv7pihnnfano-351876851193.asia-east1.run.app',
    'https://nepgame.ai.studio',
    'https://nepgame-270849059427.asia-southeast1.run.app',
  ].filter((v): v is string => typeof v === 'string' && v.trim().startsWith('https://'));

  const uniqueCandidates = Array.from(new Set(rawCandidates.map((u) => u.trim().replace(/\/+$/, ''))));
  for (const baseUrl of uniqueCandidates) {
    try {
      const parsed = new URL(baseUrl);
      if (authorizedDomains && !hostnameMatchesAuthorized(parsed.hostname, authorizedDomains)) {
        continue;
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(`${baseUrl}/`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) continue;
        const html = await res.text();
        if (html.includes('name="erot-mobile-auth-ready"') || html.includes("name='erot-mobile-auth-ready'")) {
          return baseUrl;
        }
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      // Try next relay candidate
    }
  }
  return null;
}

export async function completeNativeGoogleCallbackUrl(
  callbackUrl: string,
  expectedNonce?: string,
  rememberMe = true
): Promise<{ user: User; profile: PlayerProfile; privateAccount: PrivateAccount; isNewUser: boolean }> {
  const parsed = new URL(callbackUrl);
  const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
  const queryParams = parsed.searchParams;

  const returnedError = hashParams.get('error') || queryParams.get('error');
  if (returnedError) {
    throw new Error(returnedError);
  }

  const returnedNonce = hashParams.get('nonce') || queryParams.get('nonce') || '';
  if (expectedNonce && returnedNonce && returnedNonce !== expectedNonce) {
    throw new Error('Google sign-in session verification mismatch. Please try again.');
  }

  const idToken = hashParams.get('idToken') || queryParams.get('idToken') || '';
  const accessToken = hashParams.get('accessToken') || queryParams.get('accessToken') || '';
  if (!idToken && !accessToken) {
    throw new Error('Google sign-in did not return an authentication token.');
  }

  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
  const cred = await signInWithCredential(auth, credential);
  const existingSnap = await getDoc(doc(db, 'users', cred.user.uid));
  const isNewUser = !existingSnap.exists();
  const { profile, privateAccount } = await ensurePlayerProfileDocs(cred.user, {
    provider: 'google.com',
  });
  clearAuthFailures('login');
  return { user: cred.user, profile, privateAccount, isNewUser };
}

async function signInViaAndroidChromeRelay(
  relayBaseUrl: string,
  rememberMe: boolean
): Promise<{ user: User; profile: PlayerProfile; privateAccount: PrivateAccount; isNewUser: boolean }> {
  const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const authUrl = `${relayBaseUrl}/?mobileAuth=google&nonce=${encodeURIComponent(nonce)}`;

  const callbackUrl = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('erot-native-auth-callback', onCallbackEvent as EventListener);
      window.removeEventListener('focus', checkPending);
      document.removeEventListener('visibilitychange', checkPending);
      window.clearTimeout(timeoutId);
    };

    const finish = (url: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(url);
    };

    const onCallbackEvent = (ev: CustomEvent<{ url?: string }>) => {
      const url = ev?.detail?.url;
      if (url) finish(url);
    };

    const checkPending = () => {
      const pending = window.AndroidAuthBridge?.consumePendingAuthUrl?.();
      if (pending) finish(pending);
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Google sign-in timed out before returning to the app. Please try again.'));
    }, 120_000);

    window.addEventListener('erot-native-auth-callback', onCallbackEvent as EventListener);
    window.addEventListener('focus', checkPending);
    document.addEventListener('visibilitychange', checkPending);

    if (window.AndroidAuthBridge?.openExternalBrowser) {
      window.AndroidAuthBridge.openExternalBrowser(authUrl);
    } else {
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    }
  });

  return completeNativeGoogleCallbackUrl(callbackUrl, nonce, rememberMe);
}

export async function signInWithGooglePopup(
  rememberMe = true
): Promise<{ user: User; profile: PlayerProfile; privateAccount: PrivateAccount; isNewUser: boolean }> {
  try {
    const authorizedDomains = await fetchFirebaseAuthorizedDomains();

    if (isNativeAndroidApk()) {
      const relayUrl = await resolveReadyMobileAuthRelayUrl(authorizedDomains);
      if (relayUrl && window.AndroidAuthBridge?.openExternalBrowser) {
        return await signInViaAndroidChromeRelay(relayUrl, rememberMe);
      }
      throw new Error(
        'Google Sign-In inside the Android APK needs an updated web relay or Email & Password sign-in. Please sign in or Create Kingdom Account with Email & Password below—it works immediately!'
      );
    }

    if (
      typeof window !== 'undefined' &&
      authorizedDomains &&
      !hostnameMatchesAuthorized(window.location.hostname, authorizedDomains)
    ) {
      throw new Error(
        `Domain "${window.location.hostname}" is not in Firebase Authorized Domains yet (which triggers "The requested action is invalid"). Use Email & Password below or add "${window.location.hostname}" in Firebase Console → Authentication → Settings → Authorized domains.`
      );
    }

    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithPopup(auth, googleProvider);
    const existingSnap = await getDoc(doc(db, 'users', cred.user.uid));
    const isNewUser = !existingSnap.exists();
    const { profile, privateAccount } = await ensurePlayerProfileDocs(cred.user, {
      provider: 'google.com',
    });
    clearAuthFailures('login');
    return { user: cred.user, profile, privateAccount, isNewUser };
  } catch (error) {
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const lockSec = getRateLimitRemainingSeconds('reset');
  if (lockSec > 0) {
    throw new Error(`Please wait ${lockSec}s before requesting another reset email.`);
  }
  const eErr = validateEmailInput(email);
  if (eErr) throw new Error(eErr);

  try {
    await sendPasswordResetEmail(auth, email.trim());
    recordAuthFailure('reset'); // Light anti-spam cooldown counter
  } catch (error) {
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function resendVerification(): Promise<void> {
  if (!auth.currentUser) throw new Error('No active session.');
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (error) {
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function refreshEmailVerification(): Promise<boolean> {
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  const verified = Boolean(auth.currentUser.emailVerified);
  try {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      emailVerified: verified,
      lastLoginAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
  }
  return verified;
}

export async function updatePlayerAccountProfile(
  uid: string,
  currentProfile: PlayerProfile,
  updates: {
    username?: string;
    kingdomName?: string;
    avatarId?: string;
    level?: number;
  }
): Promise<PlayerProfile> {
  let nextUsername = currentProfile.username;
  let nextSlug = currentProfile.usernameLower;

  if (updates.username !== undefined && updates.username.trim() !== currentProfile.username) {
    const err = validateUsernameInput(updates.username);
    if (err) throw new Error(err);
    const clean = updates.username.trim();
    const slug = normalizeUsernameSlug(clean);
    if (slug !== currentProfile.usernameLower) {
      const snap = await getDoc(doc(db, 'usernames', slug));
      if (snap.exists() && snap.data()?.uid !== uid) {
        throw new Error('That username is already taken.');
      }
      await setDoc(doc(db, 'usernames', slug), {
        uid,
        username: clean,
        createdAt: serverTimestamp(),
      });
      if (currentProfile.usernameLower) {
        try {
          await deleteDoc(doc(db, 'usernames', currentProfile.usernameLower));
        } catch {
          // Non-fatal if legacy index missing
        }
      }
    }
    nextUsername = clean;
    nextSlug = slug;
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: clean });
    }
  }

  const nextKingdomName = (updates.kingdomName ?? currentProfile.kingdomName)
    .trim()
    .slice(0, KINGDOM_NAME_MAX_LENGTH);
  if (nextKingdomName.length < KINGDOM_NAME_MIN_LENGTH) {
    throw new Error(`Kingdom name must be at least ${KINGDOM_NAME_MIN_LENGTH} characters.`);
  }

  const nextAvatar = (updates.avatarId ?? currentProfile.avatarId).slice(0, AVATAR_ID_MAX_LENGTH);
  const nextLevel = Math.max(1, Math.min(999, Math.round(updates.level ?? currentProfile.level)));

  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      username: nextUsername,
      usernameLower: nextSlug,
      kingdomName: nextKingdomName,
      avatarId: nextAvatar,
      level: nextLevel,
      emailVerified: Boolean(auth.currentUser?.emailVerified ?? currentProfile.emailVerified),
      lastLoginAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    ...currentProfile,
    username: nextUsername,
    usernameLower: nextSlug,
    kingdomName: nextKingdomName,
    avatarId: nextAvatar,
    level: nextLevel,
  };
}

export async function updatePrivacySettings(
  uid: string,
  current: PrivateAccount,
  updates: {
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
    showKingdomStats: boolean;
  }
): Promise<PrivateAccount> {
  const path = `users/${uid}/private/account`;
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'account'), {
      allowFriendRequests: updates.allowFriendRequests,
      showOnlineStatus: updates.showOnlineStatus,
      showKingdomStats: updates.showKingdomStats,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
  return {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No active email session found.');
  const pwReport = evaluatePasswordStrength(newPassword);
  if (!pwReport.valid) {
    throw new Error('New password must be 8+ characters with uppercase, lowercase, and a number.');
  }
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function signOutPlayerSession(): Promise<void> {
  await signOut(auth);
}

/**
 * Persist and restore Kingdom progression independently under users/{uid}/kingdom/progress
 */
export async function saveKingdomProgressToCloud(
  uid: string,
  commanderXp: number,
  statePayload: Record<string, unknown>
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  const path = `users/${uid}/kingdom/progress`;
  try {
    await setDoc(doc(db, 'users', uid, 'kingdom', 'progress'), {
      uid,
      commanderXp: Math.max(0, Math.round(commanderXp)),
      snapshotVersion: 1,
      state: statePayload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadKingdomProgressFromCloud(
  uid: string
): Promise<Record<string, unknown> | null> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return null;
  const path = `users/${uid}/kingdom/progress`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'kingdom', 'progress'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return (data?.state as Record<string, unknown>) || null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
