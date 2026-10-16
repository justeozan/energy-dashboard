export type Scale = ((v: number) => number) & { domain: [number, number] };

export function linear([d0, d1]: [number, number], [r0, r1]: [number, number]): Scale {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const s = ((v: number) => r0 + (v - d0) * k) as Scale;
  s.domain = [d0, d1];
  return s;
}

/** Pas « rond » (1, 2, 5 × 10^n) donnant environ `count` graduations. */
function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const err = raw / pow;
  return (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * pow;
}

/** Domaine arrondi et graduations propres. */
export function niceDomain(min: number, max: number, count = 3) {
  if (max <= min) max = min + 1;
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { domain: [lo, hi] as [number, number], ticks };
}

/** Index du point le plus proche de `t` dans une liste triée. */
export function nearestIndex(times: number[], t: number) {
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < t) lo = mid;
    else hi = mid;
  }
  return Math.abs(times[lo] - t) <= Math.abs(times[hi] - t) ? lo : hi;
}

const HOUR = 3600_000;

/** Graduations horaires alignées sur l'heure de Paris (toutes les `every` heures). */
export function hourTicks(t0: number, t1: number, every: number, parisHourOf: (t: number) => number) {
  const ticks: number[] = [];
  let t = Math.ceil(t0 / HOUR) * HOUR;
  for (; t <= t1; t += HOUR) {
    if (parisHourOf(t) % every === 0) ticks.push(t);
  }
  return ticks;
}
