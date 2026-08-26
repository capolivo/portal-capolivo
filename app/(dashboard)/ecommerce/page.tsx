import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDataBR, formatMoedaBR } from "@/lib/format";
import { CANAL_ECOMMERCE_TRAY } from "@/lib/bling";

type PedidoEcommerce = {
  id: string;
  data_pedido: string;
  valor_total: number;
  status: string | null;
  frete: number | null;
  uf_destino: string | null;
  valor_difal: number | null;
  informacao_complementar: string | null;
  cliente_id: string | null;
  clientes: { nome: string } | null;
};

export default async function EcommercePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(
      "id, data_pedido, valor_total, status, frete, uf_destino, valor_difal, informacao_complementar, cliente_id, clientes(nome)",
    )
    .eq("canal", CANAL_ECOMMERCE_TRAY)
    .order("data_pedido", { ascending: false })
    .limit(200)
    .returns<PedidoEcommerce[]>();

  const pedidos = data ?? [];
  const semFreteAinda = pedidos.filter((p) => p.frete === null).length;

  return (
    <div>
      <h1 className="mb-1 text-2xl text-dourado">E-commerce</h1>
      <p className="mb-6 text-sm text-preto/60">
        Vendas com origem na loja online (Tray) — frete e ICMS DIFAL de cada pedido.
      </p>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os pedidos. Detalhe: {error.message}
        </p>
      )}

      {!error && semFreteAinda > 0 && (
        <p className="mb-4 rounded border border-dourado-claro/40 bg-bege px-4 py-3 text-sm text-preto/70">
          {semFreteAinda} pedido(s) ainda sem frete/DIFAL sincronizado — o detalhe é buscado aos
          poucos a cada sincronização com o Bling, vai completar nas próximas rodadas.
        </p>
      )}

      {!error && (
        <div className="overflow-x-auto rounded border border-preto/10">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-bege text-preto/70">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">UF destino</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Frete</th>
                <th className="px-3 py-2 font-medium">ICMS DIFAL</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className="border-t border-preto/5">
                  <td className="px-3 py-2">
                    {pedido.cliente_id ? (
                      <Link href={`/clientes/${pedido.cliente_id}`} className="text-dourado hover:underline">
                        {pedido.clientes?.nome ?? "—"}
                      </Link>
                    ) : (
                      pedido.clientes?.nome ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDataBR(pedido.data_pedido)}</td>
                  <td className="px-3 py-2">{pedido.uf_destino ?? "—"}</td>
                  <td className="px-3 py-2">{formatMoedaBR(pedido.valor_total)}</td>
                  <td className="px-3 py-2">{pedido.frete != null ? formatMoedaBR(pedido.frete) : "—"}</td>
                  <td className="px-3 py-2" title={pedido.informacao_complementar ?? undefined}>
                    {pedido.valor_difal != null ? formatMoedaBR(pedido.valor_difal) : "—"}
                  </td>
                  <td className="px-3 py-2">{pedido.status ?? "—"}</td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-preto/50">
                    Nenhum pedido de e-commerce sincronizado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
