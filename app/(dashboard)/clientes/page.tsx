import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClienteMetrica } from "@/lib/types";
import { ClientesTable } from "@/components/clientes-table";

const SORT_OPTIONS: Record<string, { column: string; ascending: boolean; label: string }> = {
  valor: { column: "valor_total", ascending: false, label: "Maior valor" },
  frequencia: { column: "total_pedidos", ascending: false, label: "Mais pedidos" },
  recencia: { column: "ultima_compra", ascending: false, label: "Compra mais recente" },
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sortKey = sort && SORT_OPTIONS[sort] ? sort : "valor";
  const { column, ascending } = SORT_OPTIONS[sortKey];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cliente_metricas")
    .select("*")
    .order(column, { ascending });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-dourado">Clientes</h1>
          <p className="text-sm text-preto/60">
            Frequência de compra e melhores clientes, calculado a partir dos pedidos sincronizados
            do Bling.
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          {Object.entries(SORT_OPTIONS).map(([key, option]) => (
            <Link
              key={key}
              href={`/clientes?sort=${key}`}
              className={`rounded px-3 py-1.5 ${
                key === sortKey ? "bg-dourado text-white" : "bg-bege text-preto/70 hover:bg-dourado-claro/40"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os clientes. Verifique se as migrations do Supabase (
          <code>supabase/migrations</code>) já foram aplicadas. Detalhe: {error.message}
        </p>
      )}

      {!error && <ClientesTable clientes={(data ?? []) as ClienteMetrica[]} />}
    </div>
  );
}
