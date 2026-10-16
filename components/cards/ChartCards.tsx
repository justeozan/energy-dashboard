"use client";

import { ChartColumnStacked, ChartSpline, Table2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { fmtGW, fmtInt, fmtTime } from "@/lib/format";
import { GROUPS } from "@/lib/sources";
import { GROUP_KEYS, type ForecastPoint, type Snapshot } from "@/lib/types";
import ProductionChart, { hourlyMix } from "../charts/ProductionChart";
import TimeChart, { type TimeSeries } from "../charts/TimeChart";
import type { FocusKey } from "../types";
import { Card } from "./Card";

const onTheHour = (iso: string) => new Date(iso).getUTCMinutes() === 0;

function ViewToggle({
  table,
  onChange,
  chartIcon,
}: {
  table: boolean;
  onChange: (t: boolean) => void;
  chartIcon: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        className="card-btn"
        aria-pressed={!table}
        aria-label="Afficher le graphique"
        title="Graphique"
        onClick={() => onChange(false)}
      >
        {chartIcon}
      </button>
      <button
        type="button"
        className="card-btn"
        aria-pressed={table}
        aria-label="Afficher le tableau de données"
        title="Tableau"
        onClick={() => onChange(true)}
      >
        <Table2 size={15} strokeWidth={1.8} />
      </button>
    </>
  );
}

interface ConsumptionChartProps {
  history: Snapshot[];
  upcoming: ForecastPoint[];
  focused: boolean;
  stale: boolean;
}

export function ConsumptionChartCard({ history, upcoming, focused, stale }: ConsumptionChartProps) {
  const [table, setTable] = useState(false);
  const series = useMemo<TimeSeries[]>(() => {
    const actual = history.map((s) => ({ t: Date.parse(s.time), v: s.consumption }));
    const forecast = [
      ...history.filter((s) => s.forecast !== null).map((s) => ({ t: Date.parse(s.time), v: s.forecast as number })),
      ...upcoming.map((p) => ({ t: Date.parse(p.time), v: p.value })),
    ];
    return [
      { key: "actual", label: "Réalisé", color: "var(--accent)", kind: "area", points: actual },
      { key: "forecast", label: "Prévision RTE", color: "var(--ink-3)", kind: "dashed", points: forecast },
    ];
  }, [history, upcoming]);
  const now = Date.parse(history[history.length - 1].time);

  return (
    <Card
      title="Courbe de charge"
      sub="Consommation sur 24 h et prévision · GW"
      focused={focused}
      stale={stale}
      actions={<ViewToggle table={table} onChange={setTable} chartIcon={<ChartSpline size={15} strokeWidth={1.8} />} />}
    >
      {table ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Heure</th>
                <th scope="col">Réalisé (MW)</th>
                <th scope="col">Prévision (MW)</th>
              </tr>
            </thead>
            <tbody>
              {history.filter((s) => onTheHour(s.time)).map((s) => (
                <tr key={s.time}>
                  <td>{fmtTime(s.time)}</td>
                  <td>{fmtInt(s.consumption)}</td>
                  <td>{s.forecast !== null ? fmtInt(s.forecast) : "—"}</td>
                </tr>
              ))}
              {upcoming.filter((p) => onTheHour(p.time)).map((p) => (
                <tr key={p.time}>
                  <td>{fmtTime(p.time)}</td>
                  <td>—</td>
                  <td>{fmtInt(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <ul className="legend">
            <li>
              <i className="key-line" style={{ background: "var(--accent)" }} />
              Réalisé
            </li>
            <li>
              <i className="key-dash" />
              Prévision RTE
            </li>
          </ul>
          <TimeChart
            series={series}
            now={now}
            formatValue={(v) => `${fmtGW(v)} GW`}
            formatTick={(v) => fmtInt(v / 1000)}
            label="Consommation sur 24 heures et prévision RTE pour les heures à venir"
          />
        </>
      )}
    </Card>
  );
}

interface ProductionChartProps {
  history: Snapshot[];
  focus: FocusKey | null;
  focused: boolean;
  stale: boolean;
}

export function ProductionChartCard({ history, focus, focused, stale }: ProductionChartProps) {
  const [table, setTable] = useState(false);
  const buckets = useMemo(() => hourlyMix(history), [history]);

  return (
    <Card
      title="Production par filière"
      sub="Moyennes horaires sur 24 h · GW"
      focused={focused}
      stale={stale}
      actions={
        <ViewToggle table={table} onChange={setTable} chartIcon={<ChartColumnStacked size={15} strokeWidth={1.8} />} />
      }
    >
      {table ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Heure</th>
                {[...GROUP_KEYS].map((k) => (
                  <th key={k} scope="col">
                    {GROUPS[k].label.split(" ")[0]}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.t}>
                  <td>{fmtTime(new Date(b.t).toISOString())}</td>
                  {GROUP_KEYS.map((k) => (
                    <td key={k}>{fmtGW(b.values[k])}</td>
                  ))}
                  <td>{fmtGW(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <ul className="legend">
            {GROUP_KEYS.map((k) => (
              <li key={k}>
                <i className="key-rect" style={{ background: `var(--series-${k})` }} />
                {k === "fossile" ? "Fossile" : GROUPS[k].label}
              </li>
            ))}
          </ul>
          <ProductionChart
            buckets={buckets}
            focus={focus}
            label="Production horaire moyenne par filière sur 24 heures, en gigawatts"
          />
        </>
      )}
    </Card>
  );
}

interface Co2ChartProps {
  history: Snapshot[];
  threshold: number;
  focused: boolean;
  stale: boolean;
}

export function Co2ChartCard({ history, threshold, focused, stale }: Co2ChartProps) {
  const [table, setTable] = useState(false);
  const series = useMemo<TimeSeries[]>(
    () => [
      {
        key: "co2",
        label: "g CO₂/kWh",
        color: "var(--co2-line)",
        kind: "area",
        points: history.map((s) => ({ t: Date.parse(s.time), v: s.co2 })),
      },
    ],
    [history],
  );

  return (
    <Card
      title="Historique carbone"
      sub="Intensité sur 24 h · g CO₂/kWh"
      focused={focused}
      stale={stale}
      actions={<ViewToggle table={table} onChange={setTable} chartIcon={<ChartSpline size={15} strokeWidth={1.8} />} />}
    >
      {table ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Heure</th>
                <th scope="col">g CO₂/kWh</th>
              </tr>
            </thead>
            <tbody>
              {history.filter((s) => onTheHour(s.time)).map((s) => (
                <tr key={s.time}>
                  <td>{fmtTime(s.time)}</td>
                  <td>{s.co2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <ul className="legend">
            <li>
              <i className="key-line" style={{ background: "var(--co2-line)" }} />
              Intensité
            </li>
            <li>
              <i className="key-dash" style={{ borderTopColor: "var(--serious)" }} />
              Seuil d&apos;alerte
            </li>
          </ul>
          <TimeChart
          series={series}
          zeroBased
          threshold={{ value: threshold, label: `seuil ${threshold}` }}
          formatValue={(v) => `${fmtInt(v)} g/kWh`}
          formatTick={(v) => fmtInt(v)}
          label={`Intensité carbone sur 24 heures, seuil d'alerte ${threshold} g CO₂ par kWh`}
          />
        </>
      )}
    </Card>
  );
}
