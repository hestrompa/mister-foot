// Força, idade e juniores por divisão ao longo das épocas (mercado incluído): npx tsx testes/medir-forca.ts [épocas]
import { gerarMundo, forcaClube } from '../src/core/mundo'
import { concluirJornada, epocaTerminada, fecharEpoca } from '../src/core/epoca'
import { prepararEpoca } from '../src/jogo/gravar'
import { avancarMercado } from '../src/core/mercado'
import type { Jogo } from '../src/core/types'
const semente = 101
const mundo = gerarMundo(semente)
const jogo: any = prepararEpoca({ mundo, treinador: 'T', clubeId: mundo.divisoes[3].clubes[9], criado: '' } as Jogo)
const N = Number(process.argv[2] ?? 12)
for (let e = 0; e < N; e++) {
  let n = 0
  avancarMercado(jogo)
  while (!epocaTerminada(jogo.epoca)) { concluirJornada(mundo, jogo.epoca, semente * 1000 + e * 50 + n++); avancarMercado(jogo) }
  fecharEpoca(mundo, jogo.epoca)
  const linha = mundo.divisoes.map((d) => {
    const js = d.clubes.flatMap((id) => mundo.clubes[id].plantel.map((p) => mundo.jogadores[p]))
    const idade = js.reduce((s, j) => s + j.idade, 0) / js.length
    const f = js.reduce((s, j) => s + j.forca, 0) / js.length
    const jov = js.filter((j) => j.idade <= 21).length / js.length
    const rep = d.clubes.reduce((s, id) => s + mundo.clubes[id].reputacao, 0) / d.clubes.length
    const fc = d.clubes.reduce((s, id) => s + forcaClube(mundo, id), 0) / d.clubes.length
    return `fc ${fc.toFixed(0)} f ${f.toFixed(1)} id ${idade.toFixed(1)} jov ${(jov * 100).toFixed(0)}% rep ${rep.toFixed(0)}`
  })
  const livres = Object.values(mundo.jogadores).filter((j) => j.clubeId === 0)
  console.log(mundo.epoca, linha.join(' | '), '| livres', livres.length, 'njog', Object.keys(mundo.jogadores).length)
  prepararEpoca(jogo)
}
