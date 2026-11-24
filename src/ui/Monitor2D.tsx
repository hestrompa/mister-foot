// Campo 2D ao vivo e repetições do meu jogo, para os ecrãs da taça e da Europa (o da liga tem a sua versão).
import { useRef, useState, type ReactNode } from 'react'
import type { Clube, Mundo } from '../core/types'
import type { EventoJogo } from '../core/partida'
import { lancesDoMinuto, posseDoMinuto, type EstadoJogo } from '../core/motor'
import { criarAmbiente, criarRepeticao, DURACAO_AMBIENTE, emCampoDe, fimEmCampo, type CenaRepeticao } from '../core/repeticao'
import { Repeticao2D } from './Repeticao2D'
import { gravarModoRep, lerModoRep, MODOS_REP, type ModoRep } from './AoVivo'

const MS_MINUTO = 450

export interface Monitor2D {
  /** Chamar para cada evento de cada jogo durante o minuto. */
  aoEvento: (e: EstadoJogo, ev: EventoJogo) => void
  /** No fim do minuto: se há uma repetição para ver, devolve 'repeticao' (a pausa do minuto fica para depois dela). */
  fimDoMinuto: <P extends string>(pausa: P | null) => P | 'repeticao' | null
  /** Mostra no marcador o golo escondido durante o lance em direto. */
  revelar: () => void
  /** A partir daqui já não há campo nem repetições (botão Saltar). */
  saltar: () => void
  /** Evento que ainda não deve aparecer no relato. */
  escondido: () => EventoJogo | null
  campo: (aVer: { repeticao: boolean; acabou: boolean; vel: number }) => ReactNode
  botaoModo: ReactNode
}

export function useMonitor2D({ mundo, meu, casa, fora, semente, voltar }: {
  mundo: Mundo; meu: EstadoJogo; casa: Clube; fora: Clube
  /** Semente para cada lance (sempre a mesma jogada dá a mesma repetição). */
  semente: (extra: number) => number
  /** Fim da repetição: volta à fase guardada (ou ao jogo). */
  voltar: (fase: string | null) => void
}): Monitor2D {
  const [modoRep, setModoRep] = useState<ModoRep>(lerModoRep)
  const modoRepRef = useRef(modoRep)
  const [rep, setRep] = useState<CenaRepeticao | null>(null)
  const [amb, setAmb] = useState<CenaRepeticao | null>(null)
  const repPend = useRef<CenaRepeticao | null>(null)
  const depoisRep = useRef<string | null>(null)
  const ultimaCena = useRef<CenaRepeticao | null>(null)
  const pontape = useRef(true)
  const saltando = useRef(false)
  const esc = useRef<{ ev: EventoJogo; golo: boolean } | null>(null)
  const [, setTick] = useState(0)

  const emCampo = () => emCampoDe(mundo, meu)

  const revelar = () => {
    const x = esc.current
    if (!x) return
    esc.current = null
    if (x.golo) meu.partida.golos[x.ev.lado === 'casa' ? 0 : 1]++
    setTick((t) => t + 1)
  }

  const aoEvento = (e: EstadoJogo, ev: EventoJogo) => {
    if (e !== meu) return
    if ((ev.tipo === 'golo' || ev.tipo === 'oportunidade') && ev.lance && !saltando.current) {
      const cena = criarRepeticao(ev, emCampo(), (semente(500 + ev.minuto) ^ (ev.jogadorId ?? 0)) >>> 0)
      const m = modoRepRef.current
      if (cena && !esc.current && (m === 'tudo' || (m === 'golos' && ev.tipo === 'golo'))) {
        repPend.current = cena
        esc.current = { ev, golo: ev.tipo === 'golo' }
      }
    }
    if (ev.tipo === 'golo' || ev.tipo === 'intervalo') pontape.current = true
  }

  const fimDoMinuto = <P extends string>(pausa: P | null): P | 'repeticao' | null => {
    if (saltando.current) return pausa
    if (repPend.current) {
      const c = repPend.current
      repPend.current = null
      // Em direto: o golo só conta no marcador quando a bola entra. Tira-se só no fim do minuto,
      // depois de o motor decidir com o resultado verdadeiro se há prolongamento.
      const x = esc.current
      if (x?.golo) meu.partida.golos[x.ev.lado === 'casa' ? 0 : 1]--
      ultimaCena.current = c
      if (c.desfecho !== 'golo') pontape.current = false
      setRep(c)
      depoisRep.current = pausa
      return 'repeticao'
    }
    if (meu.partida.jogada) return pausa
    const posse = posseDoMinuto(meu)
    if (posse) {
      const ant = ultimaCena.current
      const cena = criarAmbiente({
        emCampo: emCampo(), posse, minuto: meu.minuto, ...lancesDoMinuto(meu),
        posturas: { casa: meu.escalacoes.casa.postura, fora: meu.escalacoes.fora.postura },
        antes: pontape.current || !ant ? undefined : { ...fimEmCampo(ant), posse: ant.ambiente ? ant.atacante : undefined },
        semente: semente(900 + meu.minuto),
      })
      pontape.current = false
      ultimaCena.current = cena
      setAmb(cena)
    }
    return pausa
  }

  const campo = ({ repeticao, acabou, vel }: { repeticao: boolean; acabou: boolean; vel: number }) => (
    <>
      {!(repeticao && rep) && amb && !acabou && (
        <Repeticao2D cena={amb} mundo={mundo} casa={casa} fora={fora} autoFim={false} fim={() => {}}
          velocidade={DURACAO_AMBIENTE / (MS_MINUTO / vel / 1000)} />
      )}
      {repeticao && rep && (
        <Repeticao2D key={`${rep.minuto}-${rep.rematadorId}`} cena={rep} mundo={mundo} casa={casa} fora={fora}
          velocidade={vel > 1 ? 1.5 : 1} emDireto={esc.current != null} revelar={revelar}
          fim={() => { revelar(); setRep(null); const f = depoisRep.current; depoisRep.current = null; voltar(f) }} />
      )}
    </>
  )

  const botaoModo = (
    <button className="botao modo-rep" onClick={() => {
      const m: ModoRep = modoRep === 'tudo' ? 'golos' : modoRep === 'golos' ? 'nada' : 'tudo'
      setModoRep(m)
      modoRepRef.current = m
      gravarModoRep(m)
    }}>{MODOS_REP[modoRep]}</button>
  )

  return {
    aoEvento, fimDoMinuto, revelar, campo, botaoModo,
    saltar: () => { saltando.current = true; repPend.current = null; setRep(null); revelar() },
    escondido: () => esc.current?.ev ?? null,
  }
}
