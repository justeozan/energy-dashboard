"use client";

import { fmtGW, fmtInt, fmtPct, fmtPower, fmtTime } from "@/lib/format";
import { GROUPS, mixSummary } from "@/lib/sources";
import { GROUP_KEYS, type GroupKey, type Snapshot } from "@/lib/types";
import type { FocusKey } from "../types";
import { Card, LensButton } from "./Card";

const FOSSIL_PARTS = ["gaz", "fioul", "charbon"] as const;

interface Props {
  latest: Snapshot;
  focus: FocusKey | null;
  onFocus: (k: FocusKey | null) => void;
  focused: boolean;
  stale: boolean;
  onLens: () => void;
}

export default function MixCard({ latest, focus, onFocus, focused, stale, onLens }: Props) {
  const mix = mixSummary(latest);
  const rows = [...GROUP_KEYS].sort((a, b) => mix.groups[b] - mix.groups[a]);
  const active = focus && (GROUP_KEYS as readonly string[]).includes(focus) ? (focus as GroupKey) : null;
  const p = latest.production;

  return (
    <Card
      title="Mix de production"
      sub={`${fmtGW(mix.total)} GW produits · ${fmtTime(latest.time)}`}
      focused={focused}
      stale={stale}
      actions={<LensButton onClick={onLens} label="Voir les centrales dans la scène" />}
    >
      <div className="stack-pill" aria-hidden>
        {GROUP_KEYS.map((k) => (
          <span
            key={k}
            className={active && active !== k ? "is-dim" : undefined}
            style={{ flexGrow: mix.groups[k], background: `var(--series-${k})` }}
          />
        ))}
      </div>

      <ul className="mix-list">
        {rows.map((k) => (
          <li
            key={k}
            className={["mix-row", active === k && "is-active", active && active !== k && "is-dim"]
              .filter(Boolean)
              .join(" ")}
            onPointerEnter={() => onFocus(k)}
            onPointerLeave={() => onFocus(null)}
          >
            <span className="swatch" style={{ background: `var(--series-${k})` }} aria-hidden />
            <span className="mix-name">
              {GROUPS[k].label}
              {k === "fossile" && (
                <small>
                  {FOSSIL_PARTS.filter((k) => p[k] > 0)
                    .map((k) => `${k} ${fmtPower(p[k])}`)
                    .join(" · ") || "à l'arrêt"}
                </small>
              )}
              {k === "eolien" && latest.windOffshore > 0 && <small>dont en mer {fmtInt(latest.windOffshore)} MW</small>}
            </span>
            <span className="mix-val">
              {fmtGW(mix.groups[k])} <small>GW</small>
            </span>
            <span className="mix-pct">{fmtPct(mix.share[k])} %</span>
            <span className="mix-bar" aria-hidden>
              <span style={{ width: `${mix.share[k]}%`, background: `var(--series-${k})` }} />
            </span>
          </li>
        ))}
      </ul>

      <div className="mix-foot">
        <div className="mini-stat">
          <span>Renouvelable</span>
          <strong>{fmtPct(mix.renewablePct)}</strong>
          <small>%</small>
        </div>
        <div className="mini-stat">
          <span>Bas carbone</span>
          <strong>{fmtPct(mix.lowCarbonPct)}</strong>
          <small>%</small>
        </div>
      </div>
    </Card>
  );
}
