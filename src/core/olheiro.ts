// Olheiro em missão: o utilizador escolhe uma região e uma posição, e o olheiro vai encontrando
// talentos jovens (16 a 20 anos) que não estão em nenhum clube do jogo. Cada um fica disponível
// algumas jornadas; depois outro clube leva-o. Quanto melhor o olheiro, mais vezes encontra e
// mais alto é o teto de quem encontra. Determinístico: sementes derivadas do mundo e da jornada.
import { createRng, type Rng } from './rng'
import { forcaClube, salarioDe, valorDe } from './mundo'
import { mexerPerfil } from './atributos'
import { proximoIdJogador } from './juniores'
import { PLANTEL_MAX } from './mercado'
import { nivelDe as nivelLiga } from './ligas'
import { definirPersonalidade } from './personalidade'
import { APELIDOS_AF, APELIDOS_BR, APELIDOS_PT, NOMES_AF, NOMES_BR, NOMES_PT } from './nomes'
import { PAISES_EUROPA } from './nomes-europa'
import { mistura, nivelDe, staffDe, type ClubeComStaff, type Descoberta, type Regiao, type Resultado } from './staff'
import type { Jogador, Mundo, Posicao } from './types'

export const REGIOES: readonly Regiao[] = ['PT', 'BR', 'AF', 'EU']
export const NOME_REGIAO: Record<Regiao, string> = {
  PT: 'Portugal (distritais e escolas)',
  BR: 'Brasil',
  AF: 'África lusófona',
  EU: 'Resto da Europa',
}
export const DICA_REGIAO: Record<Regiao, string> = {
  PT: 'Mais barato e adapta-se logo; o teto é mais modesto.',
  BR: 'Técnica: mais remate e passe, e mais pérolas. Compensação mais cara.',
  AF: 'Velocidade e físico. Compensação acessível.',
  EU: 'Jogadores mais feitos (força mais alta), mas a compensação é a mais cara.',
}

interface DadosRegiao {
  preco: number
  potencial: number
  forca: number
  perola: number
  perfil: Partial<Record<'vel' | 'rem' | 'pas' | 'def' | 'fis', number>>
}
const REG: Record<Regiao, DadosRegiao> = {
  PT: { preco: 0.7, potencial: 0, forca: 0, perola: 0, perfil: {} },
  BR: { preco: 1.3, potencial: 2, forca: 0, perola: 0.03, perfil: { rem: 4, pas: 3, def: -3 } },
  AF: { preco: 0.9, potencial: 1, forca: 0, perola: 0.01, perfil: { vel: 5, fis: 4, pas: -3 } },
  EU: { preco: 1.6, potencial: 0, forca: 4, perola: 0, perfil: { pas: 2, def: 2 } },
}

/** Jornadas em que um talento descoberto fica à espera. */
export const ESPERA = 6
/** Talentos à espera ao mesmo tempo, no máximo. */
export const DESCOBERTAS_MAX = 6

/** Probabilidade de encontrar alguém numa jornada, conforme o nível do olheiro (0 = sem olheiro). */
export function chanceDescoberta(nivel: number): number {
  return nivel > 0 ? 0.05 + 0.035 * nivel : 0
}

export function missaoDe(mundo: Mundo, clubeId: number) {
  return staffDe(mundo.clubes[clubeId])?.missao
}

/** Muda (ou cancela, com `null`) a missão do olheiro. */
export function definirMissao(mundo: Mundo, clubeId: number, regiao: Regiao | null, posicao: Posicao | 'qualquer' = 'qualquer'): void {
  const c = mundo.clubes[clubeId] as ClubeComStaff
  c.staff ??= { membros: [], foco: 'equilibrado' }
  if (regiao) c.staff.missao = { regiao, posicao }
  else delete c.staff.missao
}

export function descobertas(mundo: Mundo, clubeId: number): Descoberta[] {
  return staffDe(mundo.clubes[clubeId])?.descobertas ?? []
}

/** Quantos talentos novos ainda não foram vistos (para o separador). */
export function descobertasNovas(mundo: Mundo, clubeId: number): number {
  return descobertas(mundo, clubeId).filter((d) => d.nova).length
}

export function marcarVistas(mundo: Mundo, clubeId: number): boolean {
  let mudou = false
  for (const d of descobertas(mundo, clubeId)) if (d.nova) { delete d.nova; mudou = true }
  return mudou
}

function nomeDe(rng: Rng, r: Regiao): { nome: string; curto: string; nacionalidade: string } {
  let nomes: readonly string[] = NOMES_PT, apelidos: readonly string[] = APELIDOS_PT, nac = 'PT'
  if (r === 'BR') { nomes = NOMES_BR; apelidos = APELIDOS_BR; nac = 'BR' }
  else if (r === 'AF') { nomes = NOMES_AF; apelidos = APELIDOS_AF; nac = rng.pick(['AO', 'CV', 'GW', 'MZ', 'ST']) }
  else if (r === 'EU') {
    const p = PAISES_EUROPA[rng.pick(Object.keys(PAISES_EUROPA).sort())]
    nomes = p.nomes; apelidos = p.apelidos; nac = p.codigo
  }
  const primeiro = rng.pick(nomes)
  const ultimo = rng.pick(apelidos)
  return { nome: `${primeiro} ${ultimo}`, curto: `${primeiro[0]}. ${ultimo}`, nacionalidade: nac }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

const POS_PESO: [Posicao, number][] = [['GR', 0.1], ['DEF', 0.32], ['MED', 0.33], ['AV', 0.25]]

/** Gera o talento encontrado (fora do mundo; id negativo até assinar). */
export function gerarTalento(mundo: Mundo, clubeId: number, regiao: Regiao, pos: Posicao | 'qualquer', nivel: number, rng: Rng, id: number): Jogador {
  const c = mundo.clubes[clubeId]
  const R = REG[regiao]
  let posicao: Posicao = 'MED'
  if (pos !== 'qualquer') posicao = pos
  else {
    let r = rng.next()
    for (const [p, w] of POS_PESO) if ((r -= w) < 0) { posicao = p; break }
  }
  const idade = rng.int(16, 20)
  const ref = forcaClube(mundo, clubeId)
  // Força de quem ainda não chegou lá: abaixo do onze, mais perto dele com a idade.
  const forca = clamp(Math.round(ref * 0.62 + (idade - 16) * 2.5 + R.forca + rng.normal(0, 4)), 8, 75)
  const perola = rng.chance(0.03 + 0.02 * nivel + R.perola)
  // O teto é medido pelo meu clube: um bom olheiro só traz quem pode chegar ao onze (ou passar dele).
  const potencial = clamp(Math.round(ref - 4 + nivel * 2 + R.potencial + rng.normal(0, 5) + (perola ? rng.int(8, 18) : 0)), forca + 4, 99)
  const j: Jogador = {
    id,
    ...nomeDe(rng, regiao),
    posicao,
    idade,
    forca,
    potencial,
    salario: salarioDe(forca, nivelLiga(c)),
    valor: valorDe(forca, idade),
    craque: false,
    contrato: 0,
    clubeId: 0,
  }
  const perfil: Record<string, number> = {}
  for (const [a, d] of Object.entries(R.perfil)) perfil[a] = d + rng.normal(0, 1.5)
  if (Object.keys(perfil).length) mexerPerfil(j, perfil)
  if (rng.chance(0.15)) definirPersonalidade(j, rng.pick(['profissional', 'ambicioso', 'descontraido'] as const))
  return j
}

/** Compensação ao clube de formação: o valor do jogador, mais caro quanto maior o teto e conforme a região. */
export function precoTalento(j: Jogador, regiao: Regiao): number {
  const v = valorDe(j.forca, j.idade) * (1 + Math.max(0, j.potencial - j.forca) / 15) * REG[regiao].preco
  if (v >= 100_000) return Math.round(v / 5_000) * 5_000
  return Math.max(1_000, Math.round(v / 500) * 500)
}

/**
 * Uma jornada de prospeção para todos os clubes com missão (na prática só o do utilizador).
 * Tira os talentos que já passaram do prazo e, com sorte, junta um novo.
 */
export function observarJornada(mundo: Mundo, ano: number, jornada: number, semente: number): void {
  for (const cid of Object.keys(mundo.clubes).map(Number).sort((a, b) => a - b)) {
    const st = staffDe(mundo.clubes[cid])
    if (!st) continue
    if (st.descobertas?.length) st.descobertas = st.descobertas.filter((d) => d.ano === ano && d.ate >= jornada + 1)
    const m = st.missao
    if (!m) continue
    const nivel = nivelDe(mundo.clubes[cid], 'olheiro')
    const rng = createRng(mistura(semente, cid, jornada, 0x0e1))
    if (!rng.chance(chanceDescoberta(nivel))) continue
    if ((st.descobertas?.length ?? 0) >= DESCOBERTAS_MAX) continue
    const id = -(mistura(semente, cid, jornada, 0x1d) % 1_000_000_000) - 1
    const j = gerarTalento(mundo, cid, m.regiao, m.posicao, nivel, rng, id)
    st.descobertas = [...(st.descobertas ?? []), { j, ano, ate: jornada + ESPERA, preco: precoTalento(j, m.regiao), nova: true, regiao: m.regiao }]
  }
}

/** Contrata um talento descoberto: paga a compensação, entra no plantel com 3 anos de contrato. */
export function contratarTalento(mundo: Mundo, clubeId: number, idx: number): Resultado {
  const c = mundo.clubes[clubeId]
  const st = staffDe(c)
  const d = st?.descobertas?.[idx]
  if (!st || !d) return { ok: false, texto: 'Esse jogador já não está disponível.' }
  if (c.plantel.length >= PLANTEL_MAX) return { ok: false, texto: `O plantel já tem ${PLANTEL_MAX} jogadores. Vende alguém primeiro.` }
  if (c.dinheiro < d.preco) return { ok: false, texto: 'Não há dinheiro para a compensação ao clube de formação.' }
  c.dinheiro -= d.preco
  const id = proximoIdJogador(mundo)
  const j: Jogador = { ...d.j, id, clubeId, contrato: 3, salario: salarioDe(d.j.forca, nivelLiga(c)), valor: valorDe(d.j.forca, d.j.idade) }
  mundo.jogadores[id] = j
  c.plantel.push(id)
  st.descobertas = st.descobertas!.filter((_, i) => i !== idx)
  return { ok: true, texto: `${j.nome} (${j.idade} anos) assinou por 3 anos. O olheiro está satisfeito.` }
}

/** Dispensa um talento da lista (o olheiro deixa de o seguir). */
export function dispensarTalento(mundo: Mundo, clubeId: number, idx: number): void {
  const st = staffDe(mundo.clubes[clubeId])
  if (st?.descobertas) st.descobertas = st.descobertas.filter((_, i) => i !== idx)
}
