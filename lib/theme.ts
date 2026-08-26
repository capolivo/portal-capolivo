// Tokens de identidade visual da Capolivo.
// Fonte: CLAUDE.md, seção 10 (Identidade de marca). Manual de marca v1.
// Tipografia (Playfair Display / Jost) ainda está "em avaliação" — não é oficial.

export const brandColors = {
  dourado: "#998042",
  douradoClaro: "#B69B6B",
  preto: "#171614",
  bege: "#E9E2D9",
} as const;

export const variedadeColors = {
  Arbequina: "#B79C6B",
  Koroneiki: "#5F6301",
  Picual: "#BC7D58",
  Coratina: "#7D5B20",
  Frantoio: "#3B8476",
} as const;

export type Variedade = keyof typeof variedadeColors;

export const segmentoRfmColors: Record<string, string> = {
  Campeão: "#5F6301",
  Fiel: "#998042",
  Regular: "#B69B6B",
  Novo: "#3B8476",
  "Em risco": "#BC7D58",
  "Sem compras": "#9CA3AF",
};
