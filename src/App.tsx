import { useState } from 'react'
import { forcaClube, gerarMundo } from './core/mundo'
import { euros, lugares } from './core/formato'
import type { Jogo, Mundo } from './core/types'
import { apagar, carregar, gravar } from './jogo/gravar'
import { Emblema } from './ui/Emblema'
import { Forca, Plantel } from './ui/Plantel'

type Ecra = 'inicio' | 'escolher' | 'jogo'
type Separador = 'plantel' | 'clube' | 'divisoes'

export default function App() {
  const [jogo, setJogo] = useState<Jogo | null>(() => carregar())
  const [mundoNovo, setMundoNovo] = useState<{ mundo: Mundo; treinador: string } | null>(null)
  const [ecra, setEcra] = useState<Ecra>(() => (carregar() ? 'jogo' : 'inicio'))

  if (ecra === 'inicio' || (ecra === 'jogo' && !jogo)) {
    return (
      <Inicio
        temJogo={!!jogo}
        continuar={() => setEcra('jogo')}
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
          const j: Jogo = { mundo: mundoNovo.mundo, treinador: mundoNovo.treinador, clubeId, criado: new Date().toISOString() }
          gravar(j)
          setJogo(j)
          setMundoNovo(null)
          setEcra('jogo')
        }}
      />
    )
  }
  return <Principal jogo={jogo!} sair={() => setEcra('inicio')} />
}

function Rodape() {
  return <footer className="rodape">Mister-foot · {__VERSAO__} · clubes e jogadores fictícios</footer>
}

function Inicio({ temJogo, continuar, novo }: { temJogo: boolean; continuar: () => void; novo: (t: string, s: number) => void }) {
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

function Principal({ jogo, sair }: { jogo: Jogo; sair: () => void }) {
  const { mundo } = jogo
  const meu = mundo.clubes[jogo.clubeId]
  const [sep, setSep] = useState<Separador>('plantel')
  const [div, setDiv] = useState(meu.divisao)
  const [verClube, setVerClube] = useState<number | null>(null)

  return (
    <div className="ecra jogo">
      <header className="topo clube-topo" style={{ borderColor: meu.cores[0] }}>
        <Emblema clube={meu} tamanho={44} />
        <div className="topo-info">
          <h2>{meu.nome}</h2>
          <span className="topo-det">{mundo.divisoes[meu.divisao - 1].nome} · Época {mundo.epoca}/{String(mundo.epoca + 1).slice(2)} · Mister {jogo.treinador}</span>
        </div>
        <div className="topo-dinheiro" title="Dinheiro em caixa">{euros(meu.dinheiro)}</div>
      </header>
      <nav className="separadores principal-nav">
        <button className={sep === 'plantel' ? 'ativo' : ''} onClick={() => setSep('plantel')}>Plantel</button>
        <button className={sep === 'clube' ? 'ativo' : ''} onClick={() => setSep('clube')}>Clube</button>
        <button className={sep === 'divisoes' ? 'ativo' : ''} onClick={() => { setSep('divisoes'); setVerClube(null) }}>Divisões</button>
        <button className="sair" onClick={sair}>Menu</button>
      </nav>

      {sep === 'plantel' && <Plantel mundo={mundo} clubeId={meu.id} />}

      {sep === 'clube' && (
        <div className="cartoes-info">
          <Info t="Estádio" v={meu.estadio.nome} d={`${lugares(meu.estadio.lugares)} lugares`} />
          <Info t="Bilhete" v={euros(meu.bilhete)} d="preço por jogo em casa" />
          <Info t="Dinheiro" v={euros(meu.dinheiro)} d="em caixa" />
          <Info t="Massa salarial" v={euros(meu.plantel.reduce((s, id) => s + mundo.jogadores[id].salario, 0))} d="por mês" />
          <Info t="Valor do plantel" v={euros(meu.plantel.reduce((s, id) => s + mundo.jogadores[id].valor, 0))} d={`${meu.plantel.length} jogadores`} />
          <Info t="Reputação" v={`${meu.reputacao}/100`} d={meu.cidade} />
          <Info t="Força do onze" v={String(forcaClube(mundo, meu.id))} d="média dos 11 melhores" />
        </div>
      )}

      {sep === 'divisoes' && !verClube && (
        <>
          <Divisoes mundo={mundo} div={div} setDiv={setDiv} />
          <p className="nota">Ainda sem jogos: os clubes aparecem ordenados pela força do onze.</p>
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
          </div>
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
