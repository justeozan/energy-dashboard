"use client";

import { Moon, RefreshCw, Sun } from "lucide-react";
import { fmtTime } from "@/lib/format";
import { LogoMark } from "./icons";
import { LENSES, type Lens } from "./types";
import type { Theme } from "./useTheme";

interface Props {
  lens: Lens;
  onLens: (l: Lens) => void;
  time: string;
  isDemo: boolean;
  loading: boolean;
  onRefresh: () => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}

export default function TopBar({ lens, onLens, time, isDemo, loading, onRefresh, theme, onTheme }: Props) {
  return (
    <header className="topbar hud-top">
      <div className="brand">
        <span className="brand-mark glass">
          <LogoMark />
        </span>
        <span>
          Énergie France <span className="brand-sub">· réseau électrique</span>
        </span>
      </div>

      <nav className="nav glass" aria-label="Vues de la scène">
        {LENSES.map((l) => (
          <button
            key={l.key}
            type="button"
            className="nav-item"
            aria-pressed={lens === l.key}
            onClick={() => onLens(l.key)}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <div className="top-actions">
        <span className="status-pill glass" role="status">
          <span className={isDemo ? "live-dot is-demo" : "live-dot"} aria-hidden />
          <strong>{isDemo ? "Démo" : "En direct"}</strong>
          <span className="status-time">· données de {fmtTime(time)}</span>
        </span>
        <button
          type="button"
          className={loading ? "icon-btn glass is-spinning" : "icon-btn glass"}
          onClick={onRefresh}
          aria-label="Actualiser les données"
          title="Actualiser"
          disabled={loading}
        >
          <RefreshCw size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="icon-btn glass"
          onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
          title={theme === "dark" ? "Jour" : "Nuit"}
        >
          {theme === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
        </button>
      </div>
    </header>
  );
}
