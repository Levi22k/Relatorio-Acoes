# Caderno de Ações

Código-fonte do site de registro de ações, membros, ranking e tesouraria.

## Antes de publicar

Este ZIP contém o código, não uma cópia dos dados da sua conta. Não inclui prints, banco de dados, membros, senhas, tokens, configurações locais ou dependências instaladas.

**Enviar o projeto para o GitHub não coloca o site em funcionamento. O GitHub Pages não executa este projeto**, pois ele depende de APIs no servidor, banco D1 e armazenamento R2.

Esta é a versão atual exportada, **ainda não adaptada para hospedagem independente nem para um caderno compartilhado pelo bando**:

- O login de produção depende dos cabeçalhos de autenticação fornecidos pela hospedagem Sites. As rotas de login não são um serviço de autenticação autônomo.
- Os registros são separados pelo identificador da conta, no campo `owner`. Compartilhar o endereço não faz os membros enxergarem os mesmos dados.
- Para hospedar fora do ambiente original, é necessário adaptar a integração de acesso do servidor. O pedido atual dispensa criar um novo sistema de login: esta exportação mantém a integração existente e não atribui autores às alterações. Uma instalação compartilhada sem login ainda exige substituir o escopo por conta por um escopo comum no servidor.
- Para um único caderno do bando, é necessário adaptar o escopo de dados por conta para um caderno comum. Essa adaptação de hospedagem não foi feita nesta exportação.
- D1 guarda os registros e R2 guarda as imagens. A migração de dados existentes é uma etapa separada e não é feita por este arquivo.

## Colocar no GitHub

1. Extraia o ZIP.
2. Crie um repositório no GitHub. Se escolher público, qualquer pessoa poderá consultar o código.
3. Envie o conteúdo da pasta `caderno-de-acoes` para a raiz do repositório, incluindo os arquivos que começam com ponto, como `.gitignore` e `.openai/hosting.json`.
4. Confira se `package.json`, `app/`, `db/` e `drizzle/` aparecem na raiz.

Não envie o ZIP como único arquivo do repositório: extraia e envie seus arquivos. Não envie `node_modules`, `.env`, `.wrangler` nem bancos locais.

## Executar para desenvolvimento local

Requisitos do projeto: Node.js 22.13 ou superior e npm. Execute na pasta que contém `package.json`:

```sh
npm ci
npm run build
```

Para inicializar um banco LOCAL NOVO, aplique os arquivos SQL abaixo uma única vez e na ordem indicada. Eles são versões do esquema, não dados reais:

```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_colorful_arachne.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_loose_ironclad.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_early_sprite.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_fixed_anthem.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_perpetual_bloodstrike.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_useful_shocker.sql
npm run dev
```

Abra o endereço local informado no terminal. O desenvolvimento em loopback simula um usuário local; essa simulação não é um login de produção. Há mais informações do ambiente em `README-BASE.md`.

## Recursos incluídos

- Visual em grafite e cobre, com títulos em Libre Caslon Display e interface em DM Sans. Bloco Meu caderno removido; layout conferido no computador e no celular.
- Prints e histórico de ações, com vitória, derrota e cancelamento.
- Leitura automática com Tesseract no navegador; revisão manual dos nomes, abates e mortes.
- Cadastro de membros e apelidos para ajudar na leitura.
- Ranking de abates.
- Prêmios por categoria e local, incluindo Cidade Queimada como lojinha.
- Desconto de 15% nas ações, com 85% destinados aos participantes. O quadro da reserva e sua coluna foram removidos da tela principal.
- Tesouraria por membro, pagamentos e extratos.
- Ajustes individuais positivos ou negativos, com motivo e opção de desfazer. Ajustes manuais não recebem desconto de 15%.
- Histórico geral de ajustes com pessoa, valor, motivo, data e hora. Desfazer mantém o lançamento original e registra o movimento inverso. Não há identificação do autor nem um novo sistema de login.
- O histórico não oferece botão nem API para apagar eventos. Quem administra diretamente o banco de dados ainda pode modificá-lo; isso não equivale a uma trilha imutável externa. Ajustes apagados antes da criação do histórico não podem ser recuperados.

## Estrutura principal

- `app/dashboard.tsx`: navegação, histórico e formulário de ações.
- `app/ocr.ts`, `app/ocr-image.ts`: leitura de prints.
- `app/members.tsx`, `app/member-match.ts`: membros e correspondência de nomes.
- `app/treasury.tsx`, `app/treasury-calculation.ts`, `app/adjustment-form.tsx`: tesouraria e ajustes.
- `app/api/`: APIs autenticadas de ações, membros, imagens e tesouraria.
- `app/chatgpt-auth.ts`: integração atual de autenticação; ponto que precisa ser adaptado para outra hospedagem.
- `db/schema.ts` e `drizzle/`: esquema e migrações do banco.
- `vite.config.ts`, `build/`, `scripts/`: ambiente de desenvolvimento e compilação.

O identificador do site original foi removido de `.openai/hosting.json` para que esta cópia não aponte uma publicação para o projeto existente. As bibliotecas mantêm suas licenças e avisos incluídos no projeto.

## Envio pelo navegador

Esta edição remove componentes e exemplos não utilizados, mantendo as funções do site. Extraia o ZIP, abra a pasta caderno-de-acoes e arraste seu conteúdo (incluindo pastas) para Add file → Upload files no GitHub. O package.json deve ficar na raiz do repositório. Confirme em Commit changes. Não envie apenas o ZIP. Enviar o código não publica automaticamente o site no GitHub Pages: a adaptação de hospedagem descrita acima continua necessária.
