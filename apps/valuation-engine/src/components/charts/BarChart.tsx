interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  maxValue?: number;
  width?: number;
  height?: number;
}

export function BarChart({
  data,
  title,
  maxValue,
  width = 600,
  height = 300,
}: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value));
  const padding = { top: 40, right: 20, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barWidth = chartWidth / data.length;
  const barPadding = barWidth * 0.2;

  return (
    <svg width={width} height={height} style={{ fontFamily: 'Fira Sans, sans-serif' }}>
      {/* Title */}
      {title && (
        <text x={width / 2} y={20} textAnchor="middle" fontSize="14" fontWeight="600">
          {title}
        </text>
      )}

      {/* Y-axis label */}
      <text x={15} y={padding.top + chartHeight / 2} textAnchor="middle" fontSize="12" fill="#888">
        Value
      </text>

      {/* Y-axis */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + chartHeight}
        stroke="#ccc"
        strokeWidth="1"
      />

      {/* X-axis */}
      <line
        x1={padding.left}
        y1={padding.top + chartHeight}
        x2={width - padding.right}
        y2={padding.top + chartHeight}
        stroke="#ccc"
        strokeWidth="1"
      />

      {/* Grid lines and labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + chartHeight * (1 - pct);
        const value = (max * pct).toLocaleString();
        return (
          <g key={i}>
            <line x1={padding.left - 5} y1={y} x2={padding.left} y2={y} stroke="#ccc" strokeWidth="1" />
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#888">
              ${value}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d.value / max) * chartHeight;
        const x = padding.left + i * barWidth + barPadding;
        const y = padding.top + chartHeight - barHeight;

        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth - barPadding * 2} height={barHeight} fill="#03fb83" />
            {/* Value label */}
            <text
              x={x + (barWidth - barPadding * 2) / 2}
              y={y - 5}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#03fb83"
            >
              ${(d.value / 1_000_000).toFixed(1)}M
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        const x = padding.left + i * barWidth + barWidth / 2;
        const y = padding.top + chartHeight + 20;
        return (
          <text key={i} x={x} y={y} textAnchor="middle" fontSize="12" fill="#888">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
