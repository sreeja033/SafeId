import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global handler to suppress benign Vite HMR WebSocket closed rejections in preview iframes
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr =
    event.reason instanceof Error
      ? event.reason.message
      : String(event.reason || '');

  if (
    reasonStr.includes('WebSocket') ||
    reasonStr.includes('websocket')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const msg = String(event.message || '');
  if (msg.includes('WebSocket') || msg.includes('websocket')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
