# Portal Capolivo

Portal interno da Capolivo: centraliza clientes, produtos e pedidos vindos do Bling ERP em um
banco próprio (Supabase) e mostra frequência de compra e melhores clientes.

Contexto de negócio e regras de conteúdo estão em [CLAUDE.md](./CLAUDE.md). Decisões técnicas e
passo a passo de configuração estão em [docs/ARQUITETURA.md](./docs/ARQUITETURA.md).

**Produção:** https://portal-capolivo.netlify.app

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Sem as variáveis do Supabase preenchidas, o portal mostra uma tela de "configure o Supabase" em
vez de quebrar — normal na primeira vez.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS v4, identidade visual Capolivo.
- **Backend:** Supabase (Postgres + Auth + Row Level Security + Edge Functions).
- **Integração:** Bling API v3 (OAuth2), sincronização incremental via Edge Function agendada.
- **Deploy:** Netlify (frontend) + Supabase (dados), ambos com free tier — ver
  [docs/ARQUITETURA.md](./docs/ARQUITETURA.md) para detalhes, custos e como publicar mudanças.

## Estrutura

```
app/                    Next.js App Router (páginas, layout, login)
components/             Componentes de UI reutilizáveis
lib/                    Clientes Supabase, tipos, tokens de marca
supabase/migrations/    Schema do banco (SQL)
supabase/functions/     Edge Functions (sync com o Bling)
docs/ARQUITETURA.md      Decisões técnicas e passo a passo de setup
```
