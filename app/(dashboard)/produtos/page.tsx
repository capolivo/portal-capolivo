import { createClient } from "@/lib/supabase/server";
import { Produto } from "@/lib/types";
import { variedadeColors } from "@/lib/theme";

export default async function ProdutosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos")
    .select("id, bling_id, nome, variedade, formato, sku")
    .order("variedade", { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-2xl text-dourado">Produtos</h1>
      <p className="mb-6 text-sm text-preto/60">Catálogo sincronizado do Bling.</p>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os produtos. Detalhe: {error.message}
        </p>
      )}

      {!error && (
        <div className="overflow-x-auto rounded border border-preto/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-bege text-preto/70">
              <tr>
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="px-3 py-2 font-medium">Variedade</th>
                <th className="px-3 py-2 font-medium">Formato</th>
                <th className="px-3 py-2 font-medium">SKU</th>
              </tr>
            </thead>
            <tbody>
              {(data as Produto[] | null)?.map((produto) => (
                <tr key={produto.id} className="border-t border-preto/5">
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
                  <td className="px-3 py-2">{produto.formato ?? "—"}</td>
                  <td className="px-3 py-2">{produto.sku ?? "—"}</td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-preto/50">
                    Nenhum produto sincronizado ainda.
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
