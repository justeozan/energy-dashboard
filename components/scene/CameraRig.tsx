"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import type { Lens } from "../types";
import { SLAB_TOP, polar, type V3 } from "./geo";

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Orbit {
  az: number;
  el: number;
}

const DEG = Math.PI / 180;
const BASE_AZ = 45;
const BASE_EL = 33;
const DIST = 60;

/** Emprise écran de la maquette (unités monde) : sert à cadrer l'Hexagone dans la zone libre. */
const SPAN_W = 19;
const SPAN_H = 13.8;
/** Le contenu dépasse davantage vers le haut (tours, éoliennes) : on abaisse légèrement le centre. */
const LIFT = 1;

const LENS_VIEW: Record<Lens, { zoom: number; target: V3 }> = {
  overview: { zoom: 1, target: [0, SLAB_TOP, 0] },
  production: { zoom: 1.07, target: polar(200, 0.6) },
  exchanges: { zoom: 0.84, target: polar(95, 1.3) },
  carbon: { zoom: 1.3, target: polar(252, 3.6) },
};

const damp = THREE.MathUtils.damp;

/**
 * Caméra orthographique isométrique : cadre l'Hexagone dans le rectangle laissé
 * libre par les panneaux (décalage de vue), suit l'onglet actif et la rotation
 * à la souris, avec amortissement.
 */
export function CameraRig({ view, lens, orbit }: { view: ViewRect | null; lens: Lens; orbit: RefObject<Orbit> }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const st = useRef({ ready: false, az: BASE_AZ, el: BASE_EL, zoom: 1, target: new THREE.Vector3() });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const v = view && view.width > 0 && view.height > 0 ? view : { x: 0, y: 0, width: size.width, height: size.height };
    const fit = Math.max(4, Math.min(v.width / SPAN_W, v.height / SPAN_H));
    const goal = LENS_VIEW[lens];
    const s = st.current;
    const o = orbit.current ?? { az: 0, el: 0 };

    if (!s.ready) {
      s.zoom = fit * goal.zoom;
      s.target.set(...goal.target);
      s.ready = true;
    }
    s.zoom = damp(s.zoom, fit * goal.zoom, 4, dt);
    s.az = damp(s.az, BASE_AZ + o.az, 8, dt);
    s.el = damp(s.el, BASE_EL + o.el, 8, dt);
    s.target.set(
      damp(s.target.x, goal.target[0], 4, dt),
      damp(s.target.y, goal.target[1], 4, dt),
      damp(s.target.z, goal.target[2], 4, dt),
    );

    const az = s.az * DEG;
    const el = s.el * DEG;
    camera.position.set(
      s.target.x + DIST * Math.cos(el) * Math.sin(az),
      s.target.y + DIST * Math.sin(el),
      s.target.z + DIST * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(s.target);
    camera.updateMatrixWorld();
    camera.zoom = s.zoom;

    const cx = v.x + v.width / 2;
    const cy = v.y + v.height / 2 + LIFT * s.zoom;
    camera.setViewOffset(size.width, size.height, size.width / 2 - cx, size.height / 2 - cy, size.width, size.height);
    camera.updateProjectionMatrix();
  });

  return null;
}
