import * as Sentry from "@sentry/react";
import { installDocumentDownloads } from './utils/documentUrl';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App.jsx';
import { sentryOptions } from './monitoring';
import './index.css';

// Error reporting remains enabled. Performance integrations are deliberately
// excluded in monitoring.js because IKRAM does not collect tracing/Web Vitals.
Sentry.init(sentryOptions);

installDocumentDownloads();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
