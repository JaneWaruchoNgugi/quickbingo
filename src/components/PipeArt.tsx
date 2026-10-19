/** Decorative SVG layers of the globe: gold ribbons around the sphere, exit pipes and the three bays. */
const VIEWBOX = '0 0 1189 1323'

const BACK = [
  { rot: -16, d: 'M188,455 A405,125 0 0 1 998,455' },
  { rot: 13, d: 'M163,585 A430,140 0 0 1 1023,585' },
]
const FRONT = [
  { rot: -16, d: 'M998,455 A405,125 0 0 1 188,455' },
  { rot: 13, d: 'M1023,585 A430,140 0 0 1 163,585' },
]

function Ribbon({ rot, d }: { rot: number; d: string }) {
  return (
    <g transform={`rotate(${rot} 593 490)`} fill="none" strokeLinecap="round">
      <path d={d} stroke="#ff4df0" strokeWidth="40" opacity=".38" filter="url(#bl)" />
      <path d={d} stroke="#2a0b57" strokeWidth="30" />
      <path d={d} stroke="url(#gold)" strokeWidth="22" />
      <path d={d} stroke="#7df9ff" strokeWidth="7" />
      <path className="flow" d={d} stroke="#fff" strokeWidth="5" strokeDasharray="60 520" opacity=".9" />
    </g>
  )
}

export function BackRibbons() {
  return (
    <svg className="pipes rib rib-b" viewBox={VIEWBOX} aria-hidden="true">
      <defs>
        <linearGradient id="gold" x1="0" x2="1">
          <stop offset="0" stopColor="#b8690b" />
          <stop offset=".35" stopColor="#ffe9a0" />
          <stop offset=".6" stopColor="#ffb02e" />
          <stop offset="1" stopColor="#a85f06" />
        </linearGradient>
        <radialGradient id="bayG" cx=".5" cy=".4" r=".7">
          <stop offset="0" stopColor="#2b1058" />
          <stop offset=".7" stopColor="#0d0522" />
          <stop offset="1" stopColor="#05010f" />
        </radialGradient>
        <filter id="bl" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="bl2">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {BACK.map(r => (
        <Ribbon key={r.rot} {...r} />
      ))}
    </svg>
  )
}

export function FrontRibbons() {
  return (
    <svg className="pipes rib rib-f" viewBox={VIEWBOX} aria-hidden="true">
      {FRONT.map(r => (
        <Ribbon key={r.rot} {...r} />
      ))}
    </svg>
  )
}

/** The three curved exit pipes; the balls follow the paths with ids pp0..pp2. */
const PIPES = [
  'M445,805 C420,880 330,930 360,990 C375,1030 430,1040 436,1075',
  'M593,835 L593,1070',
  'M741,805 C766,880 856,930 826,990 C811,1030 756,1040 752,1075',
]

export function PipeLayers() {
  return (
    <svg className="pipes pipes-b" viewBox={VIEWBOX} aria-hidden="true">
      {PIPES.map((d, i) => (
        <g key={i}>
          <path id={'pp' + i} d={d} fill="none" stroke="#ff7bf5" strokeWidth="116" strokeLinecap="round" opacity=".55" filter="url(#bl2)" />
          <path d={d} fill="none" stroke="#150636" strokeWidth="104" strokeLinecap="round" opacity=".62" />
          <path d={d} fill="none" stroke="#3ad7ff" strokeWidth="3" strokeLinecap="round" opacity=".8" transform="translate(-48 0)" />
          <path d={d} fill="none" stroke="#3ad7ff" strokeWidth="3" strokeLinecap="round" opacity=".8" transform="translate(48 0)" />
        </g>
      ))}
    </svg>
  )
}

const BAYS = [
  { cx: 436, color: '#ff3d6e' },
  { cx: 594, color: '#36d6ff' },
  { cx: 752, color: '#2dff7a' },
]

export function PipeBays() {
  return (
    <svg className="pipes pipes-f" viewBox={VIEWBOX} aria-hidden="true">
      {BAYS.map(({ cx, color }) => (
        <g key={cx}>
          <circle cx={cx} cy="1105" r="84" fill="none" stroke={color} strokeWidth="16" opacity=".6" filter="url(#bl2)" />
          <circle cx={cx} cy="1105" r="86" fill="url(#bayG)" stroke="url(#gold)" strokeWidth="13" />
          <circle cx={cx} cy="1105" r="70" fill="none" stroke={color} strokeWidth="5" />
          <circle cx={cx} cy="1105" r="95" fill="none" stroke="#ffffff55" strokeWidth="2" />
        </g>
      ))}
    </svg>
  )
}
