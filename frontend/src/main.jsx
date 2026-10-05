import * as Sentry from "@sentry/react";
import { installDocumentDownloads } from './utils/documentUrl';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import App from './App.jsx';
import DriverAccessPage from './pages/driver/DriverAccessPage';
import { sentryOptions } from './monitoring';
import './index.css';

// Error reporting remains enabled. Performance integrations are deliberately
// excluded in monitoring.js because IKRAM does not collect tracing/Web Vitals.
if (import.meta.env.VITE_SENTRY_ENABLED !== 'false' && !/^\/(driver-access)/.test(window.location.pathname)) Sentry.init(sentryOptions);

installDocumentDownloads();

ReactDOM.createRoot(document.getElementById('root')).render(
  window.location.pathname === '/driver-access' ? <DriverAccessPage /> : <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
