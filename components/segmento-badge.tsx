import { segmentoRfmColors } from "@/lib/theme";

export function SegmentoBadge({ segmento }: { segmento: string }) {
  const color = segmentoRfmColors[segmento] ?? "#9CA3AF";

  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {segmento}
    </span>
  );
}
