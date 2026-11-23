// Motor de jogo minuto a minuto. Estatístico (sem física de bola), ao estilo dos clássicos:
// o meio-campo decide a posse e quantas jogadas cada equipa tem; ataque contra defesa decide
// a qualidade das oportunidades; rematador contra guarda-redes decide a defesa.
import { createRng, type Rng } from './rng'
import type { Jogador, Mundo, Posicao } from './types'
import { FORMACOES } from './partida'
import type { Escalacao, EstatJogo, EventoJogo, Formacao, Lado, Lance, Partida, Postura } from './partida'

/** Estado interno de um jogo a decorrer. Serializável (sem funções). */
export interface EstadoJogo {
  partida: Partida
  minuto: number
  escalacoes: Record<Lado, Escalacao>
  /** Substituições feitas por lado (máximo 5). */
  subs: Record<Lado, number>
  /** Jogadores expulsos ou lesionados que saíram (não podem voltar). */
  fora: number[]
  /** Estado do gerador de números, para continuar de forma determinística. */
  rng: number
  [extra: string]: unknown
}

/** Campos internos extra guardados em EstadoJogo. */
interface Extra {
  /** Lados em que o motor substitui sozinho os lesionados (equipas da IA). A UI põe false no lado do jogador. */
  autoSub: Record<Lado, boolean>
  expulsos: number[]
  /** Lesionados no jogo (também estão em `fora`); podem ser substituídos. */
  lesionados: number[]
  amarelosJogo: Record<number, number>
  /** Titulares iniciais (para o cansaço). */
  iniciais: number[]
  /** Soma das quotas de posse da casa por minuto. */
  posseAcum: number
  /** Último minuto do jogo (90 + descontos), decidido ao minuto 90. */
  fimMinuto: number
}

export const MAX_SUBS = 5
const LADOS: Lado[] = ['casa', 'fora']
/** Probabilidade base de uma jogada de ataque acabar em remate, por minuto. */
const TAXA_REMATE = 0.3
/** Probabilidade base de golo por remate numa jogada equilibrada. */
const CONVERSAO = 0.125

function ex(e: EstadoJogo): Extra {
  return e as unknown as Extra
}

function idx(l: Lado): 0 | 1 {
  return l === 'casa' ? 0 : 1
}

function outro(l: Lado): Lado {
  return l === 'casa' ? 'fora' : 'casa'
}

/** Posição do lugar `i` na formação (0 = GR, depois DEF, MED, AV). */
export function posicaoDoLugar(formacao: Formacao, i: number): Posicao {
  const [d, m] = FORMACOES[formacao]
  if (i === 0) return 'GR'
  if (i <= d) return 'DEF'
  if (i <= d + m) return 'MED'
  return 'AV'
}

/** Força efetiva de um jogador num lugar: fora da posição vale cerca de 70%. */
export function forcaNoLugar(j: Jogador, pos: Posicao): number {
  if (j.posicao === pos) return j.forca
  if (pos === 'GR' || j.posicao === 'GR') return j.forca * 0.45
  return j.forca * 0.7
}

/** Escolhe a melhor escalação automática para um clube, ignorando indisponíveis. */
export function escalarAuto(mundo: Mundo, clubeId: number, indisponiveis: ReadonlySet<number>, formacao: Escalacao['formacao'] = '4-4-2'): Escalacao {
  const clube = mundo.clubes[clubeId]
  const disp = clube.plantel
    .filter((id) => !indisponiveis.has(id) && mundo.jogadores[id])
    .map((id) => mundo.jogadores[id])
    .sort((a, b) => b.forca - a.forca || a.id - b.id)
  const usados = new Set<number>()
  const [d, m, a] = FORMACOES[formacao]
  const lugares: Posicao[] = ['GR', ...Array<Posicao>(d).fill('DEF'), ...Array<Posicao>(m).fill('MED'), ...Array<Posicao>(a).fill('AV')]
  const titulares: number[] = []
  // Primeiro os de posição natural, depois preencher buracos com o melhor que render nesse lugar.
  const escolha: (number | undefined)[] = lugares.map(() => undefined)
  lugares.forEach((pos, i) => {
    const j = disp.find((p) => !usados.has(p.id) && p.posicao === pos)
    if (j) { escolha[i] = j.id; usados.add(j.id) }
  })
  lugares.forEach((pos, i) => {
    if (escolha[i] !== undefined) return
    let melhor: Jogador | undefined
    for (const p of disp) {
      if (usados.has(p.id)) continue
      if (!melhor || forcaNoLugar(p, pos) > forcaNoLugar(melhor, pos)) melhor = p
    }
    if (melhor) { escolha[i] = melhor.id; usados.add(melhor.id) }
  })
  for (const id of escolha) if (id !== undefined) titulares.push(id)
  const resto = disp.filter((p) => !usados.has(p.id))
  const suplentes: number[] = []
  const gr = resto.find((p) => p.posicao === 'GR')
  if (gr) suplentes.push(gr.id)
  for (const p of resto) {
    if (suplentes.length >= 9) break
    if (!suplentes.includes(p.id)) suplentes.push(p.id)
  }
  return { formacao, postura: 'equilibrada', titulares, suplentes }
}

function estatVazia(): EstatJogo {
  return { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] }
}

/** Prepara um jogo para ser jogado minuto a minuto. */
export function iniciarJogo(_mundo: Mundo, partida: Partida, casa: Escalacao, fora: Escalacao, semente: number): EstadoJogo {
  const copia = (e: Escalacao): Escalacao => ({ ...e, titulares: e.titulares.slice(), suplentes: e.suplentes.slice() })
  const extra: Extra = {
    autoSub: { casa: true, fora: true },
    expulsos: [],
    lesionados: [],
    amarelosJogo: {},
    iniciais: [...casa.titulares, ...fora.titulares],
    posseAcum: 0,
    fimMinuto: 90,
  }
  return {
    partida: { ...partida, golos: [0, 0], eventos: [], estat: estatVazia(), jogada: false, porque: undefined },
    minuto: 0,
    escalacoes: { casa: copia(casa), fora: copia(fora) },
    subs: { casa: 0, fora: 0 },
    fora: [],
    rng: createRng(semente).state(),
    ...extra,
  }
}

/** Liga ou desliga as substituições automáticas de lesionados num lado (desligar no lado do jogador). */
export function definirAutoSub(estado: EstadoJogo, lado: Lado, ligado: boolean): void {
  ex(estado).autoSub[lado] = ligado
}

interface EmCampo {
  j: Jogador
  pos: Posicao
  ef: number
}

function emCampo(mundo: Mundo, estado: EstadoJogo, lado: Lado): EmCampo[] {
  const esc = estado.escalacoes[lado]
  const out: EmCampo[] = []
  const iniciais = ex(estado).iniciais
  const m = estado.minuto
  // Cansaço ligeiro depois dos 60' para quem começou o jogo.
  const cansaco = m > 60 ? 1 - (m - 60) * 0.0025 : 1
  esc.titulares.forEach((id, i) => {
    if (estado.fora.includes(id)) return
    const j = mundo.jogadores[id]
    if (!j) return
    const pos = posicaoDoLugar(esc.formacao, i)
    out.push({ j, pos, ef: forcaNoLugar(j, pos) * (iniciais.includes(id) ? cansaco : 1) })
  })
  return out
}

interface Setores {
  gr: number
  meio: number
  ataque: number
  defesa: number
}

function setores(mundo: Mundo, estado: EstadoJogo, lado: Lado, campo: EmCampo[]): Setores {
  const s: Record<Posicao, number> = { GR: 0, DEF: 0, MED: 0, AV: 0 }
  for (const c of campo) s[c.pos] += c.ef
  const casa = lado === 'casa' ? 1.04 : 1
  const post = estado.escalacoes[lado].postura
  const fa = post === 'ofensiva' ? 1.12 : post === 'defensiva' ? 0.88 : 1
  const fd = post === 'ofensiva' ? 0.88 : post === 'defensiva' ? 1.12 : 1
  void mundo
  return {
    gr: (s.GR || 20) * casa,
    meio: (s.MED + 0.25 * (s.DEF + s.AV)) * casa,
    ataque: (s.AV + 0.35 * s.MED + 0.1 * s.DEF) * casa * fa,
    defesa: (s.DEF + 0.35 * s.MED + 0.1 * s.AV) * casa * fd,
  }
}

function pesado<T>(rng: Rng, itens: T[], peso: (t: T) => number): T | undefined {
  let total = 0
  for (const it of itens) total += Math.max(0, peso(it))
  if (total <= 0) return itens.length ? rng.pick(itens) : undefined
  let r = rng.next() * total
  for (const it of itens) {
    r -= Math.max(0, peso(it))
    if (r <= 0) return it
  }
  return itens[itens.length - 1]
}

const PESO_REMATE: Record<Posicao, number> = { GR: 0, DEF: 0.5, MED: 1.6, AV: 4 }
const PESO_PASSE: Record<Posicao, number> = { GR: 0.05, DEF: 0.8, MED: 3, AV: 1.5 }
const PESO_FALTA: Record<Posicao, number> = { GR: 0.2, DEF: 3, MED: 2, AV: 1 }

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function textoGolo(l: Lance, rem: string, pas?: string): string {
  switch (l.origem) {
    case 'contra': return `Golo! Contra-ataque rápido e ${rem} finaliza.`
    case 'canto': return `Golo! ${rem} de cabeça na sequência de um canto.`
    case 'livre': return `Golo de livre! ${rem} põe a bola no ângulo.`
    case 'penalti': return `Golo! ${rem} não falha o penálti.`
    case 'longe': return `Golaço! ${rem} de fora da área.`
    default: return pas ? `Golo! ${rem} remata cruzado após passe de ${pas}.` : `Golo! ${rem} remata cruzado.`
  }
}

function textoOportunidade(l: Lance, rem: string, gr?: string): string {
  if (l.desfecho === 'poste') return `Ao poste! ${rem} esteve muito perto.`
  if (l.desfecho === 'defesa') return gr ? `Grande defesa de ${gr} a remate de ${rem}.` : `Remate de ${rem} defendido.`
  return l.origem === 'penalti' ? `Penálti falhado! ${rem} atira para fora.` : `${rem} isolado, mas atira ao lado.`
}

function retirarLesionadoAuto(mundo: Mundo, estado: EstadoJogo, lado: Lado, saiId: number): EventoJogo | null {
  const esc = estado.escalacoes[lado]
  if (estado.subs[lado] >= MAX_SUBS) return null
  const i = esc.titulares.indexOf(saiId)
  if (i < 0) return null
  const pos = posicaoDoLugar(esc.formacao, i)
  const cands = esc.suplentes.filter((id) => !estado.fora.includes(id) && mundo.jogadores[id])
  if (!cands.length) return null
  let melhor = cands[0]
  for (const id of cands) {
    if (forcaNoLugar(mundo.jogadores[id], pos) > forcaNoLugar(mundo.jogadores[melhor], pos)) melhor = id
  }
  if (!substituir(mundo, estado, lado, saiId, melhor)) return null
  return estado.partida.eventos[estado.partida.eventos.length - 1]
}

/** Joga o minuto seguinte (1 a 90, com descontos opcionais) e devolve os eventos desse minuto. Ao 45 inclui 'intervalo'; no fim inclui 'fim' e marca partida.jogada = true. */
export function avancarMinuto(mundo: Mundo, estado: EstadoJogo): EventoJogo[] {
  const p = estado.partida
  if (p.jogada) return []
  const x = ex(estado)
  const rng = createRng(estado.rng)
  estado.minuto++
  const min = estado.minuto
  const evs: EventoJogo[] = []
  const sigla = (l: Lado) => mundo.clubes[l === 'casa' ? p.casaId : p.foraId]?.sigla ?? ''

  const campo = { casa: emCampo(mundo, estado, 'casa'), fora: emCampo(mundo, estado, 'fora') }
  const set = { casa: setores(mundo, estado, 'casa', campo.casa), fora: setores(mundo, estado, 'fora', campo.fora) }

  // Posse: decide o meio-campo.
  const mc = Math.pow(set.casa.meio + 1, 1.5)
  const mf = Math.pow(set.fora.meio + 1, 1.5)
  const posseCasa = mc / (mc + mf)
  x.posseAcum += posseCasa

  // Jogada de ataque deste minuto.
  const atac: Lado = rng.chance(posseCasa) ? 'casa' : 'fora'
  const def = outro(atac)
  const sa = set[atac], sd = set[def]
  const q = (sa.ataque + 1) / (sd.defesa + 1)
  const ia = idx(atac)
  if (rng.chance(clamp(TAXA_REMATE * Math.pow(q, 0.5), 0.05, 0.6))) {
    const r = rng.next()
    const origem: Lance['origem'] = r < 0.03 ? 'penalti' : r < 0.11 ? 'livre' : r < 0.23 ? 'canto' : r < 0.36 ? 'contra' : r < 0.5 ? 'longe' : 'jogada'
    const atacantes = campo[atac].filter((c) => c.pos !== 'GR')
    const remC = origem === 'penalti'
      ? atacantes.slice().sort((a, b) => b.j.forca - a.j.forca)[0]
      : pesado(rng, atacantes, (c) => PESO_REMATE[c.pos] * Math.pow(c.ef, 0.6))
    if (remC) {
      const pasC = origem === 'penalti' || origem === 'livre' ? undefined
        : pesado(rng, atacantes.filter((c) => c !== remC), (c) => PESO_PASSE[c.pos] * c.ef)
      const grC = campo[def].find((c) => c.pos === 'GR')
      const defC = pesado(rng, campo[def].filter((c) => c.pos !== 'GR'), (c) => (c.pos === 'DEF' ? 3 : 1))
      const grEf = sd.gr
      const fOrig = origem === 'penalti' ? 7 : origem === 'longe' ? 0.45 : origem === 'contra' ? 1.35 : origem === 'livre' ? 0.7 : 1
      const pGolo = clamp(CONVERSAO * fOrig * Math.pow(q, 0.8) * Math.pow((remC.ef + 1) / (grEf + 1), 0.6), 0.01, 0.85)
      const rr = rng.next()
      let desfecho: Lance['desfecho']
      if (rr < pGolo) desfecho = 'golo'
      else if (rr < pGolo + (1 - pGolo) * 0.24) desfecho = 'defesa'
      else if (rr < pGolo + (1 - pGolo) * 0.27) desfecho = 'poste'
      else desfecho = 'fora'
      const corredor = (rng.int(-1, 1)) as -1 | 0 | 1
      const lance: Lance = {
        origem, rematadorId: remC.j.id, desfecho, corredor,
        ...(pasC ? { passadorId: pasC.j.id } : {}),
        ...(defC ? { defensorId: defC.j.id } : {}),
        ...(grC ? { guardaRedesId: grC.j.id } : {}),
      }
      p.estat.remates[ia]++
      if (desfecho === 'golo' || desfecho === 'defesa') p.estat.rematesBaliza[ia]++
      if (desfecho === 'golo') {
        p.golos[ia]++
        evs.push({ minuto: min, tipo: 'golo', lado: atac, jogadorId: remC.j.id, outroId: pasC?.j.id, lance, texto: `${textoGolo(lance, remC.j.curto, pasC?.j.curto)} (${sigla(atac)})` })
      } else {
        const clara = desfecho === 'poste' || origem === 'penalti' || (desfecho === 'defesa' && rng.chance(0.3)) || (desfecho === 'fora' && rng.chance(0.06))
        if (clara) evs.push({ minuto: min, tipo: 'oportunidade', lado: atac, jogadorId: remC.j.id, outroId: pasC?.j.id, lance, texto: textoOportunidade(lance, remC.j.curto, grC?.j.curto) })
        if (desfecho !== 'poste' && rng.chance(0.3)) p.estat.cantos[ia]++
      }
    }
  } else if (rng.chance(0.02)) {
    p.estat.cantos[ia]++
  }

  // Cartões e lesões.
  for (const lado of LADOS) {
    const il = idx(lado)
    const cl = campo[lado].filter((c) => !estado.fora.includes(c.j.id))
    if (!cl.length) continue
    if (rng.chance(0.0195)) {
      // Quem já tem amarelo joga com cuidado: arrisca muito menos a falta.
      const c = pesado(rng, cl, (c) => PESO_FALTA[c.pos] * (x.amarelosJogo[c.j.id] ? 0.3 : 1))!
      const id = c.j.id
      x.amarelosJogo[id] = (x.amarelosJogo[id] ?? 0) + 1
      p.estat.amarelos[il]++
      if (x.amarelosJogo[id] >= 2) {
        p.estat.vermelhos[il]++
        x.expulsos.push(id)
        estado.fora.push(id)
        evs.push({ minuto: min, tipo: 'vermelho', lado, jogadorId: id, texto: `Segundo amarelo para ${c.j.curto}. Expulso! (${sigla(lado)})` })
      } else {
        evs.push({ minuto: min, tipo: 'amarelo', lado, jogadorId: id, texto: `Amarelo para ${c.j.curto} (${sigla(lado)}).` })
      }
    } else if (rng.chance(0.0004)) {
      const c = pesado(rng, cl, (c) => PESO_FALTA[c.pos])!
      p.estat.vermelhos[il]++
      x.expulsos.push(c.j.id)
      estado.fora.push(c.j.id)
      evs.push({ minuto: min, tipo: 'vermelho', lado, jogadorId: c.j.id, texto: `Vermelho direto para ${c.j.curto}! (${sigla(lado)})` })
    }
    const vivos = cl.filter((c) => !estado.fora.includes(c.j.id))
    if (vivos.length && rng.chance(0.0017)) {
      const c = rng.pick(vivos)
      const duracao = rng.int(1, 6)
      x.lesionados.push(c.j.id)
      estado.fora.push(c.j.id)
      evs.push({ minuto: min, tipo: 'lesao', lado, jogadorId: c.j.id, duracao, texto: `${c.j.curto} lesiona-se e não pode continuar (${duracao} ${duracao === 1 ? 'jogo' : 'jogos'}).` })
      if (x.autoSub[lado]) {
        // substituir() regista o evento em partida.eventos; passa para a lista deste minuto.
        const s = retirarLesionadoAuto(mundo, estado, lado, c.j.id)
        if (s) { p.eventos.pop(); evs.push(s) }
      }
    }
  }

  if (min === 45) evs.push({ minuto: 45, tipo: 'intervalo', lado: 'casa', texto: `Intervalo: ${sigla('casa')} ${p.golos[0]}-${p.golos[1]} ${sigla('fora')}.` })
  if (min === 90) x.fimMinuto = 90 + rng.int(0, 4)
  if (min >= 90 && min >= x.fimMinuto) {
    const pc = Math.round((100 * x.posseAcum) / min)
    p.estat.posse = [pc, 100 - pc]
    p.jogada = true
    p.porque = explicar(mundo, p)
    evs.push({ minuto: min, tipo: 'fim', lado: 'casa', texto: `Fim do jogo: ${sigla('casa')} ${p.golos[0]}-${p.golos[1]} ${sigla('fora')}.` })
  } else {
    const pc = Math.round((100 * x.posseAcum) / min)
    p.estat.posse = [pc, 100 - pc]
  }
  estado.rng = rng.state()
  p.eventos.push(...evs)
  return evs
}

function explicar(mundo: Mundo, p: Partida): string {
  const [gc, gf] = p.golos
  const s = p.estat
  if (gc === gf) {
    const dom = s.posse[0] >= s.posse[1] ? 0 : 1
    const nome = mundo.clubes[dom === 0 ? p.casaId : p.foraId]?.nome ?? ''
    if (s.posse[dom] >= 58) return `Empate apesar do domínio de ${nome}: ${s.posse[dom]}% de posse.`
    return `Jogo equilibrado: ${s.posse[0]}%-${s.posse[1]}% de posse e ${s.remates[0]}-${s.remates[1]} em remates.`
  }
  const v = gc > gf ? 0 : 1
  const d = 1 - v
  const nome = mundo.clubes[v === 0 ? p.casaId : p.foraId]?.nome ?? ''
  if (s.vermelhos[d] > s.vermelhos[v]) return `${nome} aproveitou a expulsão no adversário.`
  if (s.posse[v] >= 56) return `${nome} dominou o meio-campo: ${s.posse[v]}% de posse e ${s.remates[v]} remates.`
  if (s.remates[v] < s.remates[d]) return `Eficácia de ${nome}: ${p.golos[v]} golos em ${s.remates[v]} remates.`
  return `${nome} criou mais perigo: ${s.remates[v]} remates contra ${s.remates[d]}.`
}

/** Substituição: devolve false se não for permitida. */
export function substituir(mundo: Mundo, estado: EstadoJogo, lado: Lado, saiId: number, entraId: number): boolean {
  const x = ex(estado)
  const esc = estado.escalacoes[lado]
  if (estado.partida.jogada) return false
  if (estado.subs[lado] >= MAX_SUBS) return false
  const i = esc.titulares.indexOf(saiId)
  if (i < 0 || x.expulsos.includes(saiId)) return false
  if (!esc.suplentes.includes(entraId) || estado.fora.includes(entraId) || !mundo.jogadores[entraId]) return false
  esc.titulares[i] = entraId
  esc.suplentes = esc.suplentes.filter((id) => id !== entraId)
  if (!estado.fora.includes(saiId)) estado.fora.push(saiId)
  estado.subs[lado]++
  const sai = mundo.jogadores[saiId]?.curto ?? '?'
  const entra = mundo.jogadores[entraId].curto
  estado.partida.eventos.push({
    minuto: estado.minuto, tipo: 'substituicao', lado, jogadorId: saiId, outroId: entraId,
    texto: `Substituição: sai ${sai}, entra ${entra}.`,
  })
  return true
}

const NOME_POSTURA: Record<Postura, string> = { defensiva: 'defensiva', equilibrada: 'equilibrada', ofensiva: 'ofensiva' }

export function mudarPostura(estado: EstadoJogo, lado: Lado, postura: Postura): void {
  const esc = estado.escalacoes[lado]
  if (esc.postura === postura) return
  esc.postura = postura
  estado.partida.eventos.push({
    minuto: estado.minuto, tipo: 'postura', lado,
    texto: `${lado === 'casa' ? 'A equipa da casa' : 'A equipa visitante'} passa a jogar de forma ${NOME_POSTURA[postura]}.`,
  })
}

/** Joga o jogo inteiro de uma vez (para os jogos das outras divisões e para testes). */
export function simularJogo(mundo: Mundo, partida: Partida, casa: Escalacao, fora: Escalacao, semente: number): Partida {
  const e = iniciarJogo(mundo, partida, casa, fora, semente)
  let guarda = 0
  while (!e.partida.jogada && guarda++ < 200) avancarMinuto(mundo, e)
  return e.partida
}
