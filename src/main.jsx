import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { setLang, getLang } from './i18n/index.js';

// تطبيق اتجاه الصفحة واللغة المحفوظة قبل أول رسم
setLang(getLang());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
