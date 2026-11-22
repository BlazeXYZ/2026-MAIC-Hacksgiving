import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { hasPackagedApi } from './api/transport';
import { SurveyProvider } from './state/survey';
import ServerGate from './native/ServerGate';
import './styles/global.css';
import './styles/layout.css';
import './styles/mobile.css';
import './styles/phone.css';

function Root(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const shell = params.get('shell') === '1' || (Capacitor.isNativePlatform() && !hasPackagedApi);
  return shell ? <ServerGate /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SurveyProvider>
      <Root />
    </SurveyProvider>
  </React.StrictMode>
);
