import { parisHour } from "./format";
import {
  COUNTRY_KEYS,
  SOURCE_KEYS,
  type CountryKey,
  type Eco2mixPayload,
  type ForecastPoint,
  type Snapshot,
  type SourceKey,
} from "./types";

/** API publique ODRE (RTE éCO2mix, temps réel) — gratuite, sans clé. */
const ODRE_URL =
  "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/records";

/** Les données sont publiées au quart d'heure : 5 min de cache suffit. */
export const REVALIDATE_SECONDS = 300;

const FIELDS = [
  "date_heure",
  "consommation",
  "prevision_j",
  "taux_co2",
  ...SOURCE_KEYS,
  "eolien_offshore",
  "pompage",
  "ech_physiques",
  ...COUNTRY_KEYS.map((c) => `ech_comm_${c}`),
].join(",");

type RawRecord = Record<string, unknown>;

/** L'API renvoie parfois des nombres sous forme de chaîne ("1910"). */
const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : num(v);

async function query(params: Record<string, string>): Promise<RawRecord[] | null> {
  const url = `${ODRE_URL}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "energy-dashboard/2.0 (github.com/justeozan/energy-dashboard)" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: RawRecord[] };
    return Array.isArray(json.results) && json.results.length > 0 ? json.results : null;
  } catch {
    return null;
  }
}

function toSnapshot(r: RawRecord): Snapshot {
  return {
    time: new Date(String(r.date_heure)).toISOString(),
    consumption: num(r.consommation),
    forecast: numOrNull(r.prevision_j),
    co2: num(r.taux_co2),
    production: Object.fromEntries(SOURCE_KEYS.map((k) => [k, Math.max(0, num(r[k]))])) as Record<
      SourceKey,
      number
    >,
    windOffshore: num(r.eolien_offshore),
    pumping: num(r.pompage),
    exchanges: Object.fromEntries(
      COUNTRY_KEYS.map((c) => [c, num(r[`ech_comm_${c}`])]),
    ) as Record<CountryKey, number>,
    netExchange: num(r.ech_physiques),
  };
}

function settings() {
  const co2Threshold = Number(process.env.CO2_THRESHOLD ?? 100);
  const refresh = Number(process.env.REFRESH_INTERVAL_SECONDS ?? REVALIDATE_SECONDS);
  return {
    co2Threshold: Number.isFinite(co2Threshold) && co2Threshold > 0 ? co2Threshold : 100,
    refreshSeconds: Number.isFinite(refresh) ? Math.max(60, refresh) : REVALIDATE_SECONDS,
  };
}

export async function getEco2mix(): Promise<Eco2mixPayload> {
  const [historyRaw, upcomingRaw] = await Promise.all([
    query({
      select: FIELDS,
      where: "consommation is not null and nucleaire is not null",
      order_by: "date_heure desc",
      limit: "96",
    }),
    query({
      select: "date_heure,prevision_j,prevision_j1",
      where: "consommation is null and date_heure >= now(hours=-3)",
      order_by: "date_heure asc",
      limit: "40",
    }),
  ]);

  if (!historyRaw) return demoPayload();

  const history = historyRaw.map(toSnapshot).reverse();
  const latest = history[history.length - 1];
  const upcoming: ForecastPoint[] = (upcomingRaw ?? [])
    .map((r) => ({
      time: new Date(String(r.date_heure)).toISOString(),
      value: numOrNull(r.prevision_j) ?? num(r.prevision_j1),
    }))
    .filter((p) => p.value > 0 && p.time > latest.time)
    .slice(0, 24);

  return {
    latest,
    history,
    upcoming,
    isDemo: false,
    fetchedAt: new Date().toISOString(),
    ...settings(),
  };
}

// ── Mode démo ────────────────────────────────────────────────────────────────
// Repli quand l'API ODRE est injoignable. Mix réaliste (France : nucléaire
// majoritaire, bas carbone), bruit pseudo-aléatoire déterministe par horodatage.

const QUARTER = 15 * 60 * 1000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoSnapshot(t: number): Snapshot {
  const rand = rng(Math.floor(t / QUARTER));
  const noise = (amp: number) => (rand() - 0.5) * 2 * amp;
  const hour = parisHour(new Date(t).toISOString()) + new Date(t).getUTCMinutes() / 60;

  const daily = Math.sin((Math.PI * (hour - 5)) / 16);
  const evening = Math.exp(-((hour - 19.5) ** 2) / 3);
  const consumption = Math.round(43000 + 7000 * Math.max(0, daily) + 4000 * evening + noise(500));
  const forecast = Math.round(consumption + noise(900));

  const solaire = Math.max(0, Math.round(11000 * Math.sin((Math.PI * (hour - 7)) / 12.5) + noise(300)));
  const eolien = Math.max(300, Math.round(5200 + 2400 * Math.sin(t / 3.6e7) + noise(400)));
  const nucleaire = Math.round(39500 + noise(350));
  const hydraulique = Math.round(5200 + 3500 * evening + 1200 * Math.max(0, daily) + noise(300));
  const bioenergies = Math.round(1050 + noise(60));
  const residual = consumption + 6000 - (nucleaire + solaire + eolien + hydraulique + bioenergies);
  const gaz = Math.max(900, Math.round(Math.max(0, residual) * 0.8 + 1500));
  const fioul = Math.round(40 + Math.max(0, residual) * 0.03);
  const charbon = 0;

  const production = { nucleaire, hydraulique, eolien, solaire, bioenergies, gaz, fioul, charbon };
  const total = Object.values(production).reduce((a, b) => a + b, 0);
  const co2 = Math.round((gaz * 429 + fioul * 777 + bioenergies * 150 + total * 4) / total);
  const netExchange = consumption - total;
  const split: Record<CountryKey, number> = {
    angleterre: 0.2,
    allemagne_belgique: 0.38,
    suisse: 0.17,
    italie: 0.2,
    espagne: 0.05,
  };
  const exchanges = Object.fromEntries(
    COUNTRY_KEYS.map((c) => [c, Math.round(netExchange * split[c] + noise(150))]),
  ) as Record<CountryKey, number>;

  return {
    time: new Date(t).toISOString(),
    consumption,
    forecast,
    co2,
    production,
    windOffshore: Math.round(eolien * 0.08),
    pumping: hour < 6 ? -Math.round(1200 + noise(200)) : 0,
    exchanges,
    netExchange,
  };
}

function demoPayload(): Eco2mixPayload {
  const last = Math.floor(Date.now() / QUARTER) * QUARTER - QUARTER;
  const history = Array.from({ length: 96 }, (_, i) => demoSnapshot(last - (95 - i) * QUARTER));
  const upcoming = Array.from({ length: 24 }, (_, i) => {
    const s = demoSnapshot(last + (i + 1) * QUARTER);
    return { time: s.time, value: s.forecast ?? s.consumption };
  });
  return {
    latest: history[history.length - 1],
    history,
    upcoming,
    isDemo: true,
    fetchedAt: new Date().toISOString(),
    ...settings(),
  };
}
