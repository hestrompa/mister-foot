import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'

function versao() {
  let n = 0
  try { n = Number(execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) } catch { /* sem git */ }
  const hora = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })
  return `v${n} · ${hora}`
}

export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __VERSAO__: JSON.stringify(versao()) },
  test: { include: ['src/**/*.test.ts'] },
})
