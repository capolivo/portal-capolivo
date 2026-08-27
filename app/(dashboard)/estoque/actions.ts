"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function lancarMovimento(formData: FormData) {
  const produtoId = formData.get("produto_id") as string;
  const tipo = formData.get("tipo") as string;
  const direcao = formData.get("direcao") as string;
  const quantidadeRaw = (formData.get("quantidade") as string) ?? "";
  const observacao = ((formData.get("observacao") as string) || "").trim() || null;

  if (!produtoId || !tipo || !quantidadeRaw) {
    throw new Error("Preencha produto, tipo e quantidade.");
  }
  if (tipo !== "envase" && tipo !== "ajuste") {
    throw new Error("Tipo inválido.");
  }

  const quantidadeAbs = Number(quantidadeRaw.replace(",", "."));
  if (!Number.isFinite(quantidadeAbs) || quantidadeAbs <= 0) {
    throw new Error("Quantidade precisa ser um número maior que zero.");
  }

  // Envase é sempre entrada. Ajuste pode ser pra cima (contagem maior que o
  // saldo) ou pra baixo (contagem menor, perda, quebra), conforme o formulário.
  const quantidade = tipo === "envase" || direcao === "entrada" ? quantidadeAbs : -quantidadeAbs;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("estoque_movimentos").insert({
    produto_id: produtoId,
    tipo,
    quantidade,
    observacao,
    criado_por: user?.email ?? null,
  });

  if (error) throw error;

  revalidatePath("/estoque");
}
