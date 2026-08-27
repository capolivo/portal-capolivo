"use client";

import { useState } from "react";
import { lancarMovimento } from "@/app/(dashboard)/estoque/actions";

type ProdutoOpcao = { id: string; nome: string };

export function LancarMovimentoForm({ produtos }: { produtos: ProdutoOpcao[] }) {
  const [tipo, setTipo] = useState<"envase" | "ajuste">("envase");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setErro(null);
    setEnviando(true);
    try {
      await lancarMovimento(formData);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível lançar a movimentação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-3 rounded border border-preto/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="flex flex-col gap-1 lg:col-span-2">
        <label htmlFor="produto_id" className="text-xs text-preto/60">
          Produto
        </label>
        <select
          id="produto_id"
          name="produto_id"
          required
          className="rounded border border-preto/20 px-2 py-1.5 text-sm focus:border-dourado focus:outline-none"
        >
          {produtos.map((produto) => (
            <option key={produto.id} value={produto.id}>
              {produto.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tipo" className="text-xs text-preto/60">
          Tipo
        </label>
        <select
          id="tipo"
          name="tipo"
          value={tipo}
          onChange={(event) => setTipo(event.target.value as "envase" | "ajuste")}
          className="rounded border border-preto/20 px-2 py-1.5 text-sm focus:border-dourado focus:outline-none"
        >
          <option value="envase">Envase (entrada)</option>
          <option value="ajuste">Ajuste (contagem)</option>
        </select>
      </div>

      {tipo === "ajuste" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="direcao" className="text-xs text-preto/60">
            Direção do ajuste
          </label>
          <select
            id="direcao"
            name="direcao"
            className="rounded border border-preto/20 px-2 py-1.5 text-sm focus:border-dourado focus:outline-none"
          >
            <option value="saida">Reduzir estoque</option>
            <option value="entrada">Aumentar estoque</option>
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="quantidade" className="text-xs text-preto/60">
          Quantidade
        </label>
        <input
          id="quantidade"
          name="quantidade"
          type="number"
          min="0.001"
          step="0.001"
          required
          className="rounded border border-preto/20 px-2 py-1.5 text-sm focus:border-dourado focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-5">
        <label htmlFor="observacao" className="text-xs text-preto/60">
          Observação (opcional)
        </label>
        <input
          id="observacao"
          name="observacao"
          type="text"
          placeholder="ex.: lote 12, tanque A"
          className="rounded border border-preto/20 px-2 py-1.5 text-sm focus:border-dourado focus:outline-none"
        />
      </div>

      {erro && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-5">{erro}</p>}

      <div className="sm:col-span-2 lg:col-span-5">
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-dourado px-4 py-2 text-sm font-medium text-white transition hover:bg-dourado-claro disabled:opacity-50"
        >
          {enviando ? "Lançando..." : "Lançar movimentação"}
        </button>
      </div>
    </form>
  );
}
