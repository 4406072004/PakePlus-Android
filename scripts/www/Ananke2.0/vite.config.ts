import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/Ananke/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['ananke-logo.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/Ananke/',
          name: 'Ananke - 字卡小手机',
          short_name: 'Ananke',
          description: '纯前端虚拟手机式字卡互动网页应用，支持自定义手机桌面、字卡库与模块化系统。',
          theme_color: '#171717',
          background_color: '#171717',
          display: 'standalone',
          start_url: '/Ananke/',
          scope: '/Ananke/',
          icons: [
            {
              src: '/Ananke/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/Ananke/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/Ananke/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});