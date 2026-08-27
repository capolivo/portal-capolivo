export type ClienteMetrica = {
  cliente_id: string;
  nome: string;
  primeira_compra: string | null;
  ultima_compra: string | null;
  total_pedidos: number;
  valor_total: number;
  ticket_medio: number;
  intervalo_medio_dias: number | null;
  dias_desde_ultima_compra: number | null;
  segmento_rfm: string;
  tipo: string | null;
};

export type Pedido = {
  id: string;
  bling_id: string | null;
  cliente_id: string | null;
  data_pedido: string;
  valor_total: number;
  status: string | null;
  canal: string | null;
  frete: number | null;
  uf_destino: string | null;
  informacao_complementar: string | null;
  valor_difal: number | null;
};

export type Produto = {
  id: string;
  bling_id: string | null;
  nome: string;
  variedade: string | null;
  formato: string | null;
  sku: string | null;
};

export type EstoqueSaldo = {
  produto_id: string;
  nome: string;
  sku: string | null;
  variedade: string | null;
  formato: string | null;
  saldo: number;
  ultima_movimentacao_em: string | null;
};

export type EstoqueMovimento = {
  id: string;
  produto_id: string;
  tipo: "envase" | "venda" | "ajuste";
  quantidade: number;
  observacao: string | null;
  criado_em: string;
  criado_por: string | null;
};
