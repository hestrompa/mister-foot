# Mister-foot

Jogo de gestão de futebol simples e viciante (ritmo dos clássicos do género, camadas tipo FM opcionais). Jogo original: clubes, jogadores, nome e aspeto próprios. UI em português de Portugal.

- `src/core/`: simulação sem UI, determinística (usar sempre `createRng(semente)`, nunca `Math.random` no núcleo).
- `src/ui/`, `src/App.tsx`: ecrãs React. `src/jogo/`: gravar/carregar (localStorage, sempre em try/catch).
- Testes: `npm test` (vitest, ficheiros `src/**/*.test.ts`), `npm run fumo` com `npx vite preview --port 4173` a correr (Playwright, capturas em `OUT`).
- Publicação: push para `main` corre `.github/workflows/pages.yml` (testes, build, GitHub Pages em https://hestrompa.github.io/mister-foot/). A versão (`__VERSAO__`) é o número de commits + hora de Lisboa.
- Regras de design: resultados emergem da força, forma e tática; sem alvos de golos no código. O meio-campo tem de contar no motor (nenhuma formação extrema pode ganhar sempre).
