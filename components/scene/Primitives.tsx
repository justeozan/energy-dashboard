"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useMaterials } from "./materials";
import { SLAB_TOP, ZONES, zoneCenter, type V3, type ZoneKey } from "./geo";

const damp = THREE.MathUtils.damp;

/** Contour arrondi (anneau plat) pour la mise en évidence d'une parcelle. */
function roundedRectRing(w: number, h: number, r: number, thickness: number) {
  const rect = (path: THREE.Path, hw: number, hh: number, rr: number) => {
    path.moveTo(-hw + rr, -hh);
    path.lineTo(hw - rr, -hh);
    path.quadraticCurveTo(hw, -hh, hw, -hh + rr);
    path.lineTo(hw, hh - rr);
    path.quadraticCurveTo(hw, hh, hw - rr, hh);
    path.lineTo(-hw + rr, hh);
    path.quadraticCurveTo(-hw, hh, -hw, hh - rr);
    path.lineTo(-hw, -hh + rr);
    path.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
  };
  const shape = new THREE.Shape();
  rect(shape, w / 2, h / 2, r);
  const hole = new THREE.Path();
  rect(hole, w / 2 - thickness, h / 2 - thickness, Math.max(0.01, r - thickness));
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape, 6);
}

/** Parcelle surélevée (« îlot » des maquettes isométriques) + halo de sélection. */
export function Plot({ zone, active, color }: { zone: ZoneKey; active: boolean; color: string }) {
  const m = useMaterials();
  const [x, , z] = zoneCenter(zone);
  const [hx, hz] = ZONES[zone].half;
  const ring = useMemo(() => roundedRectRing(hx * 2 + 0.34, hz * 2 + 0.34, 0.36, 0.07), [hx, hz]);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    [color],
  );
  useEffect(() => () => ring.dispose(), [ring]);
  useEffect(() => () => ringMat.dispose(), [ringMat]);

  useFrame((_, dt) => {
    ringMat.opacity = damp(ringMat.opacity, active ? 0.95 : 0, 10, dt);
    if (ringRef.current) ringRef.current.visible = ringMat.opacity > 0.01;
  });

  return (
    <group position={[x, SLAB_TOP, z]}>
      <RoundedBox
        args={[hx * 2, 0.16, hz * 2]}
        radius={0.07}
        smoothness={3}
        position={[0, 0.08, 0]}
        material={m.plot}
        receiveShadow
        castShadow
      />
      <mesh ref={ringRef} geometry={ring} material={ringMat} rotation-x={-Math.PI / 2} position-y={0.012} />
    </group>
  );
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Poutre entre deux points (pylônes, jambes de la tour Eiffel…), en coordonnées locales. */
export function Beam({
  from,
  to,
  size = 0.06,
  material,
  castShadow = true,
}: {
  from: V3;
  to: V3;
  size?: number;
  material: THREE.Material;
  castShadow?: boolean;
}) {
  const a = new THREE.Vector3(...from);
  const dir = new THREE.Vector3(...to).sub(a);
  const len = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, dir.clone().normalize());
  const mid = a.addScaledVector(dir, 0.5);
  return (
    <mesh position={mid} quaternion={quat} material={material} castShadow={castShadow}>
      <boxGeometry args={[size, size, len]} />
    </mesh>
  );
}

const puffGeometry = new THREE.IcosahedronGeometry(1, 2);

/** Panache (vapeur des tours, fumée des cheminées) dont la densité suit la production. */
export function Plume({
  position,
  intensity,
  material,
  height = 2.2,
  size = 0.42,
  count = 9,
  speed = 0.11,
  reduced,
}: {
  position: V3;
  intensity: number;
  material: THREE.MeshStandardMaterial;
  height?: number;
  size?: number;
  count?: number;
  speed?: number;
  reduced: boolean;
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(() => Array.from({ length: count }, () => material.clone()), [count, material]);
  useEffect(() => () => mats.forEach((mm) => mm.dispose()), [mats]);
  const k = THREE.MathUtils.clamp(intensity, 0, 1);

  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const p = (t * speed + i / count) % 1;
      const s = size * (0.35 + p * 1.3) * (0.55 + 0.45 * k);
      mesh.position.set(p * p * 0.9, p * height, -p * p * 0.35);
      mesh.scale.setScalar(s);
      mats[i].opacity = k < 0.02 ? 0 : Math.sin(Math.PI * Math.min(1, p * 1.1)) * (0.25 + 0.6 * k);
      mesh.visible = mats[i].opacity > 0.01;
    }
  });

  return (
    <group position={position}>
      {mats.map((mat, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          geometry={puffGeometry}
          material={mat}
        />
      ))}
    </group>
  );
}

const pulseGeometry = new THREE.BoxGeometry(0.12, 0.07, 0.42);
const MAX_PULSES = 16;

/**
 * Ligne au sol (ruban) parcourue d'impulsions lumineuses : leur nombre suit la
 * puissance transportée, leur sens le sens du flux (production → réseau,
 * export → frontière).
 */
export function FlowLine({
  from,
  to,
  material,
  pulseMaterial,
  count,
  reverse = false,
  width = 0.1,
  speed = 1.4,
  reduced,
}: {
  from: V3;
  to: V3;
  material: THREE.Material;
  pulseMaterial: THREE.Material;
  count: number;
  reverse?: boolean;
  width?: number;
  speed?: number;
  reduced: boolean;
}) {
  const inst = useRef<THREE.InstancedMesh>(null);
  const a = useMemo(() => new THREE.Vector3(...from), [from]);
  const b = useMemo(() => new THREE.Vector3(...to), [to]);
  const len = a.distanceTo(b);
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const n = Math.max(0, Math.min(MAX_PULSES, Math.round(count)));

  useFrame(({ clock }) => {
    const mesh = inst.current;
    if (!mesh) return;
    mesh.count = n;
    const t = reduced ? 0 : clock.elapsedTime;
    for (let i = 0; i < n; i++) {
      let s = ((t * speed) / len + i / n) % 1;
      if (reverse) s = 1 - s;
      dummy.position.lerpVectors(a, b, s);
      dummy.position.y += 0.05;
      dummy.rotation.set(0, yaw, 0);
      const fade = Math.min(1, Math.sin(Math.PI * s) * 3);
      dummy.scale.set(fade, fade, fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh position={[mid.x, mid.y + 0.012, mid.z]} rotation-y={yaw} material={material} receiveShadow>
        <boxGeometry args={[width, 0.024, len]} />
      </mesh>
      <instancedMesh ref={inst} args={[pulseGeometry, pulseMaterial, MAX_PULSES]} frustumCulled={false} />
    </group>
  );
}
