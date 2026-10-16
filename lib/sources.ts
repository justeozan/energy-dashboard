import {
  COUNTRY_KEYS,
  GROUP_KEYS,
  type CountryKey,
  type GroupKey,
  type Snapshot,
} from "./types";

export interface GroupMeta {
  key: GroupKey;
  label: string;
  renewable: boolean;
  lowCarbon: boolean;
}

export const GROUPS: Record<GroupKey, GroupMeta> = {
  nucleaire: { key: "nucleaire", label: "Nucléaire", renewable: false, lowCarbon: true },
  bioenergies: { key: "bioenergies", label: "Bioénergies", renewable: true, lowCarbon: true },
  hydraulique: { key: "hydraulique", label: "Hydraulique", renewable: true, lowCarbon: true },
  solaire: { key: "solaire", label: "Solaire", renewable: true, lowCarbon: true },
  eolien: { key: "eolien", label: "Éolien", renewable: true, lowCarbon: true },
  fossile: { key: "fossile", label: "Thermique fossile", renewable: false, lowCarbon: false },
};

/** Couleurs de série validées (voir GROUP_KEYS) — miroir des variables CSS --series-*. */
export const SERIES_COLORS: Record<"light" | "dark", Record<GroupKey, string>> = {
  light: {
    nucleaire: "#6250d6",
    bioenergies: "#008300",
    hydraulique: "#2a78d6",
    solaire: "#eda100",
    eolien: "#1baf7a",
    fossile: "#eb6834",
  },
  dark: {
    nucleaire: "#9085e9",
    bioenergies: "#008300",
    hydraulique: "#3987e5",
    solaire: "#c98500",
    eolien: "#199e70",
    fossile: "#d95926",
  },
};

export interface CountryMeta {
  key: CountryKey;
  label: string;
}

export const COUNTRIES: Record<CountryKey, CountryMeta> = {
  angleterre: { key: "angleterre", label: "Royaume-Uni" },
  allemagne_belgique: { key: "allemagne_belgique", label: "Belgique · Allemagne" },
  suisse: { key: "suisse", label: "Suisse" },
  italie: { key: "italie", label: "Italie" },
  espagne: { key: "espagne", label: "Espagne" },
};

export function groupValues(s: Snapshot): Record<GroupKey, number> {
  const p = s.production;
  return {
    nucleaire: p.nucleaire,
    bioenergies: p.bioenergies,
    hydraulique: p.hydraulique,
    solaire: p.solaire,
    eolien: p.eolien,
    fossile: p.gaz + p.fioul + p.charbon,
  };
}

export function totalProduction(s: Snapshot): number {
  const g = groupValues(s);
  return GROUP_KEYS.reduce((sum, k) => sum + g[k], 0);
}

export interface MixSummary {
  total: number;
  groups: Record<GroupKey, number>;
  share: Record<GroupKey, number>;
  renewablePct: number;
  lowCarbonPct: number;
}

export function mixSummary(s: Snapshot): MixSummary {
  const groups = groupValues(s);
  const total = GROUP_KEYS.reduce((sum, k) => sum + groups[k], 0);
  const share = Object.fromEntries(
    GROUP_KEYS.map((k) => [k, total > 0 ? (groups[k] / total) * 100 : 0]),
  ) as Record<GroupKey, number>;
  const renewable = GROUP_KEYS.filter((k) => GROUPS[k].renewable).reduce((a, k) => a + groups[k], 0);
  const lowCarbon = GROUP_KEYS.filter((k) => GROUPS[k].lowCarbon).reduce((a, k) => a + groups[k], 0);
  return {
    total,
    groups,
    share,
    renewablePct: total > 0 ? (renewable / total) * 100 : 0,
    lowCarbonPct: total > 0 ? (lowCarbon / total) * 100 : 0,
  };
}

/** Émissions de la production française, tCO₂/h (intensité g/kWh × MW / 1000). */
export function emissionsPerHour(s: Snapshot): number {
  return (s.co2 * totalProduction(s)) / 1000;
}

export function sortedCountries(s: Snapshot): CountryKey[] {
  return [...COUNTRY_KEYS].sort((a, b) => Math.abs(s.exchanges[b]) - Math.abs(s.exchanges[a]));
}

export type Co2Level = "good" | "warning" | "serious";

/** Niveau de statut de l'intensité carbone par rapport au seuil d'alerte. */
export function co2Level(co2: number, threshold: number): Co2Level {
  if (co2 > threshold) return "serious";
  if (co2 > threshold * 0.6) return "warning";
  return "good";
}

export const CO2_LEVEL_LABEL: Record<Co2Level, string> = {
  good: "Bas carbone",
  warning: "Modéré",
  serious: "Au-dessus du seuil",
};
