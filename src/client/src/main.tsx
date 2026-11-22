import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import ServerGate from './native/ServerGate';
import './styles/global.css';
import './styles/layout.css';
import './styles/mobile.css';

function Root(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const shell = Capacitor.isNativePlatform() || params.get('shell') === '1';
  return shell ? <ServerGate /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
