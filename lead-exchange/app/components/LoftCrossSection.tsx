// Diagrammatic house cross-section for the homepage hero (Design Bible: technical line
// illustration, navy strokes, one bronze focal point = the spray foam). Pure inline SVG,
// no images, no dependencies. Decorative detail is aria-hidden; the svg carries one label.
export default function LoftCrossSection() {
  return (
    <svg
      className="loft-xsection"
      viewBox="0 0 480 380"
      role="img"
      aria-label="Cross-section of a house showing spray foam insulation applied to the underside of the roof in the loft space"
    >
      <defs>
        <pattern id="foam-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--bronze)" strokeWidth="1.5" opacity="0.55" />
        </pattern>
      </defs>

      <g className="xs-structure" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round">
        {/* ground */}
        <line x1="20" y1="340" x2="460" y2="340" stroke="var(--slate)" strokeWidth="1.5" />
        {/* roof outer + rafters */}
        <polyline points="56,206 240,52 424,206" />
        <polyline points="88,204 240,76 392,204" strokeWidth="1.5" />
        {/* walls */}
        <line x1="92" y1="206" x2="92" y2="340" />
        <line x1="388" y1="206" x2="388" y2="340" />
        {/* loft floor / ceiling joists */}
        <line x1="88" y1="206" x2="392" y2="206" strokeWidth="3" />
        {/* loft hatch */}
        <rect x="300" y="203" width="40" height="6" fill="var(--paper)" strokeWidth="1.5" />
        {/* ground-floor ceiling line split into two rooms */}
        <line x1="240" y1="206" x2="240" y2="340" strokeWidth="1.5" strokeDasharray="4 5" stroke="var(--slate)" />
        {/* windows */}
        <rect x="128" y="240" width="64" height="48" strokeWidth="1.5" />
        <line x1="160" y1="240" x2="160" y2="288" strokeWidth="1" />
        <rect x="288" y="240" width="64" height="48" strokeWidth="1.5" />
        <line x1="320" y1="240" x2="320" y2="288" strokeWidth="1" />
        {/* chimney */}
        <polyline points="318,118 318,74 348,74 348,143" strokeWidth="1.5" />
      </g>

      {/* the focal point: foam applied to the underside of the rafters */}
      <g className="xs-foam">
        <polygon points="88,204 240,76 240,102 122,204" fill="url(#foam-hatch)" stroke="var(--bronze)" strokeWidth="1.5" />
        <polygon points="392,204 240,76 240,102 358,204" fill="url(#foam-hatch)" stroke="var(--bronze)" strokeWidth="1.5" />
      </g>

      <g className="xs-labels" aria-hidden="true" fontFamily="'IBM Plex Mono', monospace" fontSize="14" letterSpacing="0.06em">
        {/* leader line to foam */}
        <polyline points="152,158 112,120 34,120" fill="none" stroke="var(--bronze)" strokeWidth="1.25" />
        <circle cx="152" cy="158" r="3.5" fill="var(--bronze)" />
        <text x="34" y="110" fill="var(--navy-deep)" fontWeight="500">SPRAY FOAM</text>
        <text x="240" y="178" textAnchor="middle" fill="var(--slate)">LOFT SPACE</text>
        <text x="240" y="318" textAnchor="middle" fill="var(--slate)">LIVING SPACE</text>
      </g>
    </svg>
  );
}
