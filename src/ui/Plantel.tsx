import { useMemo, useState } from 'react'
import type { Jogador, Mundo, Posicao } from '../core/types'
import { euros } from '../core/formato'

type Coluna = 'posicao' | 'nome' | 'idade' | 'forca' | 'valor' | 'salario' | 'contrato'
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

export function Plantel({ mundo, clubeId }: { mundo: Mundo; clubeId: number }) {
  const [col, setCol] = useState<Coluna>('posicao')
  const [desc, setDesc] = useState(false)
  const jogadores = useMemo(() => {
    const l = mundo.clubes[clubeId].plantel.map((id) => mundo.jogadores[id])
    const cmp = (a: Jogador, b: Jogador): number => {
      switch (col) {
        case 'posicao': return ORDEM_POS[a.posicao] - ORDEM_POS[b.posicao] || b.forca - a.forca
        case 'nome': return a.nome.localeCompare(b.nome, 'pt')
        default: return (a[col] as number) - (b[col] as number)
      }
    }
    const s = l.sort(cmp)
    return desc ? s.reverse() : s
  }, [mundo, clubeId, col, desc])

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
    <div className="tabela-wrap">
      <table className="tabela plantel">
        <thead>
          <tr>
            {cab('posicao', 'Pos')}
            {cab('nome', 'Nome')}
            {cab('idade', 'Idade', 'num')}
            {cab('forca', 'Força')}
            {cab('valor', 'Valor', 'num esconde-m')}
            {cab('salario', 'Salário', 'num esconde-m')}
            {cab('contrato', 'Contrato', 'num esconde-m')}
          </tr>
        </thead>
        <tbody>
          {jogadores.map((j) => (
            <tr key={j.id}>
              <td><span className={`pos pos-${j.posicao}`}>{j.posicao}</span></td>
              <td>
                <span className="nome-jogador">{j.nome}</span>
                {j.craque && <span className="craque" title="Craque do plantel">craque</span>}
                {j.nacionalidade !== 'PT' && <span className="nac" title={BANDEIRAS[j.nacionalidade]}>{j.nacionalidade}</span>}
              </td>
              <td className="num">{j.idade}</td>
              <td><Forca valor={j.forca} /></td>
              <td className="num esconde-m">{euros(j.valor)}</td>
              <td className="num esconde-m">{euros(j.salario)}</td>
              <td className="num esconde-m">{j.contrato} {j.contrato === 1 ? 'ano' : 'anos'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
