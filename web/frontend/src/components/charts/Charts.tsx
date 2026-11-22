// Thin wrappers over Recharts (and one small SVG forest plot) so every Results figure shares
// the design tokens, axis style and a text summary for screen readers.
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { axisProps, chartTheme, gridProps, tooltipProps } from './chartTheme';

interface FigureProps {
  caption: string;
  /** Plain-text summary of the figure for screen readers. */
  summary: string;
  height?: number;
  children: React.ReactElement;
}

const Figure: React.FC<FigureProps> = ({ caption, summary, height = 280, children }) => (
  <figure className="chart">
    <div role="img" aria-label={summary} style={{ width: '100%', height }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
    <figcaption className="fig-caption">{caption}</figcaption>
  </figure>
);

export interface BarSeries {
  key: string;
  name: string;
  color?: string;
}

export const BarCompare: React.FC<{
  data: Record<string, string | number>[];
  xKey: string;
  series: BarSeries[];
  caption: string;
  summary: string;
  yLabel?: string;
  reference?: { y: number; label: string };
  format?: (v: number) => string;
  /** Stack the series in one bar per x value (e.g. win / draw / loss shares). */
  stacked?: boolean;
  yDomain?: [number, number];
  height?: number;
}> = ({ data, xKey, series, caption, summary, yLabel, reference, format, stacked, yDomain, height }) => {
  const t = chartTheme();
  const palette = [t.ink, t.crimson, t.graphiteSoft];
  return (
    <Figure caption={caption} summary={summary} height={height}>
      <BarChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid {...gridProps()} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps()} />
        <YAxis
          {...axisProps()}
          domain={yDomain}
          tickFormatter={format}
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: t.graphiteSoft, fontSize: 12 } : undefined}
        />
        <Tooltip {...tooltipProps()} formatter={(v: number) => (format ? format(v) : v)} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {reference && (
          <ReferenceLine y={reference.y} stroke={t.graphite} strokeDasharray="5 4" label={{ value: reference.label, fill: t.graphite, fontSize: 12, position: 'insideTopRight' }} />
        )}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId={stacked ? 'stack' : undefined} fill={s.color ?? palette[i % palette.length]} isAnimationActive={false} />
        ))}
      </BarChart>
    </Figure>
  );
};

export interface LineSeries {
  name: string;
  points: [number, number][];
  color?: string;
  dashed?: boolean;
}

export const LineSeriesChart: React.FC<{
  series: LineSeries[];
  caption: string;
  summary: string;
  xLabel: string;
  yLabel: string;
  reference?: { y: number; label: string };
  xFormat?: (v: number) => string;
}> = ({ series, caption, summary, xLabel, yLabel, reference, xFormat }) => {
  const t = chartTheme();
  return (
    <Figure caption={caption} summary={summary} height={320}>
      <LineChart margin={{ top: 10, right: 16, bottom: 18, left: 4 }}>
        <CartesianGrid {...gridProps()} />
        <XAxis
          type="number"
          dataKey="x"
          domain={['dataMin', 'dataMax']}
          {...axisProps()}
          tickFormatter={xFormat}
          label={{ value: xLabel, position: 'insideBottom', offset: -10, fill: t.graphiteSoft, fontSize: 12 }}
        />
        <YAxis
          {...axisProps()}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: t.graphiteSoft, fontSize: 12 }}
        />
        <Tooltip {...tooltipProps()} labelFormatter={(v: number) => (xFormat ? xFormat(v) : v)} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 6 }} />
        {reference && (
          <ReferenceLine y={reference.y} stroke={t.graphite} strokeDasharray="5 4" label={{ value: reference.label, fill: t.graphite, fontSize: 12, position: 'insideTopRight' }} />
        )}
        {series.map((s) => (
          <Line
            key={s.name}
            data={s.points.map(([x, y]) => ({ x, y }))}
            dataKey="y"
            name={s.name}
            stroke={s.color ?? t.ink}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '6 4' : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </Figure>
  );
};

export interface ForestRow {
  label: string;
  estimate: number;
  ci: [number, number];
  emphasis: boolean;
}

/** Effect estimates with 95% intervals around zero; emphasised rows are drawn solid and marked. */
export const ForestPlot: React.FC<{ rows: ForestRow[]; caption: string; summary: string; emphasisLabel: string; format?: (v: number) => string }> = ({
  rows,
  caption,
  summary,
  emphasisLabel,
  format = (v) => v.toFixed(2),
}) => {
  const t = chartTheme();
  const lo = Math.min(0, ...rows.map((r) => r.ci[0]));
  const hi = Math.max(0, ...rows.map((r) => r.ci[1]));
  const pad = (hi - lo) * 0.08;
  const W = 680;
  const L = 70;
  const R = 250;
  const rowH = 30;
  const H = rows.length * rowH + 40;
  const x = (v: number) => L + ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (W - L - R);
  const ticks = [lo, (lo + hi) / 2, 0, hi].filter((v, i, a) => a.findIndex((w) => Math.abs(w - v) < 1e-9) === i).sort((a, b) => a - b);
  return (
    <figure className="chart">
      <div className="forest-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="forest">
        <line x1={x(0)} x2={x(0)} y1={8} y2={H - 28} stroke={t.graphite} strokeDasharray="4 3" />
        {rows.map((r, i) => {
          const y = 20 + i * rowH;
          return (
            <g key={r.label}>
              <text x={L - 10} y={y + 4} textAnchor="end" fill={t.graphite} fontSize={13} fontWeight={700}>
                {r.label}
              </text>
              <line x1={x(r.ci[0])} x2={x(r.ci[1])} y1={y} y2={y} stroke={r.emphasis ? t.inkDeep : t.graphiteSoft} strokeWidth={r.emphasis ? 3 : 1.5} />
              <rect x={x(r.estimate) - 5} y={y - 5} width={10} height={10} fill={r.emphasis ? t.inkDeep : t.surface} stroke={r.emphasis ? t.inkDeep : t.graphiteSoft} strokeWidth={1.5} />
              <text x={W - R + 12} y={y + 4} fill={t.graphite} fontSize={12}>
                {format(r.estimate)} [{format(r.ci[0])}, {format(r.ci[1])}]{r.emphasis ? ` · ${emphasisLabel}` : ''}
              </text>
            </g>
          );
        })}
        {ticks.map((v) => (
          <text key={v} x={x(v)} y={H - 10} textAnchor="middle" fill={t.graphiteSoft} fontSize={12}>
            {format(v)}
          </text>
        ))}
      </svg>
      </div>
      <figcaption className="fig-caption">{caption}</figcaption>
    </figure>
  );
};
