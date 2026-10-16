"use client";

import { fmtGW, fmtInt, fmtPower } from "@/lib/format";
import { COUNTRIES, sortedCountries } from "@/lib/sources";
import { COUNTRY_KEYS, type CountryKey, type Snapshot } from "@/lib/types";
import type { FocusKey } from "../types";
import { Card, LensButton } from "./Card";

interface Props {
  latest: Snapshot;
  focus: FocusKey | null;
  onFocus: (k: FocusKey | null) => void;
  focused: boolean;
  stale: boolean;
  onLens: () => void;
}

export default function ExchangesCard({ latest, focus, onFocus, focused, stale, onLens }: Props) {
  const rows = sortedCountries(latest);
  const max = Math.max(1000, ...COUNTRY_KEYS.map((c) => Math.abs(latest.exchanges[c])));
  const active = focus && (COUNTRY_KEYS as readonly string[]).includes(focus) ? (focus as CountryKey) : null;
  const net = latest.netExchange;
  const netLabel = net < 0 ? "Export net" : net > 0 ? "Import net" : "Solde nul";

  return (
    <Card
      title="Échanges aux frontières"
      sub={
        <>
          {netLabel} <strong style={{ color: "var(--ink-1)", fontWeight: 500 }}>{fmtGW(Math.abs(net))} GW</strong> ·
          programmes commerciaux
        </>
      }
      focused={focused}
      stale={stale}
      actions={<LensButton onClick={onLens} label="Voir les interconnexions dans la scène" />}
    >
      <div className="xch-legend" aria-hidden>
        <span>
          <i style={{ background: "var(--import)" }} />
          Import
        </span>
        <span>
          Export
          <i style={{ background: "var(--export)" }} />
        </span>
      </div>
      <ul className="xch-list">
        {rows.map((c) => {
          const v = latest.exchanges[c];
          const w = (Math.abs(v) / max) * 50;
          const exporting = v < 0;
          const dir = exporting ? "export" : v > 0 ? "import" : "";
          return (
            <li
              key={c}
              className={["xch-row", active === c && "is-active", active && active !== c && "is-dim"]
                .filter(Boolean)
                .join(" ")}
              onPointerEnter={() => onFocus(c)}
              onPointerLeave={() => onFocus(null)}
              aria-label={`${COUNTRIES[c].label} : ${dir} ${fmtInt(Math.abs(v))} MW`}
            >
              <span className="xch-name">{COUNTRIES[c].label}</span>
              <span className="xch-bar" aria-hidden>
                <span
                  style={{
                    left: exporting ? "50%" : `${50 - w}%`,
                    width: `${w}%`,
                    background: exporting ? "var(--export)" : "var(--import)",
                  }}
                />
              </span>
              <span className="xch-val">{fmtPower(Math.abs(v))}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
