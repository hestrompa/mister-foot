import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { dadosDe, editarClube, editarJogador, emblemaDe, type ClubeComEmblema } from './editar'

describe('editar clubes e jogadores', () => {
  it('muda nome, sigla, estádio, cores e emblema; recusa repetidos e inválidos', () => {
    const m = gerarMundo(3)
    const [a, b] = Object.values(m.clubes)
    const d = { ...dadosDe(a), nome: 'Os Meus Rapazes', sigla: 'omr', estadio: 'Campo da Bola', cores: ['#112233', '#ffeedd'] as [string, string], emblema: { forma: 'losango' as const, padrao: 'cruz' as const } }
    expect(editarClube(m, a.id, d)).toBeNull()
    expect(a.nome).toBe('Os Meus Rapazes')
    expect(a.sigla).toBe('OMR')
    expect(a.estadio.nome).toBe('Campo da Bola')
    expect(emblemaDe(a as ClubeComEmblema)).toEqual({ forma: 'losango', padrao: 'cruz' })
    expect(editarClube(m, b.id, { ...dadosDe(b), sigla: 'OMR' })).toMatch(/sigla/)
    expect(editarClube(m, b.id, { ...dadosDe(b), nome: 'os meus rapazes' })).toMatch(/nome/)
    expect(editarClube(m, b.id, { ...dadosDe(b), nome: 'X' })).toMatch(/entre 3 e 40/)
    expect(editarClube(m, b.id, { ...dadosDe(b), cores: ['#000000', '#000000'] })).toMatch(/diferentes/)
  })

  it('jogador com nome novo e nome curto', () => {
    const m = gerarMundo(3)
    const j = Object.values(m.jogadores)[0]
    expect(editarJogador(m, j.id, '  Zé   Maria  Bolinhas ')).toBeNull()
    expect(j.nome).toBe('Zé Maria Bolinhas')
    expect(j.curto).toBe('Z. Bolinhas')
    expect(editarJogador(m, j.id, 'Pelezinho')).toBeNull()
    expect(j.curto).toBe('Pelezinho')
  })
})
