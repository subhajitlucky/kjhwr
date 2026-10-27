export type Scale = (value: number) => number;

export function isNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function extent(values: number[], fallback: [number, number] = [0, 1]): [number, number] {
  if (!values.length) return fallback;
  let low = values[0];
  let high = values[0];
  for (const value of values) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return [low, high];
}

export function niceDomain(values: number[], padRatio = 0.08): [number, number] {
  const [low, high] = extent(values);
  const span = high - low;
  const pad = span > 0 ? span * padRatio : Math.max(Math.abs(high) * 0.1, 1000);
  return [low - pad, high + pad];
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [min, max];
  }
  const span = max - min;
  const rough = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  let step =
    magnitude *
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10);

  const build = (): number[] => {
    const start = Math.ceil(min / step) * step;
    const ticks: number[] = [];
    for (let value = start; value <= max + step * 1e-6; value += step) {
      ticks.push(Number(value.toFixed(6)));
    }
    return ticks;
  };

  let ticks = build();
  // A domain that starts between steps can yield only two grid lines. Halve
  // the step until the chart has at least three readable reference levels.
  while (ticks.length < 3 && step > 1e-9) {
    step /= 2;
    ticks = build();
  }
  while (ticks.length > 7 && step < 1e12) {
    step *= 2;
    ticks = build();
  }
  return ticks.length ? ticks : [min, max];
}

export function linearScale(
  domain: [number, number],
  range: [number, number],
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

export function pathFrom(
  values: (number | null)[],
  x: (index: number) => number,
  y: Scale,
): string {
  let path = "";
  let started = false;
  values.forEach((value, index) => {
    if (!isNum(value)) {
      started = false;
      return;
    }
    path += `${started ? "L" : "M"}${x(index).toFixed(2)},${y(value).toFixed(2)} `;
    started = true;
  });
  return path.trim();
}

export function bandPath(
  top: (number | null)[],
  bottom: (number | null)[],
  x: (index: number) => number,
  y: Scale,
): string {
  const points: string[] = [];
  for (let index = 0; index < top.length; index += 1) {
    const upper = top[index];
    const lower = bottom[index];
    if (!isNum(upper) || !isNum(lower)) continue;
    points.push(`${x(index).toFixed(2)},${y(upper).toFixed(2)}`);
  }
  for (let index = bottom.length - 1; index >= 0; index -= 1) {
    const upper = top[index];
    const lower = bottom[index];
    if (!isNum(upper) || !isNum(lower)) continue;
    points.push(`${x(index).toFixed(2)},${y(lower).toFixed(2)}`);
  }
  if (points.length < 4) return "";
  return `M${points.join(" L")} Z`;
}

export function tooltipX(
  anchor: number,
  width: number,
  cardWidth: number,
  gutter = 8,
): number {
  return clamp(anchor + 12, gutter, Math.max(gutter, width - cardWidth - gutter));
}
