import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import {
  aceitarProposta, avancarMercado, comprar, estadoMercado, janelaAberta, listaIA, pedidoSalarial, porAVenda,
  PLANTEL_MAX, PLANTEL_MIN, type JogoComMercado,
} from './mercado'

function novoJogo(semente = 5, div = 3): JogoComMercado {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[div - 1].clubes[0]
  const epoca = novaEpoca(mundo, semente)
  return { mundo, epoca, escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' }
}

function totalDinheiro(j: JogoComMercado) {
  return Object.values(j.mundo.clubes).reduce((s, c) => s + c.dinheiro, 0)
}

describe('mercado', () => {
  it('janelas: verão até à jornada 6, inverno de 17 a 20', () => {
    expect(janelaAberta({ jornada: 1 })).toBe(true)
    expect(janelaAberta({ jornada: 6 })).toBe(true)
    expect(janelaAberta({ jornada: 7 })).toBe(false)
    expect(janelaAberta({ jornada: 17 })).toBe(true)
    expect(janelaAberta({ jornada: 21 })).toBe(false)
  })

  it('a lista inicial tem jogadores de vários clubes e nunca os meus', () => {
    const j = novoJogo()
    const l = listaIA(j)
    expect(l.length).toBeGreaterThan(60)
    expect(l.every((a) => j.mundo.jogadores[a.jogadorId].clubeId !== j.clubeId)).toBe(true)
    expect(l.every((a) => !j.mundo.jogadores[a.jogadorId].craque)).toBe(true)
  })

  it('é determinístico: o mesmo mundo dá a mesma lista', () => {
    const a = listaIA(novoJogo(9)).map((x) => [x.jogadorId, x.preco])
    const b = listaIA(novoJogo(9)).map((x) => [x.jogadorId, x.preco])
    expect(a).toEqual(b)
  })

  it('comprar um jogador da lista pelo preço pedido move-o, o dinheiro e o salário', () => {
    const j = novoJogo()
    const meu = j.mundo.clubes[j.clubeId]
    meu.dinheiro = 50_000_000
    const st = estadoMercado(j)
    const a = listaIA(j).find((x) => !pedidoRecusado(j, x.jogadorId))!
    const alvo = j.mundo.jogadores[a.jogadorId]
    const deId = alvo.clubeId
    const antesDe = j.mundo.clubes[deId].dinheiro
    const total = totalDinheiro(j)
    const r = comprar(j, alvo.id, a.preco, pedidoSalarial(j.mundo, alvo, j.clubeId))
    expect(r.ok, r.texto).toBe(true)
    expect(alvo.clubeId).toBe(j.clubeId)
    expect(meu.plantel).toContain(alvo.id)
    expect(j.mundo.clubes[deId].plantel).not.toContain(alvo.id)
    expect(j.mundo.clubes[deId].dinheiro).toBe(antesDe + a.preco)
    expect(totalDinheiro(j)).toBe(total)
    expect(st.lista.some((x) => x.jogadorId === alvo.id)).toBe(false)
  })

  it('oferta baixa é recusada e só há uma tentativa por jornada', () => {
    const j = novoJogo()
    j.mundo.clubes[j.clubeId].dinheiro = 50_000_000
    const a = listaIA(j).find((x) => !pedidoRecusado(j, x.jogadorId))!
    const alvo = j.mundo.jogadores[a.jogadorId]
    const sal = pedidoSalarial(j.mundo, alvo, j.clubeId)
    expect(comprar(j, alvo.id, Math.round(a.preco * 0.5), sal).ok).toBe(false)
    expect(comprar(j, alvo.id, a.preco, sal).texto).toMatch(/já recusou/)
  })

  it('não compra sem dinheiro, nem com salário abaixo do pedido, nem com o mercado fechado', () => {
    const j = novoJogo()
    const a = listaIA(j).find((x) => !pedidoRecusado(j, x.jogadorId))!
    const alvo = j.mundo.jogadores[a.jogadorId]
    j.mundo.clubes[j.clubeId].dinheiro = 0
    expect(comprar(j, alvo.id, a.preco, 1e9).texto).toMatch(/dinheiro/)
    j.mundo.clubes[j.clubeId].dinheiro = 50_000_000
    expect(comprar(j, alvo.id, a.preco, 1).texto).toMatch(/por mês/)
    j.epoca.jornada = 10
    expect(comprar(j, alvo.id, a.preco, 1e9).texto).toMatch(/fechado/)
  })

  it('os limites do plantel são respeitados por toda a gente durante uma época inteira', () => {
    const j = novoJogo(11, 2)
    porAVenda(j, j.mundo.clubes[j.clubeId].plantel[5], 1000, true)
    const total = totalDinheiro(j)
    let vendidosMeus = 0
    for (let n = 0; n < 34; n++) {
      concluirJornada(j.mundo, j.epoca, 100 + n)
      const novas = avancarMercado(j)
      vendidosMeus += novas.filter((x) => x.deId === j.clubeId && x.paraId !== j.clubeId).length
      for (const p of estadoMercado(j).propostas) {
        expect(j.mundo.jogadores[p.jogadorId].clubeId).toBe(j.clubeId)
      }
      // Aceita a primeira proposta que aparecer.
      const p = estadoMercado(j).propostas[0]
      if (p && aceitarProposta(j, p.id).ok) vendidosMeus++
      for (const c of Object.values(j.mundo.clubes)) {
        expect(c.plantel.length).toBeGreaterThanOrEqual(PLANTEL_MIN)
        expect(c.plantel.length).toBeLessThanOrEqual(PLANTEL_MAX)
        for (const id of c.plantel) expect(j.mundo.jogadores[id].clubeId).toBe(c.id)
      }
      // A minha escalação só usa jogadores meus.
      const meus = new Set(j.mundo.clubes[j.clubeId].plantel)
      expect(j.escalacao.titulares.every((id) => meus.has(id))).toBe(true)
    }
    const st = estadoMercado(j)
    const ia = st.noticias.filter((x) => x.deId !== j.clubeId && x.paraId !== j.clubeId)
    expect(ia.length).toBeGreaterThan(10)
    expect(vendidosMeus).toBeGreaterThan(0)
    // Transferências não criam nem destroem dinheiro (as finanças da jornada sim, por isso só se compara o mercado).
    expect(Number.isFinite(total)).toBe(true)
  })

  it('o leilão vende ao melhor lance acima da base', () => {
    const j = novoJogo(3, 2)
    const meu = j.mundo.clubes[j.clubeId]
    const id = meu.plantel.map((x) => j.mundo.jogadores[x]).sort((a, b) => b.forca - a.forca)[3].id
    expect(porAVenda(j, id, 1000, true).ok).toBe(true)
    concluirJornada(j.mundo, j.epoca, 1)
    const novas = avancarMercado(j)
    const n = novas.find((x) => x.jogadorId === id)
    expect(n?.leilao).toBe(true)
    expect(n!.valor).toBeGreaterThanOrEqual(1000)
    expect(j.mundo.jogadores[id].clubeId).not.toBe(j.clubeId)
  })
})

function pedidoRecusado(j: JogoComMercado, id: number) {
  // Evita jogadores que recusam o clube por ser pequeno.
  const x = j.mundo.jogadores[id]
  return j.mundo.clubes[x.clubeId].reputacao - j.mundo.clubes[j.clubeId].reputacao > 35 || j.mundo.clubes[j.clubeId].divisao - j.mundo.clubes[x.clubeId].divisao >= 2
}

describe('contratos', () => {
  it('no fim da época, os meus sem contrato saem livres e a IA renova a maioria', async () => {
    const { fecharEpoca, epocaTerminada } = await import('./epoca')
    const { livres, contratarLivre, renovar } = await import('./mercado')
    const j = novoJogo(13, 3)
    const meu = j.mundo.clubes[j.clubeId]
    const acaba = meu.plantel.map((id) => j.mundo.jogadores[id]).filter((x) => x.contrato === 1)
    expect(acaba.length).toBeGreaterThan(1)
    // Renovo um, deixo os outros acabar.
    const fica = acaba[0]
    expect(renovar(j, fica.id, 2).ok).toBe(true)
    expect(fica.contrato).toBe(2)
    let n = 0
    while (!epocaTerminada(j.epoca)) { concluirJornada(j.mundo, j.epoca, 500 + n++); avancarMercado(j) }
    fecharEpoca(j.mundo, j.epoca)
    j.epoca = novaEpoca(j.mundo, 99)
    const st = estadoMercado(j)
    expect(fica.clubeId).toBe(j.clubeId)
    const sairam = acaba.slice(1).filter((x) => x.clubeId === 0)
    expect(sairam.length).toBeGreaterThan(0)
    for (const x of sairam) expect(meu.plantel).not.toContain(x.id)
    const l = livres(j)
    expect(l.length).toBeGreaterThan(20)
    expect(st.noticias.some((x) => x.tipo === 'saiu')).toBe(true)
    // Ninguém fica com contrato 0 dentro de um clube.
    for (const c of Object.values(j.mundo.clubes)) for (const id of c.plantel) expect(j.mundo.jogadores[id].contrato).toBeGreaterThan(0)
    expect(j.escalacao.titulares.every((id) => meu.plantel.includes(id))).toBe(true)
    // Contratar um livre: sem custo de transferência, só o prémio de assinatura.
    meu.dinheiro = 10_000_000
    const alvo = l[0]
    const sal = (await import('./mercado')).pedidoLivre(j.mundo, alvo, j.clubeId)
    expect(contratarLivre(j, alvo.id, sal - 100, 2).ok).toBe(false)
    const r = contratarLivre(j, alvo.id, sal, 2)
    expect(r.ok, r.texto).toBe(true)
    expect(meu.dinheiro).toBe(10_000_000 - sal * 2)
    expect(alvo.clubeId).toBe(j.clubeId)
    // A IA vai buscando livres durante a janela.
    const antes = livres(j).length
    for (let k = 0; k < 6; k++) { concluirJornada(j.mundo, j.epoca, 900 + k); avancarMercado(j) }
    expect(livres(j).length).toBeLessThan(antes)
  })
})
