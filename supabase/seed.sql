-- Dados fictícios para desenvolvimento local (supabase start).
-- NÃO representam clientes reais da Capolivo.

insert into public.produtos (nome, variedade, formato, sku) values
  ('Azeite Arbequina 500ml', 'Arbequina', '500ml', 'CAP-ARB-500'),
  ('Azeite Koroneiki 250ml', 'Koroneiki', '250ml', 'CAP-KOR-250'),
  ('Azeite Picual 500ml', 'Picual', '500ml', 'CAP-PIC-500'),
  ('Azeite Coratina 250ml', 'Coratina', '250ml', 'CAP-COR-250'),
  ('Azeite Frantoio 500ml', 'Frantoio', '500ml', 'CAP-FRA-500');

insert into public.clientes (nome, tipo, cidade, uf) values
  ('Empório Santa Maria', 'pessoa_juridica', 'Porto Alegre', 'RS'),
  ('Grand Cru', 'pessoa_juridica', 'São Paulo', 'SP'),
  ('Maria Fernanda Souza', 'pessoa_fisica', 'Canguçu', 'RS'),
  ('Casa Moacir', 'pessoa_juridica', 'Curitiba', 'PR'),
  ('João Pedro Alves', 'pessoa_fisica', 'Porto Alegre', 'RS');

-- Pedidos: Empório Santa Maria compra com frequência alta; Grand Cru é cliente novo;
-- Maria Fernanda comprou uma vez há muito tempo (em risco); Casa Moacir é fiel.
with c as (select id, nome from public.clientes)
insert into public.pedidos (cliente_id, data_pedido, valor_total, status, canal)
select id, data_pedido, valor_total, 'concluido', 'e-commerce'
from (
  select
    (select id from c where nome = 'Empório Santa Maria') as id,
    (current_date - (n * 20)) as data_pedido,
    350.00 as valor_total
  from generate_series(0, 8) as n
  union all
  select
    (select id from c where nome = 'Casa Moacir'),
    (current_date - (n * 45)),
    620.00
  from generate_series(0, 4) as n
  union all
  select
    (select id from c where nome = 'Grand Cru'),
    current_date - 5,
    980.00
  union all
  select
    (select id from c where nome = 'Maria Fernanda Souza'),
    current_date - 260,
    74.00
) as pedidos_fake;

refresh materialized view public.cliente_metricas;
