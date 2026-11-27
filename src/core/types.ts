import type { Escalacao, EstadoEpoca } from './partida'
import type { Obra } from './estadio'
import type { Emprestimo } from './banco'

export type Posicao = 'GR' | 'DEF' | 'MED' | 'AV'

export const POSICOES: readonly Posicao[] = ['GR', 'DEF', 'MED', 'AV']

export interface Jogador {
  id: number
  nome: string
  /** Nome curto para tabelas e relatos (ex.: "R. Tavares"). */
  curto: string
  posicao: Posicao
  idade: number
  /** Força visível, 1 a 99. */
  forca: number
  /**
   * Perfil dos atributos: quanto cada um (vel, rem, pas, def, fis, gr) está acima ou abaixo da força.
   * Opcional: sem ele, o perfil é calculado do id (ver core/atributos.ts).
   */
  perfil?: Record<'vel' | 'rem' | 'pas' | 'def' | 'fis' | 'gr', number>
  /** Teto de evolução, escondido do jogador até haver prospeção. */
  potencial: number
  /** Código de país (PT, BR, ...). */
  nacionalidade: string
  /** Salário mensal em euros. */
  salario: number
  /** Valor de mercado em euros. */
  valor: number
  /** O melhor jogador do clube, quando se destaca. */
  craque: boolean
  /** Anos de contrato restantes. */
  contrato: number
  clubeId: number
}

export interface Clube {
  id: number
  nome: string
  /** Três letras para tabelas e resultados. */
  sigla: string
  cidade: string
  cores: [string, string]
  /** Número da divisão no mundo (índice em `mundo.divisoes`, a partir de 1). */
  divisao: number
  /** Nível da divisão no seu país (1 = a primeira). Sem ele, é o próprio `divisao` (clubes de Portugal). */
  nivel?: number
  /** País do campeonato (sem ele: Portugal). */
  pais?: string
  /** 1 a 100: quanto o clube é conhecido e atrai jogadores. */
  reputacao: number
  /** Dinheiro em caixa, em euros. */
  dinheiro: number
  /** `base`: lotação antes de obras (a procura cresce menos do que a lotação). */
  estadio: { nome: string; lugares: number; base?: number; obra?: Obra }
  /** Empréstimo ao banco em curso. */
  emprestimo?: Emprestimo
  /** Preço do bilhete em euros. */
  bilhete: number
  /** Ids dos jogadores do plantel. */
  plantel: number[]
}

export interface Divisao {
  /** Número único no mundo: Portugal 1 a 4, os campeonatos estrangeiros a seguir. */
  numero: number
  nome: string
  /** País (sem ele: Portugal). */
  pais?: string
  /** Nível no país (sem ele: o próprio número). */
  nivel?: number
  clubes: number[]
}

export interface Mundo {
  versao: 1
  semente: number
  epoca: number
  divisoes: Divisao[]
  clubes: Record<number, Clube>
  jogadores: Record<number, Jogador>
}

export interface Jogo {
  mundo: Mundo
  treinador: string
  clubeId: number
  criado: string
  /** Época a decorrer (calendário, castigos, marcadores). */
  epoca: EstadoEpoca
  /** Escalação e tática guardadas do utilizador. */
  escalacao: Escalacao
}
