// Chart colours from the design tokens in styles.css. Recharts writes colours into SVG
// attributes, where var() is not reliable, so the tokens are read once at runtime.
const FALLBACK = {
  ink: '#1d3f8f',
  inkDeep: '#142d66',
  crimson: '#b4233c',
  graphite: '#2e3338',
  graphiteSoft: '#5d646b',
  grid: '#dbe4ee',
  rule: '#2e3338',
  ruleSoft: '#cfd5dc',
  surface: '#ffffff',
  highlightEdge: '#b39500',
};

export type ChartTheme = typeof FALLBACK;

let cached: ChartTheme | null = null;

export function chartTheme(): ChartTheme {
  if (cached) return cached;
  if (typeof window === 'undefined' || !document?.documentElement) return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  cached = {
    ink: read('--ink', FALLBACK.ink),
    inkDeep: read('--ink-deep', FALLBACK.inkDeep),
    crimson: read('--crimson', FALLBACK.crimson),
    graphite: read('--graphite', FALLBACK.graphite),
    graphiteSoft: read('--graphite-soft', FALLBACK.graphiteSoft),
    grid: read('--grid', FALLBACK.grid),
    rule: read('--rule', FALLBACK.rule),
    ruleSoft: read('--rule-soft', FALLBACK.ruleSoft),
    surface: read('--surface', FALLBACK.surface),
    highlightEdge: read('--highlight-edge', FALLBACK.highlightEdge),
  };
  return cached;
}

/** Shared axis/grid/tooltip props so every chart looks like one figure set. */
export function axisProps() {
  const t = chartTheme();
  return {
    stroke: t.graphiteSoft,
    tick: { fill: t.graphiteSoft, fontSize: 12 },
  };
}

export function gridProps() {
  return { strokeDasharray: '3 3', stroke: chartTheme().grid };
}

export function tooltipProps() {
  const t = chartTheme();
  return {
    contentStyle: { backgroundColor: t.surface, borderColor: t.ruleSoft, color: t.graphite, borderRadius: 0 },
    labelStyle: { color: t.graphite, fontWeight: 700 },
  };
}
