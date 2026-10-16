import type { CountryKey, GroupKey } from "@/lib/types";

/**
 * Repère : y vers le haut, caméra isométrique placée côté (+x, +y, +z).
 * Le nord géographique pointe vers le haut de l'écran, soit (−1, 0, −1)/√2,
 * et l'est vers la droite, soit (1, 0, −1)/√2.
 */
const NORTH = [-Math.SQRT1_2, -Math.SQRT1_2] as const; // (x, z)
const EAST = [Math.SQRT1_2, -Math.SQRT1_2] as const;

/** Rayon circonscrit de l'Hexagone (unités monde). */
export const HEX_R = 11;
export const HEX_IN = (HEX_R * Math.sqrt(3)) / 2;
/** Hauteur du dessus de la dalle. */
export const SLAB_TOP = 0.6;

export type V3 = [number, number, number];

/** Point à `r` du centre selon un cap géographique (degrés, 0 = nord, sens horaire). */
export function polar(bearing: number, r: number, y = SLAB_TOP): V3 {
  const b = (bearing * Math.PI) / 180;
  const n = Math.cos(b);
  const e = Math.sin(b);
  return [(NORTH[0] * n + EAST[0] * e) * r, y, (NORTH[1] * n + EAST[1] * e) * r];
}

/** Distance du centre au bord de l'Hexagone dans la direction d'un cap. */
export function hexEdgeDistance(bearing: number) {
  const rel = ((((bearing - 30) % 60) + 60) % 60) - 30;
  return HEX_IN / Math.cos((rel * Math.PI) / 180);
}

export interface ZoneLayout {
  bearing: number;
  r: number;
  /** Demi-dimensions de la parcelle (x, z). */
  half: [number, number];
}

export type ZoneKey = GroupKey | "city" | "hub";

/** Implantation inspirée de la géographie : Paris au nord, barrages dans les Alpes, solaire au sud… */
export const ZONES: Record<ZoneKey, ZoneLayout> = {
  city: { bearing: 0, r: 5.7, half: [1.75, 1.75] },
  nucleaire: { bearing: 58, r: 6.1, half: [2.15, 1.75] },
  hydraulique: { bearing: 140, r: 6.2, half: [1.85, 1.65] },
  solaire: { bearing: 180, r: 6.1, half: [1.85, 1.55] },
  bioenergies: { bearing: 236, r: 6.3, half: [1.4, 1.35] },
  fossile: { bearing: 272, r: 6.4, half: [1.55, 1.45] },
  eolien: { bearing: 308, r: 6.4, half: [1.75, 1.75] },
  hub: { bearing: 0, r: 0, half: [1.3, 1.3] },
};

export function zoneCenter(k: ZoneKey, y = SLAB_TOP): V3 {
  const z = ZONES[k];
  return polar(z.bearing, z.r, y);
}

/** Rayon approximatif d'une parcelle vue depuis le centre (pour arrêter les lignes au bord). */
export function zoneRadius(k: ZoneKey) {
  const [hx, hz] = ZONES[k].half;
  return Math.min(hx, hz) * 1.05;
}

export const BORDER_BEARINGS: Record<CountryKey, number> = {
  angleterre: 330,
  allemagne_belgique: 28,
  suisse: 84,
  italie: 112,
  espagne: 208,
};

/** Rayon de la parcelle centrale (poste RTE) d'où partent les lignes. */
export const HUB_RADIUS = 1.5;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const along = (from: V3, to: V3, d: number): V3 => {
  const v = sub(to, from);
  const len = Math.hypot(v[0], v[2]) || 1;
  return [from[0] + (v[0] / len) * d, from[1], from[2] + (v[2] / len) * d];
};

/** Ligne entre le poste central et une parcelle (du bord du poste au bord de la parcelle). */
export function zoneLine(k: ZoneKey): [V3, V3] {
  const c = zoneCenter(k);
  const hub = zoneCenter("hub");
  const len = Math.hypot(c[0] - hub[0], c[2] - hub[2]);
  return [along(hub, c, HUB_RADIUS), along(hub, c, len - zoneRadius(k))];
}

/** Point d'interconnexion sur le bord de l'Hexagone. */
export function borderPoint(c: CountryKey, inset = 0.45): V3 {
  const b = BORDER_BEARINGS[c];
  return polar(b, hexEdgeDistance(b) - inset);
}

export function borderLine(c: CountryKey): [V3, V3] {
  const hub = zoneCenter("hub");
  const end = borderPoint(c, 0.75);
  return [along(hub, end, HUB_RADIUS), end];
}

/** Distance (plan xz) d'un point à un segment. */
export function distToSegment(p: [number, number], a: V3, b: V3) {
  const ax = a[0];
  const az = a[2];
  const dx = b[0] - ax;
  const dz = b[2] - az;
  const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - (ax + t * dx), p[1] - (az + t * dz));
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
