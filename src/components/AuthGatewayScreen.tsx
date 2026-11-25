import React, { useEffect, useRef, useState } from 'react';
import fortressSceneImg from '../assets/images/login_fortress_opt.webp';
import royalCrestImg from '../assets/images/royal_crest_ui.webp';
import { useAuth } from '../context/AuthContext';
import {
  evaluatePasswordStrength,
  getRateLimitRemainingSeconds,
  isUsernameAvailable,
  validateEmailInput,
  validateUsernameInput,
} from '../services/playerAuthService';
import { AccessiblePasswordField } from './AccessiblePasswordField';
import { AndroidApkModal } from './AndroidApkModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

type AuthPanelMode = 'login' | 'signup' | 'forgot';
type LegalModalKind = 'terms' | 'privacy' | null;

const GoogleIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
    />
    <path
      fill="#FBBC05"
      d="M3.6 7.4l3.2 2.3C7.7 7.6 9.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5c-3.7 0-6.9 2.1-8.4 4.9z"
    />
    <path
      fill="#34A853"
      d="M12 21.5c2.5 0 4.6-.8 6.2-2.2l-2.9-2.4c-.8.5-1.9.9-3.3.9-2.5 0-4.7-1.7-5.5-4l-3.2 2.5c1.5 3 4.8 5.2 8.7 5.2z"
    />
    <path
      fill="#4285F4"
      d="M21.1 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.2-1 2.2-2 2.9l2.9 2.4c1.7-1.6 2.8-4 2.8-7.6z"
    />
  </svg>
);

export const AuthGatewayScreen: React.FC = () => {
  const { signInEmail, signUpEmail, signInGoogle, sendResetEmail } = useAuth();

  const [mode, setMode] = useState<AuthPanelMode>('login');
  const [legalModal, setLegalModal] = useState<LegalModalKind>(null);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const { isInstallable, isInstalled, isIOS, isAndroid, install: installPWA } = usePWAInstall();

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up fields
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPw, setSignupConfirmPw] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupConfirmPw, setShowSignupConfirmPw] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');

  // Forgot Password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Shared UI states
  const [loadingAction, setLoadingAction] = useState<'login' | 'signup' | 'google' | 'reset' | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successHeadline, setSuccessHeadline] = useState<string | null>(null);
  const [rateLimitSec, setRateLimitSec] = useState<number>(0);

  // Parallax & particle canvas refs
  const [parallax, setParallax] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const pwStrength = evaluatePasswordStrength(signupPassword);

  // Poll rate limit countdown when locked
  useEffect(() => {
    if (rateLimitSec <= 0) return;
    const t = window.setInterval(() => {
      const rem = Math.max(
        getRateLimitRemainingSeconds('login'),
        getRateLimitRemainingSeconds('register'),
        getRateLimitRemainingSeconds('reset')
      );
      setRateLimitSec(rem);
    }, 1000);
    return () => window.clearInterval(t);
  }, [rateLimitSec]);

  // Debounced username uniqueness check
  useEffect(() => {
    if (mode !== 'signup') return;
    const trimmed = signupUsername.trim();
    if (!trimmed) {
      setUsernameAvailability('idle');
      return;
    }
    const err = validateUsernameInput(trimmed);
    if (err) {
      setUsernameAvailability('invalid');
      return;
    }
    setUsernameAvailability('checking');
    const timer = window.setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(trimmed);
        setUsernameAvailability(available ? 'available' : 'taken');
      } catch {
        setUsernameAvailability('idle');
      }
    }, 360);
    return () => window.clearTimeout(timer);
  }, [mode, signupUsername]);

  // Lightweight golden ember particles overlay
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    };
    resize();
    window.addEventListener('resize', resize);

    const embers = Array.from({ length: 34 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1.1 + Math.random() * 2.2,
      vy: 0.25 + Math.random() * 0.55,
      vx: (Math.random() - 0.5) * 0.35,
      alpha: 0.3 + Math.random() * 0.65,
    }));

    let rafId = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const e of embers) {
        e.y -= e.vy;
        e.x += e.vx + Math.sin(e.y * 0.02) * 0.16;
        if (e.y < -10) {
          e.y = canvas.height + 10;
          e.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(253, 224, 71, ${e.alpha})`;
        ctx.fill();
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const switchMode = (next: AuthPanelMode) => {
    setMode(next);
    setErrorMessage(null);
    setResetSuccessMsg(null);
    setShowLoginPw(false);
    setShowSignupPw(false);
    setShowSignupConfirmPw(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const eErr = validateEmailInput(loginEmail);
    if (eErr) {
      setErrorMessage(eErr);
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoadingAction('login');
    try {
      setSuccessHeadline('WELCOME BACK, COMMANDER.');
      await signInEmail({
        email: loginEmail,
        password: loginPassword,
        rememberMe,
      });
    } catch (err) {
      setSuccessHeadline(null);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to sign in.');
      setRateLimitSec(getRateLimitRemainingSeconds('login'));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const uErr = validateUsernameInput(signupUsername);
    if (uErr) {
      setErrorMessage(uErr);
      return;
    }
    if (usernameAvailability === 'taken') {
      setErrorMessage('That Commander Username is already claimed. Please choose another.');
      return;
    }
    const eErr = validateEmailInput(signupEmail);
    if (eErr) {
      setErrorMessage(eErr);
      return;
    }
    if (!pwStrength.valid) {
      setErrorMessage('Password must be 8+ characters with uppercase, lowercase, and a digit.');
      return;
    }
    if (signupPassword !== signupConfirmPw) {
      setErrorMessage('Password and confirmation do not match.');
      return;
    }
    if (!acceptTerms) {
      setErrorMessage('Please accept the Terms and Conditions and Privacy Policy to continue.');
      return;
    }

    setLoadingAction('signup');
    try {
      setSuccessHeadline('YOUR KINGDOM BEGINS NOW.');
      await signUpEmail({
        username: signupUsername.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
      });
    } catch (err) {
      setSuccessHeadline(null);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to create account.');
      setRateLimitSec(getRateLimitRemainingSeconds('register'));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setLoadingAction('google');
    try {
      const res = await signInGoogle(rememberMe);
      setSuccessHeadline(res.isNewUser ? 'YOUR KINGDOM BEGINS NOW.' : 'WELCOME BACK, COMMANDER.');
    } catch (err) {
      setSuccessHeadline(null);
      setErrorMessage(err instanceof Error ? err.message : 'Google authentication failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessMsg(null);
    const eErr = validateEmailInput(resetEmail);
    if (eErr) {
      setErrorMessage(eErr);
      return;
    }

    setLoadingAction('reset');
    try {
      await sendResetEmail(resetEmail);
      setResetSuccessMsg(
        `A royal password recovery link has been dispatched to ${resetEmail.trim()}. Check your inbox and spam folder.`
      );
      setRateLimitSec(getRateLimitRemainingSeconds('reset'));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to send reset link.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="kg-scroll-root">
      <div className="kg-auth-grid">
        {/* LEFT SIDE: Himalayan Royal Commander Artwork & Animated Atmospheric VFX */}
        <section
          className="kg-art-pane"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 14;
            const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 10;
            setParallax({ x: -nx, y: -ny });
          }}
          onPointerLeave={() => setParallax({ x: 0, y: 0 })}
        >
          <img
            src={fortressSceneImg}
            alt="Himalayan Mountain Fortress and Royal Nepalese Commander"
            className="kg-art-bg"
            referrerPolicy="no-referrer"
            style={{
              transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.04)`,
            }}
          />
          <div className="kg-art-scrim" />
          <div className="kg-torch-glow kg-torch-glow--left" aria-hidden="true" />
          <div className="kg-torch-glow kg-torch-glow--right" aria-hidden="true" />
          <div className="kg-mist-layer" aria-hidden="true" />
          <canvas ref={particleCanvasRef} className="kg-particles-canvas" aria-hidden="true" />

          {/* Top Left Game Brand */}
          <div className="kg-brand-lockup">
            <div className="kg-crest-frame">
              <img
                src={royalCrestImg}
                alt="Empire of the Rising Towers Royal Crest"
                className="kg-crest-img"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="kg-game-title">EMPIRE OF THE RISING TOWERS</h1>
              <p className="kg-game-subtitle">UNITE THE KINGDOM · BY NEPGAME</p>
            </div>
          </div>

          {/* Bottom Left Lore & Banners */}
          <div className="kg-art-footer">
            <p className="kg-art-quote">
              From the snow-crowned citadels of the Himalayas, forge alliances, rally khukuri legions, and claim The Congress.
            </p>
            <p className="kg-art-caption">
              Command Magar Infantry, Limbu Archers, and Thakuri Cavalry across a living 3D medieval realm.
            </p>
          </div>
        </section>

        {/* RIGHT SIDE: Dark Medieval Fantasy Authentication Panel */}
        <main className="kg-form-pane">
          <div className="kg-auth-card">
            {successHeadline ? (
              <div
                style={{
                  padding: '28px 10px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '15px',
                    overflow: 'hidden',
                    background: '#0a0e14',
                    boxShadow: '0 0 28px rgba(250, 204, 21, 0.35)',
                  }}
                >
                  <img
                    src={royalCrestImg}
                    alt="Royal Crest"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <h2 className="kg-card-title" style={{ fontSize: '21px' }}>
                  {successHeadline}
                </h2>
                <p className="kg-card-subtitle" style={{ margin: 0 }}>
                  Preparing your citadel and realm archives...
                </p>
                <span className="kg-spinner" style={{ width: '24px', height: '24px', color: '#facc15' }} />
              </div>
            ) : mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} noValidate>
                <h2 className="kg-card-title">WELCOME BACK, COMMANDER</h2>
                <p className="kg-card-subtitle">Your kingdom awaits your return.</p>

                {errorMessage && (
                  <div className="kg-alert kg-alert-error" role="alert">
                    {errorMessage}
                    {rateLimitSec > 0 ? ` (${rateLimitSec}s cooldown)` : ''}
                  </div>
                )}

                <div className="kg-field">
                  <label className="kg-label" htmlFor="login-email" style={{ marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    className="kg-input"
                    placeholder="commander@realm.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>

                <AccessiblePasswordField
                  id="login-password"
                  label="Password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  visible={showLoginPw}
                  onToggleVisible={() => setShowLoginPw((v) => !v)}
                  autoComplete="current-password"
                  placeholder="Enter your royal passphrase"
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '18px',
                    flexWrap: 'wrap',
                  }}
                >
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#facc15' }}
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    className="kg-link-btn"
                    onClick={() => {
                      setResetEmail(loginEmail);
                      switchMode('forgot');
                    }}
                  >
                    FORGOT PASSWORD?
                  </button>
                </div>

                <button
                  type="submit"
                  className="kg-btn kg-btn-gold"
                  disabled={loadingAction !== null || rateLimitSec > 0}
                >
                  {loadingAction === 'login' ? <span className="kg-spinner" /> : null}
                  <span>{loadingAction === 'login' ? 'ENTERING REALM...' : 'SIGN IN'}</span>
                </button>

                <div className="kg-divider">OR</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="kg-btn kg-btn-google"
                    disabled={loadingAction !== null}
                    onClick={handleGoogleAuth}
                  >
                    {loadingAction === 'google' ? <span className="kg-spinner" /> : <GoogleIcon />}
                    <span>
                      {loadingAction === 'google' ? 'CONNECTING GOOGLE...' : 'CONTINUE WITH GOOGLE'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="kg-btn kg-btn-dark"
                    disabled={loadingAction !== null}
                    onClick={() => switchMode('signup')}
                  >
                    CREATE NEW ACCOUNT
                  </button>
                </div>
              </form>
            ) : mode === 'signup' ? (
              <form onSubmit={handleSignupSubmit} noValidate>
                <h2 className="kg-card-title">FORGE YOUR DYNASTY</h2>
                <p className="kg-card-subtitle">
                  Claim your banner and unite the Himalayan towers.
                </p>

                {errorMessage && (
                  <div className="kg-alert kg-alert-error" role="alert">
                    {errorMessage}
                  </div>
                )}

                <div className="kg-field">
                  <div className="kg-label-row">
                    <label className="kg-label" htmlFor="signup-username">
                      Player Username
                    </label>
                    {usernameAvailability === 'checking' && (
                      <span style={{ fontSize: '11px', color: '#93c5fd' }}>Checking...</span>
                    )}
                    {usernameAvailability === 'available' && (
                      <span style={{ fontSize: '11px', color: '#34d399' }}>Available</span>
                    )}
                    {usernameAvailability === 'taken' && (
                      <span style={{ fontSize: '11px', color: '#f87171' }}>Already taken</span>
                    )}
                    {usernameAvailability === 'invalid' && (
                      <span style={{ fontSize: '11px', color: '#fbbf24' }}>
                        3–24 letters/numbers
                      </span>
                    )}
                  </div>
                  <input
                    id="signup-username"
                    type="text"
                    autoComplete="username"
                    className="kg-input"
                    placeholder="e.g. Gorkha_Commander"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    minLength={3}
                    maxLength={24}
                    required
                  />
                </div>

                <div className="kg-field">
                  <label className="kg-label" htmlFor="signup-email" style={{ marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    className="kg-input"
                    placeholder="commander@realm.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>

                <AccessiblePasswordField
                  id="signup-password"
                  label="Password"
                  value={signupPassword}
                  onChange={setSignupPassword}
                  visible={showSignupPw}
                  onToggleVisible={() => setShowSignupPw((v) => !v)}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  rightLabelAdornment={
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: pwStrength.valid ? '#34d399' : '#fbbf24',
                      }}
                    >
                      {signupPassword ? pwStrength.label : 'Min 8 chars, Aa + 0-9'}
                    </span>
                  }
                >
                  <div className="kg-strength-track">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className="kg-strength-seg"
                        style={{
                          background:
                            signupPassword.length === 0
                              ? undefined
                              : idx < pwStrength.score
                                ? pwStrength.score >= 3
                                  ? '#10b981'
                                  : pwStrength.score === 2
                                    ? '#f59e0b'
                                    : '#ef4444'
                                : undefined,
                        }}
                      />
                    ))}
                  </div>
                </AccessiblePasswordField>

                <AccessiblePasswordField
                  id="signup-confirm"
                  label="Confirm Password"
                  value={signupConfirmPw}
                  onChange={setSignupConfirmPw}
                  visible={showSignupConfirmPw}
                  onToggleVisible={() => setShowSignupConfirmPw((v) => !v)}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                />

                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '9px',
                      fontSize: '12.5px',
                      lineHeight: 1.45,
                      color: '#cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#facc15' }}
                    />
                    <span>
                      I accept the{' '}
                      <button
                        type="button"
                        className="kg-link-btn"
                        onClick={() => setLegalModal('terms')}
                      >
                        Terms and Conditions
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        className="kg-link-btn"
                        onClick={() => setLegalModal('privacy')}
                      >
                        Privacy Policy
                      </button>
                      . A verification email will be sent upon registration.
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="submit"
                    className="kg-btn kg-btn-gold"
                    disabled={loadingAction !== null || usernameAvailability === 'taken'}
                  >
                    {loadingAction === 'signup' ? <span className="kg-spinner" /> : null}
                    <span>
                      {loadingAction === 'signup' ? 'CREATING KINGDOM...' : 'CREATE KINGDOM ACCOUNT'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="kg-btn kg-btn-google"
                    disabled={loadingAction !== null}
                    onClick={handleGoogleAuth}
                  >
                    {loadingAction === 'google' ? <span className="kg-spinner" /> : <GoogleIcon />}
                    <span>SIGN UP WITH GOOGLE</span>
                  </button>

                  <button
                    type="button"
                    className="kg-btn kg-btn-dark"
                    disabled={loadingAction !== null}
                    onClick={() => switchMode('login')}
                  >
                    BACK TO LOGIN
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotSubmit} noValidate>
                <h2 className="kg-card-title">RECOVER ROYAL SEAL</h2>
                <p className="kg-card-subtitle">
                  Enter your registered email address to receive a password reset link.
                </p>

                {errorMessage && (
                  <div className="kg-alert kg-alert-error" role="alert">
                    {errorMessage}
                  </div>
                )}
                {resetSuccessMsg && (
                  <div className="kg-alert kg-alert-success" role="status">
                    {resetSuccessMsg}
                  </div>
                )}

                <div className="kg-field">
                  <label className="kg-label" htmlFor="reset-email" style={{ marginBottom: '6px' }}>
                    Registered Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    className="kg-input"
                    placeholder="commander@realm.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
                  <button
                    type="submit"
                    className="kg-btn kg-btn-gold"
                    disabled={loadingAction !== null || rateLimitSec > 0}
                  >
                    {loadingAction === 'reset' ? <span className="kg-spinner" /> : null}
                    <span>
                      {loadingAction === 'reset' ? 'DISPATCHING LINK...' : 'SEND PASSWORD RESET LINK'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="kg-btn kg-btn-dark"
                    disabled={loadingAction !== null}
                    onClick={() => switchMode('login')}
                  >
                    BACK TO LOGIN
                  </button>
                </div>
              </form>
            )}

            <div
              style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(148, 163, 184, 0.16)',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => setShowAndroidModal(true)}
                style={{
                  minHeight: '38px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  color: '#86efac',
                  font: "700 12px 'Barlow Condensed', sans-serif",
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                Download Empire-of-the-Rising-Towers.apk (Android)
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Terms & Privacy Modal */}
      {legalModal && (
        <div className="kg-modal-overlay" role="dialog" aria-modal="true" onClick={() => setLegalModal(null)}>
          <div className="kg-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="kg-card-title" style={{ fontSize: '18px' }}>
                {legalModal === 'terms' ? 'TERMS AND CONDITIONS' : 'PRIVACY POLICY'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {legalModal === 'terms' ? (
                <>
                  <p style={{ margin: 0 }}>
                    Welcome to <strong>Empire of the Rising Towers</strong>. By creating an account, you agree to maintain fair tactical play across alliances, shrines, and kingdom sieges.
                  </p>
                  <p style={{ margin: 0 }}>
                    Your Commander Username must remain respectful and unique. Automated exploits or unauthorized credential sharing are prohibited.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0 }}>
                    Your authentication credentials and email address are protected by Firebase Authentication and strict Firestore owner-only security rules.
                  </p>
                  <p style={{ margin: 0 }}>
                    Your email is never exposed in public kingdom directories. You may configure online visibility, friend requests, and kingdom statistic sharing at any time inside Privacy Settings.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              className="kg-btn kg-btn-gold"
              style={{ marginTop: '18px' }}
              onClick={() => setLegalModal(null)}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <AndroidApkModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        isAndroid={isAndroid}
        onInstallPWA={installPWA}
      />
    </div>
  );
};
