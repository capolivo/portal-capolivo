import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SegmentoBadge } from "@/components/segmento-badge";
import { formatDataBR, formatMoedaBR } from "@/lib/format";

type PedidoComCliente = {
  id: string;
  data_pedido: string;
  valor_total: number;
  status: string | null;
  canal: string | null;
  cliente_id: string | null;
  clientes: { nome: string } | null;
};

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, data_pedido, valor_total, status, canal, cliente_id, clientes(nome)")
    .order("data_pedido", { ascending: false })
    .limit(200)
    .returns<PedidoComCliente[]>();

  const clienteIds = [...new Set((data ?? []).map((p) => p.cliente_id).filter(Boolean))] as string[];
  const { data: metricas } = clienteIds.length
    ? await supabase.from("cliente_metricas").select("cliente_id, segmento_rfm").in("cliente_id", clienteIds)
    : { data: [] as { cliente_id: string; segmento_rfm: string }[] };
  const segmentoPorCliente = new Map((metricas ?? []).map((m) => [m.cliente_id, m.segmento_rfm]));

  return (
    <div>
      <h1 className="mb-1 text-2xl text-dourado">Pedidos</h1>
      <p className="mb-6 text-sm text-preto/60">Últimos 200 pedidos sincronizados do Bling.</p>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os pedidos. Detalhe: {error.message}
        </p>
      )}

      {!error && (
        <div className="overflow-x-auto rounded border border-preto/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-bege text-preto/70">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Segmento</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((pedido) => (
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
                  <td className="px-3 py-2">
                    {pedido.cliente_id && segmentoPorCliente.get(pedido.cliente_id) ? (
                      <SegmentoBadge segmento={segmentoPorCliente.get(pedido.cliente_id)!} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDataBR(pedido.data_pedido)}</td>
                  <td className="px-3 py-2">{formatMoedaBR(pedido.valor_total)}</td>
                  <td className="px-3 py-2">{pedido.status ?? "—"}</td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-preto/50">
                    Nenhum pedido sincronizado ainda.
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
