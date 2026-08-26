-- Suporte para sincronizar os itens de cada pedido (o que foi vendido),
-- necessário pra ranking de produtos mais vendidos.
alter table public.itens_pedido
  add column if not exists bling_id text unique;

alter table public.pedidos
  add column if not exists itens_sincronizados_em timestamptz;

create index if not exists idx_itens_pedido_produto on public.itens_pedido (produto_id);
create index if not exists idx_pedidos_itens_sincronizados on public.pedidos (itens_sincronizados_em);
