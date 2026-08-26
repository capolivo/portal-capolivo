-- View analítica de clientes: frequência de compra e segmentação RFM
-- (Recência, Frequência, Valor). É a base para "quem são os melhores clientes"
-- e "com que frequência cada cliente compra".
--
-- Segmentação é uma primeira versão (regras simples de quartil) — ajustar
-- os cortes junto com o comercial (Martina) conforme o negócio validar.
--
-- NOTA: pedidos.status guarda o código numérico de situação do Bling (não um texto
-- tipo "cancelado" — o Bling não expõe uma lista fixa disso, é configurável por
-- conta, via /situacoes/modulos). Por enquanto esta view conta TODOS os pedidos
-- sincronizados, sem excluir cancelados. Depois do primeiro sync real, checar quais
-- códigos aparecem em pedidos.status e, se necessário, adicionar um filtro aqui.

create materialized view if not exists public.cliente_metricas as
with agregados as (
  select
    c.id as cliente_id,
    c.nome,
    c.tipo,
    min(p.data_pedido) as primeira_compra,
    max(p.data_pedido) as ultima_compra,
    count(p.id) as total_pedidos,
    coalesce(sum(p.valor_total), 0) as valor_total,
    case
      when count(p.id) > 0 then coalesce(sum(p.valor_total), 0) / count(p.id)
      else 0
    end as ticket_medio,
    case
      when count(p.id) > 1 then
        (max(p.data_pedido) - min(p.data_pedido))::numeric / (count(p.id) - 1)
      else null
    end as intervalo_medio_dias
  from public.clientes c
  left join public.pedidos p on p.cliente_id = c.id
  group by c.id, c.nome, c.tipo
),
com_compras as (
  select
    *,
    (current_date - ultima_compra) as dias_desde_ultima_compra
  from agregados
  where total_pedidos > 0
),
pontuados as (
  select
    *,
    ntile(4) over (order by dias_desde_ultima_compra asc, cliente_id) as score_recencia,
    ntile(4) over (order by total_pedidos desc, cliente_id) as score_frequencia,
    ntile(4) over (order by valor_total desc, cliente_id) as score_valor
  from com_compras
)
select
  cliente_id,
  nome,
  tipo,
  primeira_compra,
  ultima_compra,
  total_pedidos,
  valor_total,
  round(ticket_medio, 2) as ticket_medio,
  round(intervalo_medio_dias, 1) as intervalo_medio_dias,
  dias_desde_ultima_compra,
  case
    when total_pedidos > 1 and score_recencia <= 2 and score_frequencia <= 2 and score_valor <= 2 then 'Campeão'
    when total_pedidos > 1 and score_frequencia <= 2 and score_valor <= 2 then 'Fiel'
    when total_pedidos = 1 and score_recencia <= 2 then 'Novo'
    when score_recencia >= 3 then 'Em risco'
    else 'Regular'
  end as segmento_rfm
from pontuados

union all

select
  cliente_id,
  nome,
  tipo,
  primeira_compra,
  ultima_compra,
  total_pedidos,
  valor_total,
  round(ticket_medio, 2),
  intervalo_medio_dias,
  null::integer as dias_desde_ultima_compra,
  'Sem compras' as segmento_rfm
from agregados
where total_pedidos = 0;

create unique index if not exists idx_cliente_metricas_cliente
  on public.cliente_metricas (cliente_id);

grant select on public.cliente_metricas to authenticated;

-- Chamada pela Edge Function sync-bling após cada sincronização.
create or replace function public.refresh_cliente_metricas()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.cliente_metricas;
$$;
