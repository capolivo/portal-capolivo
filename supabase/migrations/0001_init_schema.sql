-- Schema inicial do Portal Capolivo.
-- Espelha os dados vindos do Bling (clientes, produtos, pedidos) via a Edge Function sync-bling.

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  bling_id text unique,
  nome text not null,
  cnpj_cpf text,
  tipo text check (tipo in ('pessoa_fisica', 'pessoa_juridica')),
  cidade text,
  uf text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  bling_id text unique,
  nome text not null,
  variedade text,
  formato text,
  sku text
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  bling_id text unique,
  cliente_id uuid references public.clientes (id) on delete set null,
  data_pedido date not null,
  valor_total numeric(12, 2) not null default 0,
  status text,
  canal text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  quantidade numeric(12, 3) not null default 0,
  valor_unitario numeric(12, 2) not null default 0
);

-- Controle de sincronização incremental (uma linha por entidade sincronizada do Bling).
create table if not exists public.sync_log (
  tabela text primary key,
  ultima_sincronizacao timestamptz,
  status text,
  mensagem text
);

-- Tokens OAuth2 do Bling. Nunca exposta ao frontend — só a service role (Edge Function) acessa.
create table if not exists public.bling_auth (
  id int primary key default 1,
  access_token text,
  refresh_token text,
  expira_em timestamptz,
  constraint bling_auth_singleton check (id = 1)
);

create index if not exists idx_pedidos_cliente on public.pedidos (cliente_id);
create index if not exists idx_pedidos_data on public.pedidos (data_pedido);
create index if not exists idx_itens_pedido_pedido on public.itens_pedido (pedido_id);

alter table public.clientes enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.sync_log enable row level security;
alter table public.bling_auth enable row level security;

-- Equipe interna autenticada pode ler os dados de negócio.
-- Escrita fica restrita à service role (usada pela Edge Function de sync).
create policy "authenticated_read_clientes" on public.clientes
  for select to authenticated using (true);

create policy "authenticated_read_produtos" on public.produtos
  for select to authenticated using (true);

create policy "authenticated_read_pedidos" on public.pedidos
  for select to authenticated using (true);

create policy "authenticated_read_itens_pedido" on public.itens_pedido
  for select to authenticated using (true);

-- sync_log e bling_auth não têm policy para "authenticated": só a service role enxerga.
