# Versão estática (GitHub Pages)

Esta pasta transforma o app em um site de arquivos estáticos, **sem alterar nenhum componente, estilo ou regra do app** (`app/`).

- `local-api.ts`: responde às rotas `/api/*` (ações, membros, tesouraria, prints) dentro do navegador, guardando os dados no IndexedDB. Faz o papel do servidor, do banco D1 e do R2.
- `main.tsx`: ponto de entrada. Instala a camada local e abre a tela principal (`app/dashboard.tsx`).
- `../index.html` e `../vite.static.config.ts`: entrada e configuração do build.

O site publicado fica na pasta `/docs` na raiz do repositório.

## Gerar de novo

```sh
cd site-75-arquivos/caderno-de-acoes
npm ci
npx vite build --config vite.static.config.ts
```

Os dados ficam no navegador de quem usa (IndexedDB): não são compartilhados entre pessoas nem entre aparelhos.
