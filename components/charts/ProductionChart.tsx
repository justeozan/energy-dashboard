"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { fmtGW, fmtTime, parisHour } from "@/lib/format";
import { GROUPS, groupValues } from "@/lib/sources";
import { GROUP_KEYS, type GroupKey, type Snapshot } from "@/lib/types";
import type { FocusKey } from "../types";
import { linear, niceDomain } from "./scale";
import { useSize } from "./useSize";

const HOUR = 3600_000;
const M = { top: 10, right: 6, bottom: 22, left: 30 };
const TOOLTIP_W = 168;

export interface HourBucket {
  t: number;
  values: Record<GroupKey, number>;
  total: number;
}

/** Moyennes horaires par filière sur les 24 dernières heures. */
export function hourlyMix(history: Snapshot[]): HourBucket[] {
  const buckets = new Map<number, { sum: Record<GroupKey, number>; n: number }>();
  for (const s of history) {
    const t = Math.floor(Date.parse(s.time) / HOUR) * HOUR;
    const g = groupValues(s);
    const b = buckets.get(t) ?? { sum: Object.fromEntries(GROUP_KEYS.map((k) => [k, 0])) as Record<GroupKey, number>, n: 0 };
    for (const k of GROUP_KEYS) b.sum[k] += g[k];
    b.n += 1;
    buckets.set(t, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .slice(-24)
    .map(([t, b]) => {
      const values = Object.fromEntries(GROUP_KEYS.map((k) => [k, b.sum[k] / b.n])) as Record<GroupKey, number>;
      return { t, values, total: GROUP_KEYS.reduce((a, k) => a + values[k], 0) };
    });
}

/** Rectangle à coins arrondis en haut seulement (extrémité de donnée). */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

interface Props {
  buckets: HourBucket[];
  focus: FocusKey | null;
  label: string;
}

export default function ProductionChart({ buckets, focus, label }: Props) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const focusGroup = focus && (GROUP_KEYS as readonly string[]).includes(focus) ? (focus as GroupKey) : null;

  const nice = useMemo(() => niceDomain(0, Math.max(...buckets.map((b) => b.total), 1) / 1000, 3), [buckets]);
  const ready = width > 0 && height > 0 && buckets.length > 0;
  const plotW = Math.max(1, width - M.left - M.right);
  const slot = plotW / Math.max(1, buckets.length);
  const bw = Math.max(2, Math.min(24, slot - 3));
  const y = linear([nice.domain[0] * 1000, nice.domain[1] * 1000], [Math.max(M.top + 1, height - M.bottom), M.top]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = hover ?? buckets.length - 1;
    if (e.key === "ArrowLeft") setHover(Math.max(0, i - 1));
    else if (e.key === "ArrowRight") setHover(Math.min(buckets.length - 1, i + 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  const hb = hover !== null ? buckets[hover] : null;
  const hx = hover !== null ? M.left + hover * slot + slot / 2 : 0;
  const tipLeft = hx + 16 + TOOLTIP_W > width ? hx - 16 - TOOLTIP_W : hx + 16;

  return (
    <div
      ref={ref}
      className="chart"
      style={{ height: "calc(var(--plot-h) + 22px)" }}
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerLeave={() => setHover(null)}
      onFocus={() => setHover(buckets.length - 1)}
      onBlur={() => setHover(null)}
      onKeyDown={onKey}
    >
      {ready && (
        <svg width={width} height={height} aria-hidden>
          {nice.ticks.map((v) => (
            <g key={v} className="tick">
              <line x1={M.left} x2={width - M.right} y1={y(v * 1000)} y2={y(v * 1000)} stroke="var(--grid)" />
              <text x={M.left - 8} y={y(v * 1000)} dy="0.32em" textAnchor="end">
                {v}
              </text>
            </g>
          ))}

          {buckets.map((b, i) => {
            const x0 = M.left + i * slot + (slot - bw) / 2;
            let cum = 0;
            const top = [...GROUP_KEYS].reverse().find((k) => b.values[k] > 0);
            const dimCol = hover !== null && hover !== i;
            return (
              <g key={b.t} opacity={dimCol ? 0.55 : 1}>
                {GROUP_KEYS.map((k, idx) => {
                  const v = b.values[k];
                  if (v <= 0) return null;
                  const yTop = y(cum + v);
                  const yBot = y(cum);
                  cum += v;
                  const gap = idx > 0 && yBot - yTop > 3 ? 2 : 0;
                  const h = Math.max(0, yBot - yTop - gap);
                  const dim = focusGroup !== null && focusGroup !== k;
                  return (
                    <path
                      key={k}
                      d={k === top ? topRounded(x0, yTop, bw, h, 3) : `M${x0},${yTop}h${bw}v${h}h${-bw}Z`}
                      fill={`var(--series-${k})`}
                      opacity={dim ? 0.22 : 1}
                    />
                  );
                })}
                {parisHour(new Date(b.t).toISOString()) % 6 === 0 && (
                  <text className="tick" x={x0 + bw / 2} y={height - 4} textAnchor="middle">
                    {fmtTime(new Date(b.t).toISOString())}
                  </text>
                )}
                <rect
                  x={M.left + i * slot}
                  y={M.top}
                  width={slot}
                  height={height - M.top - M.bottom}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {ready && hb && (
        <div className="tooltip" style={{ width: TOOLTIP_W, transform: `translate(${tipLeft}px, ${M.top}px)` }}>
          <div className="tooltip-time">
            {fmtTime(new Date(hb.t).toISOString())} – {fmtTime(new Date(hb.t + HOUR).toISOString())} · moyenne
          </div>
          {[...GROUP_KEYS].reverse().map((k) => (
            <div className="tooltip-row" key={k}>
              <i className="tooltip-key" style={{ background: `var(--series-${k})`, height: 8, borderRadius: 2 }} />
              <strong>{fmtGW(hb.values[k])} GW</strong>
              <span>{GROUPS[k].label}</span>
            </div>
          ))}
          <div className="tooltip-row" style={{ marginTop: 2 }}>
            <i />
            <strong>{fmtGW(hb.total)} GW</strong>
            <span>Total</span>
          </div>
        </div>
      )}
    </div>
  );
}
