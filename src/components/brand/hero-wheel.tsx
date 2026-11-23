import { cn } from "@/lib/utils";

/**
 * Decorative line-art wheel for the hero: tire with tread + sidewall lettering, alloy rim
 * with five twin spokes, drilled brake disc and a fixed caliper. Pure SVG (no request).
 *
 * Two layers rotate ([data-wheel-rotor]): the disc behind the caliper and the rim in
 * front of it, so the caliper stays still while the spokes sweep past it, like a real wheel.
 * CSS spins them slowly from first paint; HeroMotion takes over with scroll momentum.
 */
const C = 200;

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [round(C + r * Math.sin(a)), round(C - r * Math.cos(a))];
}

const round = (n: number) => Math.round(n * 100) / 100;
const pt = (r: number, deg: number) => polar(r, deg).join(",");
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Tapered spoke from the hub face to the rim barrel, slightly flared at the rim. */
function spokePath(center: number) {
  const hub = 46;
  const rim = 134;
  return [
    `M${pt(hub, center - 4.2)}`,
    `Q${pt((hub + rim) / 2, center - 3.2)} ${pt(rim - 6, center - 2.6)}`,
    `L${pt(rim, center - 3.6)}`,
    `L${pt(rim, center + 3.6)}`,
    `L${pt(rim - 6, center + 2.6)}`,
    `Q${pt((hub + rim) / 2, center + 3.2)} ${pt(hub, center + 4.2)}`,
    "Z",
  ].join(" ");
}

/** Caliper body hugging the disc's outer edge (static). */
function caliperPath(center: number) {
  const inner = 92;
  const outer = 124;
  const half = 21;
  const [ix1, iy1] = polar(inner, center - half);
  const [ix2, iy2] = polar(inner, center + half);
  const [ox1, oy1] = polar(outer, center - half - 2);
  const [ox2, oy2] = polar(outer, center + half + 2);
  return `M${ix1},${iy1} A${inner},${inner} 0 0,1 ${ix2},${iy2} L${ox2},${oy2} A${outer},${outer} 0 0,0 ${ox1},${oy1} Z`;
}

/** Arc along radius r from angle a to b (degrees, 0 = top, clockwise). */
function arc(r: number, a: number, b: number) {
  const [x1, y1] = polar(r, a);
  const [x2, y2] = polar(r, b);
  return `M${x1},${y1} A${r},${r} 0 ${b - a > 180 ? 1 : 0},1 ${x2},${y2}`;
}

const SIDEWALL = "M200,38 a162,162 0 1,1 0,324 a162,162 0 1,1 0,-324";
const rotorStyle = { transformOrigin: "200px 200px" } as const;

export function HeroWheel({ className }: { className?: string }) {
  const spokes = range(5).flatMap((i) => [i * 72 - 7, i * 72 + 7]);
  const holes = range(30).map((i) => {
    const ring = i % 3;
    return polar(80 + ring * 11, i * 12 + ring * 4);
  });

  return (
    <svg viewBox="0 0 400 400" aria-hidden className={cn("pointer-events-none", className)} fill="none">
      <defs>
        <radialGradient id="hero-wheel-heat" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="62%" stopColor="var(--primary)" stopOpacity="0.025" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.09" />
        </radialGradient>
        <path id="hero-wheel-sidewall" d={SIDEWALL} />
        <radialGradient id="hero-wheel-rubber" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="var(--inverse-3)" />
          <stop offset="100%" stopColor="var(--inverse)" />
        </radialGradient>
      </defs>

      {/* Rubber: solid tire wall so it reads as a tire, not a wireframe */}
      <circle cx={C} cy={C} r={173} stroke="url(#hero-wheel-rubber)" strokeWidth={46} strokeOpacity={0.85} />

      {/* Tire + disc: rotates behind the caliper */}
      <g data-wheel-rotor style={rotorStyle} className="motion-safe:animate-wheel-roll">
        <g stroke="currentColor" strokeLinecap="round">
          {/* Tread */}
          <circle cx={C} cy={C} r={196} strokeWidth={2} />
          <circle cx={C} cy={C} r={184} strokeWidth={1} />
          {range(64).map((i) => {
            const a = (i * 360) / 64;
            return (
              <g key={i}>
                <line x1={polar(184, a)[0]} y1={polar(184, a)[1]} x2={polar(196, a)[0]} y2={polar(196, a)[1]} strokeWidth={1.4} />
                <line
                  x1={polar(187, a + 1.6)[0]}
                  y1={polar(187, a + 1.6)[1]}
                  x2={polar(193, a + (i % 2 ? 3.6 : 3))[0]}
                  y2={polar(193, a + (i % 2 ? 3.6 : 3))[1]}
                  strokeWidth={0.8}
                  strokeOpacity={0.7}
                />
              </g>
            );
          })}
          {/* Sidewall */}
          <circle cx={C} cy={C} r={176} strokeWidth={0.8} strokeOpacity={0.6} />
          <circle cx={C} cy={C} r={150} strokeWidth={0.8} strokeOpacity={0.6} />
        </g>
        <text
          fill="currentColor"
          fillOpacity={0.9}
          fontSize={12.5}
          fontWeight={700}
          letterSpacing={4.2}
          style={{ fontFamily: "var(--font-display)" }}
        >
          <textPath href="#hero-wheel-sidewall" startOffset="2%">
            GENUINE AUTO &amp; TRUCK PARTS
          </textPath>
          <textPath href="#hero-wheel-sidewall" startOffset="52%">
            GENUINE OEM · PHOENIX AZ
          </textPath>
        </text>

        {/* Brake disc */}
        <circle cx={C} cy={C} r={116} fill="url(#hero-wheel-heat)" />
        <g stroke="currentColor">
          <circle cx={C} cy={C} r={116} strokeWidth={1.4} />
          <circle cx={C} cy={C} r={68} strokeWidth={1} />
          <circle cx={C} cy={C} r={62} strokeWidth={0.8} strokeDasharray="1.5 4" strokeOpacity={0.7} />
          {holes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.4} strokeWidth={0.9} />
          ))}
        </g>
      </g>

      {/* Caliper: fixed, sits between disc and spokes */}
      <g>
        <path d={caliperPath(-38)} fill="var(--primary)" fillOpacity={0.16} stroke="var(--primary)" strokeOpacity={0.45} strokeWidth={1.4} strokeLinejoin="round" />
        {[-48, -28].map((a) => {
          const [x, y] = polar(108, a);
          return <circle key={a} cx={x} cy={y} r={3} stroke="var(--primary)" strokeOpacity={0.5} strokeWidth={1} />;
        })}
      </g>

      {/* Rim + spokes + hub: rotates in front of the caliper */}
      <g data-wheel-rotor style={rotorStyle} className="motion-safe:animate-wheel-roll">
        <g stroke="currentColor" strokeLinejoin="round">
          <circle cx={C} cy={C} r={146} strokeWidth={2.2} />
          <circle cx={C} cy={C} r={140} strokeWidth={1} />
          <circle cx={C} cy={C} r={134} strokeWidth={1.2} />
          {spokes.map((a) => (
            <path key={a} d={spokePath(a)} strokeWidth={1.3} fill="var(--inverse)" fillOpacity={0.55} />
          ))}
          {/* Hub */}
          <circle cx={C} cy={C} r={46} strokeWidth={1.6} fill="var(--inverse)" fillOpacity={0.7} />
          <circle cx={C} cy={C} r={38} strokeWidth={0.8} strokeOpacity={0.7} />
          {range(5).map((i) => {
            const [x, y] = polar(28, i * 72 + 36);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={5.5} strokeWidth={1.2} />
                <circle cx={x} cy={y} r={2.2} strokeWidth={0.8} />
              </g>
            );
          })}
          <circle cx={C} cy={C} r={15} strokeWidth={1.4} />
          <circle cx={C} cy={C} r={9} strokeWidth={0.8} />
          {/* Valve stem */}
          <circle cx={polar(141, 36)[0]} cy={polar(141, 36)[1]} r={2.2} strokeWidth={1} />
        </g>
      </g>
      {/* Lighting: fixed highlights from the top-left and a soft shade bottom-right, so the
          wheel looks lit while it turns underneath */}
      <g fill="none" strokeLinecap="round">
        <path d={arc(195, -78, -18)} stroke="var(--inverse-foreground)" strokeOpacity={0.22} strokeWidth={2.4} />
        <path d={arc(190, -64, -34)} stroke="var(--inverse-foreground)" strokeOpacity={0.12} strokeWidth={1.2} />
        <path d={arc(145, -70, -22)} stroke="var(--inverse-foreground)" strokeOpacity={0.26} strokeWidth={2} />
        <path d={arc(16, -80, -10)} stroke="var(--inverse-foreground)" strokeOpacity={0.22} strokeWidth={1.4} />
        <path d={arc(173, 100, 170)} stroke="var(--inverse)" strokeOpacity={0.35} strokeWidth={46} strokeLinecap="butt" />
      </g>
    </svg>
  );
}
