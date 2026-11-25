import { useEffect, useState } from 'react'
import type { Jogo, Posicao } from '../core/types'
import type { Partida } from '../core/partida'
import { FORMACOES, type Escalacao, type Formacao, type Postura } from '../core/partida'
import { escalarAuto } from '../core/motor'
import { indisponiveisDe, tabela } from '../core/epoca'
import { Emblema } from './Emblema'
import { Forca } from './Plantel'
import { EstadoFisico } from './Balneario'
import { FormaPills, minhaPartida } from './comum'
import { Antevisao, escalacaoAdversario } from './Antevisao'
import { PlanoJogoCartao } from './PlanoJogo'
import { manterPlano } from '../core/plano'

export const POSTURAS: { v: Postura; t: string }[] = [
  { v: 'defensiva', t: 'Defensiva' }, { v: 'equilibrada', t: 'Equilibrada' }, { v: 'ofensiva', t: 'Ofensiva' },
]

/** Posição de cada lugar do onze, segundo a formação. */
export function lugaresFormacao(f: Formacao): Posicao[] {
  const [d, m, a] = FORMACOES[f]
  return ['GR', ...Array(d).fill('DEF'), ...Array(m).fill('MED'), ...Array(a).fill('AV')] as Posicao[]
}

/** Devolve uma mensagem de erro, ou null se a escalação é válida. */
export function validarEscalacao(jogo: Jogo, esc: Escalacao, indisp: ReadonlySet<number>): string | null {
  const plantel = new Set(jogo.mundo.clubes[jogo.clubeId].plantel)
  if (esc.titulares.length !== 11) return 'O onze tem de ter 11 jogadores.'
  if (new Set(esc.titulares).size !== 11) return 'Há jogadores repetidos no onze.'
  if (esc.titulares.some((id) => !plantel.has(id))) return 'Há jogadores no onze que já não são do clube.'
  const grs = esc.titulares.filter((id) => jogo.mundo.jogadores[id].posicao === 'GR').length
  // Sem nenhum guarda-redes disponível, joga um de campo na baliza (como no futebol a sério).
  const haGR = [...plantel].some((id) => jogo.mundo.jogadores[id]?.posicao === 'GR' && !indisp.has(id))
  // Um guarda-redes pode jogar à frente (plantel curto), mas a baliza é sempre de um guarda-redes se houver.
  if (haGR && (grs < 1 || jogo.mundo.jogadores[esc.titulares[0]].posicao !== 'GR')) return 'O guarda-redes tem de estar na baliza.'
  const fora = esc.titulares.filter((id) => indisp.has(id))
  if (fora.length) return `${fora.map((id) => jogo.mundo.jogadores[id].curto).join(', ')} ${fora.length > 1 ? 'não podem' : 'não pode'} jogar.`
  return null
}

/**
 * Troca no onze quem não pode jogar (castigado, lesionado, já não é do clube) pelo melhor disponível
 * da mesma posição, sem mexer no resto das escolhas do treinador. Devolve null se não houver nada a trocar.
 */
export function repararEscalacao(jogo: Jogo, esc: Escalacao, indisp: ReadonlySet<number>): Escalacao | null {
  const { mundo, clubeId } = jogo
  const plantel = mundo.clubes[clubeId].plantel
  const mau = (id: number) => indisp.has(id) || !plantel.includes(id) || !mundo.jogadores[id]
  if (!esc.titulares.some(mau)) return null
  const lugaresF = lugaresFormacao(esc.formacao)
  const titulares = [...esc.titulares]
  for (let i = 0; i < titulares.length; i++) {
    if (!mau(titulares[i])) continue
    const livres = plantel.filter((id) => !indisp.has(id) && !titulares.includes(id))
    const pos = lugaresF[i]
    const escolha = [...livres].sort((a, b) =>
      Number(mundo.jogadores[b].posicao === pos) - Number(mundo.jogadores[a].posicao === pos)
      || Number(mundo.jogadores[a].posicao === 'GR') - Number(mundo.jogadores[b].posicao === 'GR')
      || mundo.jogadores[b].forca - mundo.jogadores[a].forca)[0]
    if (escolha == null || (pos === 'GR') !== (mundo.jogadores[escolha].posicao === 'GR')) {
      return { ...escalarAuto(mundo, clubeId, indisp, esc.formacao), postura: esc.postura }
    }
    titulares[i] = escolha
  }
  const suplentes = esc.suplentes.filter((id) => !titulares.includes(id) && !mau(id))
  return { ...esc, titulares, suplentes }
}

/** Jogo fora da liga (taça): outra partida, outro título e outras baixas. */
export interface OutroJogo { partida: Partida; titulo: string; indisp: Set<number>; indispAdv?: Set<number>; botao?: string }

export function PreJogo({ jogo, mudar, jogar, outro }: { jogo: Jogo; mudar: (e: Escalacao) => void; jogar: () => void; outro?: OutroJogo }) {
  const { mundo, epoca, clubeId } = jogo
  const esc = jogo.escalacao
  const meu = mundo.clubes[clubeId]
  const [sel, setSel] = useState<number | null>(null)
  const indisp = outro?.indisp ?? indisponiveisDe(mundo, epoca, clubeId)
  const p = outro?.partida ?? minhaPartida(jogo, epoca.jornada)
  const tab = tabela(mundo, epoca, meu.divisao)
  const advId = p ? (p.casaId === clubeId ? p.foraId : p.casaId) : null
  const adv = advId != null ? mundo.clubes[advId] : null
  const posAdv = tab.findIndex((l) => l.clubeId === advId)
  const posMeu = tab.findIndex((l) => l.clubeId === clubeId)
  const erro = validarEscalacao(jogo, esc, indisp)
  // Castigos da taça/Europa, lesões e vendas: o onze é corrigido sozinho, para o botão de jogar nunca ficar preso.
  const rep = erro ? repararEscalacao(jogo, esc, indisp) : null
  const reparada = rep && !validarEscalacao(jogo, rep, indisp) ? rep : null
  useEffect(() => { if (reparada) mudar(reparada) })
  const lugaresF = lugaresFormacao(esc.formacao)
  const titSet = new Set(esc.titulares)
  const banco = [
    ...esc.suplentes.filter((id) => !titSet.has(id) && meu.plantel.includes(id)),
    ...meu.plantel.filter((id) => !titSet.has(id) && !esc.suplentes.includes(id)),
  ]

  const trocar = (entra: number) => {
    if (sel == null || indisp.has(entra)) return
    const titulares = esc.titulares.map((id) => (id === sel ? entra : id))
    const supl = esc.suplentes.includes(entra) ? esc.suplentes.map((id) => (id === entra ? sel : id)) : [sel, ...esc.suplentes].slice(0, 9)
    setSel(null)
    mudar({ ...esc, titulares, suplentes: supl.filter((id) => !titulares.includes(id)) })
  }

  const estado = (id: number) => {
    const i = epoca.indisponiveis[id]
    if (outro && indisp.has(id) && (!i || i.motivo !== 'lesao')) return <span className="baixa baixa-castigo">Castigado nesta prova</span>
    if (!i || i.jogos <= 0 || (outro && i.motivo !== 'lesao')) return <EstadoFisico jogo={jogo} id={id} />
    return <span className={`baixa baixa-${i.motivo}`}>{i.motivo === 'lesao' ? `Lesionado (${i.jogos})` : `Castigado (${i.jogos})`}</span>
  }

  if (!p || !adv) return <p className="nota">Não há jogo marcado nesta jornada.</p>

  return (
    <div className="pre-jogo">
      <div className={`cartao proximo-jogo ${outro ? 'aviso-taca' : ''}`}>
        <div className="pj-cab">{outro ? outro.titulo : `Jornada ${epoca.jornada} de ${epoca.totalJornadas} · ${p.casaId === clubeId ? 'em casa' : 'fora'}`}</div>
        <div className="pj-equipas">
          <div className="pj-eq"><Emblema clube={meu} tamanho={48} /><b>{meu.nome}</b>{epoca.jornada > 1 && <span className="dica">{posMeu + 1}.º · {tab[posMeu]?.pts ?? 0} pts</span>}
            {tab[posMeu] && tab[posMeu].forma.length > 0 && <FormaPills forma={tab[posMeu].forma} />}</div>
          <span className="pj-vs">vs</span>
          <div className="pj-eq"><Emblema clube={adv} tamanho={48} /><b>{adv.nome}</b>{epoca.jornada > 1 && posAdv >= 0 && <span className="dica">{posAdv + 1}.º · {tab[posAdv]?.pts ?? 0} pts</span>}
            {posAdv < 0 && <span className="dica">{mundo.divisoes[adv.divisao - 1]?.nome}</span>}
            {tab[posAdv] && tab[posAdv].forma.length > 0 && <FormaPills forma={tab[posAdv].forma} />}</div>
        </div>
      </div>

      <div className="pj-colunas">
      <div className="pj-col pj-col-a">
      <div className="cartao tatica">
        <label className="campo">Formação
          <select value={esc.formacao} onChange={(e) => {
            const f = e.target.value as Formacao
            mudar(manterPlano(escalarAuto(mundo, clubeId, indisp, f), esc))
          }}>
            {(Object.keys(FORMACOES) as Formacao[]).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <div className="campo">Postura
          <div className="grupo-botoes">
            {POSTURAS.map((x) => (
              <button key={x.v} className={`botao ${esc.postura === x.v ? 'ativo' : ''}`} onClick={() => mudar({ ...esc, postura: x.v })}>{x.t}</button>
            ))}
          </div>
        </div>
        <button className="botao" onClick={() => { setSel(null); mudar(manterPlano(escalarAuto(mundo, clubeId, indisp, esc.formacao), esc)) }}>Escalação automática</button>
      </div>

      <p className="nota">{sel == null ? 'Toca num titular e depois num jogador do banco para os trocar.' : `A trocar ${mundo.jogadores[sel].curto}: escolhe quem entra.`}</p>

      <div className="onze-grelha">
        <div>
          <h3 className="sub-tit">Onze inicial</h3>
          <ul className="lista-jog">
            {esc.titulares.map((id, i) => {
              const j = mundo.jogadores[id]
              const fora = j.posicao !== lugaresF[i]
              return (
                <li key={id}>
                  <button className={`linha-jog ${sel === id ? 'sel' : ''} ${indisp.has(id) ? 'indisp' : ''}`} onClick={() => setSel(sel === id ? null : id)}>
                    <span className={`pos pos-${lugaresF[i]}`}>{lugaresF[i]}</span>
                    <span className="nome-jogador">{j.curto}</span>
                    {fora && <span className="fora-pos" title={`Joga habitualmente como ${j.posicao}`}>{j.posicao}</span>}
                    {estado(id)}
                    <span className="direita"><Forca valor={j.forca} /></span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        <div>
          <h3 className="sub-tit">Banco e restantes</h3>
          <ul className="lista-jog">
            {banco.map((id, i) => {
              const j = mundo.jogadores[id]
              const ind = indisp.has(id)
              return (
                <li key={id}>
                  <button className={`linha-jog ${ind ? 'indisp' : ''} ${sel != null && !ind ? 'alvo' : ''} ${i >= 9 ? 'nao-conv' : ''}`} disabled={ind || sel == null} onClick={() => trocar(id)}>
                    <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
                    <span className="nome-jogador">{j.curto}</span>
                    {estado(id)}
                    <span className="direita"><Forca valor={j.forca} /></span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      </div>
      <div className="pj-col pj-col-b">
      <Antevisao jogo={jogo} partida={outro?.partida} indispAdv={outro?.indispAdv} aplicar={(pl) => mudar({ ...esc, plano: pl })} />

      <PlanoJogoCartao jogo={jogo} mudar={mudar} escAdv={escalacaoAdversario(jogo, outro?.partida, outro?.indispAdv) ?? undefined} />

      </div>
      </div>

      <div className="barra-acao">
        {erro ? <span className="erro">{erro}</span> : <span>{esc.formacao} · {POSTURAS.find((x) => x.v === esc.postura)?.t}</span>}
        <button className="botao principal grande" disabled={!!erro} onClick={jogar}>{outro ? (outro.botao ?? 'Jogar a taça') : 'Jogar jornada'}</button>
      </div>
    </div>
  )
}
