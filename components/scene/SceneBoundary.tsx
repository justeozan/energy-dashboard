"use client";

import { Component, useSyncExternalStore, type ReactNode } from "react";

let webglSupport: boolean | null = null;

/** Teste une fois la création d'un contexte WebGL (GPU absent, pilote bloqué…). */
function hasWebGL() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      webglSupport = !!gl;
      (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const noop = () => () => {};

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Scène 3D désactivée :", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** La scène est un décor : sans WebGL, le tableau de bord reste complet sans elle. */
export default function SceneBoundary({ children }: { children: ReactNode }) {
  const supported = useSyncExternalStore(noop, hasWebGL, () => true);
  const fallback = <div className="scene-fallback scene-static" />;
  if (!supported) return fallback;
  return <Boundary fallback={fallback}>{children}</Boundary>;
}
