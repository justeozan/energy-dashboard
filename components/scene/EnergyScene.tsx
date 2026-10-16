"use client";

import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { Snapshot } from "@/lib/types";
import type { FocusKey, Lens } from "../types";
import type { Theme } from "../useTheme";
import { CameraRig, type Orbit, type ViewRect } from "./CameraRig";
import Diorama, { HIT_LAYER } from "./Diorama";
import { LabelLayer, LabelProjector, buildLabels } from "./labels";
import { MaterialsProvider } from "./materials";
import { PALETTES, type ScenePalette } from "./palette";

export type { ViewRect };

interface Props {
  latest: Snapshot;
  theme: Theme;
  lens: Lens;
  focus: FocusKey | null;
  onFocus: (k: FocusKey | null) => void;
  view: ViewRect | null;
  reducedMotion: boolean;
}

function Effects({ palette, low }: { palette: ScenePalette; low: boolean }) {
  const ao = (
    <N8AO
      aoRadius={1.1}
      distanceFalloff={1}
      intensity={palette.aoIntensity}
      color={palette.aoColor}
      quality={low ? "performance" : "medium"}
      halfRes={low}
    />
  );
  return palette.bloom ? (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {ao}
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.9} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {ao}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function EnergyScene({ latest, theme, lens, focus, onFocus, view, reducedMotion }: Props) {
  const palette = PALETTES[theme];
  const [low, setLow] = useState(false);
  const orbit = useRef<Orbit>({ az: 0, el: 0 });
  const drag = useRef<{ x: number; y: number; az: number; el: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const labels = useMemo(() => buildLabels(latest, lens, palette), [latest, lens, palette]);
  const labelNodes = useRef(new Map<string, HTMLDivElement>());

  // Rotation à la souris (pas au doigt : le défilement de la page reste prioritaire).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.button !== 0 || e.target !== e.currentTarget.querySelector("canvas")) return;
    drag.current = { x: e.clientX, y: e.clientY, ...orbit.current };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    orbit.current = {
      az: clamp(d.az - (e.clientX - d.x) * 0.22, -40, 40),
      el: clamp(d.el + (e.clientY - d.y) * 0.12, -14, 16),
    };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  return (
    <div
      className={dragging ? "scene-canvas is-dragging" : "scene-canvas is-grabbable"}
      style={{ position: "absolute", inset: 0 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => (orbit.current = { az: 0, el: 0 })}
      aria-hidden
    >
      <Canvas
        orthographic
        shadows="variance"
        flat
        dpr={low ? 1 : [1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [40, 30, 40], zoom: 30, near: 1, far: 200 }}
        onCreated={(state) => state.raycaster.layers.set(HIT_LAYER)}
        fallback={<div className="scene-fallback">La vue 3D nécessite WebGL.</div>}
      >
        <PerformanceMonitor onDecline={() => setLow(true)} />
        <color attach="background" args={[palette.background]} />
        <fog attach="fog" args={[palette.background, palette.fog[0], palette.fog[1]]} />

        <hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]} />
        <directionalLight
          position={[-16, 24, 6]}
          color={palette.sun}
          intensity={palette.sunIntensity}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-17}
          shadow-camera-right={17}
          shadow-camera-top={17}
          shadow-camera-bottom={-17}
          shadow-camera-near={1}
          shadow-camera-far={80}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
          shadow-radius={8}
          shadow-blurSamples={16}
          shadow-intensity={0.8}
        />
        <Environment resolution={128} frames={1} environmentIntensity={palette.envIntensity}>
          <Lightformer form="rect" intensity={2} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[-14, 5, 14]} scale={[24, 6, 1]} />
          <Lightformer form="rect" intensity={0.5} position={[14, 5, -14]} scale={[24, 6, 1]} />
        </Environment>

        <MaterialsProvider palette={palette}>
          <Diorama latest={latest} palette={palette} focus={focus} onFocus={onFocus} reduced={reducedMotion} />
        </MaterialsProvider>

        <CameraRig view={view} lens={lens} orbit={orbit} />
        <LabelProjector labels={labels} nodes={labelNodes} />
        <Effects key={theme} palette={palette} low={low} />
      </Canvas>
      <LabelLayer labels={labels} nodes={labelNodes} focus={focus} onFocus={onFocus} />
    </div>
  );
}
