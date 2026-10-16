"use client";

import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { fmtGW, fmtInt, fmtPct, signed } from "@/lib/format";
import { CO2_LEVEL_LABEL, co2Level, emissionsPerHour, type Co2Level } from "@/lib/sources";
import type { Snapshot } from "@/lib/types";
import Gauge from "../charts/Gauge";
import Sparkbars from "../charts/Sparkbars";
import { Card, LensButton } from "./Card";

const HOUR = 3600_000;

function hourlyConsumption(history: Snapshot[]) {
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const s of history) {
    const t = Math.floor(Date.parse(s.time) / HOUR) * HOUR;
    const b = buckets.get(t) ?? { sum: 0, n: 0 };
    b.sum += s.consumption;
    b.n += 1;
    buckets.set(t, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .slice(-24)
    .map(([, b]) => b.sum / b.n);
}

interface ConsumptionProps {
  latest: Snapshot;
  history: Snapshot[];
  focused: boolean;
  stale: boolean;
  onLens: () => void;
}

export function ConsumptionCard({ latest, history, focused, stale, onLens }: ConsumptionProps) {
  const hourly = hourlyConsumption(history);
  const delta = latest.forecast ? ((latest.consumption - latest.forecast) / latest.forecast) * 100 : null;
  const lo = Math.min(...hourly);
  const hi = Math.max(...hourly);

  return (
    <Card
      title="Consommation"
      focused={focused}
      stale={stale}
      actions={<LensButton onClick={onLens} label="Voir la ville dans la scène" />}
    >
      <div className="metric-row">
        <p className="metric">
          <span className="metric-value">{fmtInt(latest.consumption)}</span>
          <span className="metric-unit">MW</span>
        </p>
        <Sparkbars
          values={hourly}
          label={`Consommation horaire sur 24 heures, de ${fmtGW(lo)} à ${fmtGW(hi)} GW`}
        />
      </div>
      {delta !== null && latest.forecast !== null && (
        <p className="metric-note">
          Prévision RTE <strong>{fmtInt(latest.forecast)} MW</strong> · écart{" "}
          <strong>{signed(delta, fmtPct(Math.abs(delta)))} %</strong>
        </p>
      )}
    </Card>
  );
}

const LEVEL_ICON: Record<Co2Level, typeof CircleCheck> = {
  good: CircleCheck,
  warning: CircleAlert,
  serious: TriangleAlert,
};

interface CarbonProps {
  latest: Snapshot;
  threshold: number;
  focused: boolean;
  stale: boolean;
  onLens: () => void;
}

export function CarbonCard({ latest, threshold, focused, stale, onLens }: CarbonProps) {
  const level = co2Level(latest.co2, threshold);
  const Icon = LEVEL_ICON[level];
  const max = Math.max(150, Math.ceil((threshold * 1.5) / 10) * 10, Math.ceil((latest.co2 * 1.1) / 10) * 10);

  return (
    <Card
      title="Intensité carbone"
      focused={focused}
      stale={stale}
      actions={<LensButton onClick={onLens} label="Voir les sources émettrices dans la scène" />}
    >
      <Gauge
        value={latest.co2}
        max={max}
        threshold={threshold}
        level={level}
        unit="g CO₂/kWh"
        label={`Intensité carbone : ${latest.co2} g CO₂ par kWh, seuil d'alerte ${threshold}`}
      />
      <div className="gauge-row">
        <span className={`status-tag ${level}`}>
          <Icon size={14} strokeWidth={2} aria-hidden />
          {CO2_LEVEL_LABEL[level]}
        </span>
        <p className="metric-note" style={{ margin: 0, textAlign: "right" }}>
          ≈ <strong>{fmtInt(emissionsPerHour(latest))} t CO₂/h</strong>
        </p>
      </div>
    </Card>
  );
}
