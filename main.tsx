import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getFirebaseAuth } from './services/firebaseClient';

// Eagerly initialize Firebase Client & Auth if configuration exists
getFirebaseAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
