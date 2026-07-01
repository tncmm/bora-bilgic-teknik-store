import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@bora/ui/src/styles.css';
import './shared/styles/app.css';
import './index.css';
import App from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
