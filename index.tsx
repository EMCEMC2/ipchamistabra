import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logCredentialStatus, validateCredentials } from './services/auth';
import './index.css';

// Security: Validate credentials on startup
logCredentialStatus();

// Security: Check for critical issues
const credStatus = validateCredentials();
if (credStatus.errors.length > 0) {
  console.error('[Security] Critical security issues detected:', credStatus.errors);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);