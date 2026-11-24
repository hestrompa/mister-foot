// Relatório do adversário: o que o olheiro viu do próximo adversário e o que se pode fazer contra ele.
// Quanto melhor o olheiro, mais o relatório diz (sem olheiro, só o básico e uma ideia).
import type { Jogador, Mundo } from './types'
import type { Escalacao } from './partida'
import { atributo, pontosFortes, NOME_ATRIBUTO } from './atributos'
import {
  comInstrucao, mediaAtributo, mediaFator, melhores, porPosicao, NOME_CANTO, NOME_MARCACAO,
  type PlanoJogo,
} from './plano'

export interface JogadorChave { id: number; motivo: string; forte: string }

export interface Sugestao {
  texto: string
  /** Texto do botão que aplica a sugestão ao plano. */
  rotulo?: string
  aplicar?: (p: PlanoJogo | undefined) => PlanoJogo
}

export interface Relatorio {
  /** 0 = sem olheiro; até 5. */
  nivel: number
  chave: JogadorChave[]
  /** Como costumam jogar (marcação e cantos), só com olheiro. */
  habitos?: string
  sugestoes: Sugestao[]
}

function nomes(js: Jogador[]): string {
  return js.map((j) => j.curto).join(' e ')
}

/**
 * Relatório sobre o adversário `escAdv` para quem joga com `escMinha`. As sugestões só usam o que se vê
 * nos atributos (o mesmo que o motor usa), por isso seguir o relatório costuma compensar um pouco.
 */
export function relatorioAdversario(mundo: Mundo, escMinha: Escalacao, escAdv: Escalacao, nivelOlheiro: number): Relatorio {
  const eles = escAdv.titulares.map((id) => mundo.jogadores[id]).filter(Boolean)
  const nos = escMinha.titulares.map((id) => mundo.jogadores[id]).filter(Boolean)
  const campoEles = eles.filter((j) => j.posicao !== 'GR')
  const campoNos = nos.filter((j) => j.posicao !== 'GR')
  const defEles = porPosicao(mundo, escAdv.titulares, 'DEF'), avEles = porPosicao(mundo, escAdv.titulares, 'AV')
  const defNos = porPosicao(mundo, escMinha.titulares, 'DEF'), avNos = porPosicao(mundo, escMinha.titulares, 'AV')
  const medNos = porPosicao(mundo, escMinha.titulares, 'MED')

  // Jogadores-chave: o mais forte, o mais rápido lá à frente, o melhor de cabeça, quem bate os livres.
  const chave: JogadorChave[] = []
  const usado = new Set<number>()
  const junta = (j: Jogador | undefined, motivo: string) => {
    if (!j || usado.has(j.id)) return
    usado.add(j.id)
    const f = pontosFortes(j, 1)[0]
    chave.push({ id: j.id, motivo, forte: f ? `${NOME_ATRIBUTO[f]} ${atributo(j, f)}` : '' })
  }
  const perigoso = campoEles.filter((j) => j.posicao !== 'DEF').sort((a, b) => b.forca - a.forca || a.id - b.id)[0]
  junta(perigoso, perigoso?.craque ? 'O craque da equipa' : 'O mais perigoso')
  const n = nivelOlheiro <= 0 ? 1 : nivelOlheiro <= 2 ? 3 : 4
  if (n > 1) {
    junta(melhores([...avEles, ...porPosicao(mundo, escAdv.titulares, 'MED')], 'vel', 1)[0], 'Rápido no contra-ataque')
    junta(melhores(campoEles, 'fis', 1)[0], 'Forte de cabeça nas bolas paradas')
    if (escAdv.plano?.batedor != null) junta(mundo.jogadores[escAdv.plano.batedor], 'Bate os livres e penáltis')
  }

  const sugestoes: Sugestao[] = []
  // 1) O craque deles: marcar de perto com o médio que melhor defende.
  const marcador = melhores(medNos, 'def', 1)[0] ?? melhores(defNos, 'def', 1)[0]
  if (perigoso && marcador && (perigoso.craque || perigoso.forca >= mediaAtributo(campoNos, 'def') + 4)) {
    sugestoes.push({
      texto: `${perigoso.curto} decide jogos. ${marcador.curto} (defesa ${atributo(marcador, 'def')}) pode marcá-lo de perto.`,
      rotulo: `${marcador.curto} marca ${perigoso.curto}`,
      aplicar: (p) => ({ ...comInstrucao(p, marcador.id, 'marcar'), alvo: perigoso.id }),
    })
  }
  // 2) Velocidade: avançados deles contra os nossos centrais, e o contrário.
  const velAvEles = mediaAtributo(avEles, 'vel'), velDefNos = mediaAtributo(defNos, 'vel')
  const velAvNos = mediaAtributo(avNos, 'vel'), velDefEles = mediaAtributo(defEles, 'vel')
  if (avEles.length && velAvEles >= velDefNos + 4) {
    sugestoes.push({
      texto: `Os avançados deles são mais rápidos do que os teus centrais (${Math.round(velAvEles)} contra ${Math.round(velDefNos)}). Marcar à zona é mais seguro do que individual ou pressão alta.`,
      rotulo: 'Marcar à zona',
      aplicar: (p) => ({ ...(p ?? {}), marcacao: 'zona' }),
    })
  }
  if (avNos.length && defEles.length && velAvNos >= velDefEles + 4) {
    const rapido = melhores(avNos, 'vel', 1)[0]
    sugestoes.push({
      texto: `Os centrais deles são lentos (velocidade ${Math.round(velDefEles)}). ${rapido.curto} pode explorar as costas: há mais contra-ataques.`,
      rotulo: `${rapido.curto} apoia o ataque`,
      aplicar: (p) => comInstrucao(p, rapido.id, 'subir'),
    })
  } else if (defNos.length && mediaFator(defNos, 'def') >= 1.03 && velDefNos >= velAvEles) {
    sugestoes.push({
      texto: `Os teus defesas são bons a defender e chegam aos avançados deles: a marcação individual rende.`,
      rotulo: 'Marcação individual',
      aplicar: (p) => ({ ...(p ?? {}), marcacao: 'homem' }),
    })
  }
  // 3) Físico deles baixo e o nosso bom: pressão alta.
  if (mediaFator(campoEles, 'fis') <= 0.98 && (mediaFator(campoNos, 'fis') + mediaFator(campoNos, 'vel')) / 2 >= 1.01) {
    sugestoes.push({
      texto: 'Têm pouco físico e cansam na segunda parte. A tua equipa aguenta uma pressão alta.',
      rotulo: 'Pressão alta',
      aplicar: (p) => ({ ...(p ?? {}), marcacao: 'pressao' }),
    })
  }
  // 4) Cantos: no ar ou pelo chão.
  const cabNos = melhores(campoNos, 'fis', 3), cabEles = melhores(campoEles, 'fis', 3)
  const fisNos = mediaAtributo(cabNos, 'fis'), fisEles = mediaAtributo(cabEles, 'fis')
  if (fisNos >= fisEles + 3) {
    sugestoes.push({
      texto: `Ganhas no jogo aéreo (${nomes(cabNos.slice(0, 2))}): cantos para a área.`,
      rotulo: 'Cantos à área',
      aplicar: (p) => ({ ...(p ?? {}), canto: 'area', livre: 'cruzar' }),
    })
  } else if (fisEles >= fisNos + 3) {
    const pas = melhores(campoNos, 'pas', 1)[0], rem = melhores([...medNos, ...avNos], 'rem', 1)[0]
    const curto = pas && (!rem || atributo(pas, 'pas') >= atributo(rem, 'rem'))
    sugestoes.push({
      texto: `São fortes de cabeça (${nomes(cabEles.slice(0, 2))}). Evita cruzar: ${curto ? `canto curto com ${pas.curto}` : `bola atrasada para ${rem?.curto ?? 'quem remata'}`}.`,
      rotulo: curto ? 'Canto curto' : 'Canto à entrada da área',
      aplicar: (p) => ({ ...(p ?? {}), canto: curto ? 'curto' : 'entrada' }),
    })
  }
  // 5) Guarda-redes fraco: rematar de longe com quem tem bom remate.
  const gr = eles.find((j) => j.posicao === 'GR')
  const rematador = melhores(medNos, 'rem', 1)[0]
  if (gr && rematador && atributo(gr, 'gr') + 3 <= atributo(rematador, 'rem')) {
    sugestoes.push({
      texto: `O guarda-redes deles (${gr.curto}, ${atributo(gr, 'gr')}) não é seguro. ${rematador.curto} pode rematar de longe.`,
      rotulo: `${rematador.curto} remata de longe`,
      aplicar: (p) => comInstrucao(p, rematador.id, 'rematar'),
    })
  }
  // 6) Postura.
  if (escAdv.postura === 'ofensiva') sugestoes.push({ texto: 'Vêm ao ataque: esperar atrás e sair rápido abre espaço para contra-ataques.' })
  else if (escAdv.postura === 'defensiva') sugestoes.push({ texto: 'Vão fechar-se atrás: há pouco perigo de contra-ataque, podes arriscar.' })

  const maxSug = nivelOlheiro <= 0 ? 1 : nivelOlheiro <= 2 ? 3 : 5
  const pl = escAdv.plano
  const habitos = nivelOlheiro >= 2 && pl
    ? `Costumam marcar ${pl.marcacao ? NOME_MARCACAO[pl.marcacao].toLowerCase() : 'à zona'}${pl.canto ? ` e nos cantos: ${NOME_CANTO[pl.canto].toLowerCase()}` : ''}.`
    : undefined
  return { nivel: nivelOlheiro, chave, ...(habitos ? { habitos } : {}), sugestoes: sugestoes.slice(0, maxSug) }
}
