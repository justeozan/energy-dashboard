"use client";

import { area, curveMonotoneX, line } from "d3-shape";
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fmtTime, parisHour } from "@/lib/format";
import { hourTicks, linear, nearestIndex, niceDomain } from "./scale";
import { useSize } from "./useSize";

export interface TimePoint {
  t: number;
  v: number;
}

export interface TimeSeries {
  key: string;
  label: string;
  /** Couleur CSS (variable de thème). */
  color: string;
  kind: "area" | "line" | "dashed";
  points: TimePoint[];
}

interface Props {
  series: TimeSeries[];
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  threshold?: { value: number; label: string };
  now?: number;
  zeroBased?: boolean;
  label: string;
}

const M = { top: 10, right: 10, bottom: 22, left: 38 };
const TOOLTIP_W = 150;

const parisHourOf = (t: number) => parisHour(new Date(t).toISOString());

export default function TimeChart({ series, formatValue, formatTick, threshold, now, zeroBased, label }: Props) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const [hoverT, setHoverT] = useState<number | null>(null);

  const model = useMemo(() => {
    const times = [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b);
    const values = series.flatMap((s) => s.points.map((p) => p.v));
    if (threshold) values.push(threshold.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.12 || 1;
    const nice = niceDomain(zeroBased ? 0 : Math.max(0, lo - pad), hi + pad * 0.5, 3);
    const lookup = series.map((s) => new Map(s.points.map((p) => [p.t, p.v])));
    return { times, nice, lookup };
  }, [series, threshold, zeroBased]);

  const { times, nice, lookup } = model;
  const ready = width > 0 && height > 0 && times.length > 1;
  const x = linear([times[0] ?? 0, times[times.length - 1] ?? 1], [M.left, Math.max(M.left + 1, width - M.right)]);
  const y = linear(nice.domain, [Math.max(M.top + 1, height - M.bottom), M.top]);

  const lineGen = line<TimePoint>()
    .x((p) => x(p.t))
    .y((p) => y(p.v))
    .curve(curveMonotoneX);
  const areaGen = area<TimePoint>()
    .x((p) => x(p.t))
    .y0(y(nice.domain[0]))
    .y1((p) => y(p.v))
    .curve(curveMonotoneX);

  const xTicks = ready ? hourTicks(times[0], times[times.length - 1], 6, parisHourOf) : [];

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = times[0] + ((e.clientX - rect.left - M.left) / (width - M.left - M.right)) * (times[times.length - 1] - times[0]);
    setHoverT(times[nearestIndex(times, t)]);
  };

  const lastActual = (() => {
    const primary = series.find((s) => s.kind !== "dashed") ?? series[0];
    return primary?.points[primary.points.length - 1]?.t ?? null;
  })();

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!ready) return;
    const i = hoverT === null ? times.length - 1 : times.indexOf(hoverT);
    if (e.key === "ArrowLeft") setHoverT(times[Math.max(0, i - 1)]);
    else if (e.key === "ArrowRight") setHoverT(times[Math.min(times.length - 1, i + 1)]);
    else if (e.key === "Escape") setHoverT(null);
    else return;
    e.preventDefault();
  };

  const hx = hoverT !== null ? x(hoverT) : 0;
  const tipLeft = hx + 14 + TOOLTIP_W > width ? hx - 14 - TOOLTIP_W : hx + 14;

  return (
    <div
      ref={ref}
      className="chart"
      style={{ height: "calc(var(--plot-h) + 22px)" }}
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerMove={onMove}
      onPointerLeave={() => setHoverT(null)}
      onFocus={() => setHoverT(lastActual)}
      onBlur={() => setHoverT(null)}
      onKeyDown={onKey}
    >
      {ready && (
        <svg width={width} height={height} aria-hidden>
          {nice.ticks.map((v) => (
            <g key={v} className="tick">
              <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {formatTick(v)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="tick" x={x(t)} y={height - 4} textAnchor="middle">
              {fmtTime(new Date(t).toISOString())}
            </text>
          ))}

          {threshold && (
            <g>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(threshold.value)}
                y2={y(threshold.value)}
                stroke="var(--serious)"
                strokeDasharray="4 4"
              />
              <text x={width - M.right} y={y(threshold.value) - 5} textAnchor="end">
                {threshold.label}
              </text>
            </g>
          )}

          {now !== undefined && now > times[0] && now < times[times.length - 1] && (
            <g>
              <line x1={x(now)} x2={x(now)} y1={M.top} y2={height - M.bottom} stroke="var(--axis)" />
              <text x={x(now) + 5} y={M.top + 2} dy="0.7em">
                maintenant
              </text>
            </g>
          )}

          {series.map((s) =>
            s.kind === "area" ? (
              <path key={`${s.key}-a`} d={areaGen(s.points) ?? ""} fill={s.color} fillOpacity={0.1} />
            ) : null,
          )}
          {series.map((s) => (
            <path
              key={s.key}
              d={lineGen(s.points) ?? ""}
              fill="none"
              stroke={s.kind === "dashed" ? "var(--ink-3)" : s.color}
              strokeWidth={s.kind === "dashed" ? 1.5 : 2}
              strokeDasharray={s.kind === "dashed" ? "4 4" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {series
            .filter((s) => s.kind !== "dashed" && s.points.length > 0)
            .map((s) => {
              const p = s.points[s.points.length - 1];
              return (
                <circle
                  key={`${s.key}-end`}
                  cx={x(p.t)}
                  cy={y(p.v)}
                  r={4}
                  fill={s.color}
                  stroke="var(--glass-solid)"
                  strokeWidth={2}
                />
              );
            })}

          {hoverT !== null && (
            <g>
              <line x1={hx} x2={hx} y1={M.top} y2={height - M.bottom} stroke="var(--ink-3)" strokeOpacity={0.5} />
              {series.map((s, i) => {
                const v = lookup[i].get(hoverT);
                return v === undefined ? null : (
                  <circle
                    key={s.key}
                    cx={hx}
                    cy={y(v)}
                    r={4}
                    fill={s.kind === "dashed" ? "var(--ink-3)" : s.color}
                    stroke="var(--glass-solid)"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>
      )}

      {ready && hoverT !== null && (
        <div className="tooltip" style={{ width: TOOLTIP_W, transform: `translate(${tipLeft}px, ${M.top}px)` }}>
          <div className="tooltip-time">{fmtTime(new Date(hoverT).toISOString())}</div>
          {series.map((s, i) => {
            const v = lookup[i].get(hoverT);
            return v === undefined ? null : (
              <div className="tooltip-row" key={s.key}>
                <i
                  className="tooltip-key"
                  style={
                    s.kind === "dashed"
                      ? { borderTop: "2px dashed var(--ink-3)", height: 0, background: "none" }
                      : { background: s.color }
                  }
                />
                <strong>{formatValue(v)}</strong>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
