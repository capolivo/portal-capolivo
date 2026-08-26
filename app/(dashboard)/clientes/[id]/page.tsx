import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteMetrica, Pedido } from "@/lib/types";
import { SegmentoBadge } from "@/components/segmento-badge";
import { formatDataBR, formatMoedaBR } from "@/lib/format";

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: metrica, error: metricaError }, { data: pedidos, error: pedidosError }] =
    await Promise.all([
      supabase.from("cliente_metricas").select("*").eq("cliente_id", id).maybeSingle(),
      supabase
        .from("pedidos")
        .select("id, bling_id, cliente_id, data_pedido, valor_total, status, canal")
        .eq("cliente_id", id)
        .order("data_pedido", { ascending: false }),
    ]);

  if (metricaError) {
    throw metricaError;
  }

  if (!metrica) {
    notFound();
  }

  const cliente = metrica as ClienteMetrica;

  return (
    <div>
      <Link href="/clientes" className="text-sm text-dourado hover:underline">
        ← Clientes
      </Link>

      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl text-dourado">{cliente.nome}</h1>
        <SegmentoBadge segmento={cliente.segmento_rfm} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metrica label="Total de pedidos" valor={String(cliente.total_pedidos)} />
        <Metrica label="Valor total" valor={formatMoedaBR(cliente.valor_total)} />
        <Metrica label="Ticket médio" valor={formatMoedaBR(cliente.ticket_medio)} />
        <Metrica
          label="Frequência média"
          valor={cliente.intervalo_medio_dias != null ? `${cliente.intervalo_medio_dias} dias` : "—"}
        />
        <Metrica label="Primeira compra" valor={formatDataBR(cliente.primeira_compra)} />
        <Metrica label="Última compra" valor={formatDataBR(cliente.ultima_compra)} />
      </div>

      <h2 className="mb-3 text-lg text-preto">Histórico de pedidos</h2>

      {pedidosError && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os pedidos. Detalhe: {pedidosError.message}
        </p>
      )}

      {!pedidosError && (
        <div className="overflow-x-auto rounded border border-preto/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-bege text-preto/70">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Canal</th>
              </tr>
            </thead>
            <tbody>
              {(pedidos as Pedido[] | null)?.map((pedido) => (
                <tr key={pedido.id} className="border-t border-preto/5">
                  <td className="px-3 py-2">{formatDataBR(pedido.data_pedido)}</td>
                  <td className="px-3 py-2">{formatMoedaBR(pedido.valor_total)}</td>
                  <td className="px-3 py-2">{pedido.status ?? "—"}</td>
                  <td className="px-3 py-2">{pedido.canal ?? "—"}</td>
                </tr>
              ))}
              {(!pedidos || pedidos.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-preto/50">
                    Nenhum pedido encontrado para este cliente.
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

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded border border-preto/10 bg-white px-4 py-3">
      <p className="text-xs text-preto/50">{label}</p>
      <p className="text-lg text-preto">{valor}</p>
    </div>
  );
}
