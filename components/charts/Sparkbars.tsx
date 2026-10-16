"use client";

import { useSize } from "./useSize";

interface Props {
  values: number[];
  height?: number;
  label: string;
}

/** Mini-barres de tendance : passé en gris, dernière valeur en accent. */
export default function Sparkbars({ values, height = 34, label }: Props) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const base = lo - (hi - lo) * 0.35;
  const slot = width / Math.max(1, values.length);
  const bw = Math.max(2, Math.min(8, slot - 2));

  return (
    <div ref={ref} className="sparkbars" role="img" aria-label={label} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden>
          {values.map((v, i) => {
            const h = Math.max(2, ((v - base) / (hi - base || 1)) * height);
            const last = i === values.length - 1;
            return (
              <rect
                key={i}
                x={i * slot + (slot - bw) / 2}
                y={height - h}
                width={bw}
                height={h}
                rx={Math.min(2, bw / 2)}
                fill={last ? "var(--accent)" : "var(--ink-3)"}
                fillOpacity={last ? 1 : 0.28}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
