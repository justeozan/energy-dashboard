import type { Co2Level } from "@/lib/sources";

interface Props {
  value: number;
  max: number;
  threshold: number;
  level: Co2Level;
  unit: string;
  width?: number;
  label: string;
}

const TICKS = 41;

/** Jauge demi-cercle à graduations, valeur au centre du cadran (cf. « Total System Output »). */
export default function Gauge({ value, max, threshold, level, unit, width = 220, label }: Props) {
  const r2 = width / 2 - 6;
  const r1 = r2 - 13;
  const cx = width / 2;
  const cy = r2 + 8;
  const height = cy + 16;
  const angle = (v: number) => Math.PI * (1 - Math.min(1, Math.max(0, v / max)));
  // Arrondi : le rendu serveur et le navigateur ne donnent pas toujours la même dernière décimale.
  const round = (n: number) => Math.round(n * 100) / 100;
  const pt = (a: number, r: number) => [round(cx + Math.cos(a) * r), round(cy - Math.sin(a) * r)] as const;
  const tIdx = Math.round((threshold / max) * (TICKS - 1));
  const pointerDeg = round((angle(value) * 180) / Math.PI);
  const tLabel = pt(angle(threshold), r2 + 3);

  return (
    <svg className="gauge" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {Array.from({ length: TICKS }, (_, i) => {
        const v = (i / (TICKS - 1)) * max;
        const a = angle(v);
        const isT = i === tIdx;
        const [x1, y1] = pt(a, isT ? r1 - 4 : r1);
        const [x2, y2] = pt(a, isT ? r2 + 1 : r2);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isT ? "var(--ink-2)" : v <= value ? `var(--${level})` : "var(--track)"}
            strokeWidth={isT ? 2 : 2.5}
            strokeLinecap="round"
          />
        );
      })}
      <text x={tLabel[0]} y={tLabel[1] - 5} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">
        {threshold}
      </text>
      <text x={cx - (r1 + r2) / 2} y={cy + 14} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">
        0
      </text>
      <text x={cx + (r1 + r2) / 2} y={cy + 14} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">
        {max}
      </text>
      {/* Index : court trait sous les graduations, pour laisser le centre à la valeur */}
      <line
        x1={cx + r1 - 34}
        y1={cy}
        x2={cx + r1 - 8}
        y2={cy}
        stroke="var(--ink-1)"
        strokeWidth={3.5}
        strokeLinecap="round"
        style={{
          transform: `rotate(${-pointerDeg}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: "transform 0.8s ease",
        }}
      />
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize={34} fontWeight={500} letterSpacing="-0.03em" fill="var(--ink-1)">
        {value}
      </text>
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize={12} fill="var(--ink-3)">
        {unit}
      </text>
    </svg>
  );
}
