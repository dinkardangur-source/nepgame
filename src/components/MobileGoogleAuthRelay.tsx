import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import royalCrestImg from '../assets/images/royal_crest_ui.webp';
import { auth, googleProvider } from '../firebase';
import { dismissBootSplashOverlay } from '../context/AuthContext';
import { mapAuthErrorMessage } from '../services/playerAuthService';

const NATIVE_CALLBACK_BASE = 'com.himalayanrealms.strategy://auth';

export const MobileGoogleAuthRelay: React.FC = () => {
  const [status, setStatus] = useState<'ready' | 'authenticating' | 'returning' | 'error'>('ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const nonce = params.get('nonce') || '';

  useEffect(() => {
    dismissBootSplashOverlay();
  }, []);

  const handleContinue = async () => {
    setErrorMsg(null);
    setStatus('authenticating');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const oauthCred = GoogleAuthProvider.credentialFromResult(result);
      const idToken = oauthCred?.idToken || '';
      const accessToken = oauthCred?.accessToken || '';

      if (!idToken && !accessToken) {
        throw new Error('Google did not return a sign-in token. Please try again.');
      }

      const hash = new URLSearchParams();
      if (idToken) hash.set('idToken', idToken);
      if (accessToken) hash.set('accessToken', accessToken);
      if (nonce) hash.set('nonce', nonce);

      const deepLink = `${NATIVE_CALLBACK_BASE}#${hash.toString()}`;
      setReturnUrl(deepLink);
      setStatus('returning');
      window.location.href = deepLink;
    } catch (err) {
      setStatus('error');
      setErrorMsg(mapAuthErrorMessage(err));
    }
  };

  return (
    <div
      className="kg-scroll-root"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'radial-gradient(circle at 50% 35%, #172338 0%, #090d14 78%)',
        color: '#f8fafc',
      }}
    >
      <div className="kg-auth-card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <img
            src={royalCrestImg}
            alt="Empire of the Rising Towers Crest"
            style={{ width: '68px', height: '68px', borderRadius: '15px', objectFit: 'cover' }}
          />
        </div>
        <h1 className="kg-card-title" style={{ fontSize: '20px', marginBottom: '6px' }}>
          EMPIRE OF THE RISING TOWERS
        </h1>
        <p className="kg-card-subtitle" style={{ marginBottom: '16px' }}>
          {status === 'returning'
            ? 'Google Seal verified! Returning you to the Android app...'
            : 'Complete your Google Sign-In in Chrome, then return straight to the game.'}
        </p>

        {errorMsg && (
          <div className="kg-alert kg-alert-error" role="alert" style={{ marginBottom: '14px', textAlign: 'left' }}>
            {errorMsg}
          </div>
        )}

        {status === 'returning' && returnUrl ? (
          <a
            href={returnUrl}
            className="kg-btn kg-btn-gold"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: '100%' }}
          >
            RETURN TO EMPIRE OF THE RISING TOWERS
          </a>
        ) : (
          <button
            type="button"
            className="kg-btn kg-btn-google"
            disabled={status === 'authenticating'}
            onClick={handleContinue}
          >
            {status === 'authenticating' ? <span className="kg-spinner" /> : null}
            <span>{status === 'authenticating' ? 'SIGNING IN...' : 'CONTINUE WITH GOOGLE'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
