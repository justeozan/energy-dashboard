import { Atom, Building, Droplets, Flame, Leaf, SunMedium, UtilityPole, Wind, type LucideIcon } from "lucide-react";
import type { GroupKey } from "@/lib/types";

export const GROUP_ICONS: Record<GroupKey, LucideIcon> = {
  nucleaire: Atom,
  bioenergies: Leaf,
  hydraulique: Droplets,
  solaire: SunMedium,
  eolien: Wind,
  fossile: Flame,
};

export const CityIcon = Building;
export const HubIcon = UtilityPole;

/** Logo : l'Hexagone traversé d'un éclair. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 1.8 20.8 6.9v10.2L12 22.2 3.2 17.1V6.9z"
        fill="currentColor"
        fillOpacity={0.14}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M13.2 5.8 8.6 13h3.3l-1.1 5.2 4.6-7.2h-3.3z" fill="currentColor" />
    </svg>
  );
}
