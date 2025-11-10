# Zenko by Zekai

Zenko é um aplicativo mobile-first de produtividade com quatro módulos integrados: **Tarefas (Kanban)**, **Pomodoro**, **Lembretes** e **Dashboard**. Ele utiliza Supabase (Postgres, Auth anônima e Storage) para persistência, realtime e uploads. O frontend é construído em React + Vite + TypeScript e Tailwind, enquanto o backend (mínimo) usa Node + Express para health-check e futuras extensões.

## Abas principais

- **Tarefas** – Quadro Kanban com CRUD completo, drag-and-drop, filtros, checklist e anexos via Supabase Storage.
- **Pomodoro** – Timer com presets (25/10/5), opção customizada, histórico diário e registro automático no Supabase.
- **Lembretes** – CRUD com agendamento de notificações locais e categorização entre próximos e passados.
- **Dashboard** – KPIs em tempo real e gráficos Recharts consumindo views do banco e atualizações via Supabase Realtime.

## Pré-requisitos

- Node.js 18+
- pnpm (recomendado) ou npm
- Conta Supabase com projeto ativo

## Configuração do Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com/).
2. No Dashboard, copie a **Project URL** e a **anon public key**.
3. Execute o script `schema.sql` na aba SQL do Supabase para criar tabelas, views e índices.
4. No Storage, crie um bucket público chamado `attachments`.
5. (Opcional) Configure regras de Storage para permitir upload/leitura autenticados.

## Variáveis de ambiente

Copie `.env.example` para `.env` na raiz do projeto e preencha:

```bash
VITE_SUPABASE_URL=SEU_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
SUPABASE_URL=SEU_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE
```

As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são utilizadas apenas pelo backend (caso você venha a expandi-lo).

## Instalação

```bash
cd zenko
pnpm install --filter zenko-frontend...
pnpm install --filter zenko-backend...
```

> Use `npm install` caso prefira npm.

## Execução em ambiente local

### Frontend

```bash
cd zenko/frontend
pnpm install
pnpm dev
```

A aplicação estará em `http://localhost:5173`.

### Backend (opcional)

```bash
cd zenko/backend
pnpm install
pnpm dev
```

Servidor de saúde em `http://localhost:4000/health`.

## Testes

- **Unitários** (Vitest):
  ```bash
  cd zenko/frontend
  pnpm test
  ```
- **E2E** (Cypress):
  ```bash
  cd zenko/tests/e2e
  pnpm install
  pnpm cy:run
  ```
  > Ajuste a baseUrl no `cypress.config.ts` se necessário e garanta Supabase rodando.

## Build de produção

```bash
cd zenko/frontend
pnpm build
pnpm preview
```

## Estrutura de pastas

```
zenko/
  frontend/      # Aplicação React mobile-first com Zustand, React Query e Recharts
  backend/       # Servidor Express mínimo (health-check)
  tests/         # Vitest + Cypress
  schema.sql     # Script de criação do schema Supabase
  .env.example
  README.md
```

## Notas de segurança

- Nunca exponha a service role key em ambientes públicos. Utilize apenas no backend seguro.
- Configure CORS no Supabase para aceitar apenas o domínio da aplicação em produção.
- Autenticação anônima é suficiente para POCs; planeje migração para provedores sociais conforme necessário.

## Futuro: login social

Para evoluir do login anônimo, utilize o `supabase.auth.linkIdentity` para relacionar o usuário anônimo ao provedor (Google, por exemplo). Assim, o `user_id` permanece o mesmo e as tabelas existentes continuam válidas.

## Definição de pronto

A entrega está preparada para:

- Criar/editar/excluir tarefas com anexos e drag-and-drop persistente.
- Executar ciclos de Pomodoro com presets e histórico no Supabase, com notificações locais.
- Gerenciar lembretes com notificações e segmentação entre próximos/passados.
- Visualizar KPIs e gráficos atualizados em tempo real no Dashboard.
- Executar testes unitários (Vitest) e end-to-end (Cypress).
- Layout mobile-first para telas de 360-420px sem scroll horizontal.
