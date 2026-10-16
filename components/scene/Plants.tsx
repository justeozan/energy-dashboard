"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useMaterials } from "./materials";
import { Beam, Plume } from "./Primitives";
import type { V3 } from "./geo";

/** Hauteur du dessus des parcelles, relative à la dalle. */
export const PLOT_H = 0.16;

interface PlantProps {
  /** Facteur de charge approximatif (0 → 1). */
  level: number;
  reduced: boolean;
}

// ── Nucléaire ───────────────────────────────────────────────────────────────

function coolingTowerGeometry() {
  const h = 2.7;
  const r0 = 0.8;
  const rw = 0.5;
  const yw = 1.95;
  const c = yw / Math.sqrt((r0 / rw) ** 2 - 1);
  const r = (y: number) => rw * Math.sqrt(1 + ((y - yw) / c) ** 2);
  const pts: THREE.Vector2[] = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * h;
    pts.push(new THREE.Vector2(r(y), y));
  }
  for (let i = steps; i >= 0; i--) {
    const y = Math.max(0.25, (i / steps) * h);
    pts.push(new THREE.Vector2(r(y) - 0.055, y));
  }
  return new THREE.LatheGeometry(pts, 48);
}

export const NUCLEAR_TOWERS: V3[] = [
  [-1.15, PLOT_H, -0.72],
  [0.6, PLOT_H, -0.72],
];

export function NuclearPlant({ level, reduced }: PlantProps) {
  const m = useMaterials();
  const tower = useMemo(coolingTowerGeometry, []);
  return (
    <group>
      {NUCLEAR_TOWERS.map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={tower} material={m.clay} castShadow receiveShadow />
          <mesh position-y={2.7} rotation-x={Math.PI / 2} material={m.series.nucleaire}>
            <torusGeometry args={[0.528, 0.028, 8, 48]} />
          </mesh>
          <Plume position={[0, 2.75, 0]} intensity={level} material={m.steam} height={2.4} size={0.5} reduced={reduced} />
        </group>
      ))}
      {/* Bâtiment réacteur : cylindre + dôme, cerclé de l'accent violet */}
      <group position={[1.35, PLOT_H, 0.72]}>
        <mesh position-y={0.4} material={m.clay} castShadow receiveShadow>
          <cylinderGeometry args={[0.52, 0.52, 0.8, 40]} />
        </mesh>
        <mesh position-y={0.8} material={m.clay} castShadow>
          <sphereGeometry args={[0.52, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position-y={0.62} rotation-x={Math.PI / 2} material={m.series.nucleaire}>
          <torusGeometry args={[0.535, 0.03, 8, 48]} />
        </mesh>
      </group>
      {/* Salle des machines et annexes */}
      <RoundedBox args={[1.7, 0.62, 0.78]} radius={0.06} position={[-0.5, PLOT_H + 0.31, 0.78]} material={m.clay} castShadow receiveShadow />
      <mesh position={[-0.5, PLOT_H + 0.42, 1.18]} material={m.window}>
        <boxGeometry args={[1.4, 0.07, 0.02]} />
      </mesh>
      <RoundedBox args={[0.55, 0.36, 0.5]} radius={0.05} position={[1.6, PLOT_H + 0.18, -0.85]} material={m.clayAlt} castShadow receiveShadow />
      <RoundedBox args={[0.42, 0.22, 0.42]} radius={0.04} position={[0.55, PLOT_H + 0.11, 0.72]} material={m.clayAlt} castShadow receiveShadow />
    </group>
  );
}

// ── Hydraulique ─────────────────────────────────────────────────────────────

function damGeometry() {
  // Barrage-voûte : secteur d'anneau extrudé vers le haut.
  const R = 2.5;
  const t = 0.16;
  const a0 = -0.62;
  const a1 = 0.62;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R + t, a0, a1, false);
  shape.absarc(0, 0, R, a1, a0, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.82, bevelEnabled: false, curveSegments: 32 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function HydroDam({ level, reduced }: PlantProps) {
  const m = useMaterials();
  const dam = useMemo(damGeometry, []);
  const foam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!foam.current || reduced) return;
    const t = clock.elapsedTime;
    foam.current.children.forEach((c, i) => {
      const p = (t * (0.25 + level * 0.6) + i / foam.current!.children.length) % 1;
      c.position.z = 0.5 + p * 1.05;
      c.scale.setScalar(Math.sin(Math.PI * p) * 0.9 + 0.1);
    });
  });

  return (
    <group>
      {/* Retenue : roches + plan d'eau */}
      <RoundedBox args={[0.42, 0.78, 1.95]} radius={0.06} position={[-1.6, PLOT_H + 0.39, -0.55]} material={m.clay} castShadow receiveShadow />
      <RoundedBox args={[0.42, 0.78, 1.95]} radius={0.06} position={[1.6, PLOT_H + 0.39, -0.55]} material={m.clay} castShadow receiveShadow />
      <RoundedBox args={[3.62, 0.78, 0.5]} radius={0.06} position={[0, PLOT_H + 0.39, -1.38]} material={m.clay} castShadow receiveShadow />
      <mesh position={[0, PLOT_H + 0.33, -0.45]} material={m.water} receiveShadow>
        <boxGeometry args={[2.8, 0.66, 1.4]} />
      </mesh>
      {/* Barrage-voûte, convexe vers l'amont */}
      <mesh geometry={dam} material={m.clay} position={[0, PLOT_H, 2.78]} rotation-y={Math.PI / 2} castShadow receiveShadow />
      {/* Usine et rivière en aval */}
      <RoundedBox args={[0.8, 0.34, 0.42]} radius={0.05} position={[0.85, PLOT_H + 0.17, 0.95]} material={m.clay} castShadow receiveShadow />
      <mesh position={[0.85, PLOT_H + 0.24, 1.17]} material={m.series.hydraulique}>
        <boxGeometry args={[0.6, 0.06, 0.02]} />
      </mesh>
      <mesh position={[-0.35, PLOT_H + 0.01, 1.05]} material={m.water} receiveShadow>
        <boxGeometry args={[0.4, 0.03, 1.15]} />
      </mesh>
      <group ref={foam} position={[-0.35, PLOT_H + 0.035, 0]}>
        {Array.from({ length: 4 }, (_, i) => (
          <mesh key={i} position-z={0.5 + i * 0.25} material={m.clay}>
            <boxGeometry args={[0.26, 0.02, 0.07]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── Éolien ──────────────────────────────────────────────────────────────────

function bladeGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.03, 0.06);
  s.quadraticCurveTo(0.09, 0.14, 0.06, 0.32);
  s.lineTo(0.02, 1.05);
  s.quadraticCurveTo(0, 1.1, -0.015, 1.05);
  s.lineTo(-0.035, 0.2);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -0.009);
  return geo;
}

function Turbine({
  position,
  speed,
  phase,
  reduced,
  blade,
}: {
  position: V3;
  speed: number;
  phase: number;
  reduced: boolean;
  blade: THREE.BufferGeometry;
}) {
  const m = useMaterials();
  const rotor = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (rotor.current && !reduced) rotor.current.rotation.z -= speed * Math.min(dt, 0.05);
  });
  return (
    <group position={position} rotation-y={Math.PI / 4}>
      <mesh position-y={1.4} material={m.clay} castShadow>
        <cylinderGeometry args={[0.04, 0.085, 2.8, 14]} />
      </mesh>
      <mesh position-y={0.03} material={m.series.eolien}>
        <cylinderGeometry args={[0.13, 0.13, 0.06, 20]} />
      </mesh>
      <RoundedBox args={[0.15, 0.15, 0.4]} radius={0.05} position={[0, 2.84, -0.06]} material={m.clay} castShadow />
      <group ref={rotor} position={[0, 2.84, 0.17]} rotation-z={phase}>
        <mesh rotation-x={Math.PI / 2} position-z={0.04} material={m.series.eolien}>
          <coneGeometry args={[0.065, 0.16, 16]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={blade} material={m.clay} rotation-z={(i * Math.PI * 2) / 3} castShadow />
        ))}
      </group>
    </group>
  );
}

export const WIND_TURBINES: V3[] = [
  [-1.05, PLOT_H, -1.0],
  [0.45, PLOT_H, -1.15],
  [1.2, PLOT_H, 0.05],
  [-0.55, PLOT_H, 0.35],
  [0.55, PLOT_H, 1.2],
  [-1.25, PLOT_H, 1.25],
];

export function WindFarm({ level, reduced, extra = [] }: PlantProps & { extra?: V3[] }) {
  const blade = useMemo(bladeGeometry, []);
  const speed = 0.5 + level * 5;
  return (
    <group>
      {[...WIND_TURBINES, ...extra].map((p, i) => (
        <Turbine key={i} position={p} speed={speed * (0.9 + (i % 3) * 0.07)} phase={i * 1.7} reduced={reduced} blade={blade} />
      ))}
    </group>
  );
}

// ── Solaire ─────────────────────────────────────────────────────────────────

const SOUTH_YAW = Math.PI / 4;
const TILT = (24 * Math.PI) / 180;

export function SolarFarm({ level }: { level: number }) {
  const m = useMaterials();
  // Rangées est-ouest, panneaux orientés plein sud (vers la caméra).
  const tables = useMemo(() => {
    const out: V3[] = [];
    const E = [Math.SQRT1_2, -Math.SQRT1_2];
    const S = [Math.SQRT1_2, Math.SQRT1_2];
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        const e = col * 0.8;
        const s = row * 0.5;
        const x = e * E[0] + s * S[0];
        const z = e * E[1] + s * S[1];
        // Coin avant droit laissé libre pour l'onduleur.
        if (x > 0.8 && z > 0.55) continue;
        if (Math.abs(x) < 1.5 && Math.abs(z) < 1.25) out.push([x, PLOT_H, z]);
      }
    }
    return out;
  }, []);

  return (
    <group>
      {tables.map((p, i) => (
        <group key={i} position={p} rotation-y={SOUTH_YAW}>
          <mesh position={[-0.24, 0.11, 0]} material={m.clayAlt}>
            <boxGeometry args={[0.035, 0.22, 0.035]} />
          </mesh>
          <mesh position={[0.24, 0.11, 0]} material={m.clayAlt}>
            <boxGeometry args={[0.035, 0.22, 0.035]} />
          </mesh>
          <group position-y={0.25} rotation-x={TILT}>
            <mesh material={m.clay} castShadow receiveShadow>
              <boxGeometry args={[0.74, 0.022, 0.38]} />
            </mesh>
            <mesh position-y={0.014} material={m.panel} receiveShadow>
              <boxGeometry args={[0.7, 0.01, 0.34]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* Onduleur, liseré jaune ; s'allume avec la production */}
      <group position={[1.25, PLOT_H, 1.05]} rotation-y={SOUTH_YAW}>
        <RoundedBox args={[0.5, 0.34, 0.3]} radius={0.04} position-y={0.17} material={m.clay} castShadow receiveShadow />
        <mesh position={[0, 0.25, 0.155]} material={m.series.solaire} scale={[1, 0.4 + level * 0.6, 1]}>
          <boxGeometry args={[0.36, 0.06, 0.01]} />
        </mesh>
      </group>
    </group>
  );
}

// ── Thermique fossile ───────────────────────────────────────────────────────

export const FOSSIL_STACKS: V3[] = [
  [-0.6, PLOT_H, -0.78],
  [0.32, PLOT_H, -0.92],
];

export function FossilPlant({ level, reduced }: PlantProps) {
  const m = useMaterials();
  return (
    <group>
      {FOSSIL_STACKS.map((p, i) => (
        <group key={i} position={p}>
          <mesh position-y={1.2} material={m.clay} castShadow receiveShadow>
            <cylinderGeometry args={[0.11, 0.16, 2.4, 20]} />
          </mesh>
          <mesh position-y={1.95} material={m.series.fossile}>
            <cylinderGeometry args={[0.13, 0.135, 0.09, 20]} />
          </mesh>
          <mesh position-y={2.15} material={m.series.fossile}>
            <cylinderGeometry args={[0.122, 0.126, 0.09, 20]} />
          </mesh>
          <Plume position={[0, 2.45, 0]} intensity={level} material={m.smoke} height={2} size={0.32} count={8} speed={0.14} reduced={reduced} />
        </group>
      ))}
      <RoundedBox args={[1.55, 0.78, 0.9]} radius={0.06} position={[0.15, PLOT_H + 0.39, 0.38]} material={m.clay} castShadow receiveShadow />
      <mesh position={[0.15, PLOT_H + 0.52, 0.84]} material={m.window}>
        <boxGeometry args={[1.25, 0.07, 0.02]} />
      </mesh>
      <RoundedBox args={[0.62, 0.5, 0.66]} radius={0.05} position={[-0.95, PLOT_H + 0.25, 0.5]} material={m.clayAlt} castShadow receiveShadow />
      {/* Réservoirs de gaz */}
      {[
        [1.1, -0.35],
        [1.1, 0.55],
      ].map(([x, z], i) => (
        <group key={i} position={[x, PLOT_H, z]}>
          <mesh position-y={0.42} material={m.clay} castShadow receiveShadow>
            <sphereGeometry args={[0.3, 28, 18]} />
          </mesh>
          <mesh position-y={0.1} material={m.clayAlt}>
            <cylinderGeometry args={[0.16, 0.2, 0.2, 16]} />
          </mesh>
        </group>
      ))}
      <Beam from={[0.8, PLOT_H + 0.3, -0.35]} to={[0.6, PLOT_H + 0.3, 0.1]} size={0.05} material={m.clayAlt} />
    </group>
  );
}

// ── Bioénergies ─────────────────────────────────────────────────────────────

export function BioPlant({ level, reduced }: PlantProps) {
  const m = useMaterials();
  const digesters: V3[] = [
    [-0.5, PLOT_H, -0.45],
    [0.48, PLOT_H, -0.62],
  ];
  return (
    <group>
      {digesters.map((p, i) => (
        <group key={i} position={p}>
          <mesh position-y={0.24} material={m.clay} castShadow receiveShadow>
            <cylinderGeometry args={[0.4, 0.4, 0.48, 36]} />
          </mesh>
          <mesh position-y={0.48} scale={[1, 0.55, 1]} material={m.clay} castShadow>
            <sphereGeometry args={[0.4, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position-y={0.4} rotation-x={Math.PI / 2} material={m.series.bioenergies}>
            <torusGeometry args={[0.405, 0.022, 8, 40]} />
          </mesh>
        </group>
      ))}
      <RoundedBox args={[0.75, 0.42, 0.55]} radius={0.05} position={[0.5, PLOT_H + 0.21, 0.55]} material={m.clay} castShadow receiveShadow />
      <mesh position={[-0.55, PLOT_H + 0.5, 0.45]} material={m.clay} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 1, 14]} />
      </mesh>
      <Plume position={[-0.55, PLOT_H + 1.02, 0.45]} intensity={level * 0.6} material={m.smoke} height={1.2} size={0.18} count={6} reduced={reduced} />
      {/* Tas de bois */}
      {[
        [-0.12, 0.07, 0.95],
        [0.02, 0.07, 0.95],
        [0.16, 0.07, 0.95],
        [-0.05, 0.19, 0.95],
        [0.09, 0.19, 0.95],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x - 0.3, PLOT_H + y, z]} rotation-z={Math.PI / 2} material={m.clayAlt} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.5, 12]} />
        </mesh>
      ))}
    </group>
  );
}
