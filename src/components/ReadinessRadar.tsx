interface ReadinessRadarProps {
  academic: number;
  technicalSkills: number;
  projects: number;
  interviewPrep: number;
}

export function ReadinessRadar({
  academic,
  technicalSkills,
  projects,
  interviewPrep,
}: ReadinessRadarProps) {
  const cx = 150;
  const cy = 128;
  const maxR = 82;

  const axes = [
    { label: "Assessments", value: academic, angleDeg: -90 },
    { label: "Skills & Coding", value: technicalSkills, angleDeg: 0 },
    { label: "Projects", value: projects, angleDeg: 90 },
    { label: "Interview", value: interviewPrep, angleDeg: 180 },
  ];

  const pointAt = (valuePct: number, angleDeg: number) => {
    const r = (Math.max(0, Math.min(100, valuePct)) / 100) * maxR;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const rings = [25, 50, 75, 100];
  const studentPolygon = axes
    .map((a) => {
      const p = pointAt(a.value, a.angleDeg);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  const targetPolygon = axes
    .map((a) => {
      const p = pointAt(80, a.angleDeg);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 300 264"
        className="w-full max-w-[280px] h-auto"
        role="img"
        aria-label="4-pillar student readiness radar chart"
      >
        {rings.map((ring) => {
          const pts = axes
            .map((a) => {
              const p = pointAt(ring, a.angleDeg);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke="currentColor"
              className="text-sage-200 dark:text-pine-800"
              strokeWidth="1"
            />
          );
        })}

        {axes.map((a) => {
          const outer = pointAt(100, a.angleDeg);
          return (
            <line
              key={a.label}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="currentColor"
              className="text-sage-200 dark:text-pine-800"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={targetPolygon}
          fill="#d98254"
          fillOpacity="0.12"
          stroke="#d98254"
          strokeWidth="1.25"
          strokeDasharray="4 3"
        />

        <polygon
          points={studentPolygon}
          fill="#0f4c45"
          fillOpacity="0.22"
          stroke="#0f4c45"
          strokeWidth="2.25"
        />

        {axes.map((a) => {
          const pt = pointAt(a.value, a.angleDeg);
          return (
            <circle
              key={a.label}
              cx={pt.x}
              cy={pt.y}
              r="4"
              fill="#0f4c45"
              stroke="#faf2e3"
              strokeWidth="1.5"
            />
          );
        })}

        <text
          x={cx}
          y={20}
          textAnchor="middle"
          className="fill-[#0f2622] dark:fill-cream-50 text-[11px] font-semibold"
        >
          Assessments ({academic}%)
        </text>
        <text
          x={cx + maxR + 10}
          y={cy + 4}
          textAnchor="start"
          className="fill-[#0f2622] dark:fill-cream-50 text-[11px] font-semibold"
        >
          Skills ({technicalSkills}%)
        </text>
        <text
          x={cx}
          y={cy + maxR + 24}
          textAnchor="middle"
          className="fill-[#0f2622] dark:fill-cream-50 text-[11px] font-semibold"
        >
          Projects ({projects}%)
        </text>
        <text
          x={cx - maxR - 10}
          y={cy + 4}
          textAnchor="end"
          className="fill-[#0f2622] dark:fill-cream-50 text-[11px] font-semibold"
        >
          Interview ({interviewPrep}%)
        </text>
      </svg>

      <div className="flex items-center gap-4 text-[11px] text-[#4b6058] dark:text-[#9eb4ab] mt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-pine-700 inline-block" />
          Current Student
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-ochre-500 inline-block" />
          80% Target Benchmark
        </span>
      </div>
    </div>
  );
}
