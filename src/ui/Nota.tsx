// Nota de jogo (0,0 a 10,0): o número com a cor, a média da época e as últimas notas.
import type { Mundo } from '../core/types'
import type { EstadoEpoca, Lado, Partida } from '../core/partida'
import { cartoesDoJogo, cartoesDosEventos, contaDoJogador, notasDoJogo, type CartaoJogo, type EstadoJogo } from '../core/motor'
import { classeNota, jogosComNota, mediaEpoca, melhorEmCampo, textoNota, ultimasNotas, type ContaJogo } from '../core/notas'
import './notas.css'

/** Uma nota com cor (verde forte >= 8, verde >= 7, amarelo >= 6, laranja >= 5, vermelho). */
export function Nota({ n, titulo, grande }: { n: number | undefined; titulo?: string; grande?: boolean }) {
  return <span className={`nota-jogo ${classeNota(n)} ${grande ? 'nota-grande' : ''}`} title={titulo ?? (n == null ? 'Sem nota' : 'Nota de 0 a 10')}>{textoNota(n)}</span>
}

/** Média da época, com o número de jogos na dica. */
export function NotaEpoca({ epoca, id }: { epoca: EstadoEpoca | undefined; id: number }) {
  const n = mediaEpoca(epoca, id)
  const j = jogosComNota(epoca, id)
  return <Nota n={n} titulo={n == null ? 'Ainda sem notas esta época' : `Média de ${j} ${j === 1 ? 'jogo' : 'jogos'} esta época`} />
}

/** Últimas notas, a mais recente à direita. */
export function UltimasNotas({ epoca, id }: { epoca: EstadoEpoca | undefined; id: number }) {
  const u = ultimasNotas(epoca, id)
  if (!u.length) return null
  return (
    <span className="ultimas-notas" title="Últimas notas (a mais recente à direita)">
      {u.map((n, i) => <span key={i} className={`nota-mini ${classeNota(n)}`}>{textoNota(n)}</span>)}
    </span>
  )
}

const ORDEM: Record<string, number> = { GR: 0, DEF: 1, MED: 2, AV: 3 }

/** O que o jogador fez, em poucas palavras (para a lista de notas). */
function feitosDe(c: ContaJogo | undefined): string {
  if (!c) return ''
  const f: string[] = []
  const n = (v: number, um: string, mais: string) => { if (v > 0) f.push(`${v} ${v === 1 ? um : mais}`) }
  n(c.g, 'golo', 'golos')
  n(c.a, 'assist.', 'assist.')
  if (c.pos === 'GR') n(c.dfs, 'defesa', 'defesas')
  n(c.rem - c.g, 'remate', 'remates')
  n(c.pc, 'passe p/ remate', 'passes p/ remate')
  n(c.des, 'desarme', 'desarmes')
  n(c.err, 'erro', 'erros')
  return f.join(' · ')
}

const TITULO_CARTAO: Record<CartaoJogo, string> = { amarelo: 'Amarelo', segundo: 'Expulso (segundo amarelo)', vermelho: 'Expulso (vermelho direto)' }

/** Cartão deste jogo: amarelo, amarelo+vermelho (2.º amarelo) ou vermelho. */
export function Cartao({ c }: { c: CartaoJogo | undefined }) {
  if (!c) return null
  return (
    <span className={`cartao-jogo cj-${c}`} title={TITULO_CARTAO[c]} aria-label={TITULO_CARTAO[c]}>
      {c === 'segundo' ? <><i className="cj-a" /><i className="cj-v" /></> : <i className={c === 'amarelo' ? 'cj-a' : 'cj-v'} />}
    </span>
  )
}

/**
 * Notas de uma equipa num jogo (ao vivo: provisórias; no fim: finais). Com o estado do jogo mostra
 * também os feitos e quem já saiu; só com a partida mostra as notas guardadas.
 */
export function NotasEquipa({ mundo, partida, lado, estado, titulo }: {
  mundo: Mundo; partida: Partida; lado: Lado; estado?: EstadoJogo; titulo?: string
}) {
  const notas = estado ? notasDoJogo(estado) : partida.notas ?? {}
  const cartoes = estado ? cartoesDoJogo(estado) : cartoesDosEventos(partida.eventos)
  const l = lado === 'casa' ? 0 : 1
  const esc = estado?.escalacoes[lado] ?? partida.onzes?.[l]
  const emCampo = new Set(estado ? esc?.titulares.filter((id) => !estado.fora.includes(id)) : [])
  const ids = Object.keys(notas).map(Number).filter((id) => {
    const c = estado ? contaDoJogador(estado, id) : undefined
    if (c) return c.l === l
    const j = mundo.jogadores[id]
    return j && j.clubeId === (lado === 'casa' ? partida.casaId : partida.foraId)
  })
  const posDe = (id: number) => (estado ? contaDoJogador(estado, id)?.pos : undefined) ?? mundo.jogadores[id]?.posicao ?? 'MED'
  ids.sort((a, b) => ORDEM[posDe(a)] - ORDEM[posDe(b)] || notas[b] - notas[a])
  const melhor = melhorEmCampo(notas)
  return (
    <div className="notas-equipa">
      {titulo && <h3 className="sub-tit">{titulo}</h3>}
      {ids.length === 0 && <p className="dica">As notas aparecem a partir dos 10 minutos.</p>}
      <ul className="notas-jogo-lista">
        {ids.map((id) => {
          const j = mundo.jogadores[id]
          const c = estado ? contaDoJogador(estado, id) : undefined
          const saiu = estado ? !emCampo.has(id) : false
          return (
            <li key={id} className={saiu ? 'fora-campo' : ''}>
              <span className={`pos pos-${c?.pos ?? j?.posicao}`}>{c?.pos ?? j?.posicao}</span>
              <span className="nj-nome">{j?.curto ?? '?'}{id === melhor && partida.jogada ? ' ★' : ''} <Cartao c={cartoes[id]} /></span>
              {c && <span className="nj-feitos">{feitosDe(c)}</span>}
              <Nota n={notas[id]} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** "Melhor em campo: X (8,4)". */
export function MelhorEmCampo({ mundo, partida }: { mundo: Mundo; partida: Partida }) {
  const id = melhorEmCampo(partida.notas)
  if (id == null || !partida.notas) return null
  const j = mundo.jogadores[id]
  return <p className="melhor-em-campo">Melhor em campo: <b>{j?.nome ?? '?'}</b> <Nota n={partida.notas[id]} /></p>
}
