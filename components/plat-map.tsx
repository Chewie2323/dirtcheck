import { ppa } from "@/lib/format";

export function PlatMap({
  subject,
  comps,
}: {
  subject: string;
  comps: { id: string; label: string; distanceMiles: number; pricePerAcre: number; kept: boolean }[];
}) {
  const width = 640;
  const height = 420;
  const cx = 320;
  const cy = 210;
  const maxDistance = Math.max(3, ...comps.map((comp) => comp.distanceMiles), 1);
  const placed = comps.map((comp, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(comps.length, 1);
    const radius = 36 + (comp.distanceMiles / maxDistance) * 150;
    return {
      ...comp,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.86,
    };
  });

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-[#f4f6f8]">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Schematic plat of the subject and comps" className="h-auto w-full">
        <rect width={width} height={height} fill="#f4f6f8" />
        {[0.33, 0.66, 1].map((ring) => (
          <ellipse
            key={ring}
            cx={cx}
            cy={cy}
            rx={36 + ring * 150}
            ry={(36 + ring * 150) * 0.86}
            fill="none"
            stroke="#d5dde5"
            strokeDasharray="3 4"
          />
        ))}
        <text x={cx + 168} y={cy - 8} fill="#566472" fontSize="11">
          farther
        </text>
        {placed.map((comp) => (
          <g key={comp.id}>
            <line x1={cx} y1={cy} x2={comp.x} y2={comp.y} stroke={comp.kept ? "#1f4e79" : "#b8c4d0"} strokeWidth="1" />
            <circle cx={comp.x} cy={comp.y} r={comp.kept ? 7 : 5} fill={comp.kept ? "#1f4e79" : "#c0392b"} opacity={comp.kept ? 1 : 0.45} />
            <text x={comp.x + 10} y={comp.y - 8} fill="#18222d" fontSize="11">
              {comp.kept ? ppa(comp.pricePerAcre) : "out"}
            </text>
            <text x={comp.x + 10} y={comp.y + 6} fill="#566472" fontSize="10">
              {comp.distanceMiles.toFixed(1)} mi
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r="8" fill="#e2a33b" stroke="#18222d" strokeWidth="1.5" />
        <text x={cx + 12} y={cy + 4} fill="#18222d" fontSize="12" fontWeight="600">
          Subject
        </text>
      </svg>
      <figcaption className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">
        Schematic plat for {subject}. Rings show relative distance only. This is not a survey, parcel map, or GIS exhibit.
      </figcaption>
    </figure>
  );
}
