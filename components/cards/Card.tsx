import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface CardProps {
  title: string;
  sub?: ReactNode;
  focused?: boolean;
  stale?: boolean;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, sub, focused, stale, actions, className, children }: CardProps) {
  return (
    <section
      className={["card", "glass", focused && "is-focused", stale && "is-stale", className].filter(Boolean).join(" ")}
      aria-label={title}
    >
      <header className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {sub && <p className="card-sub">{sub}</p>}
        </div>
        {actions && <div className="card-btns">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** Bouton « voir dans la scène » : bascule la vue 3D correspondante. */
export function LensButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="card-btn" onClick={onClick} aria-label={label} title={label}>
      <ArrowUpRight size={16} strokeWidth={1.8} />
    </button>
  );
}
