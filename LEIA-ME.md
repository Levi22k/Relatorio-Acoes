# Caderno de Ações — GitHub Pages + Supabase

Esta versão funciona como um caderno compartilhado do bando, sem tela de login. As ações, membros, imagens e saldos ficam no Supabase. O GitHub Pages hospeda a interface. Removidos o cartão de quantidade de participantes e o KDR; o ranking mostra Ações, Vitórias, Win Rate e Abates.

**Situação da entrega:** código compilado e regras do banco testadas localmente. A conexão com seu projeto Supabase e a publicação no seu GitHub ainda precisam ser configuradas. O ZIP não contém senhas, chaves, membros, prints nem registros do site anterior. Os dados antigos continuam no site anterior e não são migrados automaticamente; mantenha-o disponível até concluir a migração dos dados.

## 1. Criar o projeto no Supabase

1. Entre em https://supabase.com/dashboard.
2. Se necessário, crie uma organização no plano Free.
3. Clique em **New project**, use o nome **Caderno de Ações** e escolha a organização.
4. Crie e guarde a senha do banco com você. Não coloque essa senha no código, no GitHub ou em mensagens.
5. Escolha uma região próxima do Brasil e crie o projeto. Aguarde a preparação terminar.

## 2. Instalar o banco

1. Abra **SQL Editor → New query** no projeto NOVO.
2. Abra `site/supabase/instalar.sql` deste ZIP em um editor de texto.
3. Copie o conteúdo completo, cole no SQL Editor e clique em **Run**.
4. Execute uma única vez. O arquivo cria tabelas, funções, regras e o armazenamento `action-prints`.

**Acesso escolhido para este projeto:** não há login. Visitantes que acessarem o aplicativo poderão ler, cadastrar, editar e excluir ações/membros, registrar pagamentos e ajustar saldos. As imagens também são públicas. A chave pública não é uma senha. O histórico registra valor, membro, motivo e horário dos ajustes, inclusive os desfeitos; ele não identifica o autor e não impede um visitante de fazer um ajuste. A interface e a API pública não permitem editar/apagar esse histórico. Quem administra o banco no Supabase continua tendo poderes sobre os dados. Use um projeto Supabase dedicado a este caderno.

## 3. Obter as duas configurações públicas

No painel do projeto, procure **Connect** ou **Project Settings → API / API Keys** e copie:

- **Project URL**, semelhante a `https://seu-projeto.supabase.co`.
- **Publishable key** (começa com `sb_publishable_`) ou a chave antiga **anon / public**.

Nunca use `service_role`, `sb_secret_`, senha do banco nem uma chave secreta. Essas duas configurações públicas vão aparecer no navegador; isso é esperado nesta arquitetura.

## 4. Enviar o ZIP extraído para o repositório

Repositório: https://github.com/Levi22k/Relatorio-Acoes

1. Extraia o ZIP. Você verá `site/`, `.github/` e este `LEIA-ME.md`.
2. No repositório, use **Add file → Upload files**.
3. Arraste essas duas pastas e o arquivo para a raiz do repositório. Envie os arquivos extraídos, não apenas o ZIP.
4. Confirme em **Commit changes**.
5. Verifique se existem `site/package.json` e `.github/workflows/deploy.yml` no GitHub. Não coloque tudo dentro de mais uma pasta.

Os arquivos antigos na raiz podem permanecer: o novo fluxo compila apenas a pasta `site`. Se já houver outro fluxo de publicação do Pages, mantenha ativo somente o novo fluxo **Publicar Caderno** para evitar que o antigo sobrescreva a publicação. Não envie `node_modules`, `dist` nem `.env`.

## 5. Configurar e publicar no GitHub

1. Abra **Settings → Secrets and variables → Actions → Variables**.
2. Clique em **New repository variable** e adicione:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable key ou anon/public |

3. Vá a **Settings → Pages → Build and deployment** e selecione **Source: GitHub Actions**.
4. Vá à aba **Actions**, abra **Publicar Caderno**, clique em **Run workflow** e escolha a branch usada no repositório.
5. Aguarde o resultado verde. O GitHub mostrará o endereço publicado. O endereço esperado para esse repositório é **https://levi22k.github.io/Relatorio-Acoes/** — ele só estará disponível depois da publicação terminar.

O fluxo executa automaticamente os testes, compila o site e publica. Novos commits em `main` ou `master` atualizam a publicação. Se a branch tiver outro nome, ajuste a lista em `.github/workflows/deploy.yml`. Se mudar as variáveis, execute **Run workflow** novamente.

## 6. Conferir antes de mandar ao bando

Abra o endereço publicado, cadastre um membro e confira em outro dispositivo se o mesmo cadastro aparece (atualize a página). Cadastre uma ação e confira o saldo. Os valores só são creditados em vitórias; a parte líquida é 85% do prêmio. Ajustes manuais entram integralmente. Derrotas marcam todos como mortos. A leitura de prints continua exigindo conferência humana, especialmente em imagens pequenas.

Se aparecer **Configure o banco do bando**, faltam as duas variáveis ou é preciso publicar novamente. Se aparecer erro ao carregar os dados, confira o endereço/chave e se o SQL foi executado no mesmo projeto. Para erros de publicação, veja os detalhes da execução na aba Actions.

## Desenvolvimento local

Requer Node.js 22.12+ ou 24. Na pasta `site`, copie `.env.example` para `.env.local`, preencha apenas as duas configurações públicas e execute:

```sh
npm ci
npm test
npm run dev
```

`npm run build` gera `dist`. O teste de banco roda em PostgreSQL local em memória (PGlite), sem tocar no Supabase real; ele cobre os cálculos e permissões do aplicativo. As regras de armazenamento e a conexão real devem ser verificadas depois da configuração do Supabase.

## Referências oficiais

- GitHub Pages com Vite: https://vite.dev/guide/static-deploy.html#github-pages
- Funções no Supabase: https://supabase.com/docs/guides/database/functions
- Chaves públicas e secretas: https://supabase.com/docs/guides/getting-started/api-keys
- Armazenamento: https://supabase.com/docs/guides/storage/security/access-control
