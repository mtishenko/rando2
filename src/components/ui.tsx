import { scoreBand } from "@/lib/ui/format";

export function PriorityPill({ band, score }: { band: string; score?: number }) {
  return (
    <span className={`pill band-${band.toLowerCase()}`}>
      {band}
      {score !== undefined ? ` · ${score}` : ""}
    </span>
  );
}

export function HealthBar({ value, width = 90 }: { value: number; width?: number }) {
  const band = scoreBand(value);
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="bar" style={{ width }}>
        <span className={`fill-${band}`} style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <span className={`band-${band}`} style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

export function Trend({ value, invert = false, suffix = "" }: { value: number; invert?: boolean; suffix?: string }) {
  const cls =
    Math.abs(value) < 0.5
      ? "trend-flat"
      : (invert ? value < 0 : value > 0)
        ? "trend-up"
        : "trend-down";
  const arrow = value > 0.5 ? "▲" : value < -0.5 ? "▼" : "▬";
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className={cls} style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
      {arrow} {rounded > 0 ? "+" : ""}
      {rounded}
      {suffix}
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  band,
  children,
}: {
  label: string;
  value: string | number;
  unit?: string;
  band?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        <span className={band ? `band-${band}` : undefined}>{value}</span>
        {unit ? <span className="metric-unit"> {unit}</span> : null}
      </div>
      {children}
    </div>
  );
}
