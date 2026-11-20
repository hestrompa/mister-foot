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
  divisao: number
  /** 1 a 100: quanto o clube é conhecido e atrai jogadores. */
  reputacao: number
  /** Dinheiro em caixa, em euros. */
  dinheiro: number
  estadio: { nome: string; lugares: number }
  /** Preço do bilhete em euros. */
  bilhete: number
  /** Ids dos jogadores do plantel. */
  plantel: number[]
}

export interface Divisao {
  numero: number
  nome: string
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
}
