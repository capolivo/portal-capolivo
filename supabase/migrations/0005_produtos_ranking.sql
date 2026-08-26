-- Ranking de produtos mais vendidos, a partir dos itens de pedido sincronizados.
-- Não é materializada (dataset pequeno, ~poucas dezenas de produtos) — sempre
-- reflete os itens já sincronizados no momento da consulta.
create or replace view public.produtos_ranking as
select
  p.id as produto_id,
  p.nome,
  p.sku,
  p.variedade,
  p.formato,
  coalesce(sum(ip.quantidade), 0) as quantidade_total,
  count(distinct ip.pedido_id) as total_pedidos,
  coalesce(sum(ip.quantidade * ip.valor_unitario), 0) as valor_total
from public.produtos p
left join public.itens_pedido ip on ip.produto_id = p.id
group by p.id, p.nome, p.sku, p.variedade, p.formato;

grant select on public.produtos_ranking to authenticated;
