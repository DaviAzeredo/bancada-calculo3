/// <reference types="vitest/config" />
import { type Plugin, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Mesma política da Bancada de Física: meta no build, porque o GitHub Pages não define
 * cabeçalhos. Nada aqui precisa de 'unsafe-eval': as fórmulas viram programas de
 * `math/lote.ts`, sem `new Function`.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self'",
  "media-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const politicaDeSeguranca = (): Plugin => ({
  name: 'politica-de-seguranca',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
  ],
})

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), politicaDeSeguranca()],
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three') || id.includes('node_modules/camera-controls')) return 'three'
          // zustand é usado pela interface e pela fiber: fica com o React, senão puxa o three
          if (/node_modules\/(react|scheduler|zustand|use-sync-external-store)/.test(id)) return 'react'
          if (id.includes('node_modules/katex')) return 'katex'
          if (id.includes('node_modules/mathlive')) return 'mathlive'
          return undefined
        },
      },
    },
  },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 30000 },
})
