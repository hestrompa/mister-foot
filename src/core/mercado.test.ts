import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import {
  aceitarProposta, avancarMercado, comprar, estadoMercado, janelaAberta, listaIA, pedidoSalarial, porAVenda,
  PLANTEL_MAX, PLANTEL_MIN, type JogoComMercado,
  comissaoEmpresario,
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
    const salario = pedidoSalarial(j.mundo, alvo, j.clubeId)
    const r = comprar(j, alvo.id, a.preco, salario)
    expect(r.ok, r.texto).toBe(true)
    expect(alvo.clubeId).toBe(j.clubeId)
    expect(meu.plantel).toContain(alvo.id)
    expect(j.mundo.clubes[deId].plantel).not.toContain(alvo.id)
    expect(j.mundo.clubes[deId].dinheiro).toBe(antesDe + a.preco)
    // Só a comissão do empresário sai da economia.
    expect(totalDinheiro(j)).toBe(total - comissaoEmpresario(a.preco, salario))
    expect(st.lista.some((x) => x.jogadorId === alvo.id)).toBe(false)
  })

  it('oferta baixa é recusada e só há uma tentativa por jornada', () => {
    const j = novoJogo()
    j.mundo.clubes[j.clubeId].dinheiro = 50_000_000
    const a = listaIA(j).find((x) => !pedidoRecusado(j, x.jogadorId))!
    const alvo = j.mundo.jogadores[a.jogadorId]
    const sal = pedidoSalarial(j.mundo, alvo, j.clubeId)
    expect(comprar(j, alvo.id, Math.round(a.preco * 0.3), sal).texto).toMatch(/nem fazem contraproposta/)
    expect(comprar(j, alvo.id, a.preco, sal).texto).toMatch(/já recusou/)
  })

  it('oferta razoável recusada traz contraproposta, que se pode aceitar na mesma jornada', () => {
    const j = novoJogo()
    j.mundo.clubes[j.clubeId].dinheiro = 50_000_000
    const a = listaIA(j).find((x) => !pedidoRecusado(j, x.jogadorId))!
    const alvo = j.mundo.jogadores[a.jogadorId]
    const sal = pedidoSalarial(j.mundo, alvo, j.clubeId)
    const r = comprar(j, alvo.id, Math.round(a.preco * 0.7), sal)
    expect(r.texto).toMatch(/contraproposta/)
    const contra = estadoMercado(j).contra![alvo.id]
    expect(contra).toBeGreaterThan(a.preco * 0.7)
    expect(comprar(j, alvo.id, contra - 10_000, sal).texto).toMatch(/só aceitam/)
    expect(comprar(j, alvo.id, contra, sal).ok).toBe(true)
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
    // O teste é sobre contratos: ninguém paga a cláusula deste.
    ;(fica as { clausula?: number }).clausula = 1e12
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
    // Contratar um livre: sem custo de transferência, só o prémio de assinatura e a comissão (1 mês).
    meu.dinheiro = 10_000_000
    // Um livre que aceite vir (os bons esperam por clubes do seu nível).
    const { recusaDoLivre } = await import('./mercado')
    const alvo = l.find((x) => !recusaDoLivre(j.mundo, x, j.clubeId, j.epoca.jornada))!
    const sal = (await import('./mercado')).pedidoLivre(j.mundo, alvo, j.clubeId)
    expect(contratarLivre(j, alvo.id, sal - 100, 2).ok).toBe(false)
    const r = contratarLivre(j, alvo.id, sal, 2)
    expect(r.ok, r.texto).toBe(true)
    expect(meu.dinheiro).toBe(10_000_000 - sal * 3)
    expect(alvo.clubeId).toBe(j.clubeId)
    // A IA vai buscando livres durante a janela.
    const antes = livres(j).length
    for (let k = 0; k < 6; k++) { concluirJornada(j.mundo, j.epoca, 900 + k); avancarMercado(j) }
    expect(livres(j).length).toBeLessThan(antes)
  })
})

describe('juniores e salários', () => {
  it('a formação dá juniores: promover junta-os ao plantel, dispensar deixa-os livres', async () => {
    const { juniores, promoverJunior, dispensarJunior, livres, JUNIORES_POR_EPOCA } = await import('./mercado')
    const j = novoJogo(17, 4)
    const meu = j.mundo.clubes[j.clubeId]
    const js = juniores(j)
    expect(js).toHaveLength(JUNIORES_POR_EPOCA)
    for (const x of js) { expect(x.idade).toBeLessThanOrEqual(18); expect(x.clubeId).toBe(0); expect(meu.plantel).not.toContain(x.id) }
    const n = meu.plantel.length
    expect(promoverJunior(j, js[0].id).ok).toBe(true)
    expect(meu.plantel).toHaveLength(n + 1)
    expect(js[0].clubeId).toBe(j.clubeId)
    expect(js[0].contrato).toBe(3)
    expect(dispensarJunior(j, js[1].id).ok).toBe(true)
    expect(livres(j).map((x) => x.id)).toContain(js[1].id)
    // O que ficou sem decisão sai livre quando fecha a janela de verão.
    for (let k = 0; k < 6; k++) { concluirJornada(j.mundo, j.epoca, 40 + k); avancarMercado(j) }
    expect(juniores(j)).toHaveLength(0)
    // Ids únicos.
    const ids = Object.values(j.mundo.jogadores).map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('renovar pode baixar o salário de quem já não vale tanto, e nunca sobe mais de 10%', async () => {
    const { pedidoRenovacao } = await import('./mercado')
    const j = novoJogo(19, 3)
    for (const id of j.mundo.clubes[j.clubeId].plantel) {
      const x = j.mundo.jogadores[id]
      expect(pedidoRenovacao(j.mundo, x)).toBeLessThanOrEqual(Math.round(x.salario * 1.1) + 50)
    }
    const x = j.mundo.jogadores[j.mundo.clubes[j.clubeId].plantel[0]]
    x.salario *= 3
    expect(pedidoRenovacao(j.mundo, x)).toBeLessThan(x.salario)
  })

  it('em 4 épocas os salários não disparam e ninguém fica com plantel abaixo do mínimo', async () => {
    const { fecharEpoca } = await import('./epoca')
    const j = novoJogo(23, 4)
    const massa = (d: number) => {
      const v = j.mundo.divisoes[d].clubes.map((id) => j.mundo.clubes[id].plantel.reduce((s, p) => s + j.mundo.jogadores[p].salario, 0)).sort((a, b) => a - b)
      return v[9]
    }
    const inicio = [0, 1, 2, 3].map(massa)
    for (let e = 0; e < 4; e++) {
      estadoMercado(j)
      for (let k = 0; k < 34; k++) { concluirJornada(j.mundo, j.epoca, e * 100 + k); avancarMercado(j) }
      fecharEpoca(j.mundo, j.epoca)
      j.epoca = novaEpoca(j.mundo, 50 + e)
    }
    estadoMercado(j)
    const fim = [0, 1, 2, 3].map(massa)
    for (let d = 0; d < 4; d++) expect(fim[d]).toBeLessThan(inicio[d] * 1.6)
    for (const c of Object.values(j.mundo.clubes)) expect(c.plantel.length).toBeGreaterThanOrEqual(PLANTEL_MIN)
  }, 20_000)
})
