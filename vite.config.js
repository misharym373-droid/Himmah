import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' يجعل الموقع يعمل على GitHub Pages وعلى أي دومين خاص بدون تعديل
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
});
