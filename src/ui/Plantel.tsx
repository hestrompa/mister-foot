import { Fragment, useMemo, useState } from 'react'
import type { Jogador, Mundo, Posicao } from '../core/types'
import { euros } from '../core/formato'
import { ATRIBUTOS, NOME_ATRIBUTO, atributo, atributosDe, pontosFortes, type Atributo } from '../core/atributos'
import { AtributosJogador, PontoForte } from './Atributos'
import { Carater, CarreiraJogador } from './CarreiraJogador'
import type { EstadoEpoca } from '../core/partida'

type Coluna = 'posicao' | 'nome' | 'idade' | 'forca' | 'atr' | 'valor' | 'salario' | 'contrato'
const ORDEM_POS: Record<Posicao, number> = { GR: 0, DEF: 1, MED: 2, AV: 3 }

const BANDEIRAS: Record<string, string> = { PT: 'Portugal', BR: 'Brasil', ES: 'Espanha', AO: 'Angola', CV: 'Cabo Verde', GW: 'Guiné-Bissau', MZ: 'Moçambique' }

export function corForca(f: number): string {
  if (f >= 75) return 'var(--f-top)'
  if (f >= 60) return 'var(--f-alta)'
  if (f >= 45) return 'var(--f-media)'
  if (f >= 30) return 'var(--f-baixa)'
  return 'var(--f-fraca)'
}

export function Forca({ valor }: { valor: number }) {
  return (
    <span className="forca">
      <span className="forca-num" style={{ color: corForca(valor) }}>{valor}</span>
      <span className="forca-barra"><span style={{ width: `${valor}%`, background: corForca(valor) }} /></span>
    </span>
  )
}

export function Plantel({ mundo, clubeId, epoca }: { mundo: Mundo; clubeId: number; epoca?: EstadoEpoca }) {
  const [col, setCol] = useState<Coluna>('posicao')
  const [desc, setDesc] = useState(false)
  const [aberto, setAberto] = useState<number | null>(null)
  const [ver, setVer] = useState<Atributo | 'forte'>('forte')
  const valorVer = (j: Jogador) => ver === 'forte' ? atributosDe(j)[pontosFortes(j, 1)[0]] : atributo(j, ver)
  const jogadores = useMemo(() => {
    const l = mundo.clubes[clubeId].plantel.map((id) => mundo.jogadores[id])
    const cmp = (a: Jogador, b: Jogador): number => {
      switch (col) {
        case 'posicao': return ORDEM_POS[a.posicao] - ORDEM_POS[b.posicao] || b.forca - a.forca
        case 'nome': return a.nome.localeCompare(b.nome, 'pt')
        case 'atr': return valorVer(a) - valorVer(b)
        default: return (a[col] as number) - (b[col] as number)
      }
    }
    const s = l.sort(cmp)
    return desc ? s.reverse() : s
  }, [mundo, clubeId, col, desc, ver])

  const cab = (c: Coluna, t: string, cls = '') => (
    <th className={cls}>
      <button
        className={`ordenar ${col === c ? 'ativo' : ''}`}
        onClick={() => { if (col === c) setDesc(!desc); else { setCol(c); setDesc(c !== 'posicao' && c !== 'nome') } }}
      >
        {t}{col === c ? (desc ? ' ▼' : ' ▲') : ''}
      </button>
    </th>
  )

  return (
    <>
    <div className="plantel-ver">
      <label>Atributo na tabela{' '}
        <select value={ver} onChange={(e) => { setVer(e.target.value as Atributo | 'forte'); setCol('atr'); setDesc(true) }}>
          <option value="forte">Ponto forte</option>
          {ATRIBUTOS.map((a) => <option key={a} value={a}>{NOME_ATRIBUTO[a]}</option>)}
        </select>
      </label>
      <span className="nota">Carrega num jogador para ver os atributos, a personalidade e a carreira.</span>
    </div>
    <div className="tabela-wrap">
      <table className="tabela plantel">
        <thead>
          <tr>
            {cab('posicao', 'Pos')}
            {cab('nome', 'Nome')}
            {cab('idade', 'Idade', 'num')}
            {cab('forca', 'Força')}
            {cab('atr', ver === 'forte' ? 'Forte' : NOME_ATRIBUTO[ver].slice(0, 3) + '.')}
            {cab('valor', 'Valor', 'num esconde-m')}
            {cab('salario', 'Salário', 'num esconde-m')}
            {cab('contrato', 'Contrato', 'num esconde-m')}
          </tr>
        </thead>
        <tbody>
          {jogadores.map((j) => (
            <Fragment key={j.id}>
            <tr className={`clicavel ${aberto === j.id ? 'meu' : ''}`} onClick={() => setAberto(aberto === j.id ? null : j.id)} aria-expanded={aberto === j.id}>
              <td><span className={`pos pos-${j.posicao}`}>{j.posicao}</span></td>
              <td>
                <span className="nome-jogador">{j.nome}</span>
                {j.craque && <span className="craque" title="Craque do plantel">craque</span>}
                {aberto !== j.id && <span className="esconde-m"> <Carater j={j} /></span>}
                {j.nacionalidade !== 'PT' && <span className="nac" title={BANDEIRAS[j.nacionalidade]}>{j.nacionalidade}</span>}
              </td>
              <td className="num">{j.idade}</td>
              <td><Forca valor={j.forca} /></td>
              <td>{ver === 'forte' ? <PontoForte j={j} /> : <Forca valor={atributo(j, ver)} />}</td>
              <td className="num esconde-m">{euros(j.valor)}</td>
              <td className="num esconde-m">{euros(j.salario)}</td>
              <td className="num esconde-m">{j.contrato} {j.contrato === 1 ? 'ano' : 'anos'}</td>
            </tr>
            {aberto === j.id && (
              <tr className="atr-linha"><td colSpan={8}><AtributosJogador j={j} /><CarreiraJogador j={j} mundo={mundo} epoca={epoca} /></td></tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}
