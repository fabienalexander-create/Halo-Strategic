// Diagrammatic roof cross-section showing the roofing structure itself (Design Bible: technical
// line illustration, navy strokes, one bronze focal point -- here the roof covering/structure
// under repair). Pure inline SVG, matching LoftCrossSection's construction.
export default function RoofingIllustration() {
  return (
    <svg
      className="industry-card-art"
      viewBox="0 0 480 380"
      role="img"
      aria-label="Cross-section of a house roof showing the roofing structure, with one section highlighted as under repair"
    >
      <g className="xs-structure" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round">
        <line x1="20" y1="340" x2="460" y2="340" stroke="var(--slate)" strokeWidth="1.5" />
        <polyline points="56,206 240,52 424,206" />
        <polyline points="88,204 240,76 392,204" strokeWidth="1.5" />
        <line x1="92" y1="206" x2="92" y2="340" />
        <line x1="388" y1="206" x2="388" y2="340" />
        <line x1="88" y1="206" x2="392" y2="206" strokeWidth="3" />
        <rect x="128" y="240" width="64" height="48" strokeWidth="1.5" />
        <line x1="160" y1="240" x2="160" y2="288" strokeWidth="1" />
        <rect x="288" y="240" width="64" height="48" strokeWidth="1.5" />
        <line x1="320" y1="240" x2="320" y2="288" strokeWidth="1" />
        {/* roof tile lines, left slope */}
        <line x1="88" y1="204" x2="140" y2="175" strokeWidth="1" opacity="0.5" />
        <line x1="100" y1="183" x2="152" y2="154" strokeWidth="1" opacity="0.5" />
        <line x1="112" y1="162" x2="164" y2="133" strokeWidth="1" opacity="0.5" />
        {/* roof tile lines, right slope */}
        <line x1="392" y1="204" x2="340" y2="175" strokeWidth="1" opacity="0.5" />
        <line x1="380" y1="183" x2="328" y2="154" strokeWidth="1" opacity="0.5" />
        <line x1="368" y1="162" x2="316" y2="133" strokeWidth="1" opacity="0.5" />
      </g>

      {/* the focal point: the section being repaired/replaced, on the right slope */}
      <g className="xs-foam">
        <polygon points="330,185 392,204 358,150 310,140" fill="none" stroke="var(--bronze)" strokeWidth="1.75" />
      </g>

      <g className="xs-labels" aria-hidden="true" fontFamily="'IBM Plex Mono', monospace" fontSize="14" letterSpacing="0.06em">
        <polyline points="345,172 395,150 435,150" fill="none" stroke="var(--bronze)" strokeWidth="1.25" />
        <circle cx="345" cy="172" r="3.5" fill="var(--bronze)" />
        <text x="435" y="140" textAnchor="end" fill="var(--navy-deep)" fontWeight="500">ROOF WORK</text>
        <text x="240" y="178" textAnchor="middle" fill="var(--slate)">LOFT SPACE</text>
        <text x="240" y="318" textAnchor="middle" fill="var(--slate)">LIVING SPACE</text>
      </g>
    </svg>
  );
}
