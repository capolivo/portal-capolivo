// Formata uma data "YYYY-MM-DD" (sem horário) vinda do Postgres.
// NUNCA usar `new Date(dataString)` direto para isso: o JS interpreta a string
// como meia-noite UTC, e ao exibir no fuso do Brasil (UTC-3) o dia "volta" um —
// foi exatamente o bug que fez um pedido de 20/08 aparecer como 19/08 na tela.
export function formatDataBR(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

export function formatMoedaBR(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
