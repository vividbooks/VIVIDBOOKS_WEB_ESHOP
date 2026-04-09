import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { installChunkLoadRecovery } from './utils/installChunkLoadRecovery';

installChunkLoadRecovery();

// Stará verze ukládala celý katalog do localStorage a vyčerpala kvótu — OAuth pak nemohl zapsat session.
if (typeof window !== 'undefined') {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith('vividbooks_')) window.localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
  