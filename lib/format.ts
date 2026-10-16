const TZ = "Europe/Paris";

const intFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});
const hourFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

export const fmtInt = (n: number) => intFmt.format(Math.round(n));

/** MW → « 38,1 » (GW, une décimale). */
export const fmtGW = (mw: number) => oneDecimal.format(mw / 1000);

export const fmtPct = (n: number) => oneDecimal.format(n);

/** Puissance compacte : GW au-delà de 1 000 MW, MW en dessous. */
export function fmtPowerParts(mw: number): { value: string; unit: "GW" | "MW" } {
  return Math.abs(mw) >= 1000 ? { value: fmtGW(mw), unit: "GW" } : { value: fmtInt(mw), unit: "MW" };
}

export function fmtPower(mw: number) {
  const { value, unit } = fmtPowerParts(mw);
  return `${value} ${unit}`;
}

export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));

/** Heure de Paris (0–23) d'un horodatage. En français, l'heure seule se formate « 06 h » : on lit la partie « hour ». */
export const parisHour = (iso: string) =>
  Number(hourFmt.formatToParts(new Date(iso)).find((p) => p.type === "hour")?.value ?? NaN);

export const fmtDay = (iso: string) => {
  const s = dayFmt.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Signe typographique (− U+2212) pour les écarts. */
export const signed = (n: number, text: string) => (n > 0 ? `+${text}` : n < 0 ? `−${text}` : text);
