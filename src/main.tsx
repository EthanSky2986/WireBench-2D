import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './theme/provider';
import './styles.css';
import './theme/tokens.css';
const VisualPreview = lazy(() => import('./preview/VisualPreview'));
const materialPreview = new URLSearchParams(window.location.search).get('preview') === 'materials';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <Suspense fallback={null}>{materialPreview ? <VisualPreview /> : <App />}</Suspense>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
