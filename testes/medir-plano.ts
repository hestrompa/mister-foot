// Mede o efeito do plano de jogo: npx tsx testes/medir-plano.ts [jogos por par]
// Cada variante joga com o clube A contra o B (que usa o plano da IA), metade em casa, em vários pares da 1.ª divisão.
import { gerarMundo } from '../src/core/mundo'
import { simularJogo } from '../src/core/motor'
import { escalarIA } from '../src/core/tatica'
import { comInstrucao, melhores, porPosicao, type PlanoJogo } from '../src/core/plano'
import { relatorioAdversario } from '../src/core/relatorio'
import type { Escalacao, Partida } from '../src/core/partida'
import type { Mundo } from '../src/core/types'

const N = Number(process.argv[2] ?? 300)
function partidaNova(casaId: number, foraId: number): Partida {
  return { id: `t-${casaId}-${foraId}`, competicao: 'liga', divisao: 1, jornada: 1, casaId, foraId, golos: [0, 0], eventos: [], jogada: false,
    estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] } }
}
type Var = (m: Mundo, e: Escalacao, adv: Escalacao) => PlanoJogo | undefined
const VARS: Record<string, Var> = {
  'sem plano': () => undefined,
  'IA': (_m, e) => e.plano,
  'zona': (_m, e) => ({ ...e.plano, marcacao: 'zona' }),
  'homem': (_m, e) => ({ ...e.plano, marcacao: 'homem' }),
  'pressao': (_m, e) => ({ ...e.plano, marcacao: 'pressao' }),
  'canto area': (_m, e) => ({ ...e.plano, canto: 'area' }),
  'canto curto': (_m, e) => ({ ...e.plano, canto: 'curto' }),
  'canto entrada': (_m, e) => ({ ...e.plano, canto: 'entrada' }),
  'livre cruzar': (_m, e) => ({ ...e.plano, livre: 'cruzar' }),
  'livre direto': (_m, e) => ({ ...e.plano, livre: 'direto' }),
  'subir 2 AV': (m, e) => { let p = e.plano; for (const j of porPosicao(m, e.titulares, 'AV').slice(0, 2)) p = comInstrucao(p, j.id, 'subir'); return p },
  'subir 2 DEF': (m, e) => { let p = e.plano; for (const j of porPosicao(m, e.titulares, 'DEF').slice(0, 2)) p = comInstrucao(p, j.id, 'subir'); return p },
  'subir melhor MED rem': (m, e) => { const j = melhores(porPosicao(m, e.titulares, 'MED'), 'rem', 1)[0]; return j ? comInstrucao(e.plano, j.id, 'subir') : e.plano },
  'segurar 2 MED': (m, e) => { let p = e.plano; for (const j of melhores(porPosicao(m, e.titulares, 'MED'), 'def', 2)) p = comInstrucao(p, j.id, 'segurar'); return p },
  'segurar DEF': (m, e) => { let p = e.plano; for (const j of porPosicao(m, e.titulares, 'DEF')) p = comInstrucao(p, j.id, 'segurar'); return p },
  'rematar melhor MED': (m, e) => { const j = melhores(porPosicao(m, e.titulares, 'MED'), 'rem', 1)[0]; return j ? comInstrucao(e.plano, j.id, 'rematar') : e.plano },
  'rematar pior MED': (m, e) => { const js = melhores(porPosicao(m, e.titulares, 'MED'), 'rem', 9); const j = js[js.length - 1]; return j ? comInstrucao(e.plano, j.id, 'rematar') : e.plano },
  'segue relatorio 5': (m, e, adv) => relatorioAdversario(m, e, adv, 5).sugestoes.reduce((p, s) => (s.aplicar ? s.aplicar(p) : p), e.plano),
  'segue relatorio 0': (m, e, adv) => relatorioAdversario(m, e, adv, 0).sugestoes.reduce((p, s) => (s.aplicar ? s.aplicar(p) : p), e.plano),
  'marcar c/ pior MED': (m, e, adv) => {
    const alvo = adv.titulares.map((id) => m.jogadores[id]).filter((j) => j.posicao !== 'GR' && j.posicao !== 'DEF').sort((a, b) => b.forca - a.forca)[0]
    const ms = melhores(porPosicao(m, e.titulares, 'MED'), 'def', 9); const mar = ms[ms.length - 1]
    return alvo && mar ? { ...comInstrucao(e.plano, mar.id, 'marcar'), alvo: alvo.id } : e.plano
  },
  'marcar melhor deles': (m, e, adv) => {
    const alvo = adv.titulares.map((id) => m.jogadores[id]).filter((j) => j.posicao !== 'GR' && j.posicao !== 'DEF').sort((a, b) => b.forca - a.forca)[0]
    const mar = melhores(porPosicao(m, e.titulares, 'MED'), 'def', 1)[0]
    return alvo && mar ? { ...comInstrucao(e.plano, mar.id, 'marcar'), alvo: alvo.id } : e.plano
  },
}
const m = gerarMundo(11)
const d1 = m.divisoes[0].clubes
const pares: [number, number][] = []
for (let i = 0; i + 1 < d1.length; i += 2) pares.push([d1[i], d1[i + 1]])
for (const [nome, v] of Object.entries(VARS)) {
  let pts = 0, gm = 0, gs = 0, bp = 0, jogos = 0
  for (const [a, b] of pares) {
    for (let s = 0; s < N; s++) {
      const casa = s % 2 === 0
      const ea = escalarIA(m, a, b, casa, new Set()), eb = escalarIA(m, b, a, !casa, new Set())
      const pl = v(m, ea, eb)
      const eA: Escalacao = { ...ea, postura: 'equilibrada' }
      if (pl) eA.plano = pl; else delete eA.plano
      const p = casa ? simularJogo(m, partidaNova(a, b), eA, eb, s * 7 + a) : simularJogo(m, partidaNova(b, a), eb, eA, s * 7 + a)
      const i = casa ? 0 : 1
      pts += p.golos[i] > p.golos[1 - i] ? 3 : p.golos[i] === p.golos[1 - i] ? 1 : 0
      gm += p.golos[i]; gs += p.golos[1 - i]; jogos++
      bp += p.eventos.filter((e) => e.tipo === 'golo' && e.lado === (casa ? 'casa' : 'fora') && (e.lance?.origem === 'canto' || e.lance?.origem === 'livre')).length
    }
  }
  console.log(`${nome.padEnd(20)} pts ${(pts / jogos).toFixed(3)}  golos ${(gm / jogos).toFixed(2)}-${(gs / jogos).toFixed(2)}  bolas paradas ${(bp / jogos).toFixed(3)}`)
}
