// Point d'entrée du prototype : monte <App /> dans #root.
// Aucun routeur (la navigation est un état, comme dans frontend/src/App.tsx) et
// aucun service worker : c'est une démonstration autonome, sans backend.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
