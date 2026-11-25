import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

// Register service worker after first paint/load so precaching never competes with initial boot
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => {
      const emitSwStatus = (ready: boolean) => {
        window.__EROT_SW_OFFLINE_READY__ = ready;
        window.dispatchEvent(new CustomEvent('erot-sw-status', { detail: { offlineReady: ready } }));
      };

      if (navigator.serviceWorker.controller) {
        emitSwStatus(true);
      }

      const triggerSw = () => {
        void import('virtual:pwa-register').then(({ registerSW }) => {
          registerSW({
            immediate: true,
            onOfflineReady() {
              emitSwStatus(true);
            },
            onRegisteredSW(_swUrl, registration) {
              if (registration?.active) {
                emitSwStatus(true);
              }
            },
          });
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
