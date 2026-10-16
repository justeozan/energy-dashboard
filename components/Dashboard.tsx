"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { fmtDay } from "@/lib/format";
import type { Eco2mixPayload } from "@/lib/types";
import { ConsumptionChartCard, Co2ChartCard, ProductionChartCard } from "./cards/ChartCards";
import ExchangesCard from "./cards/ExchangesCard";
import { CarbonCard, ConsumptionCard } from "./cards/MetricCards";
import MixCard from "./cards/MixCard";
import type { ViewRect } from "./scene/CameraRig";
import SceneBoundary from "./scene/SceneBoundary";
import TopBar from "./TopBar";
import type { FocusKey, Lens } from "./types";
import { useTheme } from "./useTheme";

const EnergyScene = dynamic(() => import("./scene/EnergyScene"), {
  ssr: false,
  loading: () => <div className="scene-fallback" />,
});

const motionQuery = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(motionQuery);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
}

/**
 * Rectangle libre entre les panneaux, relatif au canvas : la caméra y cadre l'Hexagone.
 * En mise en page empilée, fixe aussi la hauteur du bandeau 3D (--scene-h).
 */
function useSceneView() {
  const appRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewRect | null>(null);

  useLayoutEffect(() => {
    const app = appRef.current;
    const scene = sceneRef.current;
    const focus = focusRef.current;
    if (!app || !scene || !focus) return;

    const update = () => {
      const stacked = getComputedStyle(scene).position !== "fixed";
      if (stacked) {
        const bottom = focus.getBoundingClientRect().bottom - app.getBoundingClientRect().top;
        app.style.setProperty("--scene-h", `${Math.round(bottom + 12)}px`);
      } else {
        app.style.removeProperty("--scene-h");
      }
      const s = scene.getBoundingClientRect();
      const f = focus.getBoundingClientRect();
      setView((prev) => {
        const next = { x: f.left - s.left, y: f.top - s.top, width: f.width, height: f.height };
        return prev &&
          Math.abs(prev.x - next.x) < 1 &&
          Math.abs(prev.y - next.y) < 1 &&
          Math.abs(prev.width - next.width) < 1 &&
          Math.abs(prev.height - next.height) < 1
          ? prev
          : next;
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(focus);
    ro.observe(app);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return { appRef, sceneRef, focusRef, view };
}

export default function Dashboard({ initial }: { initial: Eco2mixPayload }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [lens, setLens] = useState<Lens>("overview");
  const [focus, setFocus] = useState<FocusKey | null>(null);
  const [theme, setTheme] = useTheme();
  const reducedMotion = useReducedMotion();
  const { appRef, sceneRef, focusRef, view } = useSceneView();
  const fetchedAt = useRef(Date.parse(initial.fetchedAt));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/eco2mix", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as Eco2mixPayload;
      fetchedAt.current = Date.now();
      // Un repli démo ne remplace jamais des données réelles déjà affichées.
      setData((prev) => (next.isDemo && !prev.isDemo ? prev : next));
    } catch {
      // réseau indisponible : on garde l'affichage courant
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const period = data.refreshSeconds * 1000;
    const id = window.setInterval(refresh, period);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAt.current > period) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [data.refreshSeconds, refresh]);

  // Bouton « voir dans la scène » de la carte consommation : met la ville en évidence un instant.
  const flashTimer = useRef<number | undefined>(undefined);
  const flash = (k: FocusKey) => {
    setFocus(k);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFocus((f) => (f === k ? null : f)), 2600);
  };

  const { latest, history, upcoming } = data;

  return (
    <div className="app" ref={appRef}>
      <div className="scene-layer" ref={sceneRef}>
        <SceneBoundary>
          <EnergyScene
            latest={latest}
            theme={theme}
            lens={lens}
            focus={focus}
            onFocus={setFocus}
            view={view}
            reducedMotion={reducedMotion}
          />
        </SceneBoundary>
      </div>

      <main className="hud">
        <TopBar
          lens={lens}
          onLens={setLens}
          time={latest.time}
          isDemo={data.isDemo}
          loading={loading}
          onRefresh={refresh}
          theme={theme}
          onTheme={setTheme}
        />

        <section className="hud-title hero">
          <div className="hero-eyebrow">{fmtDay(latest.time)} · France</div>
          <h1>
            Réseau
            <br />
            électrique
          </h1>
          <p>Production, consommation, échanges et carbone, mis à jour tous les quarts d&apos;heure.</p>
          {data.isDemo && (
            <div className="demo-note" role="note">
              Données simulées — l&apos;API ODRE ne répond pas
            </div>
          )}
        </section>

        <div className="scene-focus" ref={focusRef} aria-hidden />

        <div className="hud-left">
          <ConsumptionCard
            latest={latest}
            history={history}
            focused={focus === "city"}
            stale={loading}
            onLens={() => {
              setLens("overview");
              flash("city");
            }}
          />
          <CarbonCard
            latest={latest}
            threshold={data.co2Threshold}
            focused={lens === "carbon"}
            stale={loading}
            onLens={() => setLens("carbon")}
          />
        </div>

        <div className="hud-right">
          <MixCard
            latest={latest}
            focus={focus}
            onFocus={setFocus}
            focused={lens === "production"}
            stale={loading}
            onLens={() => setLens("production")}
          />
        </div>

        <div className="hud-bottom">
          <ConsumptionChartCard history={history} upcoming={upcoming} focused={false} stale={loading} />
          <ProductionChartCard history={history} focus={focus} focused={lens === "production"} stale={loading} />
          <Co2ChartCard history={history} threshold={data.co2Threshold} focused={lens === "carbon"} stale={loading} />
          <ExchangesCard
            latest={latest}
            focus={focus}
            onFocus={setFocus}
            focused={lens === "exchanges"}
            stale={loading}
            onLens={() => setLens("exchanges")}
          />
        </div>

        <footer className="hud-foot foot">
          <span>
            Source : RTE éCO2mix via{" "}
            <a href="https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/" target="_blank" rel="noreferrer">
              ODRE
            </a>{" "}
            · données temps réel, pas de 15 min
          </span>
          <span className="foot-hint">Glisser pour tourner la maquette · double-clic pour recentrer</span>
        </footer>
      </main>
    </div>
  );
}
