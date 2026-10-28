import type { Estimate } from "@/lib/data";
import { interval, pct, ratio } from "@/lib/format";

/** A point estimate and its 95% interval on a 0–100% track; the tooltip carries the exact figures. */
export function IntervalBar({ estimate, name, anchor = false }: { estimate: Estimate; name: string; anchor?: boolean }) {
  const { value, low, high } = estimate;
  return (
    <div className="interval" data-anchor={anchor || undefined} tabIndex={0} aria-label={`${name}: ${pct(value)}, 95% CI ${interval(estimate)}, ${ratio(estimate)}`}>
      <div className="interval-track" aria-hidden>
        <span className="interval-band" style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%` }} />
        <span className="interval-dot" style={{ left: `${value * 100}%` }} />
      </div>
      <span className="interval-value">{pct(value)}</span>
      <span className="tooltip" role="tooltip">
        <strong>{name}</strong>
        <span>
          {pct(value)} ({ratio(estimate)})
        </span>
        <span>95% interval {interval(estimate)}</span>
      </span>
    </div>
  );
}

/** Tick labels for a column of IntervalBars. */
export function IntervalAxis() {
  return (
    <div className="interval-axis" aria-hidden>
      <div className="interval-track">
        {[0, 50, 100].map((t) => (
          <span key={t} style={{ left: `${t}%` }}>
            {t}%
          </span>
        ))}
      </div>
      <span className="interval-value" />
    </div>
  );
}
