"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useMemo, type CSSProperties, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { fmtGW, fmtInt, fmtPct, fmtPowerParts } from "@/lib/format";
import { COUNTRIES, GROUPS, mixSummary } from "@/lib/sources";
import { COUNTRY_KEYS, GROUP_KEYS, type GroupKey, type Snapshot } from "@/lib/types";
import { CityIcon, GROUP_ICONS, HubIcon } from "../icons";
import type { FocusKey, Lens } from "../types";
import { borderPoint, zoneCenter, type V3, type ZoneKey } from "./geo";
import type { ScenePalette } from "./palette";

export interface LabelSpec {
  id: FocusKey;
  position: V3;
  color: string;
  icon: ReactNode;
  iconInk?: string;
  title: string;
  value: string;
  unit: string;
  extra?: ReactNode;
  visible: boolean;
  /** Atténuée même sans survol (vue carbone : sources bas carbone). */
  muted?: boolean;
  border?: boolean;
}

/** Ancrage des étiquettes, relatif au centre de chaque parcelle. */
const ANCHORS: Record<ZoneKey, V3> = {
  nucleaire: [0.6, 3.05, -0.72],
  hydraulique: [0, 1.3, -0.45],
  eolien: [0.45, 3.55, -1.15],
  solaire: [0, 0.8, 0],
  bioenergies: [-0.5, 1.05, -0.45],
  fossile: [0.32, 2.8, -0.92],
  city: [1.08, 2.5, 1.08],
  hub: [0, 1.35, 0.05],
};

const anchor = (k: ZoneKey): V3 => {
  const c = zoneCenter(k);
  const a = ANCHORS[k];
  return [c[0] + a[0], c[1] + a[1], c[2] + a[2]];
};

/** Étiquettes de la scène selon la vue active. */
export function buildLabels(latest: Snapshot, lens: Lens, palette: ScenePalette): LabelSpec[] {
  const mix = mixSummary(latest);
  const p = latest.production;
  const expanded = lens === "production";

  const sources = GROUP_KEYS.map((k: GroupKey): LabelSpec => {
    const Icon = GROUP_ICONS[k];
    return {
      id: k,
      position: anchor(k),
      color: palette.series[k],
      icon: <Icon size={13} strokeWidth={2.2} />,
      iconInk: k === "solaire" ? "#1d1400" : undefined,
      title: expanded ? `${GROUPS[k].label} · ${fmtPct(mix.share[k])} %` : GROUPS[k].label,
      value: fmtGW(mix.groups[k]),
      unit: "GW",
      extra: expanded ? (
        <span className="tag3d-extra">
          <span style={{ width: `${mix.share[k]}%` }} />
        </span>
      ) : lens === "carbon" && k === "fossile" ? (
        <span className="tag3d-title">
          gaz {fmtGW(p.gaz)} · fioul {fmtInt(p.fioul)} MW
        </span>
      ) : undefined,
      visible: lens !== "exchanges",
      muted: lens === "carbon" && k !== "fossile" && k !== "bioenergies",
    };
  });

  const exporting = latest.netExchange < 0;
  const hub: LabelSpec = {
    id: "hub",
    position: anchor("hub"),
    color: palette.accent,
    icon: <HubIcon size={13} strokeWidth={2.2} />,
    title: lens === "exchanges" ? (exporting ? "Solde · export net" : "Solde · import net") : "Production totale",
    value: lens === "exchanges" ? fmtGW(Math.abs(latest.netExchange)) : fmtGW(mix.total),
    unit: "GW",
    visible: lens === "exchanges" || lens === "production",
  };

  const city: LabelSpec = {
    id: "city",
    position: anchor("city"),
    color: palette.accent,
    icon: <CityIcon size={13} strokeWidth={2.2} />,
    title: "Consommation",
    value: fmtGW(latest.consumption),
    unit: "GW",
    visible: lens === "overview",
  };

  const borders = COUNTRY_KEYS.map((c): LabelSpec => {
    const v = latest.exchanges[c];
    const out = v < 0;
    const Arrow = out ? ArrowUpRight : ArrowDownLeft;
    const pt = borderPoint(c);
    const power = fmtPowerParts(Math.abs(v));
    return {
      id: c,
      position: [pt[0], pt[1] + 1.55, pt[2]],
      color: out ? palette.export : palette.import,
      icon: <Arrow size={13} strokeWidth={2.4} />,
      title: `${COUNTRIES[c].label} · ${out ? "export" : "import"}`,
      value: power.value,
      unit: power.unit,
      visible: lens === "exchanges",
      border: true,
    };
  });

  return [...sources, city, hub, ...borders];
}

export type LabelNodes = RefObject<Map<string, HTMLDivElement>>;

/**
 * Dans le canvas : projette chaque ancre 3D à l'écran et déplace l'étiquette DOM
 * correspondante (une seule arborescence React, aucun re-rendu par image).
 * On évite <Html> de drei : une racine React par étiquette perd des mises à jour
 * avec React 19.3 (étiquettes absentes ou figées au survol).
 */
export function LabelProjector({ labels, nodes }: { labels: LabelSpec[]; nodes: LabelNodes }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const map = nodes.current;
    if (!map) return;
    for (const l of labels) {
      const el = map.get(l.id);
      if (!el) continue;
      v.set(l.position[0], l.position[1], l.position[2]).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  });

  return null;
}

/** Hors du canvas : les étiquettes en verre dépoli (cf. « Storage A » de Floware). */
export function LabelLayer({
  labels,
  nodes,
  focus,
  onFocus,
}: {
  labels: LabelSpec[];
  nodes: LabelNodes;
  focus: FocusKey | null;
  onFocus: (k: FocusKey | null) => void;
}) {
  return (
    <div className="label-layer" aria-hidden>
      {labels.map((l) => {
        const state =
          !l.visible && focus !== l.id ? "hidden" : focus === l.id ? "active" : focus || l.muted ? "dim" : "normal";
        return (
          <div
            key={l.id}
            className="label-anchor"
            ref={(el) => {
              if (el) nodes.current?.set(l.id, el);
              else nodes.current?.delete(l.id);
            }}
          >
            <div
              className={["tag3d", `is-${state}`, l.border && "is-border"].filter(Boolean).join(" ")}
              style={{ "--tag-color": l.color } as CSSProperties}
              onPointerEnter={() => onFocus(l.id)}
              onPointerLeave={() => onFocus(null)}
            >
              <div className="tag3d-card">
                <span className="tag3d-icon" style={l.iconInk ? { color: l.iconInk } : undefined}>
                  {l.icon}
                </span>
                <span className="tag3d-text">
                  <span className="tag3d-title">{l.title}</span>
                  <span className="tag3d-value">
                    {l.value} <small>{l.unit}</small>
                  </span>
                  {l.extra}
                </span>
              </div>
              <span className="tag3d-stem" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
