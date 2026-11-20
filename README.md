# Mister-foot

Um jogo de gestão de futebol simples e viciante, inspirado nos clássicos do género. Escolhes um clube, assinas contrato e geres o plantel e o clube, jornada após jornada, à procura da subida de divisão e dos títulos.

Todos os clubes e jogadores são fictícios, gerados a partir de uma semente: a mesma semente dá sempre o mesmo mundo.

- **Jogar:** https://hestrompa.github.io/mister-foot/
- **Plano do projeto:** https://claude.ai/artifact/64mohujVmBLbhgpQRc8CHC

Corre inteiramente no browser; a carreira fica gravada no próprio browser, por isso podes fechar a página e continuar mais tarde.

## Como correr

Precisas de Node 22 ou mais recente.

```sh
npm install      # instalar dependências
npm run dev      # servidor de desenvolvimento (http://localhost:5173/)
npm test         # testes unitários (Vitest)
npm run build    # versão de produção em dist/
```

Teste de fumo num browser real (Playwright), contra a versão de produção:

```sh
npm run build
npx vite preview --port 4173 &
npm run fumo     # ou: node testes/fumo.mjs http://localhost:4173/
```

As capturas de ecrã ficam na pasta indicada pela variável `OUT`.

## Organização

```
src/
  core/    simulação do jogo, sem interface (mundo, nomes, aleatoriedade, regras)
  ui/      ecrãs e componentes React
  jogo/    gravação e carregamento da carreira
testes/    teste de fumo com Playwright
.github/   publicação automática no GitHub Pages a cada push para main
```

Os testes unitários vivem ao lado do código, em `src/**/*.test.ts`.

## Licença

[MIT](LICENSE) © 2026 Hugo
