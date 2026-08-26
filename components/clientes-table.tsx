"use client";

import { useState } from "react";
import Link from "next/link";
import { ClienteMetrica } from "@/lib/types";
import { SegmentoBadge } from "@/components/segmento-badge";
import { formatDataBR, formatMoedaBR } from "@/lib/format";

const FILTROS_TIPO = [
  { valor: "todos", label: "Todos" },
  { valor: "pessoa_juridica", label: "Pessoa jurídica (CNPJ)" },
  { valor: "pessoa_fisica", label: "Pessoa física (CPF)" },
] as const;

export function ClientesTable({ clientes }: { clientes: ClienteMetrica[] }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<(typeof FILTROS_TIPO)[number]["valor"]>("todos");

  const filtrados = clientes
    .filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()))
    .filter((c) => tipo === "todos" || c.tipo === tipo);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="w-full max-w-xs rounded border border-preto/20 px-3 py-2 text-sm focus:border-dourado focus:outline-none"
        />

        <select
          value={tipo}
          onChange={(event) => setTipo(event.target.value as (typeof FILTROS_TIPO)[number]["valor"])}
          className="rounded border border-preto/20 px-3 py-2 text-sm focus:border-dourado focus:outline-none"
        >
          {FILTROS_TIPO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded border border-preto/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-bege text-preto/70">
            <tr>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Segmento</th>
              <th className="px-3 py-2 font-medium">Pedidos</th>
              <th className="px-3 py-2 font-medium">Valor total</th>
              <th className="px-3 py-2 font-medium">Ticket médio</th>
              <th className="px-3 py-2 font-medium">Frequência (dias)</th>
              <th className="px-3 py-2 font-medium">Última compra</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((cliente) => (
              <tr key={cliente.cliente_id} className="border-t border-preto/5 hover:bg-bege/50">
                <td className="px-3 py-2">
                  <Link href={`/clientes/${cliente.cliente_id}`} className="text-dourado hover:underline">
                    {cliente.nome}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <SegmentoBadge segmento={cliente.segmento_rfm} />
                </td>
                <td className="px-3 py-2">{cliente.total_pedidos}</td>
                <td className="px-3 py-2">{formatMoedaBR(cliente.valor_total)}</td>
                <td className="px-3 py-2">{formatMoedaBR(cliente.ticket_medio)}</td>
                <td className="px-3 py-2">
                  {cliente.intervalo_medio_dias != null ? `${cliente.intervalo_medio_dias} dias` : "—"}
                </td>
                <td className="px-3 py-2">{formatDataBR(cliente.ultima_compra)}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-preto/50">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
