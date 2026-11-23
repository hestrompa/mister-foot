// Medir o equilíbrio de várias épocas: npx tsx testes/medir.ts [mundos] [épocas]
import { medirCarreira } from '../src/jogo/medir'
const mundos = Number(process.argv[2] ?? 3), epocas = Number(process.argv[3] ?? 5)
for (let s = 1; s <= mundos; s++) {
  for (const m of medirCarreira(s * 101, epocas)) {
    const r = (v: number) => v.toFixed(2)
    console.log(`mundo ${s} ${m.ano}: golos ${m.golosPorJogo.map(r).join('/')} emp ${(100*m.empates/m.jogos).toFixed(0)}% casa ${(100*m.vitoriasCasa/m.jogos).toFixed(0)}% | am ${r(m.amarelos/m.jogos)} verm ${r(m.vermelhos/m.jogos)} les ${r(m.lesoes/m.jogos)} cast ${m.castigos} | camp rank ${m.campeaoRank.join(',')} pts ${m.ptsCampeao.join(',')} ult ${m.ptsUltimo.join(',')} | din ${m.dinheiroMediano.map((v) => (v/1e6).toFixed(2)+'M').join(' ')} falidos ${m.falidos} | forca ${m.forcaMedia.join('/')} goleada ${m.maiorGoleada} marc ${m.maxGolosMarcador}`)
  }
}
