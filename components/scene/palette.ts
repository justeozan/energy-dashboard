import { SERIES_COLORS } from "@/lib/sources";
import type { GroupKey } from "@/lib/types";
import type { Theme } from "../useTheme";

export interface ScenePalette {
  background: string;
  ground: string;
  slab: string;
  plot: string;
  clay: string;
  clayAlt: string;
  window: string;
  /** Fenêtres éclairées (nuit) : intensité émissive. */
  windowGlow: number;
  panel: string;
  water: string;
  line: string;
  steam: string;
  smoke: string;
  /** Vapeur et fumées éclairées de l'intérieur la nuit. */
  plumeGlow: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sun: string;
  sunIntensity: number;
  envIntensity: number;
  /** Multiplicateur d'émission des accents (> 1 la nuit pour le bloom). */
  glow: number;
  fog: [number, number];
  aoIntensity: number;
  aoColor: string;
  bloom: boolean;
  series: Record<GroupKey, string>;
  accent: string;
  export: string;
  import: string;
}

export const PALETTES: Record<Theme, ScenePalette> = {
  light: {
    background: "#e9ecf1",
    ground: "#e2e6ec",
    slab: "#f1f3f6",
    plot: "#fbfcfd",
    clay: "#f7f8fa",
    clayAlt: "#e6eaf0",
    window: "#bfcbdc",
    windowGlow: 0,
    /** Teinte multipliée à la texture des panneaux solaires. */
    panel: "#ffffff",
    water: "#3d86dd",
    line: "#cfd5de",
    steam: "#ffffff",
    smoke: "#b9c0ca",
    plumeGlow: 0,
    hemiSky: "#ffffff",
    hemiGround: "#a9b3c2",
    hemiIntensity: 1.05,
    sun: "#ffffff",
    sunIntensity: 2.3,
    envIntensity: 0.55,
    glow: 0.35,
    fog: [70, 120],
    aoIntensity: 2.4,
    aoColor: "#5a6478",
    bloom: false,
    series: SERIES_COLORS.light,
    accent: "#2a6fdb",
    export: "#2a78d6",
    import: "#e34948",
  },
  dark: {
    background: "#07090d",
    ground: "#0b0e14",
    slab: "#171d27",
    plot: "#1e2531",
    clay: "#2b3443",
    clayAlt: "#212935",
    window: "#ffc979",
    windowGlow: 2.2,
    panel: "#7b88a6",
    water: "#1f5fb5",
    line: "#323c4c",
    steam: "#c9d2e0",
    smoke: "#7a8291",
    plumeGlow: 0.5,
    hemiSky: "#6f84b0",
    hemiGround: "#05070a",
    hemiIntensity: 0.95,
    sun: "#b4c4ff",
    sunIntensity: 1.5,
    envIntensity: 0.35,
    glow: 2.6,
    fog: [66, 110],
    aoIntensity: 2.2,
    aoColor: "#000000",
    bloom: true,
    series: SERIES_COLORS.dark,
    accent: "#5b9bff",
    export: "#3987e5",
    import: "#e66767",
  },
};
