import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// اپ کاملاً استاتیک است: خروجی build فقط HTML/CSS/JS است و هیچ سروری لازم ندارد.
export default defineConfig({
  plugins: [react()],
  // مسیر نسبی تا خروجی روی هر ساب‌دامین/زیرپوشه‌ای (GitHub Pages و…) کار کند.
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
})
