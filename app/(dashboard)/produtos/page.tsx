import { createClient } from "@/lib/supabase/server";
import { variedadeColors } from "@/lib/theme";
import { formatMoedaBR } from "@/lib/format";

type ProdutoRanking = {
  produto_id: string;
  nome: string;
  sku: string | null;
  variedade: string | null;
  formato: string | null;
  quantidade_total: number;
  total_pedidos: number;
  valor_total: number;
};

export default async function ProdutosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos_ranking")
    .select("*")
    .order("quantidade_total", { ascending: false })
    .returns<ProdutoRanking[]>();

  const produtos = data ?? [];

  return (
    <div>
      <h1 className="mb-1 text-2xl text-dourado">Produtos</h1>
      <p className="mb-6 text-sm text-preto/60">
        Catálogo sincronizado do Bling, ordenado pelos mais vendidos.
      </p>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os produtos. Detalhe: {error.message}
        </p>
      )}

      {!error && (
        <div className="overflow-x-auto rounded border border-preto/10">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-bege text-preto/70">
              <tr>
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="px-3 py-2 font-medium">Variedade</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Quantidade vendida</th>
                <th className="px-3 py-2 font-medium">Pedidos</th>
                <th className="px-3 py-2 font-medium">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((produto) => (
                <tr key={produto.produto_id} className="border-t border-preto/5">
                  <td className="px-3 py-2">{produto.nome}</td>
                  <td className="px-3 py-2">
                    {produto.variedade ? (
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{
                          color:
                            variedadeColors[produto.variedade as keyof typeof variedadeColors] ??
                            undefined,
                        }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              variedadeColors[
                                produto.variedade as keyof typeof variedadeColors
                              ] ?? "#9CA3AF",
                          }}
                        />
                        {produto.variedade}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{produto.sku ?? "—"}</td>
                  <td className="px-3 py-2">{produto.quantidade_total}</td>
                  <td className="px-3 py-2">{produto.total_pedidos}</td>
                  <td className="px-3 py-2">{formatMoedaBR(produto.valor_total)}</td>
                </tr>
              ))}
              {produtos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-preto/50">
                    Nenhum produto sincronizado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-preto/50">
        &quot;Variedade&quot; ainda não vem preenchida do Bling — só o nome do produto identifica
        cada azeite por enquanto.
      </p>
    </div>
  );
}
