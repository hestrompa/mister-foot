import { useState } from 'react'
import { forcaClube, gerarMundo, NOMES_DIVISAO } from './core/mundo'
import { salariosPorJornada } from './core/financas'
import { ObrasBanco } from './ui/ObrasBanco'
import { AbrirCopia, descarregarCopia } from './ui/CopiaSeguranca'
import { AvisoConquistas } from './ui/Conquistas'
import { verificarConquistas } from './core/conquistas'
import { avancarInvestidores } from './core/investidores'
import { avancarPremiosJogo } from './core/premios-jogo'
import { avancarTreinadorMes, JORNADAS_MES } from './core/treinador-mes'
import { AvisoInvestidor } from './ui/InicioEpoca'
import { euros, lugares } from './core/formato'
import type { Jogo, Mundo } from './core/types'
import type { Escalacao } from './core/partida'
import { epocaTerminada, fecharEpoca, indisponiveisDe, tabela } from './core/epoca'
import { escalarAuto } from './core/motor'
import { apagar, carregar, gravar, prepararEpoca } from './jogo/gravar'
import { Emblema } from './ui/Emblema'
import { Dicas } from './ui/Dicas'
import { Forca, Plantel } from './ui/Plantel'
import { PreJogo } from './ui/PreJogo'
import { AoVivo } from './ui/AoVivo'
import { Calendario } from './ui/Calendario'
import { FimEpoca, type DadosFimEpoca } from './ui/FimEpoca'
import { TabelaLiga } from './ui/comum'
import { Mercado, propostasPendentes } from './ui/Mercado'
import { avancarMercado } from './core/mercado'
import { avancarTaca, meuJogoPendente, registarCampeao, type JogoComTaca } from './core/taca'
import { Staff } from './ui/Staff'
import { AoVivoTaca, TacaSeparador, avisoTaca } from './ui/Taca'
import { avancarEuropa, meuJogoEuropa, mundoEuropa, qualificarEuropa, type JogoComEuropa } from './core/europa'
import { AoVivoEuropa, EuropaSeparador, avisoEuropa } from './ui/Europa'

import { avancarDirecao } from './core/direcao'
import { avancarBalneario } from './core/balneario-acoes'
import { avancarSelecao } from './core/selecao'
import { Balneario, conflitosPendentes } from './ui/Balneario'
import { registarFichas } from './core/fichas'
import { avancarImprensa, noticiaExtra, noticiasPorLer } from './core/imprensa'
import { AvisoRival, ConferenciaCartao, Noticias } from './ui/Imprensa'
import { Historia } from './ui/Historia'
import { EditarClube } from './ui/EditarClube'
import { AvisoDirecao, Carreira, Despedido, despedido, ofertasPendentes } from './ui/Carreira'

type Ecra = 'inicio' | 'escolher' | 'jogo'
type Separador = 'jogo' | 'plantel' | 'balneario' | 'staff' | 'mercado' | 'taca' | 'europa' | 'classificacao' | 'calendario' | 'clube' | 'carreira' | 'divisoes' | 'noticias' | 'historia'

export default function App() {
  const [jogo, setJogo] = useState<Jogo | null>(() => carregar())
  const [mundoNovo, setMundoNovo] = useState<{ mundo: Mundo; treinador: string } | null>(null)
  const [ecra, setEcra] = useState<Ecra>(() => (jogo ? 'jogo' : 'inicio'))
  const atualizar = (j: Jogo) => { gravar(j); setJogo({ ...j }) }

  if (ecra === 'inicio' || (ecra === 'jogo' && !jogo)) {
    return (
      <Inicio
        temJogo={!!jogo}
        continuar={() => setEcra('jogo')}
        copia={jogo ? () => descarregarCopia(jogo) : undefined}
        aberto={() => { const j = carregar(); if (j) { setJogo(j); setEcra('jogo') } }}
        novo={(treinador, semente) => {
          setMundoNovo({ mundo: gerarMundo(semente), treinador })
          setEcra('escolher')
        }}
      />
    )
  }
  if (ecra === 'escolher' && mundoNovo) {
    return (
      <EscolherClube
        mundo={mundoNovo.mundo}
        voltar={() => setEcra('inicio')}
        escolher={(clubeId) => {
          const j = prepararEpoca({ mundo: mundoNovo.mundo, treinador: mundoNovo.treinador, clubeId, criado: new Date().toISOString() } as Jogo)
          gravar(j)
          setJogo(j)
          setMundoNovo(null)
          setEcra('jogo')
        }}
      />
    )
  }
  return <Principal jogo={jogo!} atualizar={atualizar} sair={() => setEcra('inicio')} />
}

function Rodape() {
  return <footer className="rodape">Mister-foot · {__VERSAO__} · clubes e jogadores fictícios</footer>
}

function Inicio({ temJogo, continuar, novo, copia, aberto }: { temJogo: boolean; continuar: () => void; novo: (t: string, s: number) => void; copia?: () => void; aberto: () => void }) {
  const [treinador, setTreinador] = useState('')
  const [semente, setSemente] = useState('')
  return (
    <div className="ecra inicio">
      <div className="logo">
        <img src="./favicon.svg" alt="" width={72} height={72} />
        <h1>Mister-foot</h1>
        <p className="lema">Só mais uma jornada.</p>
      </div>
      {temJogo && (
        <button className="botao principal grande" onClick={continuar}>Continuar carreira</button>
      )}
      <form
        className="cartao novo-jogo"
        onSubmit={(e) => {
          e.preventDefault()
          if (temJogo && !confirm('Começar um jogo novo apaga a carreira atual. Continuar?')) return
          apagar()
          const s = semente.trim() ? Number(semente.replace(/\D/g, '')) || 1 : Math.floor(Math.random() * 1e9)
          novo(treinador.trim() || 'Mister', s)
        }}
      >
        <h2>Novo jogo</h2>
        <label>
          O teu nome
          <input value={treinador} onChange={(e) => setTreinador(e.target.value)} placeholder="Mister" maxLength={30} />
        </label>
        <label>
          Semente do mundo <span className="dica">(opcional: o mesmo número gera o mesmo mundo)</span>
          <input value={semente} onChange={(e) => setSemente(e.target.value)} inputMode="numeric" placeholder="aleatória" maxLength={10} />
        </label>
        <button className="botao principal" type="submit">Gerar mundo</button>
      </form>
      <div className="cartao copia-seguranca">
        <h2>Cópia de segurança</h2>
        <p className="dica">A carreira fica gravada neste browser. Guarda uma cópia num ficheiro para a passar para outro aparelho ou não a perder se limpares o browser.</p>
        <div className="copia-botoes">
          {copia && <button type="button" className="botao" onClick={copia}>Guardar cópia num ficheiro</button>}
          <AbrirCopia temJogo={temJogo} aberto={aberto} />
        </div>
      </div>
      <Rodape />
    </div>
  )
}

function EscolherClube({ mundo, escolher, voltar }: { mundo: Mundo; escolher: (id: number) => void; voltar: () => void }) {
  const [div, setDiv] = useState(4)
  const [sel, setSel] = useState<number | null>(null)
  const d = mundo.divisoes[div - 1]
  const clubes = d.clubes.map((id) => mundo.clubes[id]).sort((a, b) => forcaClube(mundo, b.id) - forcaClube(mundo, a.id))
  return (
    <div className="ecra">
      <header className="topo">
        <button className="botao fantasma" onClick={voltar}>Voltar</button>
        <h2>Escolhe o teu clube</h2>
      </header>
      <p className="nota">Começar na 4.ª Divisão e subir até ao topo é a forma clássica de jogar. Podes começar onde quiseres.</p>
      <Divisoes mundo={mundo} div={div} setDiv={(n) => { setDiv(n); setSel(null) }} />
      <div className="grelha-clubes">
        {clubes.map((c) => (
          <button key={c.id} className={`cartao clube ${sel === c.id ? 'sel' : ''}`} onClick={() => setSel(c.id)}>
            <Emblema clube={c} />
            <span className="clube-info">
              <span className="clube-nome">{c.nome}</span>
              <span className="clube-det">{lugares(c.estadio.lugares)} lugares · {euros(c.dinheiro)}</span>
            </span>
            <Forca valor={forcaClube(mundo, c.id)} />
          </button>
        ))}
      </div>
      {sel && (
        <div className="barra-acao">
          <span>{mundo.clubes[sel].nome}</span>
          <button className="botao principal" onClick={() => escolher(sel)}>Assinar contrato</button>
        </div>
      )}
      <Rodape />
    </div>
  )
}

function Divisoes({ mundo, div, setDiv }: { mundo: Mundo; div: number; setDiv: (n: number) => void }) {
  return (
    <nav className="separadores" aria-label="Divisões">
      {mundo.divisoes.map((d) => (
        <button key={d.numero} className={div === d.numero ? 'ativo' : ''} onClick={() => setDiv(d.numero)}>{d.nome}</button>
      ))}
    </nav>
  )
}

function Principal({ jogo, sair, atualizar }: { jogo: Jogo; sair: () => void; atualizar: (j: Jogo) => void }) {
  const { mundo } = jogo
  const meu = mundo.clubes[jogo.clubeId]
  const [sep, setSep] = useState<Separador>('jogo')
  const [div, setDiv] = useState(meu.divisao)
  const [verClube, setVerClube] = useState<number | null>(null)
  const [editar, setEditar] = useState<number | null>(null)
  const [aoVivo, setAoVivo] = useState<string | null>(null)
  const [tacaVivo, setTacaVivo] = useState<string | null>(null)
  const pendTaca = meuJogoPendente(jogo as JogoComTaca)
  const [euVivo, setEuVivo] = useState<string | null>(null)
  const pendEu = pendTaca ? null : meuJogoEuropa(jogo as JogoComEuropa)
  const [fim, setFim] = useState<DadosFimEpoca | null>(null)

  const mudarEscalacao = (e: Escalacao) => atualizar({ ...jogo, escalacao: e })

  const aposJornada = () => {
    setAoVivo(null)
    setSep('jogo')
    registarFichas(jogo)
    avancarMercado(jogo)
    avancarTaca(jogo as JogoComTaca)
    avancarEuropa(jogo as JogoComEuropa)
    avancarBalneario(jogo)
    avancarPremiosJogo(jogo)
    avancarSelecao(jogo)
    avancarDirecao(jogo)
    for (const i of avancarInvestidores(mundo, jogo.epoca)) {
      const c = mundo.clubes[i.clubeId]
      noticiaExtra(jogo, i.clubeId === jogo.clubeId ? 'meu' : 'liga', `${c.nome}: ${i.nome} investe ${euros(i.valor)}`, `Os bons resultados na ${NOMES_DIVISAO[c.divisao - 1] ?? 'divisão'} convenceram os investidores. O dinheiro já está na conta do clube.`)
    }
    avancarImprensa(jogo)
    for (const pr of avancarTreinadorMes(jogo)) {
      const meu = pr.clubeId === jogo.clubeId
      if (!meu && pr.divisao !== mundo.clubes[jogo.clubeId].divisao) continue
      noticiaExtra(jogo, meu ? 'meu' : 'liga', meu ? `Mister ${jogo.treinador} é o treinador do mês!` : `Treinador do mês: ${mundo.clubes[pr.clubeId].nome}`, `${pr.pontos} pontos em ${JORNADAS_MES} jornadas na ${NOMES_DIVISAO[pr.divisao - 1] ?? 'divisão'}.${meu ? ' A direção gostou.' : ''}`)
    }
    verificarConquistas(jogo)
    if (!epocaTerminada(jogo.epoca) && despedido(jogo)) { atualizar(jogo); return }
    if (!epocaTerminada(jogo.epoca)) {
      // Lesionados ou castigados no onze: refaz a escalação mantendo formação e postura.
      const ind = indisponiveisDe(mundo, jogo.epoca, jogo.clubeId)
      if (jogo.escalacao.titulares.some((id) => ind.has(id))) {
        atualizar({ ...jogo, escalacao: { ...escalarAuto(mundo, jogo.clubeId, ind, jogo.escalacao.formacao), postura: jogo.escalacao.postura } })
      }
      return
    }
    const divisaoAntes = meu.divisao
    const posicao = tabela(mundo, jogo.epoca, divisaoAntes).findIndex((l) => l.clubeId === meu.id) + 1
    qualificarEuropa(jogo as JogoComEuropa)
    const resumo = fecharEpoca(mundo, jogo.epoca)
    registarCampeao(jogo as JogoComTaca, resumo.campeoes)
    prepararEpoca(jogo)
    atualizar(jogo)
    setDiv(mundo.clubes[jogo.clubeId].divisao)
    setFim({ resumo, posicao, divisaoAntes, divisaoDepois: mundo.clubes[jogo.clubeId].divisao })
  }

  const cabecalho = (
    <header className="topo clube-topo" style={{ borderColor: meu.cores[0] }}>
      <Emblema clube={meu} tamanho={44} />
      <div className="topo-info">
        <h2>{meu.nome}</h2>
        <span className="topo-det">{mundo.divisoes[meu.divisao - 1].nome} · Época {mundo.epoca}/{String(mundo.epoca + 1).slice(2)} · Mister {jogo.treinador}</span>
      </div>
      <div className="topo-dinheiro" title="Dinheiro em caixa">{euros(meu.dinheiro)}</div>
    </header>
  )

  if (fim) {
    return <div className="ecra jogo">{cabecalho}<FimEpoca jogo={jogo} d={fim} continuar={() => setFim(null)} /></div>
  }
  if (tacaVivo) {
    return (
      <div className="ecra jogo ecra-vivo">
        <AoVivoTaca key={tacaVivo} jogo={jogo as JogoComTaca} guardar={() => atualizar(jogo)} continuar={() => {
          setTacaVivo(null)
          setSep('jogo')
          avancarTaca(jogo as JogoComTaca)
          registarFichas(jogo)
          avancarEuropa(jogo as JogoComEuropa)
          const ind = indisponiveisDe(mundo, jogo.epoca, jogo.clubeId)
          if (jogo.escalacao.titulares.some((id) => ind.has(id))) {
            atualizar({ ...jogo, escalacao: { ...escalarAuto(mundo, jogo.clubeId, ind, jogo.escalacao.formacao), postura: jogo.escalacao.postura } })
          } else atualizar(jogo)
        }} />
      </div>
    )
  }
  if (euVivo) {
    return (
      <div className="ecra jogo ecra-vivo">
        <AoVivoEuropa key={euVivo} jogo={jogo as JogoComEuropa} guardar={() => atualizar(jogo)} continuar={() => {
          setEuVivo(null)
          setSep('jogo')
          avancarEuropa(jogo as JogoComEuropa)
          avancarTaca(jogo as JogoComTaca)
          registarFichas(jogo)
          const ind = indisponiveisDe(mundo, jogo.epoca, jogo.clubeId)
          if (jogo.escalacao.titulares.some((id) => ind.has(id))) {
            atualizar({ ...jogo, escalacao: { ...escalarAuto(mundo, jogo.clubeId, ind, jogo.escalacao.formacao), postura: jogo.escalacao.postura } })
          } else atualizar(jogo)
        }} />
      </div>
    )
  }
  const mudouClube = () => { setSep('jogo'); setVerClube(null); setDiv(mundo.clubes[jogo.clubeId].divisao) }
  if (despedido(jogo) && !aoVivo) {
    return <div className="ecra jogo">{cabecalho}<Despedido jogo={jogo} atualizar={atualizar} mudouClube={mudouClube} /><Rodape /></div>
  }
  if (aoVivo) {
    return (
      <div className="ecra jogo ecra-vivo">
        <AoVivo key={aoVivo} jogo={jogo} guardar={() => atualizar(jogo)} continuar={aposJornada} />
      </div>
    )
  }

  return (
    <div className="ecra jogo">
      {cabecalho}
      <nav className="separadores principal-nav">
        {([['jogo', 'Jogo'], ['plantel', 'Plantel'], ['balneario', conflitosPendentes(jogo) ? `Balneário (${conflitosPendentes(jogo)})` : 'Balneário'], ['staff', 'Staff'], ['mercado', `Mercado${propostasPendentes(jogo) ? ` (${propostasPendentes(jogo)})` : ''}`], ['taca', pendTaca ? 'Taça (!)' : 'Taça'], ['europa', pendEu ? 'Europa (!)' : 'Europa'], ['classificacao', 'Classificação'], ['calendario', 'Calendário'], ['clube', 'Clube'], ['carreira', `Carreira${ofertasPendentes(jogo) ? ` (${ofertasPendentes(jogo)})` : ''}`], ['divisoes', 'Divisões'], ['noticias', `Imprensa${noticiasPorLer(jogo) ? ` (${noticiasPorLer(jogo)})` : ''}`], ['historia', 'História']] as [Separador, string][]).map(([k, t]) => (
          <button key={k} className={sep === k ? 'ativo' : ''} onClick={() => { setSep(k); setVerClube(null); setEditar(null) }}>{t}</button>
        ))}
        <button className="sair" onClick={sair}>Menu</button>
      </nav>

      <Dicas sep={sep} />

      {sep === 'jogo' && <AvisoDirecao jogo={jogo} abrir={() => setSep('carreira')} />}
      {sep === 'jogo' && <AvisoConquistas jogo={jogo} atualizar={atualizar} />}
      {sep === 'jogo' && <AvisoInvestidor jogo={jogo} />}
      {sep === 'jogo' && !pendTaca && !pendEu && <><AvisoRival jogo={jogo} /><ConferenciaCartao jogo={jogo} atualizar={atualizar} /></>}
      {sep === 'jogo' && (pendTaca
        ? <PreJogo key="taca" jogo={jogo} mudar={mudarEscalacao} outro={avisoTaca(jogo as JogoComTaca, pendTaca.ronda, pendTaca.partida)} jogar={() => setTacaVivo(`${jogo.epoca.ano}-${pendTaca.partida.id}`)} />
        : pendEu
          ? <PreJogo key="europa" jogo={{ ...jogo, mundo: mundoEuropa(jogo as JogoComEuropa) }} mudar={mudarEscalacao} outro={avisoEuropa(jogo as JogoComEuropa, pendEu.comp, pendEu.ronda, pendEu.partida, pendEu.dia)} jogar={() => setEuVivo(`${jogo.epoca.ano}-${pendEu.partida.id}`)} />
          : <PreJogo jogo={jogo} mudar={mudarEscalacao} jogar={() => setAoVivo(`${jogo.epoca.ano}-${jogo.epoca.jornada}`)} />)}

      {sep === 'taca' && <TacaSeparador jogo={jogo as JogoComTaca} />}

      {sep === 'europa' && <EuropaSeparador jogo={jogo as JogoComEuropa} />}

      {sep === 'classificacao' && (
        <>
          <Divisoes mundo={mundo} div={div} setDiv={setDiv} />
          <TabelaLiga mundo={mundo} linhas={tabela(mundo, jogo.epoca, div)} divisao={div} meuId={meu.id} />
          <p className="nota"><span className="leg sobe">■</span> subida · <span className="leg desce">■</span> descida</p>
        </>
      )}

      {sep === 'calendario' && <Calendario jogo={jogo} />}

      {sep === 'noticias' && <Noticias jogo={jogo} atualizar={atualizar} />}
      {sep === 'historia' && <Historia jogo={jogo} />}
      {sep === 'carreira' && <Carreira jogo={jogo} atualizar={atualizar} mudouClube={mudouClube} />}

      {sep === 'plantel' && <Plantel mundo={mundo} clubeId={meu.id} />}

      {sep === 'staff' && <Staff jogo={jogo} atualizar={atualizar} />}

      {sep === 'balneario' && <Balneario jogo={jogo} atualizar={atualizar} />}

      {sep === 'mercado' && <Mercado jogo={jogo} atualizar={atualizar} />}

      {sep === 'clube' && (editar === meu.id
        ? <EditarClube jogo={jogo} clubeId={meu.id} atualizar={atualizar} fechar={() => setEditar(null)} />
        : <button className="botao ed-abrir" onClick={() => setEditar(meu.id)}>Editar nome, cores e emblema</button>)}
      {sep === 'clube' && (
        <div className="cartoes-info">
          <Info t="Estádio" v={meu.estadio.nome} d={`${lugares(meu.estadio.lugares)} lugares`} />
          <div className="cartao info">
            <span className="info-t">Bilhete</span>
            <span className="info-v bilhete-ctl">
              <button className="botao" aria-label="Baixar preço" onClick={() => { meu.bilhete = Math.max(1, meu.bilhete - 1); atualizar(jogo) }}>−</button>
              {euros(meu.bilhete)}
              <button className="botao" aria-label="Subir preço" onClick={() => { meu.bilhete = Math.min(100, meu.bilhete + 1); atualizar(jogo) }}>+</button>
            </span>
            <span className="info-d">mais caro rende mais por adepto, mas vai menos gente</span>
          </div>
          <Info t="Salários" v={euros(salariosPorJornada(mundo, meu.id))} d="por jornada" />
          <Info t="Dinheiro" v={euros(meu.dinheiro)} d="em caixa" />
          <Info t="Massa salarial" v={euros(meu.plantel.reduce((s, id) => s + mundo.jogadores[id].salario, 0))} d="por mês" />
          <Info t="Valor do plantel" v={euros(meu.plantel.reduce((s, id) => s + mundo.jogadores[id].valor, 0))} d={`${meu.plantel.length} jogadores`} />
          <Info t="Reputação" v={`${meu.reputacao}/100`} d={meu.cidade} />
          <Info t="Força do onze" v={String(forcaClube(mundo, meu.id))} d="média dos 11 melhores" />
        </div>
      )}
      {sep === 'clube' && <ObrasBanco jogo={jogo} atualizar={atualizar} />}

      {sep === 'divisoes' && !verClube && (
        <>
          <Divisoes mundo={mundo} div={div} setDiv={setDiv} />
          <p className="nota">Clubes ordenados pela força do onze. Toca num clube para ver o plantel.</p>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>#</th><th>Clube</th><th>Força</th><th className="num esconde-m">Estádio</th><th className="num">Dinheiro</th></tr></thead>
              <tbody>
                {mundo.divisoes[div - 1].clubes
                  .map((id) => mundo.clubes[id])
                  .sort((a, b) => forcaClube(mundo, b.id) - forcaClube(mundo, a.id))
                  .map((c, i) => (
                    <tr key={c.id} className={`clicavel ${c.id === meu.id ? 'meu' : ''}`} onClick={() => setVerClube(c.id)}>
                      <td className="num">{i + 1}</td>
                      <td><span className="clube-linha"><Emblema clube={c} tamanho={22} /> {c.nome}</span></td>
                      <td><Forca valor={forcaClube(mundo, c.id)} /></td>
                      <td className="num esconde-m">{lugares(c.estadio.lugares)}</td>
                      <td className="num">{euros(c.dinheiro)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {sep === 'divisoes' && verClube && (
        <>
          <div className="topo outro-clube">
            <button className="botao fantasma" onClick={() => setVerClube(null)}>Voltar</button>
            <Emblema clube={mundo.clubes[verClube]} tamanho={32} />
            <h3>{mundo.clubes[verClube].nome}</h3>
            {editar !== verClube && <button className="botao fantasma" onClick={() => setEditar(verClube)}>Editar</button>}
          </div>
          {editar === verClube && <EditarClube jogo={jogo} clubeId={verClube} atualizar={atualizar} fechar={() => setEditar(null)} />}
          <Plantel mundo={mundo} clubeId={verClube} />
        </>
      )}
      <Rodape />
    </div>
  )
}

function Info({ t, v, d }: { t: string; v: string; d: string }) {
  return (
    <div className="cartao info">
      <span className="info-t">{t}</span>
      <span className="info-v">{v}</span>
      <span className="info-d">{d}</span>
    </div>
  )
}
