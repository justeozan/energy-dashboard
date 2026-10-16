"use client";

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { mixSummary } from "@/lib/sources";
import { COUNTRY_KEYS, GROUP_KEYS, type CountryKey, type GroupKey, type Snapshot } from "@/lib/types";
import type { FocusKey } from "../types";
import {
  BORDER_BEARINGS,
  SLAB_TOP,
  ZONES,
  borderLine,
  borderPoint,
  zoneCenter,
  zoneLine,
  type ZoneKey,
} from "./geo";
import { City, Ground, Hub, Mountains, Pylon, Trees } from "./Landscape";
import { useMaterials } from "./materials";
import type { ScenePalette } from "./palette";
import { BioPlant, FossilPlant, HydroDam, NuclearPlant, SolarFarm, WindFarm } from "./Plants";
import { FlowLine, Plot } from "./Primitives";

/** Calque réservé aux volumes de survol (seuls objets testés par le raycaster). */
export const HIT_LAYER = 1;

/** Puissance installée approximative, pour doser les animations (facteur de charge). */
const CAPACITY: Record<GroupKey, number> = {
  nucleaire: 61000,
  hydraulique: 20000,
  eolien: 22000,
  solaire: 22000,
  bioenergies: 2200,
  fossile: 12000,
};

const pulses = (mw: number, per: number, max: number) =>
  mw < 20 ? 0 : Math.min(max, Math.round(mw / per) + 1);

function HitBox({ zone, onFocus }: { zone: ZoneKey; onFocus: (k: FocusKey | null) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const gl = useThree((s) => s.gl);
  const [x, , z] = zoneCenter(zone);
  const [hx, hz] = ZONES[zone].half;
  useLayoutEffect(() => ref.current?.layers.set(HIT_LAYER), []);
  return (
    <mesh
      ref={ref}
      position={[x, SLAB_TOP + 1.6, z]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        gl.domElement.style.cursor = "pointer";
        onFocus(zone);
      }}
      onPointerOut={() => {
        gl.domElement.style.cursor = "";
        onFocus(null);
      }}
    >
      <boxGeometry args={[hx * 2 + 0.2, 3.2, hz * 2 + 0.2]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

function BorderHit({ country, onFocus }: { country: CountryKey; onFocus: (k: FocusKey | null) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const gl = useThree((s) => s.gl);
  const p = borderPoint(country);
  useLayoutEffect(() => ref.current?.layers.set(HIT_LAYER), []);
  return (
    <mesh
      ref={ref}
      position={[p[0], p[1] + 0.8, p[2]]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        gl.domElement.style.cursor = "pointer";
        onFocus(country);
      }}
      onPointerOut={() => {
        gl.domElement.style.cursor = "";
        onFocus(null);
      }}
    >
      <boxGeometry args={[1, 1.8, 1]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

interface Props {
  latest: Snapshot;
  palette: ScenePalette;
  focus: FocusKey | null;
  onFocus: (k: FocusKey | null) => void;
  reduced: boolean;
}

export default function Diorama({ latest, palette, focus, onFocus, reduced }: Props) {
  const m = useMaterials();
  const mix = mixSummary(latest);
  const level = (k: GroupKey) => Math.min(1, mix.groups[k] / CAPACITY[k]);

  const zone = (k: ZoneKey, children: React.ReactNode) => (
    <group position={zoneCenter(k)}>{children}</group>
  );

  return (
    <group>
      <Ground />
      <Mountains />
      <Trees />

      {(Object.keys(ZONES) as ZoneKey[]).map((k) => (
        <Plot
          key={k}
          zone={k}
          active={focus === k}
          color={k === "city" || k === "hub" ? palette.accent : palette.series[k as GroupKey]}
        />
      ))}

      {zone("nucleaire", <NuclearPlant level={level("nucleaire")} reduced={reduced} />)}
      {zone("hydraulique", <HydroDam level={level("hydraulique")} reduced={reduced} />)}
      {zone("eolien", <WindFarm level={level("eolien")} reduced={reduced} />)}
      {zone("solaire", <SolarFarm level={level("solaire")} />)}
      {zone("bioenergies", <BioPlant level={level("bioenergies")} reduced={reduced} />)}
      {zone("fossile", <FossilPlant level={level("fossile")} reduced={reduced} />)}
      {zone("city", <City />)}
      {zone("hub", <Hub />)}

      {/* Production → poste central */}
      {GROUP_KEYS.map((k) => {
        const [hubEnd, zoneEnd] = zoneLine(k);
        return (
          <FlowLine
            key={k}
            from={zoneEnd}
            to={hubEnd}
            material={m.series[k]}
            pulseMaterial={m.series[k]}
            count={pulses(mix.groups[k], 2400, 14)}
            width={0.07}
            reduced={reduced}
          />
        );
      })}
      {/* Poste central → consommation */}
      {(() => {
        const [hubEnd, cityEnd] = zoneLine("city");
        return (
          <FlowLine
            from={hubEnd}
            to={cityEnd}
            material={m.accent}
            pulseMaterial={m.accent}
            count={pulses(latest.consumption, 3600, 14)}
            width={0.07}
            reduced={reduced}
          />
        );
      })()}
      {/* Interconnexions */}
      {COUNTRY_KEYS.map((c) => {
        const [a, b] = borderLine(c);
        const v = latest.exchanges[c];
        const yaw = ((BORDER_BEARINGS[c] - 45) * Math.PI) / 180;
        return (
          <group key={c}>
            <FlowLine
              from={a}
              to={b}
              material={m.line}
              pulseMaterial={v < 0 ? m.export : m.import}
              count={pulses(Math.abs(v), 700, 9)}
              reverse={v > 0}
              width={0.07}
              reduced={reduced}
            />
            <Pylon position={borderPoint(c)} yaw={-yaw} lamp={v < 0 ? m.export : m.import} />
            <BorderHit country={c} onFocus={onFocus} />
          </group>
        );
      })}

      {(Object.keys(ZONES) as ZoneKey[]).map((k) => (
        <HitBox key={k} zone={k} onFocus={onFocus} />
      ))}

    </group>
  );
}
