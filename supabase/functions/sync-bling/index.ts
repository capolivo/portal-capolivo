// Edge Function: sincroniza clientes, produtos e pedidos do Bling (API v3, OAuth2)
// para o banco do Portal Capolivo, de forma incremental.
//
// Endpoints, parâmetros e campos abaixo foram conferidos em 2026-08-25 contra o
// OpenAPI oficial (developer.bling.com.br/build/assets/openapi-*.json) e contra um
// fluxo OAuth2 real (autorização + troca de token funcionaram). Pontos que ficaram
// sem resposta definitiva nesse OpenAPI, marcados com TODO abaixo:
//   - GET /contatos (listagem) não retorna cidade/UF/tipo de pessoa — só o detalhe
//     (GET /contatos/{id}) tem isso. Por ora cidade/uf/tipo ficam null; buscar o
//     detalhe por contato é N+1 chamadas, decidir se vale a pena depois.
//   - "variedade" e "formato" (250ml/500ml) do produto não existem como campo
//     próprio no Bling — nem em /produtos nem no detalhe. Precisam ser inferidos do
//     nome/código do produto ou de um mapeamento manual por SKU.
//   - situacao do pedido vem como código numérico (situacao.valor), não texto —
//     mapear para um rótulo exigiria consultar GET /situacoes; por ora grava o
//     código bruto.
//
// Agendamento: configurar via pg_cron para chamar esta função periodicamente
// (ex.: a cada 6h). Ver docs/ARQUITETURA.md.

import { createClient } from "npm:@supabase/supabase-js@2";

const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";
const BLING_API_BASE = "https://api.bling.com.br/Api/v3";

const BLING_ENDPOINTS = {
  clientes: "/contatos",
  produtos: "/produtos",
  pedidos: "/pedidos/vendas",
} as const;

type BlingAuthRow = {
  access_token: string | null;
  refresh_token: string | null;
  expira_em: string | null;
};

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

function getSupabaseAdmin() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

async function getValidAccessToken(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<string> {
  const { data, error } = await supabase
    .from("bling_auth")
    .select("access_token, refresh_token, expira_em")
    .eq("id", 1)
    .maybeSingle<BlingAuthRow>();

  if (error) throw error;
  if (!data?.refresh_token) {
    throw new Error(
      "bling_auth vazio: complete o fluxo OAuth2 do Bling primeiro (autorização manual, um passo único) e grave o refresh_token inicial na tabela bling_auth.",
    );
  }

  const expirado = !data.expira_em || new Date(data.expira_em) <= new Date();
  if (!expirado && data.access_token) {
    return data.access_token;
  }

  const response = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${getEnv("BLING_CLIENT_ID")}:${getEnv("BLING_CLIENT_SECRET")}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao renovar token do Bling: ${response.status} ${await response.text()}`);
  }

  const tokenData = await response.json();
  const expiraEm = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("bling_auth")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? data.refresh_token,
      expira_em: expiraEm,
    })
    .eq("id", 1);

  return tokenData.access_token;
}

// O Bling espera "YYYY-MM-DD HH:mm:ss" (ex.: "2022-01-01 10:00:00"), não ISO 8601.
function formatBlingDateTime(iso: string): string {
  return iso.slice(0, 19).replace("T", " ");
}

async function fetchBlingPaginado(
  path: string,
  accessToken: string,
  desde: string | null,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let pagina = 1;

  while (true) {
    const url = new URL(`${BLING_API_BASE}${path}`);
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("limite", "100");
    if (desde) url.searchParams.set("dataAlteracaoInicial", formatBlingDateTime(desde));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(
        `Erro ao buscar ${path} (página ${pagina}): ${response.status} ${await response.text()}`,
      );
    }

    const body = await response.json();
    const pageItems: Record<string, unknown>[] = body.data ?? [];
    items.push(...pageItems);

    if (pageItems.length === 0) break;
    pagina += 1;
  }

  return items;
}

async function getUltimaSincronizacao(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tabela: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("sync_log")
    .select("ultima_sincronizacao")
    .eq("tabela", tabela)
    .maybeSingle();
  return data?.ultima_sincronizacao ?? null;
}

async function marcarSincronizado(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tabela: string,
  status: "ok" | "erro",
  mensagem?: string,
) {
  await supabase.from("sync_log").upsert({
    tabela,
    ultima_sincronizacao: new Date().toISOString(),
    status,
    mensagem: mensagem ?? null,
  });
}

// GET /contatos (listagem) só devolve id, nome, codigo, situacao, numeroDocumento,
// telefone, celular — cidade/uf exigiriam GET /contatos/{id} por contato (TODO, ver
// comentário no topo do arquivo). "tipo" dá pra inferir do tamanho do documento:
// CPF tem 11 dígitos, CNPJ tem 14 — não precisa de chamada extra.
function tipoPorDocumento(numeroDocumento: string | null | undefined): string | null {
  const digitos = (numeroDocumento ?? "").length;
  if (digitos === 11) return "pessoa_fisica";
  if (digitos === 14) return "pessoa_juridica";
  return null;
}

function mapClienteFromBling(raw: Record<string, unknown>) {
  const numeroDocumento = (raw.numeroDocumento as string) || null;
  return {
    bling_id: String(raw.id),
    nome: raw.nome as string,
    cnpj_cpf: numeroDocumento,
    tipo: tipoPorDocumento(numeroDocumento),
    cidade: null as string | null,
    uf: null as string | null,
    atualizado_em: new Date().toISOString(),
  };
}

// GET /produtos devolve nome, codigo (SKU), preco, tipo, situacao, formato (marcador
// interno do Bling, não é "250ml") — não existe campo de variedade/volume próprio.
function mapProdutoFromBling(raw: Record<string, unknown>) {
  return {
    bling_id: String(raw.id),
    nome: raw.nome as string,
    sku: (raw.codigo as string) ?? null,
    // "variedade" e "formato" (250ml/500ml) não existem nativamente no Bling —
    // inferir do nome do produto ou manter um mapeamento manual por SKU (ver
    // docs/ARQUITETURA.md).
    formato: null as string | null,
    variedade: null as string | null,
  };
}

// Schema real (VendasDadosBaseDTO): id, numero, data, total, contato{id,nome,...},
// situacao{id, valor: integer}, loja{id, unidadeNegocio}.
// Confirmado com dados reais em 2026-08-25: situacao.valor vem sempre 0 — quem
// identifica a situação de fato é situacao.id (mapear para rótulo exigiria
// consultar GET /situacoes/modulos; por ora grava o código bruto).
function mapPedidoFromBling(raw: Record<string, unknown>, clienteBlingIdToUuid: Map<string, string>) {
  const contato = raw.contato as { id?: number | string } | undefined;
  const clienteId = contato?.id ? clienteBlingIdToUuid.get(String(contato.id)) ?? null : null;
  const situacao = raw.situacao as { id?: number } | undefined;
  const loja = raw.loja as { id?: number } | undefined;

  return {
    bling_id: String(raw.id),
    cliente_id: clienteId,
    data_pedido: raw.data as string,
    valor_total: Number(raw.total ?? 0),
    status: situacao?.id != null ? String(situacao.id) : null,
    canal: loja?.id != null ? String(loja.id) : null,
    atualizado_em: new Date().toISOString(),
  };
}

Deno.serve(async (_req) => {
  const supabase = getSupabaseAdmin();

  try {
    const accessToken = await getValidAccessToken(supabase);

    // 1) Produtos
    const desdeProdutos = await getUltimaSincronizacao(supabase, "produtos");
    const produtosRaw = await fetchBlingPaginado(BLING_ENDPOINTS.produtos, accessToken, desdeProdutos);
    if (produtosRaw.length > 0) {
      const { error } = await supabase
        .from("produtos")
        .upsert(produtosRaw.map(mapProdutoFromBling), { onConflict: "bling_id" });
      if (error) throw error;
    }
    await marcarSincronizado(supabase, "produtos", "ok");

    // 2) Clientes
    const desdeClientes = await getUltimaSincronizacao(supabase, "clientes");
    const clientesRaw = await fetchBlingPaginado(BLING_ENDPOINTS.clientes, accessToken, desdeClientes);
    if (clientesRaw.length > 0) {
      const { error } = await supabase
        .from("clientes")
        .upsert(clientesRaw.map(mapClienteFromBling), { onConflict: "bling_id" });
      if (error) throw error;
    }
    await marcarSincronizado(supabase, "clientes", "ok");

    // 3) Pedidos (depende do mapeamento bling_id -> uuid de clientes já sincronizados)
    const { data: clientesAtuais } = await supabase.from("clientes").select("id, bling_id");
    const clienteBlingIdToUuid = new Map(
      (clientesAtuais ?? [])
        .filter((c) => c.bling_id)
        .map((c) => [c.bling_id as string, c.id as string]),
    );

    const desdePedidos = await getUltimaSincronizacao(supabase, "pedidos");
    const pedidosRaw = await fetchBlingPaginado(BLING_ENDPOINTS.pedidos, accessToken, desdePedidos);
    if (pedidosRaw.length > 0) {
      const { error } = await supabase
        .from("pedidos")
        .upsert(pedidosRaw.map((p) => mapPedidoFromBling(p, clienteBlingIdToUuid)), {
          onConflict: "bling_id",
        });
      if (error) throw error;
    }
    await marcarSincronizado(supabase, "pedidos", "ok");

    // 4) Atualiza a view de métricas (RFM) usada pelo dashboard.
    const { error: refreshError } = await supabase.rpc("refresh_cliente_metricas");
    if (refreshError) throw refreshError;

    return new Response(
      JSON.stringify({
        ok: true,
        produtos: produtosRaw.length,
        clientes: clientesRaw.length,
        pedidos: pedidosRaw.length,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    await marcarSincronizado(supabase, "sync-bling", "erro", mensagem);
    return new Response(JSON.stringify({ ok: false, error: mensagem }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
