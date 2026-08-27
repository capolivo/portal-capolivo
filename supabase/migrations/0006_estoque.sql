-- Controle de estoque de produtos envasados (250ml/500ml/200ml/5L), como um
-- livro de movimentações: cada envase, venda ou ajuste manual é uma linha.
-- O saldo atual é sempre a soma das movimentações (view estoque_saldo).
create table public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id),
  tipo text not null check (tipo in ('envase', 'venda', 'ajuste')),
  -- positivo = entrada (envase, ajuste pra cima), negativo = saída (venda, ajuste pra baixo)
  quantidade numeric(12, 3) not null,
  -- só preenchido pra tipo='venda' — referencia o item de pedido que originou a
  -- baixa, com índice único, pra nunca descontar a mesma venda duas vezes.
  origem_item_pedido_id uuid references public.itens_pedido (id),
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por text
);

create unique index idx_estoque_mov_origem_item
  on public.estoque_movimentos (origem_item_pedido_id)
  where origem_item_pedido_id is not null;

create index idx_estoque_mov_produto on public.estoque_movimentos (produto_id);

create view public.estoque_saldo as
select
  p.id as produto_id,
  p.nome,
  p.sku,
  p.variedade,
  p.formato,
  coalesce(sum(m.quantidade), 0) as saldo,
  max(m.criado_em) as ultima_movimentacao_em
from public.produtos p
left join public.estoque_movimentos m on m.produto_id = p.id
group by p.id, p.nome, p.sku, p.variedade, p.formato;

grant select on public.estoque_saldo to authenticated;

alter table public.estoque_movimentos enable row level security;

create policy "authenticated_read_estoque_movimentos" on public.estoque_movimentos
  for select to authenticated using (true);

-- Equipe pode lançar envases e ajustes manuais pelo portal — mas nunca o tipo
-- "venda", que só a sincronização automática (service role) pode criar.
create policy "authenticated_insert_envase_ajuste" on public.estoque_movimentos
  for insert to authenticated
  with check (tipo in ('envase', 'ajuste'));

-- Marca quais itens de pedido já geraram baixa de estoque (ou foram
-- explicitamente ignorados por serem anteriores ao início do controle).
alter table public.itens_pedido
  add column estoque_baixado_em timestamptz;

-- Início do controle de estoque: tudo que já existe no histórico não deve virar
-- baixa retroativa — só vendas novas, a partir de agora, vão descontar.
update public.itens_pedido set estoque_baixado_em = now() where estoque_baixado_em is null;
