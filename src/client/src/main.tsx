import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import ServerGate from './native/ServerGate';
import { isPackagedShell } from './native/serverEndpoint';
import './styles/global.css';
import './styles/layout.css';
import './styles/mobile.css';
import './styles/phone.css';

function Root(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const preview = params.get('shell') === '1';
  // The native bridge is injected into every page, including the Tailscale
  // dashboard. Only the packaged shell should show the connect screen.
  const shell = preview || (Capacitor.isNativePlatform() && isPackagedShell());
  return shell ? <ServerGate /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
