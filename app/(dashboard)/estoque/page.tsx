import { createClient } from "@/lib/supabase/server";
import { formatDataBR } from "@/lib/format";
import { LancarMovimentoForm } from "@/components/lancar-movimento-form";
import { EstoqueSaldo } from "@/lib/types";

export default async function EstoquePage() {
  const supabase = await createClient();

  const [{ data: saldos, error }, { data: produtos }] = await Promise.all([
    supabase.from("estoque_saldo").select("*").order("nome", { ascending: true }).returns<EstoqueSaldo[]>(),
    supabase.from("produtos").select("id, nome").order("nome", { ascending: true }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl text-dourado">Estoque</h1>
      <p className="mb-6 text-sm text-preto/60">
        Saldo de garrafas já envasadas. Cada venda nova sincronizada do Bling desconta
        automaticamente — o histórico anterior ao início do controle não foi descontado.
      </p>

      <div className="mb-8">
        <LancarMovimentoForm produtos={produtos ?? []} />
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar o estoque. Detalhe: {error.message}
        </p>
      )}

      {!error && (
        <div className="overflow-x-auto rounded border border-preto/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-bege text-preto/70">
              <tr>
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Saldo</th>
                <th className="px-3 py-2 font-medium">Última movimentação</th>
              </tr>
            </thead>
            <tbody>
              {(saldos ?? []).map((item) => (
                <tr key={item.produto_id} className="border-t border-preto/5">
                  <td className="px-3 py-2">{item.nome}</td>
                  <td className="px-3 py-2">{item.sku ?? "—"}</td>
                  <td className={`px-3 py-2 font-medium ${item.saldo < 0 ? "text-red-600" : ""}`}>
                    {item.saldo}
                    {item.saldo < 0 && " ⚠"}
                  </td>
                  <td className="px-3 py-2">
                    {item.ultima_movimentacao_em ? formatDataBR(item.ultima_movimentacao_em) : "—"}
                  </td>
                </tr>
              ))}
              {(!saldos || saldos.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-preto/50">
                    Nenhum produto cadastrado ainda.
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
