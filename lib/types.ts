export const SOURCE_KEYS = [
  "nucleaire",
  "hydraulique",
  "eolien",
  "solaire",
  "bioenergies",
  "gaz",
  "fioul",
  "charbon",
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

/**
 * Filières affichées. L'ordre est celui de l'empilement des graphiques : il a été
 * validé (séparation daltonisme ΔE ≥ 8 entre voisins, en clair comme en sombre).
 * Ne pas le réordonner sans relancer la validation de palette.
 */
export const GROUP_KEYS = [
  "nucleaire",
  "bioenergies",
  "hydraulique",
  "solaire",
  "eolien",
  "fossile",
] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

export const COUNTRY_KEYS = [
  "angleterre",
  "allemagne_belgique",
  "suisse",
  "italie",
  "espagne",
] as const;
export type CountryKey = (typeof COUNTRY_KEYS)[number];

export interface Snapshot {
  /** Horodatage ISO 8601 (UTC) du quart d'heure. */
  time: string;
  /** Consommation nationale, MW. */
  consumption: number;
  /** Prévision RTE du jour pour ce quart d'heure, MW. */
  forecast: number | null;
  /** Intensité carbone de la production, gCO₂eq/kWh. */
  co2: number;
  /** Production par source, MW. */
  production: Record<SourceKey, number>;
  /** Part offshore de l'éolien, MW. */
  windOffshore: number;
  /** Pompage des STEP, MW (négatif quand les stations consomment). */
  pumping: number;
  /** Échanges commerciaux par frontière, MW (> 0 import, < 0 export). */
  exchanges: Record<CountryKey, number>;
  /** Solde des échanges physiques, MW (> 0 import, < 0 export). */
  netExchange: number;
}

export interface ForecastPoint {
  time: string;
  value: number;
}

export interface Eco2mixPayload {
  latest: Snapshot;
  /** 24 dernières heures, pas de 15 minutes, ordre chronologique. */
  history: Snapshot[];
  /** Prévision de consommation pour les heures à venir. */
  upcoming: ForecastPoint[];
  isDemo: boolean;
  fetchedAt: string;
  co2Threshold: number;
  refreshSeconds: number;
}
