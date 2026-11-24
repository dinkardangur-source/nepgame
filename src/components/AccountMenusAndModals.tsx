import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HERO_PORTRAIT_URLS, getHeroPortraitUrl } from '../game/HeroPortraits';
import { NEPALESE_HEROES } from '../game/NepaleseBalanceConfig';
import {
  evaluatePasswordStrength,
  isUsernameAvailable,
  normalizeUsernameSlug,
  validateUsernameInput,
} from '../services/playerAuthService';
import { AccessiblePasswordField } from './AccessiblePasswordField';

interface TopRightAccountMenuProps {
  compact?: boolean;
}

export const TopRightAccountMenu: React.FC<TopRightAccountMenuProps> = ({
  compact = false,
}) => {
  const {
    user,
    profile,
    openAccountModal,
    openSignOutConfirm,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const displayName = profile?.username || user.displayName || 'Commander';
  const avatarUrl = getHeroPortraitUrl(profile?.avatarId);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', zIndex: 90 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="kg-account-trigger"
        style={{
          minHeight: compact ? '30px' : '38px',
          padding: compact ? '2px 8px 2px 4px' : '4px 12px 4px 6px',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Commander Account Menu"
      >
        <img
          src={avatarUrl}
          alt={displayName}
          referrerPolicy="no-referrer"
          style={{
            width: compact ? '22px' : '28px',
            height: compact ? '22px' : '28px',
            borderRadius: '6px',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            border: '1px solid #facc15',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            maxWidth: compact ? '90px' : '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 700,
          }}
        >
          {displayName}
        </span>
        <span style={{ fontSize: '10px', color: '#facc15' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="kg-account-dropdown" role="menu" aria-label="Account Menu">
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
              marginBottom: '4px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fef08a' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              {profile?.kingdomName || 'Royal Bastion'} · Lv.{profile?.level || 1}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            className="kg-dropdown-item"
            onClick={() => {
              setOpen(false);
              openAccountModal('profile');
            }}
          >
            <span>👑</span>
            <span>My Profile</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="kg-dropdown-item"
            onClick={() => {
              setOpen(false);
              openAccountModal('settings');
            }}
          >
            <span>⚙️</span>
            <span>Account Settings</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="kg-dropdown-item"
            onClick={() => {
              setOpen(false);
              openAccountModal('password');
            }}
          >
            <span>🔑</span>
            <span>Change Password</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="kg-dropdown-item"
            onClick={() => {
              setOpen(false);
              openAccountModal('privacy');
            }}
          >
            <span>🛡️</span>
            <span>Privacy Settings</span>
          </button>

          <div
            style={{
              height: '1px',
              background: 'rgba(148, 163, 184, 0.16)',
              margin: '4px 6px',
            }}
          />

          <button
            type="button"
            role="menuitem"
            className="kg-dropdown-item kg-dropdown-item--danger"
            onClick={() => {
              setOpen(false);
              openSignOutConfirm();
            }}
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

function formatIsoDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AccountModalController: React.FC = () => {
  const {
    user,
    profile,
    privateAccount,
    activeAccountModal,
    closeAccountModal,
    signOutConfirmOpen,
    cancelSignOutConfirm,
    confirmSignOut,
    resendVerificationEmail,
    checkEmailVerified,
    updateAccountProfile,
    updatePrivacy,
    updateAccountPassword,
  } = useAuth();

  // Profile verification status feedback
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  // Account Settings state
  const [editUsername, setEditUsername] = useState('');
  const [editKingdomName, setEditKingdomName] = useState('');
  const [editAvatarId, setEditAvatarId] = useState('hero_bhimsen_thapa');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Change Password state
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmNewPw, setShowConfirmNewPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // Privacy Settings state
  const [allowFriends, setAllowFriends] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [privMsg, setPrivMsg] = useState<string | null>(null);
  const [privErr, setPrivErr] = useState<string | null>(null);
  const [privSaving, setPrivSaving] = useState(false);

  // Sign out loading state
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (activeAccountModal === 'settings' && profile) {
      setEditUsername(profile.username);
      setEditKingdomName(profile.kingdomName);
      setEditAvatarId(profile.avatarId || 'hero_bhimsen_thapa');
      setUsernameStatus('idle');
      setSettingsMsg(null);
      setSettingsErr(null);
    }
    if (activeAccountModal === 'password' || activeAccountModal === null) {
      setShowCurPw(false);
      setShowNewPw(false);
      setShowConfirmNewPw(false);
    }
    if (activeAccountModal === 'password') {
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg(null);
      setPwErr(null);
    }
    if (activeAccountModal === 'privacy' && privateAccount) {
      setAllowFriends(privateAccount.allowFriendRequests);
      setShowOnline(privateAccount.showOnlineStatus);
      setShowStats(privateAccount.showKingdomStats);
      setPrivMsg(null);
      setPrivErr(null);
    }
    if (activeAccountModal === 'profile') {
      setVerifyNotice(null);
      setVerifyError(null);
    }
  }, [activeAccountModal, profile, privateAccount]);

  // Debounced username uniqueness check in Account Settings
  useEffect(() => {
    if (activeAccountModal !== 'settings' || !profile) return;
    const slug = normalizeUsernameSlug(editUsername);
    if (!editUsername.trim() || slug === profile.usernameLower) {
      setUsernameStatus('idle');
      return;
    }
    const err = validateUsernameInput(editUsername);
    if (err) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const timer = window.setTimeout(async () => {
      try {
        const ok = await isUsernameAvailable(editUsername);
        setUsernameStatus(ok ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 380);
    return () => window.clearTimeout(timer);
  }, [activeAccountModal, editUsername, profile]);

  const hasPasswordProvider = Boolean(user?.providerData.some((p) => p.providerId === 'password'));
  const pwStrength = evaluatePasswordStrength(newPw);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsErr(null);
    setSettingsMsg(null);
    if (usernameStatus === 'taken') {
      setSettingsErr('That Commander Username is already claimed.');
      return;
    }
    setSettingsSaving(true);
    try {
      await updateAccountProfile({
        username: editUsername,
        kingdomName: editKingdomName,
        avatarId: editAvatarId,
      });
      setSettingsMsg('Royal Account Settings saved to Firebase.');
    } catch (err) {
      setSettingsErr(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwErr('New password and confirmation do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await updateAccountPassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg('Password updated successfully.');
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrivErr(null);
    setPrivMsg(null);
    setPrivSaving(true);
    try {
      await updatePrivacy({
        allowFriendRequests: allowFriends,
        showOnlineStatus: showOnline,
        showKingdomStats: showStats,
      });
      setPrivMsg('Privacy preferences saved.');
    } catch (err) {
      setPrivErr(err instanceof Error ? err.message : 'Unable to update privacy preferences.');
    } finally {
      setPrivSaving(false);
    }
  };

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      await confirmSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (!activeAccountModal && !signOutConfirmOpen) return null;

  return (
    <div
      className="kg-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (signOutConfirmOpen && !signingOut) cancelSignOutConfirm();
        else closeAccountModal();
      }}
    >
      <div className="kg-modal-card" onClick={(e) => e.stopPropagation()}>
        {signOutConfirmOpen ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(153, 27, 27, 0.38)',
                  border: '1px solid rgba(248, 113, 113, 0.5)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '22px',
                  flexShrink: 0,
                }}
              >
                🚪
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: "'Cinzel', serif",
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#fef08a',
                    letterSpacing: '0.04em',
                  }}
                >
                  ARE YOU SURE YOU WANT TO LEAVE YOUR KINGDOM?
                </h2>
              </div>
            </div>

            <p style={{ margin: '0 0 20px', fontSize: '13.5px', lineHeight: 1.55, color: '#cbd5e1' }}>
              Your empire progress, garrisoned armies, resources, and shrine conquests remain safely preserved in your account. You will be returned to the Royal Login screen.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="kg-btn kg-btn-dark"
                disabled={signingOut}
                onClick={cancelSignOutConfirm}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="kg-btn kg-btn-danger"
                disabled={signingOut}
                onClick={handleConfirmSignOut}
              >
                {signingOut ? <span className="kg-spinner" /> : null}
                <span>{signingOut ? 'SIGNING OUT...' : 'SIGN OUT'}</span>
              </button>
            </div>
          </div>
        ) : activeAccountModal === 'profile' && user ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="kg-card-title" style={{ fontSize: '19px' }}>MY PROFILE</h2>
              <button
                type="button"
                onClick={closeAccountModal}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px',
                background: 'rgba(9, 14, 26, 0.88)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '10px',
                marginBottom: '16px',
              }}
            >
              <img
                src={getHeroPortraitUrl(profile?.avatarId)}
                alt={profile?.username || 'Commander'}
                referrerPolicy="no-referrer"
                style={{
                  width: '66px',
                  height: '66px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  objectPosition: 'center 20%',
                  border: '2px solid #facc15',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: '18px', fontWeight: 800, color: '#fef08a' }}>
                  {profile?.username || user.displayName || 'Commander'}
                </div>
                <div style={{ fontSize: '13px', color: '#bae6fd', marginTop: '3px' }}>
                  {profile?.kingdomName || 'Royal Bastion'} · Level {profile?.level || 1}
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                  ID: {user.uid}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
                <span style={{ color: '#94a3b8' }}>Email Address</span>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{privateAccount?.email || user.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
                <span style={{ color: '#94a3b8' }}>Authentication Method</span>
                <span style={{ color: '#fde68a', fontWeight: 600 }}>
                  {profile?.provider === 'google.com' ? 'Google Sign-In' : 'Email & Password'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
                <span style={{ color: '#94a3b8' }}>Email Verification</span>
                <span style={{ color: user.emailVerified ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                  {user.emailVerified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
                <span style={{ color: '#94a3b8' }}>Account Created</span>
                <span style={{ color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>{formatIsoDate(profile?.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: '#94a3b8' }}>Last Login</span>
                <span style={{ color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>{formatIsoDate(profile?.lastLoginAt)}</span>
              </div>
            </div>

            {verifyNotice && <div className="kg-alert kg-alert-success" style={{ marginTop: '12px' }}>{verifyNotice}</div>}
            {verifyError && <div className="kg-alert kg-alert-error" style={{ marginTop: '12px' }}>{verifyError}</div>}

            {!user.emailVerified && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="kg-btn kg-btn-gold"
                  style={{ flex: 1 }}
                  disabled={verifyBusy}
                  onClick={async () => {
                    setVerifyBusy(true);
                    setVerifyNotice(null);
                    setVerifyError(null);
                    try {
                      await resendVerificationEmail();
                      setVerifyNotice('Verification email dispatched! Check your inbox.');
                    } catch (err) {
                      setVerifyError(err instanceof Error ? err.message : 'Unable to send email.');
                    } finally {
                      setVerifyBusy(false);
                    }
                  }}
                >
                  Resend Verification
                </button>
                <button
                  type="button"
                  className="kg-btn kg-btn-dark"
                  style={{ flex: 1 }}
                  disabled={verifyBusy}
                  onClick={async () => {
                    setVerifyBusy(true);
                    setVerifyNotice(null);
                    setVerifyError(null);
                    try {
                      const ok = await checkEmailVerified();
                      setVerifyNotice(ok ? 'Email verified successfully!' : 'Not verified yet. Open the link in your inbox first.');
                    } catch (err) {
                      setVerifyError(err instanceof Error ? err.message : 'Unable to refresh status.');
                    } finally {
                      setVerifyBusy(false);
                    }
                  }}
                >
                  Refresh Status
                </button>
              </div>
            )}
          </div>
        ) : activeAccountModal === 'settings' ? (
          <form onSubmit={handleSaveSettings}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 className="kg-card-title" style={{ fontSize: '19px' }}>ACCOUNT SETTINGS</h2>
              <button
                type="button"
                onClick={closeAccountModal}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {settingsMsg && <div className="kg-alert kg-alert-success">{settingsMsg}</div>}
            {settingsErr && <div className="kg-alert kg-alert-error">{settingsErr}</div>}

            <div className="kg-field">
              <div className="kg-label-row">
                <label className="kg-label" htmlFor="acct-username">Player Username</label>
                {usernameStatus === 'checking' && <span style={{ fontSize: '11px', color: '#93c5fd' }}>Checking...</span>}
                {usernameStatus === 'available' && <span style={{ fontSize: '11px', color: '#34d399' }}>Available</span>}
                {usernameStatus === 'taken' && <span style={{ fontSize: '11px', color: '#f87171' }}>Already taken</span>}
                {usernameStatus === 'invalid' && <span style={{ fontSize: '11px', color: '#fbbf24' }}>3–24 alphanumeric chars</span>}
              </div>
              <input
                id="acct-username"
                className="kg-input"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                required
                minLength={3}
                maxLength={24}
              />
            </div>

            <div className="kg-field">
              <label className="kg-label" htmlFor="acct-kingdom" style={{ marginBottom: '6px' }}>
                Kingdom Name
              </label>
              <input
                id="acct-kingdom"
                className="kg-input"
                value={editKingdomName}
                onChange={(e) => setEditKingdomName(e.target.value)}
                required
                minLength={2}
                maxLength={40}
              />
            </div>

            <div className="kg-field">
              <span className="kg-label" style={{ marginBottom: '8px' }}>Royal Commander Portrait</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {NEPALESE_HEROES.map((hero) => {
                  const active = editAvatarId === hero.id;
                  return (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => setEditAvatarId(hero.id)}
                      title={hero.name}
                      style={{
                        padding: '3px',
                        borderRadius: '8px',
                        background: active ? 'rgba(250, 204, 21, 0.25)' : 'rgba(15, 23, 42, 0.8)',
                        border: active ? '2px solid #facc15' : '1px solid rgba(148,163,184,0.28)',
                        cursor: 'pointer',
                      }}
                    >
                      <img
                        src={HERO_PORTRAIT_URLS[hero.id] || getHeroPortraitUrl(hero.id)}
                        alt={hero.name}
                        referrerPolicy="no-referrer"
                        style={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          objectFit: 'cover',
                          objectPosition: 'center 20%',
                          borderRadius: '6px',
                          display: 'block',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="kg-btn kg-btn-gold"
              disabled={settingsSaving || usernameStatus === 'taken' || usernameStatus === 'invalid'}
            >
              {settingsSaving ? <span className="kg-spinner" /> : null}
              <span>{settingsSaving ? 'SAVING...' : 'SAVE SETTINGS'}</span>
            </button>
          </form>
        ) : activeAccountModal === 'password' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 className="kg-card-title" style={{ fontSize: '19px' }}>CHANGE PASSWORD</h2>
              <button
                type="button"
                onClick={closeAccountModal}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {!hasPasswordProvider ? (
              <div className="kg-alert kg-alert-info">
                Your account signs in with Google Authentication. Password management is handled directly through your Google Account security settings.
              </div>
            ) : (
              <form onSubmit={handleSavePassword}>
                {pwMsg && <div className="kg-alert kg-alert-success">{pwMsg}</div>}
                {pwErr && <div className="kg-alert kg-alert-error">{pwErr}</div>}

                <AccessiblePasswordField
                  id="pw-cur"
                  label="Current Password"
                  value={curPw}
                  onChange={setCurPw}
                  visible={showCurPw}
                  onToggleVisible={() => setShowCurPw((v) => !v)}
                  autoComplete="current-password"
                />

                <AccessiblePasswordField
                  id="pw-new"
                  label="New Password"
                  value={newPw}
                  onChange={setNewPw}
                  visible={showNewPw}
                  onToggleVisible={() => setShowNewPw((v) => !v)}
                  autoComplete="new-password"
                  rightLabelAdornment={
                    <span style={{ fontSize: '11px', color: pwStrength.valid ? '#34d399' : '#fbbf24' }}>
                      {pwStrength.label}
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
                            newPw.length === 0
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
                  id="pw-conf"
                  label="Confirm New Password"
                  value={confirmPw}
                  onChange={setConfirmPw}
                  visible={showConfirmNewPw}
                  onToggleVisible={() => setShowConfirmNewPw((v) => !v)}
                  autoComplete="new-password"
                />

                <button type="submit" className="kg-btn kg-btn-gold" disabled={pwSaving}>
                  {pwSaving ? <span className="kg-spinner" /> : null}
                  <span>{pwSaving ? 'UPDATING...' : 'UPDATE PASSWORD'}</span>
                </button>
              </form>
            )}
          </div>
        ) : activeAccountModal === 'privacy' ? (
          <form onSubmit={handleSavePrivacy}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 className="kg-card-title" style={{ fontSize: '19px' }}>PRIVACY SETTINGS</h2>
              <button
                type="button"
                onClick={closeAccountModal}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {privMsg && <div className="kg-alert kg-alert-success">{privMsg}</div>}
            {privErr && <div className="kg-alert kg-alert-error">{privErr}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '9px',
                  background: 'rgba(9, 14, 26, 0.85)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                    Allow Friend Requests
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    Allow allied commanders to send comrade invitations.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowFriends}
                  onChange={(e) => setAllowFriends(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#facc15' }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '9px',
                  background: 'rgba(9, 14, 26, 0.85)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                    Show Online Status
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    Display your active realm presence to alliance members.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showOnline}
                  onChange={(e) => setShowOnline(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#facc15' }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '9px',
                  background: 'rgba(9, 14, 26, 0.85)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                    Show Kingdom Statistics
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    Let allies view your power, level, and shrine honors.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showStats}
                  onChange={(e) => setShowStats(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#facc15' }}
                />
              </label>
            </div>

            <button type="submit" className="kg-btn kg-btn-gold" disabled={privSaving}>
              {privSaving ? <span className="kg-spinner" /> : null}
              <span>{privSaving ? 'SAVING...' : 'SAVE PRIVACY'}</span>
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
};
