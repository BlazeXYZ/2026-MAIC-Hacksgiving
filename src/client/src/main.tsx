import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SurveyProvider } from './state/survey';
import './styles/global.css';
import './styles/layout.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SurveyProvider>
      <App />
    </SurveyProvider>
  </React.StrictMode>
);
