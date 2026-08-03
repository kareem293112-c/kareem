import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safeguard window.alert globally inside cross-origin iframe sandboxes
try {
  const originalAlert = window.alert;
  Object.defineProperty(window, 'alert', {
    value: (message?: any) => {
      try {
        if (originalAlert) {
          originalAlert(message);
        } else {
          console.warn("Blocked alert() call inside sandbox iframe:", message);
        }
      } catch (e) {
        console.warn("Blocked alert() call inside sandbox iframe:", message);
      }
    },
    writable: true,
    configurable: true
  });
} catch (e) {
  console.warn("Could not override window.alert inside iframe:", e);
}

// Intercept and suppress Firebase Quota errors to prevent them from crashing the AI Studio preview

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  try {
    const hasQuotaError = args.some(arg => {
      if (typeof arg === 'string') {
        return arg.includes('resource-exhausted') || arg.includes('Quota limit exceeded') || arg.includes('Quota') || arg.includes('maximum backoff delay') || arg.includes('maximum backoff delay');
      }
      if (arg instanceof Error) {
        return arg.message.includes('resource-exhausted') || arg.message.includes('Quota limit exceeded') || arg.message.includes('Quota') || arg.message.includes('maximum backoff delay');
      }
      if (arg && typeof arg === 'object' && (arg as any).code === 'resource-exhausted') {
        return true;
      }
      return false;
    });

    if (hasQuotaError) {
      return;
    }
  } catch (e) {}
  originalConsoleWarn(...args);
};

const originalConsoleError = console.error;
console.error = (...args) => {
  try {
    const hasQuotaError = args.some(arg => {
      if (typeof arg === 'string') {
        return arg.includes('resource-exhausted') || arg.includes('Quota limit exceeded') || arg.includes('Quota') || arg.includes('maximum backoff delay');
      }
      if (arg instanceof Error) {
        return arg.message.includes('resource-exhausted') || arg.message.includes('Quota limit exceeded') || arg.message.includes('Quota');
      }
      if (arg && typeof arg === 'object' && (arg as any).code === 'resource-exhausted') {
        return true;
      }
      return false;
    });

    if (hasQuotaError) {
      if (!(window as any).__quotaAlertShown) {
        try {
          alert("عذراً، تم الوصول إلى الحد الأقصى المجاني لقاعدة البيانات (Quota Exceeded). بعض الميزات قد لا تعمل حالياً حتى يتم تجديد الباقة غداً.");
        } catch (err) {}
        (window as any).__quotaAlertShown = true;
      }
      return;
    }
  } catch (e) {}
  originalConsoleError(...args);
};




createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

