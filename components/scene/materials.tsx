"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { GROUP_KEYS, type GroupKey } from "@/lib/types";
import type { ScenePalette } from "./palette";

export interface Materials {
  ground: THREE.MeshStandardMaterial;
  slab: THREE.MeshStandardMaterial;
  plot: THREE.MeshStandardMaterial;
  clay: THREE.MeshStandardMaterial;
  clayAlt: THREE.MeshStandardMaterial;
  mountain: THREE.MeshStandardMaterial;
  window: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  line: THREE.MeshStandardMaterial;
  /** Matériaux de base des panaches (clonés par bouffée pour l'opacité). */
  steam: THREE.MeshStandardMaterial;
  smoke: THREE.MeshStandardMaterial;
  /** Accents colorés (légèrement émissifs le jour, lumineux la nuit). */
  series: Record<GroupKey, THREE.MeshStandardMaterial>;
  accent: THREE.MeshStandardMaterial;
  export: THREE.MeshStandardMaterial;
  import: THREE.MeshStandardMaterial;
}

let panelMap: THREE.CanvasTexture | null = null;

/** Cellules photovoltaïques : fond bleu nuit quadrillé de fins liserés clairs. */
function panelTexture() {
  if (panelMap) return panelMap;
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e9eef5";
  ctx.fillRect(0, 0, 192, 96);
  const cols = 6;
  const rows = 3;
  const gap = 3;
  const cw = (192 - gap * (cols + 1)) / cols;
  const ch = (96 - gap * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gap + c * (cw + gap);
      const y = gap + r * (ch + gap);
      const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
      g.addColorStop(0, "#2f416a");
      g.addColorStop(1, "#1f2c4b");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cw, ch);
    }
  }
  panelMap = new THREE.CanvasTexture(canvas);
  panelMap.colorSpace = THREE.SRGBColorSpace;
  panelMap.anisotropy = 4;
  return panelMap;
}

const plume = (color: string, glow: number) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: glow,
    roughness: 1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

const clay = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });

function createMaterials(p: ScenePalette): Materials {
  const glow = (color: string, k = 1) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: p.glow * k,
      roughness: 0.45,
      metalness: 0,
    });

  return {
    ground: clay(p.ground, { roughness: 1 }),
    slab: clay(p.slab),
    plot: clay(p.plot),
    clay: clay(p.clay),
    clayAlt: clay(p.clayAlt),
    mountain: clay(p.clay, { flatShading: true }),
    window: new THREE.MeshStandardMaterial({
      color: p.window,
      emissive: p.window,
      emissiveIntensity: p.windowGlow,
      roughness: 0.3,
      metalness: 0.1,
    }),
    panel: new THREE.MeshStandardMaterial({ color: p.panel, map: panelTexture(), roughness: 0.3, metalness: 0.5 }),
    water: new THREE.MeshStandardMaterial({
      color: p.water,
      emissive: p.water,
      emissiveIntensity: p.glow * 0.35,
      roughness: 0.12,
      metalness: 0.15,
    }),
    line: clay(p.line, { roughness: 0.8 }),
    steam: plume(p.steam, p.plumeGlow),
    smoke: plume(p.smoke, p.plumeGlow * 0.6),
    series: Object.fromEntries(GROUP_KEYS.map((k) => [k, glow(p.series[k])])) as Record<
      GroupKey,
      THREE.MeshStandardMaterial
    >,
    accent: glow(p.accent),
    export: glow(p.export),
    import: glow(p.import),
  };
}

function disposeAll(m: Materials) {
  const { series, ...rest } = m;
  Object.values(rest).forEach((mat) => mat.dispose());
  Object.values(series).forEach((mat) => mat.dispose());
}

const MaterialsContext = createContext<Materials | null>(null);

export function MaterialsProvider({ palette, children }: { palette: ScenePalette; children: ReactNode }) {
  const materials = useMemo(() => createMaterials(palette), [palette]);
  useEffect(() => () => disposeAll(materials), [materials]);
  return <MaterialsContext.Provider value={materials}>{children}</MaterialsContext.Provider>;
}

export function useMaterials() {
  const m = useContext(MaterialsContext);
  if (!m) throw new Error("useMaterials doit être utilisé dans <MaterialsProvider>");
  return m;
}
