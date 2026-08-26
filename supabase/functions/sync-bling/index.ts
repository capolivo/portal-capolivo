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

// loja.id do canal de e-commerce (Tray) — identificado em 2026-08-26 como o canal
// mais frequente de vendas online da Capolivo. Confirmar contra GET /canais-venda
// se algum dia parecer errado (precisa do escopo "Canais de Venda" no app Bling).
const CANAL_ECOMMERCE_TRAY = "204752067";

// Quantos pedidos de e-commerce enriquecer (frete + DIFAL) por execução — cada um
// custa até 2 chamadas extras ao Bling (detalhe do pedido + nota fiscal), então
// isso fica limitado pra não estourar o tempo da Edge Function nem o rate limit
// do Bling. Roda de novo a cada sincronização até dar conta de todo o histórico.
const MAX_ENRIQUECER_ECOMMERCE = 25;
// Bling limita a 3 requisições/segundo (confirmado em teste real, erro 429 em
// 2026-08-26) — 400ms de pausa dá ~2.5 req/s, com margem de segurança.
const PAUSA_ENTRE_CHAMADAS_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  extraParams?: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let pagina = 1;

  while (true) {
    const url = new URL(`${BLING_API_BASE}${path}`);
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("limite", "100");
    if (desde) url.searchParams.set("dataAlteracaoInicial", formatBlingDateTime(desde));
    for (const [chave, valor] of Object.entries(extraParams ?? {})) {
      url.searchParams.set(chave, valor);
    }

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

    // Bling limita a 3 requisições/segundo — sem essa pausa, listas com muitas
    // páginas (ex.: 1700+ clientes) estouram o limite e o sync falha com 429.
    await sleep(PAUSA_ENTRE_CHAMADAS_MS);
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

function decodeXmlEntities(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

// "1.234,56" -> 1234.56 (formato numérico brasileiro usado no texto da nota).
function parseNumeroBR(texto: string): number | null {
  const numero = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

// O valor do ICMS DIFAL não é um campo próprio do Bling — quando existe, vem como
// texto solto dentro do campo "informações complementares" (infCpl) do XML da nota
// fiscal, algo como "... valor do ICMS DIFAL para UF de destino R$ 12,34 ...".
function extrairDifal(infCpl: string): number | null {
  const match = infCpl.match(/ICMS\s*DIFAL[^\d]*R\$\s*([\d.,]+)/i);
  return match ? parseNumeroBR(match[1]) : null;
}

type PedidoPendente = { id: string; bling_id: string | null };

// Enriquece pedidos do canal de e-commerce com frete e informação de ICMS DIFAL —
// dados que só existem no detalhe do pedido / nota fiscal, não na listagem padrão.
// Processa em lotes pequenos (MAX_ENRIQUECER_ECOMMERCE) e marca cada pedido tratado
// em `detalhe_sincronizado_em`, então roda de novo a cada sync até cobrir tudo.
async function enriquecerPedidosEcommerce(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  accessToken: string,
): Promise<{ enriquecidos: number; falhas: number }> {
  const { data: pendentes, error } = await supabase
    .from("pedidos")
    .select("id, bling_id")
    .eq("canal", CANAL_ECOMMERCE_TRAY)
    .is("detalhe_sincronizado_em", null)
    .limit(MAX_ENRIQUECER_ECOMMERCE)
    .returns<PedidoPendente[]>();

  if (error) throw error;
  if (!pendentes || pendentes.length === 0) return { enriquecidos: 0, falhas: 0 };

  let enriquecidos = 0;
  let falhas = 0;

  for (const pedido of pendentes) {
    if (!pedido.bling_id) continue;

    try {
      const detalheResp = await fetch(`${BLING_API_BASE}/pedidos/vendas/${pedido.bling_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!detalheResp.ok) {
        throw new Error(`detalhe do pedido: ${detalheResp.status} ${await detalheResp.text()}`);
      }
      const detalhe = (await detalheResp.json()).data ?? {};
      const transporte = detalhe.transporte ?? {};
      const frete = typeof transporte.frete === "number" ? transporte.frete : null;
      const ufDestino = transporte.etiqueta?.uf || null;
      const notaFiscalId = detalhe.notaFiscal?.id;

      let informacaoComplementar: string | null = null;
      let valorDifal: number | null = null;

      if (notaFiscalId) {
        await sleep(PAUSA_ENTRE_CHAMADAS_MS);
        const nfeResp = await fetch(`${BLING_API_BASE}/nfe/${notaFiscalId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (nfeResp.ok) {
          const nfe = (await nfeResp.json()).data ?? {};
          // O campo "xml" não é o XML em si — é uma URL assinada pra baixá-lo.
          // Só existe depois que a nota é autorizada pela Sefaz (chaveAcesso
          // preenchida); antes disso vem vazio.
          const xmlUrl: string = nfe.xml || "";
          if (xmlUrl) {
            await sleep(PAUSA_ENTRE_CHAMADAS_MS);
            const xmlResp = await fetch(xmlUrl);
            if (xmlResp.ok) {
              const xml = await xmlResp.text();
              const match = xml.match(/<infCpl>([\s\S]*?)<\/infCpl>/);
              if (match) {
                informacaoComplementar = decodeXmlEntities(match[1]);
                valorDifal = extrairDifal(informacaoComplementar);
              }
            }
          }
        }
        // Falha ao buscar a nota fiscal/XML não invalida o resto do enriquecimento
        // (frete já foi obtido) — só fica sem o DIFAL desta vez.
      }

      const { error: updateError } = await supabase
        .from("pedidos")
        .update({
          frete,
          uf_destino: ufDestino,
          informacao_complementar: informacaoComplementar,
          valor_difal: valorDifal,
          detalhe_sincronizado_em: new Date().toISOString(),
        })
        .eq("id", pedido.id);
      if (updateError) throw updateError;

      enriquecidos++;
    } catch (err) {
      falhas++;
      console.error(`Falha ao enriquecer pedido ${pedido.bling_id}:`, err);
    }

    await sleep(PAUSA_ENTRE_CHAMADAS_MS);
  }

  return { enriquecidos, falhas };
}

Deno.serve(async (_req) => {
  const supabase = getSupabaseAdmin();

  const resultado = {
    produtos: 0,
    clientes: 0,
    pedidos: 0,
    ecommerceEnriquecidos: 0,
    ecommerceFalhas: 0,
    erros: [] as string[],
  };

  try {
    const accessToken = await getValidAccessToken(supabase);

    // 1) Produtos. tipo=P filtra só produtos simples — sem esse filtro, o Bling
    // vem retornando erro 400 ("MISSING_REQUIRED_FIELD_ERROR ... produto Loja")
    // pra algum registro fora desse tipo (variação/estrutura/serviço). Confirmado
    // em 2026-08-26 que o filtro contorna o problema.
    try {
      const desdeProdutos = await getUltimaSincronizacao(supabase, "produtos");
      const produtosRaw = await fetchBlingPaginado(BLING_ENDPOINTS.produtos, accessToken, desdeProdutos, {
        tipo: "P",
      });
      if (produtosRaw.length > 0) {
        const { error } = await supabase
          .from("produtos")
          .upsert(produtosRaw.map(mapProdutoFromBling), { onConflict: "bling_id" });
        if (error) throw error;
      }
      resultado.produtos = produtosRaw.length;
      await marcarSincronizado(supabase, "produtos", "ok");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      resultado.erros.push(`produtos: ${mensagem}`);
      await marcarSincronizado(supabase, "produtos", "erro", mensagem);
    }

    // 2) Clientes — cada etapa é independente: se uma falhar, as outras seguem
    // rodando (por ex. um bug pontual do Bling em /produtos não deve travar a
    // sincronização de pedidos, que é o que alimenta a aba E-commerce).
    try {
      const desdeClientes = await getUltimaSincronizacao(supabase, "clientes");
      const clientesRaw = await fetchBlingPaginado(BLING_ENDPOINTS.clientes, accessToken, desdeClientes);
      if (clientesRaw.length > 0) {
        const { error } = await supabase
          .from("clientes")
          .upsert(clientesRaw.map(mapClienteFromBling), { onConflict: "bling_id" });
        if (error) throw error;
      }
      resultado.clientes = clientesRaw.length;
      await marcarSincronizado(supabase, "clientes", "ok");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      resultado.erros.push(`clientes: ${mensagem}`);
      await marcarSincronizado(supabase, "clientes", "erro", mensagem);
    }

    // 3) Pedidos (depende do mapeamento bling_id -> uuid de clientes já sincronizados,
    // lido direto do banco — usa o que já tiver, mesmo se o passo 2 falhou acima).
    try {
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
      resultado.pedidos = pedidosRaw.length;
      await marcarSincronizado(supabase, "pedidos", "ok");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      resultado.erros.push(`pedidos: ${mensagem}`);
      await marcarSincronizado(supabase, "pedidos", "erro", mensagem);
    }

    // 4) Enriquece um lote de pedidos de e-commerce com frete e DIFAL.
    try {
      const { enriquecidos, falhas } = await enriquecerPedidosEcommerce(supabase, accessToken);
      resultado.ecommerceEnriquecidos = enriquecidos;
      resultado.ecommerceFalhas = falhas;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      resultado.erros.push(`ecommerce: ${mensagem}`);
    }

    // 5) Atualiza a view de métricas (RFM) usada pelo dashboard.
    const { error: refreshError } = await supabase.rpc("refresh_cliente_metricas");
    if (refreshError) resultado.erros.push(`refresh_cliente_metricas: ${refreshError.message}`);

    return new Response(JSON.stringify({ ok: resultado.erros.length === 0, ...resultado }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    await marcarSincronizado(supabase, "sync-bling", "erro", mensagem);
    return new Response(JSON.stringify({ ok: false, error: mensagem, ...resultado }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
