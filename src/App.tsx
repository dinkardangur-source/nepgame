import React, { Suspense, lazy } from 'react';
import { AuthErrorBoundary } from './components/AuthErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UpdatePromptBanner } from './components/UpdatePromptBanner';
import royalCrestImg from './assets/images/royal_crest_ui.webp';

const AuthGatewayScreen = lazy(() =>
  import('./components/AuthGatewayScreen').then((m) => ({ default: m.AuthGatewayScreen }))
);
const ProtectedGameShell = lazy(() =>
  import('./components/ProtectedGameShell').then((m) => ({ default: m.ProtectedGameShell }))
);
const AccountModalController = lazy(() =>
  import('./components/AccountMenusAndModals').then((m) => ({ default: m.AccountModalController }))
);

const CitadelLoadingScreen: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="kg-scroll-root"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      minHeight: '100dvh',
      background: 'radial-gradient(circle at 50% 35%, #172338 0%, #090d14 78%)',
    }}
  >
    <div className="kg-crest-frame">
      <img
        src={royalCrestImg}
        alt="Empire of the Rising Towers Crest"
        className="kg-crest-img"
        decoding="async"
      />
    </div>
    <span className="kg-spinner" style={{ width: '28px', height: '28px', color: '#facc15' }} />
    <div
      style={{
        fontFamily: "'Cinzel', serif",
        fontSize: '18px',
        color: '#fef08a',
        letterSpacing: '0.09em',
        textAlign: 'center',
        padding: '0 16px',
      }}
    >
      EMPIRE OF THE RISING TOWERS
    </div>
    <div style={{ fontSize: '12px', color: '#94a3b8', letterSpacing: '0.06em' }}>{label}</div>
  </div>
);

const AppGate: React.FC = () => {
  const { authStatus, user, profile } = useAuth();

  if (authStatus === 'loading') {
    return <CitadelLoadingScreen label="Verifying Royal Seal..." />;
  }

  if (authStatus === 'unauthenticated' || !user) {
    return (
      <Suspense fallback={<CitadelLoadingScreen label="Opening Royal Gate..." />}>
        <AuthGatewayScreen />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<CitadelLoadingScreen label="Entering Royal Citadel..." />}>
      <ProtectedGameShell
        key={user.uid}
        uid={user.uid}
        initialViewMode="kingdom"
        commanderUsername={profile?.username}
      />
      <AccountModalController />
    </Suspense>
  );
};

export const App: React.FC = () => {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <AppGate />
        <UpdatePromptBanner />
      </AuthProvider>
    </AuthErrorBoundary>
  );
};

export default App;
