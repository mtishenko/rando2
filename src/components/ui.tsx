import { scoreStatus, oneDp } from "@/lib/ui/format";

export function PriorityPill({ band, score }: { band: string; score?: number }) {
  return (
    <span className={`pill p-${band.toLowerCase()}`}>
      <span className="dot" />
      {band}
      {score !== undefined ? ` · ${score}` : ""}
    </span>
  );
}

export function HealthBar({ value, width = 90 }: { value: number; width?: number }) {
  const st = scoreStatus(value);
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="hbar" style={{ width }}>
        <span className={`f-${st}`} style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
      </div>
      <span className={`s-${st} mono`} style={{ fontWeight: 600 }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

export function Trend({ value, invert = false, suffix = "" }: { value: number; invert?: boolean; suffix?: string }) {
  const cls =
    Math.abs(value) < 0.5 ? "t-flat" : (invert ? value < 0 : value > 0) ? "t-up" : "t-down";
  const arrow = value > 0.5 ? "▲" : value < -0.5 ? "▼" : "▬";
  const r = Math.round(value * 10) / 10;
  return (
    <span className={cls}>
      {arrow} {r > 0 ? "+" : ""}
      {r}
      {suffix}
    </span>
  );
}

/**
 * Portfolio hero metric. `tone` = "status" colors by band (health/coverage),
 * "edgefi" colors purple (edgefi's own measured contribution — impact).
 */
export function Metric({
  label,
  value,
  unit,
  tone = "status",
  children,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: "status" | "edgefi";
  children?: React.ReactNode;
}) {
  const cls = tone === "edgefi" ? "s-edgefi" : `s-${scoreStatus(value)}`;
  return (
    <div className="metric">
      <div className="ml">{label}</div>
      <div className="mv">
        <span className={cls}>{oneDp(value)}</span>
        {unit ? <span className="mu">{unit}</span> : null}
      </div>
      {children}
    </div>
  );
}
