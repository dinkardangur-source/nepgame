import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

// Register service worker after first paint/load so precaching never competes with initial boot
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => {
      const triggerSw = () => {
        void import('virtual:pwa-register').then(({ registerSW }) => {
          registerSW({ immediate: true });
        });
      };
      const ric = (
        window as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
        }
      ).requestIdleCallback;
      if (typeof ric === 'function') {
        ric(triggerSw, { timeout: 2500 });
      } else {
        globalThis.setTimeout(triggerSw, 1200);
      }
    },
    { once: true }
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
