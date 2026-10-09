// Small SVG charts (no external library).

interface Bar {
  label: string;
  value: number | null;
  detail?: string;
}

export function BarChart({ bars, max = 100, unit = "%", title }: { bars: Bar[]; max?: number; unit?: string; title: string }) {
  const width = 560;
  const height = 200;
  const pad = { top: 22, bottom: 34, left: 8, right: 8 };
  const slot = (width - pad.left - pad.right) / Math.max(bars.length, 1);
  const barWidth = Math.min(54, slot * 0.6);
  const scale = (v: number) => ((height - pad.top - pad.bottom) * v) / max;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#d3ddd5" />
        {bars.map((bar, i) => {
          const x = pad.left + slot * i + (slot - barWidth) / 2;
          const h = bar.value === null ? 0 : scale(Math.min(bar.value, max));
          const y = height - pad.bottom - h;
          return (
            <g key={bar.label}>
              <title>{bar.detail ?? `${bar.label}: ${bar.value ?? "sin recorridos"}`}</title>
              {bar.value === null ? (
                <text x={x + barWidth / 2} y={height - pad.bottom - 6} textAnchor="middle" fontSize="12" fill="#5b6a61">
                  —
                </text>
              ) : (
                <>
                  <rect x={x} y={y} width={barWidth} height={h} rx="4" fill={bar.value >= 85 ? "#1E4A37" : "#F2B705"} />
                  <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#17231C">
                    {Math.round(bar.value)}
                    {unit}
                  </text>
                </>
              )}
              <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" fontSize="12" fill="#5b6a61">
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

export function RiskPill({ risk, label }: { risk: "low" | "medium" | "high"; label: string }) {
  return <span className={`pill pill-${risk}`}>{label}</span>;
}
