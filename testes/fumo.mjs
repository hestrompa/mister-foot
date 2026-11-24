// Teste de fumo: abre o jogo num browser real e percorre o arranque de uma carreira.
// Uso: node testes/fumo.mjs [url]   (por omissão http://localhost:4173/)
// Capturas de ecrã vão para $OUT.
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const URL_BASE = process.argv[2] || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/85f25e80-5cae-503b-82cb-c955b4446221/scratchpad/fumo'
mkdirSync(OUT, { recursive: true })

const erros = []
let falhas = 0

async function passo(nome, fn) {
  try {
    await fn()
    console.log(`PASS  ${nome}`)
  } catch (e) {
    falhas++
    console.log(`FAIL  ${nome}\n      ${String(e?.message || e).split('\n')[0]}`)
  }
}

function esperar(cond, msg) {
  if (!cond) throw new Error(msg)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
  const foto = (f) => page.screenshot({ path: join(OUT, f), fullPage: true })
  const saltarJogo = async () => {
    await page.getByRole('button', { name: 'Saltar para o fim' }).click()
    await page.getByRole('button', { name: 'Sim, saltar' }).click()
  }

  await passo('abrir página e título "Mister-foot"', async () => {
    await page.goto(URL_BASE, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Mister-foot' }).first().waitFor({ timeout: 10000 })
    await foto('1-inicio.png')
  })

  await passo('preencher nome e semente, gerar mundo', async () => {
    await page.getByPlaceholder('Mister').fill('Hugo')
    await page.getByPlaceholder('aleatória').fill('2027')
    await page.getByRole('button', { name: 'Gerar mundo' }).click()
    await page.getByText('Escolhe o teu clube').first().waitFor({ timeout: 10000 })
    await foto('2-escolher.png')
  })

  await passo('escolher clube e assinar contrato', async () => {
    await page.locator('button.cartao.clube').first().click()
    await page.getByRole('button', { name: 'Assinar contrato' }).click()
    await page.getByRole('button', { name: 'Jogar jornada' }).waitFor({ timeout: 10000 })
    await foto('3a-jogo.png')
    await page.getByRole('button', { name: 'Plantel', exact: true }).click()
    await page.locator('table.plantel').first().waitFor({ timeout: 10000 })
  })

  await passo('plantel com 24 jogadores', async () => {
    const n = await page.locator('table.plantel tbody tr').count()
    esperar(n === 24, `esperava 24 linhas, encontrei ${n}`)
    await foto('3-plantel.png')
  })

  await passo('plantel: atributos do jogador ao carregar na linha e ordenar por atributo', async () => {
    await page.locator('table.plantel tbody tr').nth(5).click()
    await page.locator('table.plantel .atributos').waitFor({ timeout: 5000 })
    const n = await page.locator('table.plantel .atr').count()
    esperar(n >= 4, `esperava pelo menos 4 atributos, encontrei ${n}`)
    await page.getByLabel('Atributo na tabela').selectOption('vel')
    await foto('3b-plantel-atributos.png')
    await page.getByLabel('Atributo na tabela').selectOption('forte')
    await page.locator('table.plantel tbody tr.meu').click()
  })

  await passo('separador Clube mostra "Estádio"', async () => {
    await page.getByRole('button', { name: 'Clube', exact: true }).or(page.getByRole('tab', { name: 'Clube', exact: true })).first().click()
    await page.getByText('Estádio').first().waitFor({ timeout: 5000 })
  })

  await passo('obras no estádio e empréstimo ao banco', async () => {
    await page.getByRole('region', { name: 'Obras no estádio' }).waitFor({ timeout: 5000 })
    const banco = page.getByRole('region', { name: 'Banco' })
    const antes = await page.locator('.topo-dinheiro').innerText()
    await banco.getByRole('button', { name: 'Pedir empréstimo' }).click()
    await banco.getByRole('button', { name: /Liquidar/ }).waitFor({ timeout: 5000 })
    const depois = await page.locator('.topo-dinheiro').innerText()
    esperar(antes !== depois, `o dinheiro não mudou (${antes})`)
    await page.getByRole('region', { name: 'Obras no estádio' }).getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Começar obra' }).click()
    await page.getByText(/Faltam \d+ jornadas/).waitFor({ timeout: 5000 })
    await foto('3b-obras-banco.png')
  })

  await passo('editar nome, sigla e emblema do clube', async () => {
    await page.getByRole('button', { name: 'Clube', exact: true }).click()
    await page.getByRole('button', { name: 'Editar nome, cores e emblema' }).click()
    const f = page.locator('.ed-clube')
    await f.getByLabel('Nome do clube').fill('Mister Futebol Clube')
    await f.getByLabel('Sigla').fill('MFC')
    await f.getByRole('button', { name: 'Redondo' }).click()
    await f.getByRole('button', { name: 'Riscas' }).click()
    await foto('4b-editar-clube.png')
    await f.getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('heading', { name: 'Mister Futebol Clube' }).waitFor({ timeout: 3000 })
    esperar(await page.locator('.ed-clube').count() === 0, 'o editor não fechou depois de guardar')
  })

  await passo('separador Divisões com 18 linhas', async () => {
    await page.getByRole('button', { name: 'Divisões', exact: true }).or(page.getByRole('tab', { name: 'Divisões', exact: true })).first().click()
    await page.locator('table tbody tr').first().waitFor({ timeout: 5000 })
    const n = await page.locator('table tbody tr').count()
    esperar(n === 18, `esperava 18 linhas, encontrei ${n}`)
    await foto('4-divisoes.png')
  })

  await passo('separador Carreira: confiança, objetivos e histórico', async () => {
    await page.getByRole('button', { name: /^Carreira/ }).first().click()
    await page.getByText('Confiança da direção').first().waitFor({ timeout: 5000 })
    await page.getByText(/Liga: /).first().waitFor({ timeout: 5000 })
    const n = await page.locator('.carreira table tbody tr').count()
    esperar(n >= 1, `histórico vazio`)
    await foto('4b-carreira.png')
  })

  await passo('mercado: fazer oferta e pôr um jogador em leilão', async () => {
    await page.getByRole('button', { name: /^Mercado/ }).first().click()
    await page.getByText('Mercado aberto').first().waitFor({ timeout: 5000 })
    await page.getByLabel('Divisão').selectOption('4')
    await page.getByLabel('Ordenar por atributo').selectOption('rem')
    await page.locator('table.mercado-tab tbody tr').first().click()
    await page.locator('.negociar .atributos').waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Fazer oferta' }).click()
    await page.locator('[role=status]').first().waitFor({ timeout: 5000 })
    await foto('4b-mercado.png')
    await page.getByRole('button', { name: 'Vender', exact: true }).click()
    await page.locator('table.mercado-tab tbody tr').nth(20).click()
    await page.getByRole('button', { name: 'Leilão', exact: true }).click()
    await page.getByText(/vai a leilão/).waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Notícias', exact: true }).click()
    await page.getByRole('button', { name: 'Procurar', exact: true }).click()
    await page.getByPlaceholder('Nome do jogador').waitFor({ timeout: 5000 })
    await foto('4c-procurar.png')
    await page.getByRole('button', { name: /^Contratos/ }).click()
    await page.locator('table.mercado-tab tbody tr').first().click()
    await page.getByRole('button', { name: 'Renovar', exact: true }).click()
    await page.getByText(/renovou por/).waitFor({ timeout: 5000 })
    await foto('4d-contratos.png')
    await page.getByRole('button', { name: 'Livres', exact: true }).click()
    await page.getByText(/Jogadores sem clube/).waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: /^Juniores/ }).click()
    await foto('4e-juniores.png')
    await page.getByRole('button', { name: 'Promover', exact: true }).first().click()
    await page.getByText(/sobe ao plantel principal/).waitFor({ timeout: 5000 })
  })

  await passo('separador Staff: treino, foco e contratar', async () => {
    await page.getByRole('button', { name: 'Staff', exact: true }).click()
    await page.getByRole('region', { name: 'Treinador adjunto' }).waitFor({ timeout: 5000 })
    await page.getByRole('radio', { name: 'Médios' }).click()
    await page.getByText(/médios evoluem mais depressa/).waitFor({ timeout: 5000 })
    await page.getByRole('radiogroup', { name: 'Treino específico' }).getByRole('radio', { name: 'Velocidade' }).click()
    await page.getByText(/Treinam-no/).waitFor({ timeout: 5000 })
    const adj = page.getByRole('region', { name: 'Olheiro' })
    await adj.getByRole('button', { name: /^(Trocar|Contratar)$/ }).click()
    await adj.locator('.st-candidatos li').first().getByRole('button', { name: 'Contratar' }).click()
    await page.getByText(/é o novo olheiro/).waitFor({ timeout: 5000 })
    await foto('4f-staff.png')
  })

  await passo('separador Balneário: ambiente, capitão, promessa e médico', async () => {
    await page.getByRole('button', { name: /^Balneário/ }).click()
    await page.getByRole('region', { name: 'Ambiente' }).waitFor({ timeout: 5000 })
    await page.getByRole('region', { name: 'Departamento médico' }).waitFor({ timeout: 5000 })
    await page.locator('.bn-tabela').getByRole('button', { name: 'Prometer' }).last().click()
    await page.getByText(/Prometeste a .+ jogos a titular/).first().waitFor({ timeout: 5000 })
    await foto('4g-balneario.png')
  })

  await passo('recarregar mantém a carreira', async () => {
    await page.reload({ waitUntil: 'networkidle' })
    const plantel = page.getByRole('button', { name: 'Plantel', exact: true }).or(page.getByRole('tab', { name: 'Plantel', exact: true })).first()
    await plantel.waitFor({ timeout: 10000 })
    if (!(await page.locator('table.plantel').count())) await plantel.click()
    await page.locator('table.plantel').first().waitFor({ timeout: 5000 })
  })

  await passo('conferência de imprensa antes da 1.ª jornada', async () => {
    await page.getByRole('button', { name: 'Jogo', exact: true }).click()
    const conf = page.locator('.im-conf')
    await conf.waitFor({ timeout: 5000 })
    await foto('5c-conferencia.png')
    await conf.locator('.im-opcao').nth(1).click()
    esperar(await page.locator('.im-conf').count() === 0, 'a conferência não fechou depois de responder')
  })

  await passo('jogar jornada ao vivo a 2x', async () => {
    await page.getByRole('button', { name: 'Jogo', exact: true }).click()
    await page.getByRole('button', { name: 'Jogar jornada' }).click()
    await page.getByRole('button', { name: '2x' }).click()
    await page.getByTestId('campo-vivo').or(page.getByTestId('repeticao')).first().waitFor({ timeout: 8000 })
    await page.waitForTimeout(5000)
    await foto('6-ao-vivo.png')
    const n = await page.locator('.placares li').count()
    esperar(n === 9, `esperava 9 jogos, encontrei ${n}`)
  })

  await passo('repetição 2D em caricas de um lance do meu jogo', async () => {
    const rep = page.getByTestId('repeticao')
    await rep.waitFor({ timeout: 45000 })
    await page.waitForTimeout(1800)
    await foto('6b-repeticao.png')
    const desenhado = await rep.locator('canvas').evaluate((c) => c.width > 100 && c.height > 60)
    esperar(desenhado, 'o canvas da repetição não tem tamanho')
    await rep.getByRole('button', { name: 'Continuar' }).click()
    await rep.waitFor({ state: 'detached', timeout: 5000 })
  })

  await passo('mexer na equipa sem parar: formação e substituição', async () => {
    await page.getByTestId('repeticao').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
    await page.getByRole('button', { name: 'Equipa', exact: true }).click()
    const painel = page.locator('.painel-subs')
    await painel.getByText('o jogo continua').waitFor({ timeout: 8000 })
    await painel.locator('select').selectOption('4-3-3')
    await painel.locator('.lista-jog').first().locator('button').nth(10).click()
    await painel.locator('.lista-jog').nth(1).locator('button').first().click()
    await painel.getByText(/Sai .*, entra/).waitFor({ timeout: 3000 })
    await foto('6a-equipa-ao-vivo.png')
    await painel.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.locator('.relato').getByText(/muda para 4-3-3/).waitFor({ timeout: 5000 })
  })

  await passo('saltar e ver o resumo', async () => {
    await saltarJogo()
    await page.getByText('Outros resultados').waitFor({ timeout: 10000 })
    await foto('7-resumo.png')
    await page.locator('.rep-lista .botao').first().click()
    await page.getByTestId('repeticao').waitFor({ timeout: 5000 })
    await page.waitForTimeout(2500)
    await foto('7b-resumo-repeticao.png')
    // Câmara: perto (segue a bola) e campo inteiro, com o público na bancada.
    const cam = page.getByTestId('rep-camara')
    const antes = await cam.textContent()
    await cam.click()
    esperar((await cam.textContent()) !== antes, 'o botão da câmara não mudou')
    await page.waitForTimeout(600)
    await foto('7b2-repeticao-campo.png')
    await cam.click()
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.locator('.placares .pl-ver').first().click()
    await page.getByText(/Noutro jogo/).waitFor({ timeout: 5000 })
    await page.waitForTimeout(2500)
    await foto('7c-resumo-outro-jogo.png')
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  })

  await passo('continuar e ver a jornada 2', async () => {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByText(/Jornada 2 de/).waitFor({ timeout: 5000 })
    const formas = await page.locator('.pj-eq .forma').count()
    esperar(formas === 2, `forma recente nas duas equipas do próximo jogo (vi ${formas})`)
    await page.getByRole('button', { name: 'Classificação', exact: true }).click()
    await foto('8-classificacao.png')
    await page.getByRole('button', { name: 'Calendário', exact: true }).click()
    await page.locator('.res-V, .res-E, .res-D').first().waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Jogo', exact: true }).click()
  })

  await passo('ficha do jogo 1: táticas e onzes das duas equipas', async () => {
    await page.getByRole('button', { name: 'Calendário', exact: true }).click()
    await page.locator('.calendario tr.clicavel').first().click()
    await page.locator('.ficha').waitFor({ timeout: 5000 })
    const onzes = await page.locator('.fi-onze .fi-lista:not(.fi-sup) li').count()
    esperar(onzes === 22, `22 titulares na ficha (vi ${onzes})`)
    esperar(await page.locator('.fi-tatica').count() === 2, 'falta a tática de uma das equipas')
    await foto('8b-ficha-jogo.png')
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await page.getByRole('button', { name: 'Jogo', exact: true }).click()
  })

  await passo('notícias da jornada e história (recordes, rivais)', async () => {
    await page.getByRole('button', { name: /^Imprensa( \(\d+\))?$/ }).click()
    await page.locator('.im-noticia').first().waitFor({ timeout: 5000 })
    const n = await page.locator('.im-noticia').count()
    esperar(n >= 2, `esperava notícias da jornada e da conferência (vi ${n})`)
    await foto('8c-noticias.png')
    await page.getByRole('button', { name: 'História', exact: true }).click()
    await page.locator('.historia').waitFor({ timeout: 5000 })
    const rivais = await page.locator('.historia table').first().locator('tbody tr').count()
    esperar(rivais >= 4, `esperava os rivais da região (vi ${rivais})`)
    await foto('8d-historia.png')
    await page.getByRole('button', { name: 'Jogo', exact: true }).click()
  })

  await passo('dicas de primeiros passos fecham-se', async () => {
    const dica = page.locator('.dica-cartao')
    esperar(await dica.count() === 1, 'falta a dica no separador Jogo')
    await dica.getByRole('button', { name: 'Percebido' }).click()
    esperar(await page.locator('.dica-cartao').count() === 0, 'a dica não fechou')
  })

  await passo('telemóvel 390x844 sem scroll horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    await foto('5-telemovel.png')
    esperar(sw <= iw + 1, `scrollWidth ${sw} > innerWidth ${iw}`)
  })

  await passo('telemóvel: jornada ao vivo sem scroll horizontal', async () => {
    await page.getByRole('button', { name: 'Jogar jornada' }).click()
    await page.getByRole('button', { name: '4x' }).click()
    await page.waitForTimeout(3000)
    await foto('9-ao-vivo-telemovel.png')
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    esperar(sw <= iw + 1, `scrollWidth ${sw} > innerWidth ${iw}`)
    await saltarJogo()
    await page.getByText('Outros resultados').waitFor({ timeout: 10000 })
    await foto('10-resumo-telemovel.png')
  })

  await passo('telemóvel: todos os separadores sem scroll horizontal', async () => {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByText(/Jornada 3 de/).waitFor({ timeout: 5000 })
    const seps = ['Plantel', 'Balneário', 'Staff', 'Mercado', 'Taça', 'Europa', 'Classificação', 'Calendário', 'Clube', 'Carreira', 'Divisões', 'Imprensa', 'História', 'Jogo']
    const largos = []
    for (const [i, nome] of seps.entries()) {
      await page.getByRole('button', { name: new RegExp(`^${nome}( \\(\\d+\\))?$`) }).click()
      await page.waitForTimeout(150)
      await foto(`11-${i + 1}-telemovel-${nome.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}.png`)
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
      if (sw > iw + 1) largos.push(`${nome} ${sw}`)
    }
    esperar(largos.length === 0, `scroll horizontal em: ${largos.join(', ')}`)
  })

  await passo('taça: jornada 3, depois a eliminatória da taça a meio da semana', async () => {
    await page.getByRole('button', { name: 'Jogar jornada' }).click()
    await saltarJogo()
    await page.getByText('Outros resultados').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    const botao = page.getByRole('button', { name: 'Jogar a taça' })
    await botao.or(page.getByText(/Jornada 4 de/)).first().waitFor({ timeout: 5000 })
    if (await botao.count()) {
      await foto('12a-pre-taca.png')
      await botao.click()
      await page.getByRole('button', { name: '4x' }).click()
      await page.waitForTimeout(1500)
      await foto('12b-taca-ao-vivo.png')
      await saltarJogo()
      await page.locator('.taca-titulo').waitFor({ timeout: 10000 })
      await foto('12c-taca-resumo.png')
      await page.getByRole('button', { name: 'Continuar', exact: true }).click()
      await page.getByText(/Jornada 4 de/).waitFor({ timeout: 5000 })
    }
    await page.getByRole('button', { name: /^Taça/ }).click()
    await page.getByText('Notícias da taça').waitFor({ timeout: 5000 })
    const jogados = await page.locator('.taca-jogo').count()
    esperar(jogados >= 8, `esperava jogos da taça no quadro, vi ${jogados}`)
    await foto('12d-taca-separador.png')
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    esperar(sw <= iw + 1, `scrollWidth ${sw} > innerWidth ${iw}`)
    await page.setViewportSize({ width: 1280, height: 800 })
    await foto('12e-taca-separador-pc.png')
  })

  await passo('Europa: grupos das duas provas, jornadas já jogadas e notícias', async () => {
    await page.getByRole('button', { name: /^Europa/ }).click()
    await page.getByText('Notícias da Europa').waitFor({ timeout: 5000 })
    const grupos = await page.locator('.eu-grupo').count()
    esperar(grupos === 4, `esperava 4 grupos, vi ${grupos}`)
    await foto('13a-europa-pc.png')
    await page.getByRole('button', { name: 'Taça Continental' }).click()
    await page.waitForTimeout(150)
    const jogos = await page.locator('.taca-jogo').count()
    esperar(jogos >= 8, `esperava 8 jogos da jornada europeia, vi ${jogos}`)
    await page.setViewportSize({ width: 390, height: 844 })
    await foto('13b-europa-telemovel.png')
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    esperar(sw <= iw + 1, `scrollWidth ${sw} > innerWidth ${iw}`)
    await page.getByRole('button', { name: 'Calendário' }).click()
    await foto('13c-calendario-telemovel.png')
  })

  await ctx.close()
} finally {
  await browser.close()
}

await passo('sem erros na consola', async () => {
  esperar(erros.length === 0, erros.join(' | '))
})

console.log(falhas ? `\n${falhas} passo(s) falharam` : '\nTudo bem.')
console.log(`Capturas em ${OUT}`)
process.exit(falhas ? 1 : 0)
