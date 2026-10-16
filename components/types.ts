import type { CountryKey, GroupKey } from "@/lib/types";

/** Vues de la scène, pilotées par les onglets de la barre du haut. */
export type Lens = "overview" | "production" | "exchanges" | "carbon";

export const LENSES: { key: Lens; label: string }[] = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "production", label: "Production" },
  { key: "exchanges", label: "Échanges" },
  { key: "carbon", label: "Carbone" },
];

/** Élément survolé, partagé entre la scène 3D et les cartes. */
export type FocusKey = GroupKey | CountryKey | "city" | "hub";
