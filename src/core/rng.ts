// Sorteios com semente: o mesmo número de semente gera sempre o mesmo mundo.
export interface Rng {
  /** Número em [0, 1). */
  next(): number
  /** Inteiro em [min, max], inclusivo. */
  int(min: number, max: number): number
  /** Elemento ao acaso de uma lista. */
  pick<T>(list: readonly T[]): T
  /** Distribuição normal (média, desvio-padrão). */
  normal(mean: number, sd: number): number
  /** true com probabilidade p. */
  chance(p: number): boolean
  /** Baralha uma cópia da lista. */
  shuffle<T>(list: readonly T[]): T[]
  /** Estado interno, para gravar e retomar. */
  state(): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    normal: (mean, sd) => {
      const u = 1 - next()
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    chance: (p) => next() < p,
    shuffle: (list) => {
      const a = list.slice()
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    },
    state: () => s,
  }
  return rng
}
