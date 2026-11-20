import type { Jogo } from '../core/types'

const CHAVE = 'mister-foot:jogo'

export function gravar(jogo: Jogo): boolean {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(jogo))
    return true
  } catch {
    return false
  }
}

export function carregar(): Jogo | null {
  try {
    const s = localStorage.getItem(CHAVE)
    if (!s) return null
    const j = JSON.parse(s) as Jogo
    return j?.mundo?.versao === 1 ? j : null
  } catch {
    return null
  }
}

export function apagar(): void {
  try { localStorage.removeItem(CHAVE) } catch { /* ignora */ }
}
