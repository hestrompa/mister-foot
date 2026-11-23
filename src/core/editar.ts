// Edição de nomes e emblemas: clubes (nome, sigla, estádio, cores, forma e padrão do emblema) e jogadores.
import type { Clube, Mundo } from './types'

export type FormaEmblema = 'escudo' | 'redondo' | 'quadrado' | 'losango'
export type PadraoEmblema = 'liso' | 'metades' | 'riscas' | 'faixa' | 'cruz' | 'aro'

export const FORMAS: { v: FormaEmblema; t: string }[] = [
  { v: 'escudo', t: 'Escudo' }, { v: 'redondo', t: 'Redondo' }, { v: 'quadrado', t: 'Quadrado' }, { v: 'losango', t: 'Losango' },
]
export const PADROES: { v: PadraoEmblema; t: string }[] = [
  { v: 'liso', t: 'Liso' }, { v: 'metades', t: 'Metades' }, { v: 'riscas', t: 'Riscas' }, { v: 'faixa', t: 'Faixa' }, { v: 'cruz', t: 'Cruz' }, { v: 'aro', t: 'Aro' },
]

export interface Emblema { forma: FormaEmblema; padrao: PadraoEmblema }

export type ClubeComEmblema = Clube & { emblema?: Emblema }

export function emblemaDe(c: Pick<Clube, 'id'> & { emblema?: Emblema }): Emblema {
  return c.emblema ?? { forma: 'escudo', padrao: 'metades' }
}

export interface DadosClube {
  nome: string
  sigla: string
  estadio: string
  cores: [string, string]
  emblema: Emblema
}

const COR = /^#[0-9a-f]{6}$/i

/** Valida os dados; devolve a mensagem de erro ou null. */
export function validarClube(mundo: Mundo, id: number, d: DadosClube): string | null {
  const nome = d.nome.trim()
  if (nome.length < 3 || nome.length > 40) return 'O nome tem de ter entre 3 e 40 letras.'
  if (Object.values(mundo.clubes).some((c) => c.id !== id && c.nome.toLowerCase() === nome.toLowerCase())) return 'Já há um clube com esse nome.'
  const sigla = d.sigla.trim().toUpperCase()
  if (!/^[A-Z0-9ÁÉÍÓÚÂÊÔÃÕÇ]{2,3}$/.test(sigla)) return 'A sigla tem 2 ou 3 letras.'
  if (Object.values(mundo.clubes).some((c) => c.id !== id && c.sigla === sigla)) return 'Essa sigla já é de outro clube.'
  const est = d.estadio.trim()
  if (est.length < 3 || est.length > 40) return 'O nome do estádio tem de ter entre 3 e 40 letras.'
  if (!COR.test(d.cores[0]) || !COR.test(d.cores[1])) return 'Cores inválidas.'
  if (d.cores[0].toLowerCase() === d.cores[1].toLowerCase()) return 'Escolhe duas cores diferentes.'
  if (!FORMAS.some((f) => f.v === d.emblema.forma) || !PADROES.some((p) => p.v === d.emblema.padrao)) return 'Emblema inválido.'
  return null
}

export function dadosDe(c: Clube): DadosClube {
  return { nome: c.nome, sigla: c.sigla, estadio: c.estadio.nome, cores: [c.cores[0], c.cores[1]], emblema: emblemaDe(c as ClubeComEmblema) }
}

/** Aplica a edição se for válida. Devolve o erro ou null. */
export function editarClube(mundo: Mundo, id: number, d: DadosClube): string | null {
  const erro = validarClube(mundo, id, d)
  if (erro) return erro
  const c = mundo.clubes[id] as ClubeComEmblema
  c.nome = d.nome.trim()
  c.sigla = d.sigla.trim().toUpperCase()
  c.estadio.nome = d.estadio.trim()
  c.cores = [d.cores[0].toLowerCase(), d.cores[1].toLowerCase()]
  c.emblema = { ...d.emblema }
  return null
}

/** Nome curto: inicial do primeiro nome e último apelido ("R. Tavares"). */
export function nomeCurto(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return p.length === 1 ? p[0] : `${p[0][0]}. ${p[p.length - 1]}`
}

export function editarJogador(mundo: Mundo, id: number, nome: string): string | null {
  const n = nome.trim().replace(/\s+/g, ' ')
  if (n.length < 2 || n.length > 40) return 'O nome tem de ter entre 2 e 40 letras.'
  const j = mundo.jogadores[id]
  if (!j) return 'Jogador desconhecido.'
  j.nome = n
  j.curto = nomeCurto(n)
  return null
}
