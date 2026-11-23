// Seleções: três paragens por época. Os melhores portugueses vão à Seleção Nacional; os melhores das outras
// nacionalidades às suas seleções. Ser chamado dá moral e valor, mas cansa e pode trazer uma lesão.
import { createRng } from './rng'
import { mistura } from './staff'
import { mudarMoralJogador, anotar } from './balneario'
import { definirFadiga, fadigaDe, sortearLesao } from './lesoes'
import { valorDe } from './mundo'
import type { Jogador, Jogo, Posicao } from './types'

/** Jornadas depois das quais há paragem para as seleções. */
export const PARAGENS = [8, 17, 26]

const VAGAS: Record<Posicao, number> = { GR: 3, DEF: 8, MED: 7, AV: 5 }

export const PAISES: Record<string, string> = { PT: 'Portugal', BR: 'Brasil', ES: 'Espanha', AO: 'Angola', CV: 'Cabo Verde', GW: 'Guiné-Bissau', MZ: 'Moçambique' }
const ADVERSARIOS = ['Islândia', 'Escócia', 'Croácia', 'Polónia', 'Grécia', 'Sérvia', 'Noruega', 'Áustria', 'Hungria', 'Suécia', 'Turquia', 'Dinamarca', 'Bélgica', 'Itália', 'França', 'Alemanha']

export interface Convocatoria {
  ano: number
  jornada: number
  /** Convocados da Seleção Nacional. */
  ids: number[]
  /** Convocados por outras seleções (só os do meu clube interessam ao ecrã, mas guardam-se todos os poucos). */
  outros: number[]
  adversario: string
  golos: [number, number]
  /** Jogadores lesionados ao serviço da seleção. */
  lesionados: number[]
}

export interface EstadoSelecao {
  convocatorias: Convocatoria[]
  /** Internacionalizações por jogador (só Seleção Nacional). */
  internacional: Record<number, number>
}

export type JogoComSelecao = Jogo & { selecao?: EstadoSelecao }

export function estadoSelecao(jogo: JogoComSelecao): EstadoSelecao {
  if (!jogo.selecao) jogo.selecao = { convocatorias: [], internacional: {} }
  return jogo.selecao
}

/** Os melhores jogadores de uma nacionalidade por posição (com clube). */
export function escolherConvocados(jogo: Jogo, pais: string, vagas: Record<Posicao, number>): number[] {
  const porPos: Record<Posicao, Jogador[]> = { GR: [], DEF: [], MED: [], AV: [] }
  for (const j of Object.values(jogo.mundo.jogadores)) {
    if (j.nacionalidade !== pais || !j.clubeId || !jogo.mundo.clubes[j.clubeId]) continue
    if (jogo.epoca.indisponiveis[j.id]?.motivo === 'lesao') continue
    porPos[j.posicao].push(j)
  }
  const out: number[] = []
  for (const pos of Object.keys(vagas) as Posicao[]) {
    porPos[pos].sort((a, b) => b.forca - a.forca || a.idade - b.idade || a.id - b.id)
    out.push(...porPos[pos].slice(0, vagas[pos]).map((j) => j.id))
  }
  return out
}

/** Chamar depois de cada jornada: faz a paragem se a jornada acabada for uma das PARAGENS (idempotente). */
export function avancarSelecao(jogo: JogoComSelecao): Convocatoria | null {
  const st = estadoSelecao(jogo)
  const acabada = jogo.epoca.jornada - 1
  if (!PARAGENS.includes(acabada)) return null
  if (st.convocatorias.some((c) => c.ano === jogo.epoca.ano && c.jornada === acabada)) return null
  const { mundo } = jogo
  const rng = createRng(mistura(mundo.semente, jogo.epoca.ano, acabada, 0x5e1))
  const ids = escolherConvocados(jogo, 'PT', VAGAS)
  const outros: number[] = []
  for (const pais of Object.keys(PAISES)) {
    if (pais === 'PT') continue
    outros.push(...escolherConvocados(jogo, pais, { GR: 1, DEF: 1, MED: 1, AV: 1 }))
  }
  // Jogo da seleção: força média dos 11 melhores contra um adversário sorteado.
  const onze = ids.map((id) => mundo.jogadores[id]).sort((a, b) => b.forca - a.forca).slice(0, 11)
  const nossa = onze.reduce((s, j) => s + j.forca, 0) / Math.max(1, onze.length)
  const adv = rng.pick(ADVERSARIOS)
  const forcaAdv = nossa + rng.normal(0, 6)
  const golo = (a: number, b: number) => { let g = 0; for (let k = 0; k < 6; k++) if (rng.chance(0.22 * Math.pow((a + 1) / (b + 1), 2))) g++; return g }
  const golos: [number, number] = [golo(nossa, forcaAdv), golo(forcaAdv, nossa)]

  const lesionados: number[] = []
  for (const id of [...ids, ...outros]) {
    const j = mundo.jogadores[id]
    if (!j) continue
    const nacional = ids.includes(id)
    const estreia = nacional && !st.internacional[id]
    if (nacional) st.internacional[id] = (st.internacional[id] ?? 0) + 1
    // Viagens e dois jogos: cansa, sobretudo quem já vinha cansado.
    definirFadiga(j, fadigaDe(j) + 12)
    if (estreia) j.valor = Math.round(valorDe(j.forca, j.idade) * 1.05)
    const motivo = j.clubeId === jogo.clubeId
      ? estreia ? `${j.curto} estreia-se na Seleção Nacional!` : nacional ? `${j.curto} foi chamado à Seleção Nacional.` : `${j.curto} foi chamado à seleção de ${PAISES[j.nacionalidade] ?? j.nacionalidade}.`
      : ''
    mudarMoralJogador(jogo, id, estreia ? 10 : 5, motivo)
    if (rng.chance(0.03)) {
      const les = sortearLesao(rng, j)
      const atual = jogo.epoca.indisponiveis[id]
      if (!atual || atual.jogos < les.jogos) jogo.epoca.indisponiveis[id] = { jogos: les.jogos, motivo: 'lesao', tipo: les.tipo.id, total: les.jogos }
      lesionados.push(id)
      if (j.clubeId === jogo.clubeId) anotar(jogo, `${j.curto} lesionou-se ao serviço da seleção: ${les.tipo.nome.toLowerCase()} (${les.jogos} ${les.jogos === 1 ? 'jogo' : 'jogos'}).`, 'mau', id)
    }
  }
  const conv: Convocatoria = { ano: jogo.epoca.ano, jornada: acabada, ids, outros, adversario: adv, golos, lesionados }
  st.convocatorias.push(conv)
  if (st.convocatorias.length > 6) st.convocatorias.splice(0, st.convocatorias.length - 6)
  return conv
}

export function textoJogoSelecao(c: Convocatoria): string {
  const [a, b] = c.golos
  const r = a > b ? 'venceu' : a < b ? 'perdeu com' : 'empatou com'
  return `Portugal ${r} a ${c.adversario} por ${a}-${b}.`
}
