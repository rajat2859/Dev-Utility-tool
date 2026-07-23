import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully intercept and suppress benign HMR WebSocket/Vite connection errors
if (typeof window !== 'undefined') {
  const isBenignWSError = (err: any): boolean => {
    if (!err) return false;
    const str = String(err?.message || err?.reason || err);
    const targetStr = String(err?.target?.constructor?.name || '');
    return (
      str.includes('WebSocket') ||
      str.includes('websocket') ||
      str.includes('vite') ||
      str.includes('closed without opened') ||
      targetStr.includes('WebSocket')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isBenignWSError(event.reason) || isBenignWSError(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('error', (event) => {
    if (isBenignWSError(event.error) || isBenignWSError(event.message) || isBenignWSError(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

