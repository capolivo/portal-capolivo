-- Campos para a aba E-commerce: frete, UF de destino e informações complementares
-- da nota fiscal (onde normalmente aparece o valor do ICMS DIFAL para vendas
-- interestaduais). Só são preenchidos para pedidos do canal de e-commerce (Tray),
-- via chamadas extras de detalhe do pedido/nota fiscal — não vêm na listagem padrão.
alter table public.pedidos
  add column if not exists frete numeric(12, 2),
  add column if not exists uf_destino text,
  add column if not exists informacao_complementar text,
  add column if not exists valor_difal numeric(12, 2),
  add column if not exists detalhe_sincronizado_em timestamptz;

create index if not exists idx_pedidos_canal on public.pedidos (canal);
