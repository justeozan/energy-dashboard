"use client";

import { Instance, Instances, RoundedBox } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COUNTRY_KEYS } from "@/lib/types";
import {
  HEX_R,
  SLAB_TOP,
  ZONES,
  borderLine,
  distToSegment,
  hexEdgeDistance,
  polar,
  seeded,
  zoneCenter,
  zoneLine,
  type V3,
  type ZoneKey,
} from "./geo";
import { useMaterials } from "./materials";
import { PLOT_H } from "./Plants";
import { Beam } from "./Primitives";

// ── Sol et dalle hexagonale ─────────────────────────────────────────────────

function hexSlabGeometry() {
  const corner = 0.9;
  const verts = [0, 60, 120, 180, 240, 300].map((b) => {
    const [x, , z] = polar(b, HEX_R, 0);
    return new THREE.Vector2(x, -z);
  });
  const shape = new THREE.Shape();
  verts.forEach((v, i) => {
    const prev = verts[(i + verts.length - 1) % verts.length];
    const next = verts[(i + 1) % verts.length];
    const p1 = v.clone().add(prev.clone().sub(v).setLength(corner));
    const p2 = v.clone().add(next.clone().sub(v).setLength(corner));
    if (i === 0) shape.moveTo(p1.x, p1.y);
    else shape.lineTo(p1.x, p1.y);
    shape.quadraticCurveTo(v.x, v.y, p2.x, p2.y);
  });
  shape.closePath();
  const bevel = 0.09;
  const depth = SLAB_TOP - bevel * 2;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return geo;
}

export function Ground() {
  const m = useMaterials();
  const slab = useMemo(hexSlabGeometry, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={m.ground} receiveShadow>
        <planeGeometry args={[400, 400]} />
      </mesh>
      <mesh geometry={slab} material={m.slab} castShadow receiveShadow />
    </group>
  );
}

// ── Obstacles partagés (montagnes, arbres) ──────────────────────────────────

const ZONE_KEYS = Object.keys(ZONES) as ZoneKey[];
const LINES: [V3, V3][] = [
  ...ZONE_KEYS.filter((k) => k !== "hub").map(zoneLine),
  ...COUNTRY_KEYS.map(borderLine),
];

function inZone(x: number, z: number, margin: number) {
  return ZONE_KEYS.some((k) => {
    const [cx, , cz] = zoneCenter(k);
    const [hx, hz] = ZONES[k].half;
    return Math.abs(x - cx) < hx + margin && Math.abs(z - cz) < hz + margin;
  });
}

function nearLine(x: number, z: number, margin: number) {
  return LINES.some(([a, b]) => distToSegment([x, z], a, b) < margin);
}

interface Peak {
  pos: V3;
  radius: number;
  height: number;
  rot: number;
  sides: number;
}

function makeMountains(): Peak[] {
  const rand = seeded(7);
  const ranges = [
    { from: 90, to: 134, r0: 7.9, r1: 9.4, h0: 1.3, h1: 2.4, n: 16 }, // Alpes
    { from: 196, to: 226, r0: 8.4, r1: 9.4, h0: 0.9, h1: 1.6, n: 10 }, // Pyrénées
    { from: 62, to: 78, r0: 8.9, r1: 9.4, h0: 0.6, h1: 1, n: 4 }, // Vosges / Jura
    { from: 168, to: 214, r0: 2.6, r1: 4, h0: 0.45, h1: 0.8, n: 5 }, // Massif central
  ];
  const peaks: Peak[] = [];
  for (const g of ranges) {
    let tries = 0;
    let made = 0;
    while (made < g.n && tries < 300) {
      tries++;
      const bearing = g.from + rand() * (g.to - g.from);
      const r = Math.min(g.r0 + rand() * (g.r1 - g.r0), hexEdgeDistance(bearing) - 0.7);
      const [x, , z] = polar(bearing, r);
      const radius = 0.55 + rand() * 0.55;
      if (inZone(x, z, radius * 0.6) || nearLine(x, z, radius * 0.9)) continue;
      if (peaks.some((p) => Math.hypot(p.pos[0] - x, p.pos[2] - z) < (p.radius + radius) * 0.62)) continue;
      peaks.push({
        pos: [x, SLAB_TOP, z],
        radius,
        height: g.h0 + rand() * (g.h1 - g.h0),
        rot: rand() * Math.PI,
        sides: 5 + Math.floor(rand() * 3),
      });
      made++;
    }
  }
  return peaks;
}

const MOUNTAINS = makeMountains();

export function Mountains() {
  const m = useMaterials();
  return (
    <group>
      {MOUNTAINS.map((p, i) => (
        <mesh
          key={i}
          position={[p.pos[0], p.pos[1] + p.height / 2, p.pos[2]]}
          rotation-y={p.rot}
          material={m.mountain}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[p.radius, p.height, p.sides, 1]} />
        </mesh>
      ))}
    </group>
  );
}

interface Tree {
  pos: V3;
  scale: number;
  kind: "cone" | "bush";
}

function makeTrees(): Tree[] {
  const rand = seeded(42);
  const trees: Tree[] = [];
  let tries = 0;
  while (trees.length < 150 && tries < 5000) {
    tries++;
    const bearing = rand() * 360;
    const r = Math.sqrt(rand()) * HEX_R;
    if (r > hexEdgeDistance(bearing) - 0.55) continue;
    const [x, , z] = polar(bearing, r);
    if (inZone(x, z, 0.32) || nearLine(x, z, 0.38)) continue;
    if (MOUNTAINS.some((p) => Math.hypot(p.pos[0] - x, p.pos[2] - z) < p.radius + 0.1)) continue;
    if (trees.some((t) => Math.hypot(t.pos[0] - x, t.pos[2] - z) < 0.36)) continue;
    // Forêt des Landes plus dense au sud-ouest.
    const landes = Math.abs(bearing - 225) < 25 && r > 4;
    if (!landes && rand() < 0.35) continue;
    trees.push({ pos: [x, SLAB_TOP, z], scale: 0.75 + rand() * 0.6, kind: rand() < 0.7 ? "cone" : "bush" });
  }
  return trees;
}

const TREES = makeTrees();
const coneGeometry = new THREE.ConeGeometry(0.17, 0.62, 14).translate(0, 0.31, 0);
const bushGeometry = new THREE.IcosahedronGeometry(0.16, 2).translate(0, 0.15, 0);

export function Trees() {
  const m = useMaterials();
  return (
    <group>
      <Instances limit={TREES.length} geometry={coneGeometry} material={m.clay} castShadow receiveShadow>
        {TREES.filter((t) => t.kind === "cone").map((t, i) => (
          <Instance key={i} position={t.pos} scale={t.scale} />
        ))}
      </Instances>
      <Instances limit={TREES.length} geometry={bushGeometry} material={m.clay} castShadow receiveShadow>
        {TREES.filter((t) => t.kind === "bush").map((t, i) => (
          <Instance key={i} position={t.pos} scale={t.scale} />
        ))}
      </Instances>
    </group>
  );
}

// ── Paris ───────────────────────────────────────────────────────────────────

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

const CELL = 1.08;

function makeCity(): Building[] {
  const rand = seeded(1789);
  const out: Building[] = [];
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      const cx = gx * CELL;
      const cz = gz * CELL;
      if (gx === 1 && gz === 1) continue; // tour Eiffel
      if (gx === -1 && gz === 1) {
        // La Défense, à l'ouest
        out.push({ x: cx - 0.2, z: cz - 0.18, w: 0.36, d: 0.36, h: 2.1 });
        out.push({ x: cx + 0.22, z: cz - 0.2, w: 0.3, d: 0.4, h: 1.55 });
        out.push({ x: cx - 0.05, z: cz + 0.25, w: 0.42, d: 0.3, h: 1.2 });
        continue;
      }
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        if (rand() < 0.12) continue;
        out.push({
          x: cx + sx * 0.23,
          z: cz + sz * 0.23,
          w: 0.36 + rand() * 0.06,
          d: 0.36 + rand() * 0.06,
          h: 0.32 + rand() * (gx === 0 && gz === 0 ? 0.35 : 0.65),
        });
      }
    }
  }
  return out;
}

const CITY = makeCity();
const unitBox = new THREE.BoxGeometry(1, 1, 1);

function WindowStrips({ buildings }: { buildings: Building[] }) {
  const m = useMaterials();
  const ref = useRef<THREE.InstancedMesh>(null);
  const strips = useMemo(() => {
    const out: { p: V3; s: V3 }[] = [];
    for (const b of buildings) {
      if (b.h < 0.42) continue;
      for (let y = 0.2; y < b.h - 0.1; y += 0.17) {
        out.push({ p: [b.x + b.w / 2 + 0.004, PLOT_H + y, b.z], s: [0.012, 0.045, b.d * 0.72] });
        out.push({ p: [b.x, PLOT_H + y, b.z + b.d / 2 + 0.004], s: [b.w * 0.72, 0.045, 0.012] });
      }
    }
    return out;
  }, [buildings]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    strips.forEach((st, i) => {
      o.position.set(...st.p);
      o.scale.set(...st.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [strips]);

  return <instancedMesh ref={ref} args={[unitBox, m.window, strips.length]} />;
}

function EiffelTower({ position }: { position: V3 }) {
  const m = useMaterials();
  const legs: [V3, V3][] = [];
  const mids: [V3, V3][] = [];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    legs.push([
      [sx * 0.34, 0, sz * 0.34],
      [sx * 0.15, 0.62, sz * 0.15],
    ]);
    mids.push([
      [sx * 0.15, 0.62, sz * 0.15],
      [sx * 0.06, 1.3, sz * 0.06],
    ]);
  }
  return (
    <group position={position}>
      {legs.map(([a, b], i) => (
        <Beam key={`l${i}`} from={a} to={b} size={0.075} material={m.clay} />
      ))}
      <mesh position-y={0.34} material={m.clay} castShadow>
        <boxGeometry args={[0.56, 0.045, 0.56]} />
      </mesh>
      {mids.map(([a, b], i) => (
        <Beam key={`m${i}`} from={a} to={b} size={0.05} material={m.clay} />
      ))}
      <mesh position-y={0.62} material={m.clay} castShadow>
        <boxGeometry args={[0.38, 0.035, 0.38]} />
      </mesh>
      <mesh position-y={1.3} material={m.clay} castShadow>
        <boxGeometry args={[0.16, 0.03, 0.16]} />
      </mesh>
      <mesh position-y={1.66} rotation-y={Math.PI / 4} material={m.clay} castShadow>
        <cylinderGeometry args={[0.012, 0.085, 0.72, 4]} />
      </mesh>
      <mesh position-y={2.1} material={m.clay}>
        <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
      </mesh>
    </group>
  );
}

export function City() {
  const m = useMaterials();
  return (
    <group>
      {CITY.map((b, i) => (
        <RoundedBox
          key={i}
          args={[b.w, b.h, b.d]}
          radius={0.035}
          smoothness={2}
          position={[b.x, PLOT_H + b.h / 2, b.z]}
          material={i % 5 === 0 ? m.clayAlt : m.clay}
          castShadow
          receiveShadow
        />
      ))}
      <WindowStrips buildings={CITY} />
      <EiffelTower position={[CELL, PLOT_H, CELL]} />
    </group>
  );
}

// ── Poste central RTE ───────────────────────────────────────────────────────

export function Hub() {
  const m = useMaterials();
  return (
    <group>
      {[-0.55, 0, 0.55].map((x) => (
        <group key={x} position={[x, PLOT_H, -0.62]}>
          <RoundedBox args={[0.36, 0.34, 0.3]} radius={0.03} position-y={0.17} material={m.clay} castShadow receiveShadow />
          <mesh position={[0, 0.42, 0]} material={m.clayAlt}>
            <cylinderGeometry args={[0.03, 0.03, 0.16, 8]} />
          </mesh>
        </group>
      ))}
      {[-0.85, 0.85].map((x) => (
        <group key={x}>
          <Beam from={[x, PLOT_H, -0.15]} to={[x, PLOT_H + 0.95, -0.15]} size={0.05} material={m.clayAlt} />
          <Beam from={[x, PLOT_H, 0.25]} to={[x, PLOT_H + 0.95, 0.25]} size={0.05} material={m.clayAlt} />
          <Beam from={[x, PLOT_H + 0.95, -0.22]} to={[x, PLOT_H + 0.95, 0.32]} size={0.05} material={m.clayAlt} />
        </group>
      ))}
      <Beam from={[-0.85, PLOT_H + 0.8, 0.05]} to={[0.85, PLOT_H + 0.8, 0.05]} size={0.035} material={m.clayAlt} />
      <RoundedBox args={[0.95, 0.4, 0.45]} radius={0.04} position={[0.1, PLOT_H + 0.2, 0.72]} material={m.clay} castShadow receiveShadow />
      <mesh position={[0.1, PLOT_H + 0.26, 0.95]} material={m.window}>
        <boxGeometry args={[0.7, 0.06, 0.02]} />
      </mesh>
      {/* Cœur du réseau : anneau lumineux */}
      <group position={[0, PLOT_H, 0.05]}>
        <mesh position-y={0.11} material={m.clay} castShadow>
          <cylinderGeometry args={[0.24, 0.26, 0.22, 32]} />
        </mesh>
        <mesh position-y={0.23} rotation-x={Math.PI / 2} material={m.accent}>
          <torusGeometry args={[0.2, 0.025, 8, 40]} />
        </mesh>
      </group>
    </group>
  );
}

// ── Interconnexions ─────────────────────────────────────────────────────────

export function Pylon({ position, yaw, lamp }: { position: V3; yaw: number; lamp: THREE.Material }) {
  const m = useMaterials();
  const legs: [V3, V3][] = [
    [
      [-0.16, 0, -0.16],
      [-0.04, 1.25, -0.04],
    ],
    [
      [0.16, 0, -0.16],
      [0.04, 1.25, -0.04],
    ],
    [
      [-0.16, 0, 0.16],
      [-0.04, 1.25, 0.04],
    ],
    [
      [0.16, 0, 0.16],
      [0.04, 1.25, 0.04],
    ],
  ];
  return (
    <group position={position} rotation-y={yaw}>
      {legs.map(([a, b], i) => (
        <Beam key={i} from={a} to={b} size={0.04} material={m.clay} />
      ))}
      <mesh position-y={1.02} material={m.clay} castShadow>
        <boxGeometry args={[0.78, 0.045, 0.06]} />
      </mesh>
      <mesh position-y={0.74} material={m.clay} castShadow>
        <boxGeometry args={[0.56, 0.04, 0.05]} />
      </mesh>
      <mesh position-y={1.34} material={lamp}>
        <sphereGeometry args={[0.075, 16, 12]} />
      </mesh>
    </group>
  );
}

