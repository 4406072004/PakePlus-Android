import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 全局异常与未捕获 Promise Rejection 拦截保护，防止移动端 WebView 或 iframe 闪退白屏
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    // 捕获可能来自第三方音频、图片解码或存储超限的未捕获 Promise
    console.warn('[System Watchdog] Intercepted unhandled promise rejection:', event.reason);
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    // 拦截可能由不可控外部资源加载引发的全局报错
    console.warn('[System Watchdog] Intercepted runtime error:', event.error || event.message);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
