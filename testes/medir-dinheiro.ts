// Dinheiro ao longo de várias épocas com mercado, contratos, obras e empréstimos: npx tsx testes/medir-dinheiro.ts [mundos] [épocas] (TACA=1 joga também a taça e a Europa; TUDO=1 também balneário, seleções, direção e imprensa)
import { medirDinheiro } from '../src/jogo/medir'
const mundos = Number(process.argv[2] ?? 2), epocas = Number(process.argv[3] ?? 5)
const M = (v: number) => (v / 1e6).toFixed(2)
for (let s = 1; s <= mundos; s++) {
  for (const m of medirDinheiro(s * 101, epocas, 3, !!process.env.TACA, !!process.env.TUDO)) {
    console.log(`mundo ${s} ${m.ano}: min/p10/p50/p90/max ${m.p50.map((_, d) => `${M(m.min[d])}/${M(m.p10[d])}/${M(m.p50[d])}/${M(m.p90[d])}/${M(m.max[d])}`).join(' | ')} || sal ${m.salarios.map(M).join('/')} | verm ${m.vermelho} empr ${m.emprestimo} obras ${m.obras} | forca ${m.forcaMedia.join('/')} | plantel ${m.plantelMin}-${m.plantelMax} | transf ${m.transferencias} | total ${M(m.total)}`)
    if (process.env.FLUXOS) m.fluxos.forEach((f, d) => console.log(`   D${d + 1} ` + Object.entries(f).map(([k, v]) => `${k} ${M(v)}`).join(' ')))
  }
}
