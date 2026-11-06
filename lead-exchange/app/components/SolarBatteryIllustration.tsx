// Diagrammatic house with roof-mounted solar panels and a wall-mounted battery (Design Bible:
// technical line illustration, navy strokes, one bronze focal point — here the panels + battery).
// Pure inline SVG, matching LoftCrossSection's construction, sized for the homepage industry card.
export default function SolarBatteryIllustration() {
  return (
    <svg
      className="industry-card-art"
      viewBox="0 0 480 380"
      role="img"
      aria-label="House with solar panels mounted on the roof and a battery storage unit on the outside wall"
    >
      <g className="xs-structure" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round">
        <line x1="20" y1="340" x2="460" y2="340" stroke="var(--slate)" strokeWidth="1.5" />
        <polyline points="56,206 240,52 424,206" />
        <line x1="92" y1="206" x2="92" y2="340" />
        <line x1="388" y1="206" x2="388" y2="340" />
        <rect x="128" y="240" width="64" height="48" strokeWidth="1.5" />
        <line x1="160" y1="240" x2="160" y2="288" strokeWidth="1" />
        <rect x="288" y="240" width="64" height="48" strokeWidth="1.5" />
        <line x1="320" y1="240" x2="320" y2="288" strokeWidth="1" />
        {/* battery unit on the outer wall */}
        <rect x="396" y="286" width="34" height="54" strokeWidth="1.5" fill="var(--paper)" />
        <line x1="406" y1="298" x2="420" y2="298" strokeWidth="1.25" />
        <line x1="406" y1="308" x2="420" y2="308" strokeWidth="1.25" />
        <line x1="406" y1="318" x2="420" y2="318" strokeWidth="1.25" />
      </g>

      {/* the focal point: solar panels on the roof */}
      <g className="xs-foam">
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={108 + i * 58}
            y={118 - i * 24}
            width="52"
            height="30"
            transform={`skewY(-27) translate(${i * 2}, 0)`}
            fill="none"
            stroke="var(--bronze)"
            strokeWidth="1.5"
          />
        ))}
      </g>

      <g className="xs-labels" aria-hidden="true" fontFamily="'IBM Plex Mono', monospace" fontSize="14" letterSpacing="0.06em">
        <polyline points="200,110 150,90 60,90" fill="none" stroke="var(--bronze)" strokeWidth="1.25" />
        <circle cx="200" cy="110" r="3.5" fill="var(--bronze)" />
        <text x="60" y="80" fill="var(--navy-deep)" fontWeight="500">SOLAR PANELS</text>
        <polyline points="413,286 413,260 340,260" fill="none" stroke="var(--bronze)" strokeWidth="1.25" />
        <circle cx="413" cy="286" r="3.5" fill="var(--bronze)" />
        <text x="236" y="265" textAnchor="end" fill="var(--navy-deep)" fontWeight="500">BATTERY</text>
        <text x="240" y="318" textAnchor="middle" fill="var(--slate)">LIVING SPACE</text>
      </g>
    </svg>
  );
}
