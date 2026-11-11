import type { ReliabilityBin } from "@/lib/extraction";

const SIZE = 220;
const PAD = 32;

/**
 * Stated confidence against measured accuracy, one dot per confidence band (area = number of
 * values). On the diagonal the model's confidence means what it says; below it, overconfident.
 */
export function ReliabilityChart({ bins, label }: { bins: ReliabilityBin[]; label: string }) {
  const plot = SIZE - PAD;
  const x = (v: number) => PAD + v * plot;
  const y = (v: number) => SIZE - PAD - v * plot + 8;
  const total = bins.reduce((s, b) => s + b.n, 0);
  return (
    <figure className="reliability">
      <svg
        viewBox={`0 0 ${SIZE + 8} ${SIZE + 8}`}
        role="img"
        aria-label={`${label}: ${bins
          .map((b) => `${b.n} values at mean confidence ${Math.round(b.confidence * 100)}% were ${Math.round(b.accuracy * 100)}% correct`)
          .join("; ")}`}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t} className="rel-grid">
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} />
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} />
            <text x={x(0) - 6} y={y(t) + 4} textAnchor="end">
              {t * 100}%
            </text>
            <text x={x(t)} y={y(0) + 16} textAnchor="middle">
              {t * 100}%
            </text>
          </g>
        ))}
        <line className="rel-diagonal" x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} />
        {bins.map((b) => (
          <circle
            key={b.bin}
            className="rel-dot"
            cx={x(b.confidence)}
            cy={y(b.accuracy)}
            r={3 + 12 * Math.sqrt(b.n / Math.max(total, 1))}
          >
            <title>{`${b.n} values, mean confidence ${Math.round(b.confidence * 100)}%, ${Math.round(b.accuracy * 100)}% correct`}</title>
          </circle>
        ))}
      </svg>
      <figcaption>
        <span>{label}</span>
        <span className="sub">confidence (x) vs. share correct (y)</span>
      </figcaption>
    </figure>
  );
}
