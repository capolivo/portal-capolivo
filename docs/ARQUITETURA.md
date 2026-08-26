# Arquitetura — Portal Capolivo

## Visão geral

```
Bling ERP  --(OAuth2, sync incremental)-->  Edge Function (Supabase)  -->  Postgres (Supabase)
                                                                                |
                                                                                v
                                                                    view cliente_metricas (RFM)
                                                                                |
                                                                                v
                                                              Next.js (Vercel)  <-- equipe Capolivo
```

- **Supabase** é a fonte única de dados do portal (não se lê o Bling diretamente do frontend).
- A sincronização é **um caminho só: Bling → Supabase**. O portal não escreve de volta no Bling
  nesta fase.
- A camada analítica (frequência de compra, melhores clientes) vive em SQL, na materialized view
  `cliente_metricas` — não em código de frontend — para poder ser reaproveitada por qualquer
  cliente futuro (app, planilha, relatório).

## Por que essa stack

- **Next.js + Vercel:** deploy simples, free tier cobre uso interno de uma empresa pequena, e é
  um app web responsivo — funciona em celular pelo navegador sem custo de loja de app.
- **Supabase:** Postgres gerenciado + Auth + Row Level Security + Edge Functions no mesmo
  projeto, free tier generoso (500MB de banco, suficiente por muito tempo para este volume de
  dados).
- **Bling API v3 (OAuth2):** é o único jeito suportado hoje de acessar dados do Bling
  programaticamente.

Custo esperado para começar: **R$ 0** (ambos free tier). Vercel Pro (~US$20/mês) e Supabase Pro
(~US$25/mês) só se tornam necessários se o uso crescer bastante (mais usuários simultâneos, mais
dados, mais chamadas de API) — não é esperado nesta fase inicial.

## Passo a passo de configuração

### 1. Supabase

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com) (free tier).
2. Em **Project Settings → API**, copie a `Project URL` e a `anon public key` para o
   `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. Copie também a `service_role key` — essa **nunca** vai para o frontend nem para o `.env.local`
   usado pelo Next.js; ela é usada só pela Edge Function (configurada como secret do Supabase, ver
   passo 4).
4. Aplique as migrations (`supabase/migrations/`) — via SQL Editor do painel do Supabase (copiar
   e colar o conteúdo de cada arquivo, em ordem) ou via Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
5. Crie ao menos um usuário para a equipe em **Authentication → Users** (e-mail/senha) — é o
   login usado no portal.

### 2. Bling

1. Acesse [developer.bling.com.br](https://developer.bling.com.br), registre um aplicativo do
   tipo **API / Privado** e defina a `redirect_uri` como `https://<seu-dominio>/api/bling/callback`
   (ou `http://localhost:3000/api/bling/callback` em desenvolvimento).
2. Guarde `Client ID` e `Client Secret` em `BLING_CLIENT_ID` / `BLING_CLIENT_SECRET` no
   `.env.local` (o Secret nunca deve ser compartilhado fora do arquivo local).
3. Com o portal rodando e você **logado**, acesse `/api/bling/authorize` no navegador — ele
   redireciona para a tela de autorização do Bling. Depois de aprovar, o Bling volta para
   `/api/bling/callback`, que troca o código por `access_token`/`refresh_token` e já grava tudo na
   tabela `bling_auth` automaticamente (rotas em `app/api/bling/`). É um passo único — depois
   disso a Edge Function `sync-bling` renova o token sozinha.
4. **Antes de rodar em produção:** confira os endpoints e nomes de campo usados em
   `supabase/functions/sync-bling/index.ts`, `app/api/bling/authorize/route.ts` e
   `app/api/bling/callback/route.ts` contra a documentação atual do Bling — estão marcados com
   `TODO` no código porque a API pode ter mudado desde que foram escritos.

### 3. Edge Function de sincronização

```bash
npx supabase functions deploy sync-bling
npx supabase secrets set BLING_CLIENT_ID=... BLING_CLIENT_SECRET=...
```

Agende a execução periódica (ex.: a cada 6h) via `pg_cron` chamando a função, ou via um agendador
externo (cron job, GitHub Actions) fazendo `POST` no endpoint da função.

### 4. Frontend (Vercel)

1. Crie um projeto em [vercel.com](https://vercel.com), conecte o repositório.
2. Configure as mesmas variáveis do `.env.local` (exceto `SUPABASE_SERVICE_ROLE_KEY`, que não é
   usada pelo frontend) nas **Environment Variables** do projeto Vercel.
3. Deploy automático a cada push.

## Modelo de dados

Ver `supabase/migrations/0001_init_schema.sql` para o schema completo. Resumo:

- `clientes`, `produtos`, `pedidos`, `itens_pedido` — espelham o Bling.
- `sync_log` — controla a sincronização incremental (evita reprocessar tudo a cada rodada).
- `bling_auth` — tokens OAuth2 do Bling, acessível só pela service role.
- `cliente_metricas` (materialized view, `0002_cliente_metricas.sql`) — frequência de compra,
  ticket médio, recência e segmento RFM (Campeão / Fiel / Regular / Novo / Em risco / Sem
  compras) por cliente. É essa view que alimenta a página **Clientes** do portal.

A segmentação RFM usa quartis simples (`ntile(4)`) — é uma primeira versão. Vale revisar os
cortes com o comercial (Martina) depois que houver dados reais.

## Decisões em aberto

- Mapeamento de **variedade** (Arbequina, Koroneiki...) por produto do Bling: a API do Bling não
  tem esse campo nativamente. Hoje fica `null` no sync — decidir se mapeia por SKU/nome do
  produto (regra simples no `map ProdutoFromBling`) ou se mantém um cadastro manual auxiliar.
- Frequência de agendamento do sync (a cada 6h é um ponto de partida, não uma decisão final).
- Papéis de acesso (comercial/marketing/financeiro/admin) — hoje qualquer usuário autenticado lê
  tudo; se for necessário restringir por papel, ajustar as policies de RLS em
  `0001_init_schema.sql`.
