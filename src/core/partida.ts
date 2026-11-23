// Contrato comum do M1: tipos de jogo, eventos e época.
// motor.ts e epoca.ts implementam as funções declaradas nos seus ficheiros;
// a UI só usa o que está aqui e as funções exportadas por esses dois ficheiros.

export type Formacao = '4-4-2' | '4-3-3' | '4-5-1' | '3-5-2' | '3-4-3' | '5-3-2' | '5-4-1' | '4-2-4' | '5-0-5'

/** Quantos DEF, MED e AV cada formação usa (o GR é sempre 1). */
export const FORMACOES: Record<Formacao, [number, number, number]> = {
  '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '4-5-1': [4, 5, 1], '3-5-2': [3, 5, 2], '3-4-3': [3, 4, 3],
  '5-3-2': [5, 3, 2], '5-4-1': [5, 4, 1], '4-2-4': [4, 2, 4], '5-0-5': [5, 0, 5],
}

export type Postura = 'defensiva' | 'equilibrada' | 'ofensiva'

export interface Escalacao {
  formacao: Formacao
  postura: Postura
  /** 11 ids: o primeiro é o guarda-redes, depois DEF, MED e AV pela ordem da formação. */
  titulares: number[]
  /** Até 9 suplentes. */
  suplentes: number[]
}

export type Lado = 'casa' | 'fora'

/** Matéria-prima das futuras repetições 2D: como nasceu e acabou um lance. */
export interface Lance {
  origem: 'jogada' | 'contra' | 'canto' | 'livre' | 'penalti' | 'longe'
  /** Quem fez o último passe (se houve). */
  passadorId?: number
  rematadorId: number
  defensorId?: number
  guardaRedesId?: number
  desfecho: 'golo' | 'defesa' | 'poste' | 'fora'
  /** Lado do campo por onde veio: -1 esquerda, 0 meio, 1 direita. */
  corredor: -1 | 0 | 1
}

export type TipoEvento =
  | 'golo' | 'oportunidade' | 'amarelo' | 'vermelho' | 'lesao' | 'substituicao'
  | 'intervalo' | 'fim' | 'postura'

export interface EventoJogo {
  minuto: number
  tipo: TipoEvento
  lado: Lado
  /** Marcador, jogador do cartão, lesionado, quem sai. */
  jogadorId?: number
  /** Assistência, ou quem entra numa substituição. */
  outroId?: number
  /** Jogos de baixa numa lesão. */
  duracao?: number
  /** Para golos e oportunidades. */
  lance?: Lance
  /** Linha de relato curta em pt-PT (ex.: "Golo! R. Tavares de cabeça."). */
  texto: string
}

export interface EstatJogo {
  /** Posse em %, casa e fora (somam 100). */
  posse: [number, number]
  remates: [number, number]
  rematesBaliza: [number, number]
  cantos: [number, number]
  amarelos: [number, number]
  vermelhos: [number, number]
}

export interface Partida {
  id: string
  competicao: 'liga' | 'taca' | 'europa'
  /** Na taça é 0. */
  divisao: number
  jornada: number
  casaId: number
  foraId: number
  golos: [number, number]
  eventos: EventoJogo[]
  estat: EstatJogo
  jogada: boolean
  /** Uma linha a explicar o resultado (ex.: "Dominou o meio-campo: 61% de posse."). */
  porque?: string
  /** Espectadores e receita de bilheteira do clube da casa. */
  publico?: number
  receita?: number
  /** Taça: desempate por penáltis (casa, fora) e a série [lado 0/1, jogadorId, marcou]. */
  /** Taça: houve prolongamento (até ao minuto 120). */
  prolongamento?: boolean
  penaltis?: [number, number]
  serie?: [0 | 1, number, boolean][]
  /** Escalações iniciais (casa, fora), para a ficha do jogo. */
  onzes?: [Escalacao, Escalacao]
}

export interface LinhaTabela {
  clubeId: number
  j: number; v: number; e: number; d: number
  gm: number; gs: number; pts: number
  /** Últimos 5 resultados, mais recente no fim. */
  forma: ('V' | 'E' | 'D')[]
}

export interface Indisponivel {
  /** Jogos que ainda falha. */
  jogos: number
  motivo: 'lesao' | 'castigo'
}

export interface EstadoEpoca {
  ano: number
  /** Próxima jornada a jogar (1-based). Quando passa de `totalJornadas`, a época acabou. */
  jornada: number
  totalJornadas: number
  /** calendario[divisao-1][jornada-1] = partidas dessa jornada. */
  calendario: Partida[][][]
  /** Amarelos acumulados por jogador (5 = 1 jogo de castigo, depois volta a 0). */
  amarelos: Record<number, number>
  indisponiveis: Record<number, Indisponivel>
  /** Golos marcados na época por jogador, para a lista de melhores marcadores. */
  marcadores: Record<number, number>
  /** Balanço da última jornada por clube (bilheteira, receitas fixas, salários). */
  ultimoBalanco?: Record<number, import('./financas').Balanco>
}

export interface ResumoEpoca {
  ano: number
  campeoes: { divisao: number; clubeId: number }[]
  subidas: { divisao: number; clubeIds: number[] }[]
  descidas: { divisao: number; clubeIds: number[] }[]
  melhorMarcador: { jogadorId: number; golos: number } | null
}
