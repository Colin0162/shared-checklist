import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // 새 배포가 있으면 자동으로 최신화
      manifest: {
        name: '청년회 체크리스트',
        short_name: '체크리스트',
        description: '여러 명이 함께 쓰는 공유 체크리스트 (폴더·실시간 체크·채팅)',
        lang: 'ko',
        theme_color: '#6366f1',
        background_color: '#f5f3ee',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // 앱 화면(셸)을 미리 캐시 → 네트워크가 끊겨도 앱은 열림.
        // Supabase(데이터/실시간)는 다른 도메인이고 캐시하지 않음 → 끊기면 데이터만 '연결 중'.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html', // 딥링크(/board/:id 등) 오프라인 진입 시 셸로
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
})
