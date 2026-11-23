import { useMemo, useState } from 'react'
import type { Jogador, Posicao } from '../core/types'
import { euros } from '../core/formato'
import {
  aceitarProposta, comprar, estadoMercado, janelaAberta, listaIA, pedidoSalarial, porAVenda, precoPedido,
  recusaDoJogador, recusarProposta, retirarDaVenda, textoJanela, PLANTEL_MAX, type JogoComMercado, type Resultado,
  dispensarJunior, juniores, promoverJunior,
  anosMaximos, contratarLivre, livres, pedidoLivre, pedidoRenovacao, premioAssinatura, renovar,
} from '../core/mercado'
import { Emblema } from './Emblema'
import { Forca } from './Plantel'
import { potencialTexto } from '../core/juniores'
import { salarioDe } from '../core/mundo'
import './mercado.css'

type Sub = 'lista' | 'procurar' | 'livres' | 'juniores' | 'propostas' | 'vender' | 'contratos' | 'noticias'
const POS: (Posicao | 'todas')[] = ['todas', 'GR', 'DEF', 'MED', 'AV']
const MAX_LINHAS = 60

/** Número de propostas pendentes, para o separador. */
export function propostasPendentes(jogo: JogoComMercado): number {
  return estadoMercado(jogo).propostas.length
}

export function Mercado({ jogo, atualizar }: { jogo: JogoComMercado; atualizar: (j: JogoComMercado) => void }) {
  const st = estadoMercado(jogo)
  const [sub, setSub] = useState<Sub>(st.propostas.length ? 'propostas' : 'lista')
  const [msg, setMsg] = useState<Resultado | null>(null)
  const meu = jogo.mundo.clubes[jogo.clubeId]
  const aberta = janelaAberta(jogo.epoca)
  const feito = (r: Resultado) => { setMsg(r); atualizar(jogo) }

  return (
    <div className="mercado">
      <div className={`cartao janela ${aberta ? 'aberta' : 'fechada'}`}>
        <span className="janela-estado">{aberta ? 'Mercado aberto' : 'Mercado fechado'}</span>
        <span className="janela-txt">{textoJanela(jogo.epoca)}</span>
        <span className="janela-txt">Dinheiro: <b>{euros(meu.dinheiro)}</b> · Plantel: <b>{meu.plantel.length}/{PLANTEL_MAX}</b></span>
      </div>
      <nav className="separadores sub-sep" aria-label="Mercado">
        {([['lista', 'À venda'], ['procurar', 'Procurar'], ['livres', 'Livres'], ['juniores', `Juniores${juniores(jogo).length ? ` (${juniores(jogo).length})` : ''}`], ['propostas', `Propostas${st.propostas.length ? ` (${st.propostas.length})` : ''}`], ['vender', 'Vender'], ['contratos', `Contratos${aAcabar(jogo) ? ` (${aAcabar(jogo)})` : ''}`], ['noticias', 'Notícias']] as [Sub, string][]).map(([k, t]) => (
          <button key={k} className={sub === k ? 'ativo' : ''} onClick={() => { setSub(k); setMsg(null) }}>{t}</button>
        ))}
      </nav>
      {msg && <p className={msg.ok ? 'msg-ok' : 'erro'} role="status">{msg.texto}</p>}
      {(sub === 'lista' || sub === 'procurar') && <Comprar key={sub} jogo={jogo} soLista={sub === 'lista'} feito={feito} />}
      {sub === 'livres' && <Livres jogo={jogo} feito={feito} />}
      {sub === 'juniores' && <Juniores jogo={jogo} feito={feito} />}
      {sub === 'contratos' && <Contratos jogo={jogo} feito={feito} />}
      {sub === 'propostas' && <Propostas jogo={jogo} feito={feito} />}
      {sub === 'vender' && <Vender jogo={jogo} feito={feito} />}
      {sub === 'noticias' && <Noticias jogo={jogo} />}
    </div>
  )
}

function ClubeCurto({ jogo, id }: { jogo: JogoComMercado; id: number }) {
  const c = jogo.mundo.clubes[id]
  return <span className="clube-linha"><Emblema clube={c} tamanho={18} /> <span className="nm-longo">{c.nome}</span><span className="nm-sigla">{c.sigla}</span> <span className="div-tag">{c.divisao}.ª</span></span>
}

function Filtros({ pos, setPos, div, setDiv, posso, setPosso, nome, setNome }: {
  pos: Posicao | 'todas'; setPos: (p: Posicao | 'todas') => void; div: number; setDiv: (d: number) => void
  posso: boolean; setPosso: (b: boolean) => void; nome?: string; setNome?: (s: string) => void
}) {
  return (
    <div className="filtros">
      <div className="grupo-botoes">
        {POS.map((p) => <button key={p} className={`botao ${pos === p ? 'ativo' : ''}`} onClick={() => setPos(p)}>{p === 'todas' ? 'Todas' : p}</button>)}
      </div>
      <div className="filtros-linha">
        <select value={div} onChange={(e) => setDiv(Number(e.target.value))} aria-label="Divisão">
          <option value={0}>Todas as divisões</option>
          {[1, 2, 3, 4].map((d) => <option key={d} value={d}>{d}.ª Divisão</option>)}
        </select>
        <label className="chk"><input type="checkbox" checked={posso} onChange={(e) => setPosso(e.target.checked)} /> Só o que posso pagar</label>
        {setNome && <input className="procura" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do jogador" />}
      </div>
    </div>
  )
}

function Comprar({ jogo, soLista, feito }: { jogo: JogoComMercado; soLista: boolean; feito: (r: Resultado) => void }) {
  const { mundo } = jogo
  const meu = mundo.clubes[jogo.clubeId]
  const [pos, setPos] = useState<Posicao | 'todas'>('todas')
  const [div, setDiv] = useState(0)
  const [posso, setPosso] = useState(true)
  const [nome, setNome] = useState('')
  const [sel, setSel] = useState<number | null>(null)
  const st = estadoMercado(jogo)

  const linhas = useMemo(() => {
    const base: { j: Jogador; preco: number; leilao?: boolean }[] = soLista
      ? listaIA(jogo).map((a) => ({ j: mundo.jogadores[a.jogadorId], preco: a.preco, leilao: a.leilao }))
      : Object.values(mundo.jogadores).filter((j) => j.clubeId !== jogo.clubeId && j.clubeId !== 0).map((j) => ({ j, preco: precoPedido(jogo, j.id) }))
    const q = nome.trim().toLowerCase()
    return base
      .filter(({ j, preco }) =>
        (pos === 'todas' || j.posicao === pos) &&
        (!div || mundo.clubes[j.clubeId].divisao === div) &&
        (!posso || preco <= meu.dinheiro) &&
        (!q || j.nome.toLowerCase().includes(q)) &&
        !recusaDoJogador(mundo, j, jogo.clubeId))
      .sort((a, b) => b.j.forca - a.j.forca || a.preco - b.preco)
      .slice(0, MAX_LINHAS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogo, soLista, pos, div, posso, nome, meu.dinheiro, st.lista.length])

  return (
    <>
      <p className="nota">{soLista
        ? 'Jogadores que os clubes querem vender e que aceitam vir para cá. Pelo preço pedido é quase certo; abaixo, arriscas uma recusa (uma tentativa por jornada).'
        : 'Qualquer jogador de outro clube que aceite vir para cá. Quem não está à venda custa bem mais, e o craque ainda mais.'}</p>
      <Filtros pos={pos} setPos={setPos} div={div} setDiv={setDiv} posso={posso} setPosso={setPosso} nome={soLista ? undefined : nome} setNome={soLista ? undefined : setNome} />
      {sel != null && mundo.jogadores[sel]?.clubeId !== jogo.clubeId && (
        <Negociar key={sel} jogo={jogo} id={sel} fechar={() => setSel(null)} feito={(r) => { if (r.ok) setSel(null); feito(r) }} />
      )}
      {linhas.length === 0 ? <p className="nota">Nenhum jogador com estes filtros.</p> : (
        <div className="tabela-wrap">
          <table className="tabela mercado-tab">
            <thead><tr><th>Pos</th><th>Nome</th><th className="num">Idade</th><th>Força</th><th className="esconde-m">Clube</th><th className="num">Preço</th></tr></thead>
            <tbody>
              {linhas.map(({ j, preco }) => (
                <tr key={j.id} className={`clicavel ${sel === j.id ? 'meu' : ''}`} onClick={() => setSel(j.id)}>
                  <td><span className={`pos pos-${j.posicao}`}>{j.posicao}</span></td>
                  <td><span className="nome-jogador">{j.curto}</span>{j.craque && <span className="craque">craque</span>}</td>
                  <td className="num">{j.idade}</td>
                  <td><Forca valor={j.forca} /></td>
                  <td className="esconde-m"><ClubeCurto jogo={jogo} id={j.clubeId} /></td>
                  <td className="num">{euros(preco)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/** Passo de ajuste com botões − e +: 5% do valor de referência, arredondado. */
function passo(ref: number) {
  const b = ref * 0.05
  const m = b >= 100_000 ? 10_000 : b >= 10_000 ? 1_000 : b >= 1_000 ? 100 : 50
  return Math.max(m, Math.round(b / m) * m)
}

function Ajuste({ rotulo, valor, setValor, base, dica }: { rotulo: string; valor: number; setValor: (v: number) => void; base: number; dica: string }) {
  const p = passo(base)
  return (
    <div className="ajuste">
      <span className="info-t">{rotulo}</span>
      <span className="ajuste-ctl">
        <button className="botao" aria-label={`Baixar ${rotulo}`} onClick={() => setValor(Math.max(p, valor - p))}>−</button>
        <b>{euros(valor)}</b>
        <button className="botao" aria-label={`Subir ${rotulo}`} onClick={() => setValor(valor + p)}>+</button>
      </span>
      <span className="info-d">{dica}</span>
    </div>
  )
}

function Negociar({ jogo, id, fechar, feito }: { jogo: JogoComMercado; id: number; fechar: () => void; feito: (r: Resultado) => void }) {
  const { mundo } = jogo
  const j = mundo.jogadores[id]
  const pedido = precoPedido(jogo, id)
  const sal = pedidoSalarial(mundo, j, jogo.clubeId)
  const [oferta, setOferta] = useState(pedido)
  const [salario, setSalario] = useState(sal)
  const recusa = recusaDoJogador(mundo, j, jogo.clubeId)
  const st = estadoMercado(jogo)
  const jaTentou = st.recusados.includes(id)
  const aberta = janelaAberta(jogo.epoca)
  return (
    <div className="cartao negociar">
      <div className="neg-topo">
        <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
        <span className="neg-nome">{j.nome}</span>
        <Forca valor={j.forca} />
        <button className="botao fantasma fechar" onClick={fechar} aria-label="Fechar">Fechar</button>
      </div>
      <p className="nota">{j.idade} anos · <ClubeCurto jogo={jogo} id={j.clubeId} /> · valor {euros(j.valor)} · ganha {euros(j.salario)}/mês</p>
      {recusa ? <p className="erro">{recusa}</p> : (
        <>
          <div className="neg-ajustes">
            <Ajuste rotulo="Oferta ao clube" valor={oferta} setValor={setOferta} base={pedido} dica={`Pedem ${euros(pedido)}`} />
            <Ajuste rotulo="Salário por mês" valor={salario} setValor={setSalario} base={sal} dica={`Pede ${euros(sal)}`} />
          </div>
          <button className="botao principal" disabled={!aberta || jaTentou} onClick={() => feito(comprar(jogo, id, oferta, salario))}>
            {!aberta ? 'Mercado fechado' : jaTentou ? 'Recusaram nesta jornada' : 'Fazer oferta'}
          </button>
        </>
      )}
    </div>
  )
}

function Propostas({ jogo, feito }: { jogo: JogoComMercado; feito: (r: Resultado) => void }) {
  const st = estadoMercado(jogo)
  const { mundo } = jogo
  if (!st.propostas.length) {
    return <p className="nota">Sem propostas. Os clubes fazem ofertas durante as janelas, sobretudo pelos jogadores que pões à venda. Uma proposta vale até à jornada seguinte.</p>
  }
  return (
    <div className="propostas">
      {st.propostas.map((p) => {
        const j = mundo.jogadores[p.jogadorId]
        const c = mundo.clubes[p.clubeId]
        return (
          <div key={p.id} className="cartao proposta">
            <div className="prop-txt">
              <Emblema clube={c} tamanho={28} />
              <span>
                <b>{c.nome}</b> ({c.divisao}.ª) oferece <b>{euros(p.valor)}</b> por <span className={`pos pos-${j.posicao}`}>{j.posicao}</span> <b>{j.curto}</b> (força {j.forca}, valor {euros(j.valor)})
                {p.espontanea && <span className="dica"> · não estava à venda</span>}
              </span>
            </div>
            <div className="grupo-botoes">
              <button className="botao principal" onClick={() => feito(aceitarProposta(jogo, p.id))}>Aceitar</button>
              <button className="botao" onClick={() => { recusarProposta(jogo, p.id); feito({ ok: true, texto: `Recusaste a proposta do ${c.nome}.` }) }}>Recusar</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Vender({ jogo, feito }: { jogo: JogoComMercado; feito: (r: Resultado) => void }) {
  const { mundo } = jogo
  const st = estadoMercado(jogo)
  const [sel, setSel] = useState<number | null>(null)
  const anuncios = new Map(st.lista.filter((a) => a.meu).map((a) => [a.jogadorId, a]))
  const plantel = mundo.clubes[jogo.clubeId].plantel.map((id) => mundo.jogadores[id])
    .sort((a, b) => ['GR', 'DEF', 'MED', 'AV'].indexOf(a.posicao) - ['GR', 'DEF', 'MED', 'AV'].indexOf(b.posicao) || b.forca - a.forca)
  return (
    <>
      <p className="nota">Põe jogadores à venda para receber propostas, ou em leilão: na jornada seguinte (com a janela aberta) vai para quem der mais, se alguém chegar ao preço base.</p>
      {sel != null && mundo.jogadores[sel]?.clubeId === jogo.clubeId && (
        <Anunciar key={sel} jogo={jogo} id={sel} fechar={() => setSel(null)} feito={(r) => { setSel(null); feito(r) }} />
      )}
      <div className="tabela-wrap">
        <table className="tabela mercado-tab">
          <thead><tr><th>Pos</th><th>Nome</th><th className="num">Idade</th><th>Força</th><th className="num">Valor</th><th>Estado</th></tr></thead>
          <tbody>
            {plantel.map((j) => {
              const a = anuncios.get(j.id)
              return (
                <tr key={j.id} className={`clicavel ${sel === j.id ? 'meu' : ''}`} onClick={() => setSel(j.id)}>
                  <td><span className={`pos pos-${j.posicao}`}>{j.posicao}</span></td>
                  <td><span className="nome-jogador">{j.curto}</span>{j.craque && <span className="craque">craque</span>}</td>
                  <td className="num">{j.idade}</td>
                  <td><Forca valor={j.forca} /></td>
                  <td className="num">{euros(j.valor)}</td>
                  <td>{a ? <span className={`estado-venda ${a.leilao ? 'leilao' : ''}`}>{a.leilao ? 'Leilão' : 'À venda'} · {euros(a.preco)}</span> : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Anunciar({ jogo, id, fechar, feito }: { jogo: JogoComMercado; id: number; fechar: () => void; feito: (r: Resultado) => void }) {
  const j = jogo.mundo.jogadores[id]
  const a = estadoMercado(jogo).lista.find((x) => x.jogadorId === id && x.meu)
  const [preco, setPreco] = useState(a?.preco ?? j.valor)
  return (
    <div className="cartao negociar">
      <div className="neg-topo">
        <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
        <span className="neg-nome">{j.nome}</span>
        <Forca valor={j.forca} />
        <button className="botao fantasma fechar" onClick={fechar} aria-label="Fechar">Fechar</button>
      </div>
      <p className="nota">{j.idade} anos · valor {euros(j.valor)} · ganha {euros(j.salario)}/mês · contrato {j.contrato} {j.contrato === 1 ? 'ano' : 'anos'}</p>
      <div className="neg-ajustes">
        <Ajuste rotulo="Preço" valor={preco} setValor={setPreco} base={j.valor} dica="pedido à venda, ou base do leilão" />
      </div>
      <div className="grupo-botoes">
        <button className="botao principal" onClick={() => feito(porAVenda(jogo, id, preco, false))}>Pôr à venda</button>
        <button className="botao" onClick={() => feito(porAVenda(jogo, id, preco, true))}>Leilão</button>
        {a && <button className="botao" onClick={() => { retirarDaVenda(jogo, id); feito({ ok: true, texto: `${j.curto} saiu da lista de vendas.` }) }}>Retirar</button>}
      </div>
    </div>
  )
}

function Noticias({ jogo }: { jogo: JogoComMercado }) {
  const { mundo } = jogo
  const st = estadoMercado(jogo)
  const lista = [...st.noticias].reverse()
  if (!lista.length) return <p className="nota">Ainda não houve transferências nesta época.</p>
  return (
    <ul className="noticias">
      {lista.map((n, i) => {
        const j = mundo.jogadores[n.jogadorId]
        const minha = n.deId === jogo.clubeId || n.paraId === jogo.clubeId
        if (n.tipo === 'saiu') {
          return <li key={i} className={minha ? 'minha' : ''}><span className="dica">J{n.jornada}</span> <span className={`pos pos-${j?.posicao}`}>{j?.posicao}</span> <b>{j?.curto}</b> ({j?.forca}) acabou contrato com <ClubeCurto jogo={jogo} id={n.deId} /> e ficou livre</li>
        }
        if (n.tipo === 'livre') {
          return <li key={i} className={minha ? 'minha' : ''}><span className="dica">J{n.jornada}</span> <span className={`pos pos-${j?.posicao}`}>{j?.posicao}</span> <b>{j?.curto}</b> ({j?.forca}) assinou pelo <ClubeCurto jogo={jogo} id={n.paraId} /> a custo zero</li>
        }
        if (n.tipo === 'reformou') {
          return <li key={i} className={minha ? 'minha' : ''}><span className="dica">J{n.jornada}</span> <b>{j?.curto}</b> ({j?.idade} anos) terminou a carreira no <ClubeCurto jogo={jogo} id={n.deId} /></li>
        }
        if (n.tipo === 'renovou') {
          return <li key={i} className="minha"><span className="dica">J{n.jornada}</span> <b>{j?.curto}</b> renovou por 1 ano: sem ele o plantel ficava curto.</li>
        }
        if (n.deId === n.paraId) {
          return <li key={i} className="minha"><span className="dica">J{n.jornada}</span> Leilão de <b>{j?.curto}</b> sem lances suficientes: continua no plantel.</li>
        }
        return (
          <li key={i} className={minha ? 'minha' : ''}>
            <span className="dica">J{n.jornada}</span> <span className={`pos pos-${j?.posicao}`}>{j?.posicao}</span> <b>{j?.curto}</b> ({j?.forca})
            {' '}<ClubeCurto jogo={jogo} id={n.deId} /> → <ClubeCurto jogo={jogo} id={n.paraId} /> · <b>{euros(n.valor)}</b>{n.leilao ? ' em leilão' : ''}
          </li>
        )
      })}
    </ul>
  )
}

/** Quantos jogadores meus acabam contrato no fim desta época. */
function aAcabar(jogo: JogoComMercado): number {
  return jogo.mundo.clubes[jogo.clubeId].plantel.filter((id) => jogo.mundo.jogadores[id].contrato <= 1).length
}

function Contratos({ jogo, feito }: { jogo: JogoComMercado; feito: (r: Resultado) => void }) {
  const { mundo } = jogo
  const [sel, setSel] = useState<number | null>(null)
  const [anos, setAnos] = useState(2)
  const plantel = mundo.clubes[jogo.clubeId].plantel.map((id) => mundo.jogadores[id]).sort((a, b) => a.contrato - b.contrato || b.forca - a.forca)
  const j = sel != null ? mundo.jogadores[sel] : null
  return (
    <>
      <p className="nota">Quem chega ao fim do contrato sai a custo zero no fim da época. Renova a tempo os que queres manter (é possível com 2 anos ou menos de contrato).</p>
      {j && j.clubeId === jogo.clubeId && (
        <div className="cartao negociar">
          <div className="neg-topo">
            <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
            <span className="neg-nome">{j.nome}</span>
            <Forca valor={j.forca} />
            <button className="botao fantasma fechar" onClick={() => setSel(null)}>Fechar</button>
          </div>
          <p className="nota">{j.idade} anos · ganha {euros(j.salario)}/mês · contrato {j.contrato} {j.contrato === 1 ? 'ano' : 'anos'}</p>
          {j.contrato > 2 ? <p className="nota">Ainda é cedo para renovar.</p> : (
            <>
              <p>Pede <b>{euros(pedidoRenovacao(mundo, j))}</b> por mês.</p>
              <div className="grupo-botoes">
                {Array.from({ length: anosMaximos(j) }, (_, k) => k + 1).map((a) => (
                  <button key={a} className={`botao ${Math.min(anos, anosMaximos(j)) === a ? 'ativo' : ''}`} onClick={() => setAnos(a)}>{a} {a === 1 ? 'ano' : 'anos'}</button>
                ))}
              </div>
              <button className="botao principal" onClick={() => { feito(renovar(jogo, j.id, Math.min(anos, anosMaximos(j)))); setSel(null) }}>Renovar</button>
            </>
          )}
        </div>
      )}
      <div className="tabela-wrap">
        <table className="tabela mercado-tab">
          <thead><tr><th>Pos</th><th>Nome</th><th className="num">Idade</th><th>Força</th><th className="num esconde-m">Salário</th><th className="num">Contrato</th></tr></thead>
          <tbody>
            {plantel.map((x) => (
              <tr key={x.id} className={`clicavel ${sel === x.id ? 'meu' : ''}`} onClick={() => setSel(x.id)}>
                <td><span className={`pos pos-${x.posicao}`}>{x.posicao}</span></td>
                <td><span className="nome-jogador">{x.curto}</span>{x.craque && <span className="craque">craque</span>}</td>
                <td className="num">{x.idade}</td>
                <td><Forca valor={x.forca} /></td>
                <td className="num esconde-m">{euros(x.salario)}</td>
                <td className={`num ${x.contrato <= 1 ? 'acaba' : ''}`}>{x.contrato <= 1 ? 'acaba' : `${x.contrato} anos`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Livres({ jogo, feito }: { jogo: JogoComMercado; feito: (r: Resultado) => void }) {
  const { mundo } = jogo
  const [pos, setPos] = useState<Posicao | 'todas'>('todas')
  const [sel, setSel] = useState<number | null>(null)
  const lista = livres(jogo).filter((j) => pos === 'todas' || j.posicao === pos).sort((a, b) => b.forca - a.forca).slice(0, MAX_LINHAS)
  const j = sel != null ? mundo.jogadores[sel] : null
  return (
    <>
      <p className="nota">Jogadores sem clube, que acabaram contrato. Não pagas transferência, só o salário e um prémio de assinatura de dois meses.</p>
      <div className="grupo-botoes">
        {POS.map((p) => <button key={p} className={`botao ${pos === p ? 'ativo' : ''}`} onClick={() => setPos(p)}>{p === 'todas' ? 'Todas' : p}</button>)}
      </div>
      {j && j.clubeId === 0 && <AssinarLivre key={j.id} jogo={jogo} j={j} fechar={() => setSel(null)} feito={(r) => { if (r.ok) setSel(null); feito(r) }} />}
      {lista.length === 0 ? <p className="nota">Não há jogadores livres{pos !== 'todas' ? ' nesta posição' : ''}. Aparecem no início de cada época.</p> : (
        <div className="tabela-wrap">
          <table className="tabela mercado-tab">
            <thead><tr><th>Pos</th><th>Nome</th><th className="num">Idade</th><th>Força</th><th className="num">Pede</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className={`clicavel ${sel === x.id ? 'meu' : ''}`} onClick={() => setSel(x.id)}>
                  <td><span className={`pos pos-${x.posicao}`}>{x.posicao}</span></td>
                  <td><span className="nome-jogador">{x.curto}</span></td>
                  <td className="num">{x.idade}</td>
                  <td><Forca valor={x.forca} /></td>
                  <td className="num">{euros(pedidoLivre(mundo, x, jogo.clubeId))}/mês</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function AssinarLivre({ jogo, j, fechar, feito }: { jogo: JogoComMercado; j: Jogador; fechar: () => void; feito: (r: Resultado) => void }) {
  const pede = pedidoLivre(jogo.mundo, j, jogo.clubeId)
  const [salario, setSalario] = useState(pede)
  const [anos, setAnos] = useState(Math.min(2, anosMaximos(j)))
  const aberta = janelaAberta(jogo.epoca)
  return (
    <div className="cartao negociar">
      <div className="neg-topo">
        <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
        <span className="neg-nome">{j.nome}</span>
        <Forca valor={j.forca} />
        <button className="botao fantasma fechar" onClick={fechar}>Fechar</button>
      </div>
      <p className="nota">{j.idade} anos · livre · ganhava {euros(j.salario)}/mês</p>
      <div className="neg-ajustes">
        <Ajuste rotulo="Salário por mês" valor={salario} setValor={setSalario} base={pede} dica={`Pede ${euros(pede)} · prémio ${euros(premioAssinatura(salario))}`} />
      </div>
      <div className="grupo-botoes">
        {Array.from({ length: anosMaximos(j) }, (_, k) => k + 1).map((a) => (
          <button key={a} className={`botao ${anos === a ? 'ativo' : ''}`} onClick={() => setAnos(a)}>{a} {a === 1 ? 'ano' : 'anos'}</button>
        ))}
      </div>
      <button className="botao principal" disabled={!aberta} onClick={() => feito(contratarLivre(jogo, j.id, salario, anos))}>{aberta ? 'Contratar' : 'Mercado fechado'}</button>
    </div>
  )
}

function Juniores({ jogo, feito }: { jogo: JogoComMercado; feito: (r: Resultado) => void }) {
  const lista = juniores(jogo)
  const div = jogo.mundo.clubes[jogo.clubeId].divisao
  return (
    <>
      <p className="nota">Todos os anos a formação do clube dá {lista.length || 'alguns'} juniores. Promove-os ao plantel (contrato de 3 anos) ou dispensa-os. Os que ficarem sem decisão saem livres quando fechar a janela de verão. O potencial é a opinião dos treinadores da formação, não uma certeza.</p>
      {lista.length === 0 ? <p className="nota">Não há juniores à espera. A próxima fornada chega no início da próxima época.</p> : (
        <div className="propostas">
          {lista.map((j) => (
            <div key={j.id} className="cartao proposta">
              <div className="neg-topo">
                <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
                <span className="neg-nome">{j.nome}</span>
                <Forca valor={j.forca} />
              </div>
              <p className="nota">{j.idade} anos · potencial <b className={`pot pot-${potencialTexto(j, jogo.mundo, jogo.clubeId)}`}>{potencialTexto(j, jogo.mundo, jogo.clubeId)}</b> · ganharia {euros(salarioDe(j.forca, div))}/mês</p>
              <div className="grupo-botoes">
                <button className="botao principal" onClick={() => feito(promoverJunior(jogo, j.id))}>Promover</button>
                <button className="botao" onClick={() => feito(dispensarJunior(jogo, j.id))}>Dispensar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
