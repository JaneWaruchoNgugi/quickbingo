import { memo } from 'react'

/** Decorative SVG layers of the globe: gold ribbons around the sphere, six exit pipes and their holes. */
export const VB_W = 1189
export const VB_H = 1323
const VIEWBOX = `0 0 ${VB_W} ${VB_H}`

/** The glass sphere in viewBox units; CSS in 02-panels.css places the canvas and glass to match. */
export const GLOBE = { cx: 593, cy: 470, r: 400 }
/** Ribbons were drawn for a sphere of radius 345 centred at (593, 490). */
const RIB_FIT = `translate(${GLOBE.cx} ${GLOBE.cy}) scale(${GLOBE.r / 345}) translate(-593 -490)`

const BACK = [
  { rot: -16, d: 'M188,455 A405,125 0 0 1 998,455' },
  { rot: 13, d: 'M163,585 A430,140 0 0 1 1023,585' },
]
const FRONT = [
  { rot: -16, d: 'M998,455 A405,125 0 0 1 188,455' },
  { rot: 13, d: 'M1023,585 A430,140 0 0 1 163,585' },
]

/** A ribbon band; `glow` adds the blurred halo under it. */
function Ribbon({ rot, d, glow = true }: { rot: number; d: string; glow?: boolean }) {
  return (
    <g transform={`${RIB_FIT} rotate(${rot} 593 490)`} fill="none" strokeLinecap="round">
      {glow && <path d={d} stroke="#ff4df0" strokeWidth="40" opacity=".38" filter="url(#bl)" />}
      <path d={d} stroke="#2a0b57" strokeWidth="30" />
      <path d={d} stroke="url(#gold)" strokeWidth="22" />
      <path d={d} stroke="#7df9ff" strokeWidth="7" />
    </g>
  )
}

function RibbonFlow({ rot, d }: { rot: number; d: string }) {
  return (
    <g transform={`${RIB_FIT} rotate(${rot} 593 490)`} fill="none" strokeLinecap="round">
      <path className="flow" d={d} stroke="#fff" strokeWidth="5" strokeDasharray="60 520" opacity=".9" />
    </g>
  )
}

/**
 * The light running along the ribbons, in an SVG of its own: an animated dash in the same SVG as
 * the blurred glows makes the browser redo the blurs every frame. The second band is drawn again
 * (without its glow) between the two dashes, so the first dash still passes under it.
 */
function RibbonFlows({ set, cls }: { set: typeof BACK; cls: string }) {
  return (
    <svg className={'pipes rib flows ' + cls} viewBox={VIEWBOX} aria-hidden="true">
      <RibbonFlow {...set[0]} />
      <Ribbon {...set[1]} glow={false} />
      <RibbonFlow {...set[1]} />
    </svg>
  )
}

export const BackRibbons = memo(function BackRibbons() {
  return (
    <>
      <svg className="pipes rib rib-b" viewBox={VIEWBOX} aria-hidden="true">
        <defs>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0" stopColor="#b8690b" />
            <stop offset=".35" stopColor="#ffe9a0" />
            <stop offset=".6" stopColor="#ffb02e" />
            <stop offset="1" stopColor="#a85f06" />
          </linearGradient>
          <linearGradient id="goldC" x1="0" x2="1">
            <stop offset="0" stopColor="#6b3a04" />
            <stop offset=".18" stopColor="#c9850f" />
            <stop offset=".4" stopColor="#fff1b8" />
            <stop offset=".62" stopColor="#f0a828" />
            <stop offset=".88" stopColor="#8a4f06" />
            <stop offset="1" stopColor="#4a2702" />
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
      <RibbonFlows set={BACK} cls="rib-b" />
    </>
  )
})

export const FrontRibbons = memo(function FrontRibbons() {
  return (
    <>
      <svg className="pipes rib rib-f" viewBox={VIEWBOX} aria-hidden="true">
        {FRONT.map(r => (
          <Ribbon key={r.rot} {...r} />
        ))}
      </svg>
      <RibbonFlows set={FRONT} cls="rib-f" />
    </>
  )
})

/** Six pipes fan out from the bottom of the sphere and drop into a row of holes on the podium. */
const HOLE_Y = 1130
const HOLE_R = 70
const COLLAR_Y = 1046
const HOLE_COLORS = ['#ff3df0', '#ff2d55', '#ffc21a', '#2dff7a', '#36d6ff', '#a64dff']

export const PIPES = HOLE_COLORS.map((color, i) => {
  const dx = (i - 2.5) * 116
  const xt = GLOBE.cx + dx
  const yt = 800 - 60 * (dx / 290) ** 2
  const xb = GLOBE.cx + (i - 2.5) * 165
  const h = COLLAR_Y - yt
  const c1 = { x: xt + dx * 0.22, y: yt + h * 0.42 }
  const tube = `M${xt},${yt} C${c1.x},${c1.y} ${xb},${COLLAR_Y - h * 0.5} ${xb},${HOLE_Y - HOLE_R + 6}`
  return {
    color,
    tube,
    /** the path a ball rides: the tube plus a short drop into the hole */
    ride: `${tube} L${xb},${HOLE_Y - 24}`,
    top: { x: xt, y: yt, tilt: (Math.atan2(c1.x - xt, c1.y - yt) * 180) / Math.PI },
    hole: { x: xb, y: HOLE_Y },
  }
})

function Collar({ x, y, tilt = 0, w = 88 }: { x: number; y: number; tilt?: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${-tilt})`}>
      <rect x={-w / 2 - 4} y="-30" width={w + 8} height="20" rx="7" fill="url(#goldC)" />
      <rect x={-w / 2} y="-12" width={w} height="40" rx="6" fill="url(#goldC)" />
      <rect x={-w / 2} y="2" width={w} height="6" fill="#36d6ff" opacity=".9" />
      <rect x={-w / 2} y="2" width={w} height="6" fill="#7df9ff" filter="url(#bl2)" />
      <rect x={-w / 2} y="-12" width={w} height="3" fill="#4a2702" opacity=".55" />
    </g>
  )
}

export const PipeLayers = memo(function PipeLayers() {
  return (
    <>
      <svg className="pipes pipes-b" viewBox={VIEWBOX} aria-hidden="true">
        {PIPES.map(({ tube, ride }, i) => (
          <g key={i} fill="none" strokeLinecap="round">
            <path id={'pp' + i} d={ride} stroke="none" />
            <path d={tube} stroke="#36d6ff" strokeWidth="88" opacity=".26" filter="url(#bl)" />
            <path d={tube} stroke="#c8f6ff" strokeWidth="70" opacity=".55" />
            <path d={tube} stroke="#14236e" strokeWidth="62" opacity=".78" />
            <path d={tube} stroke="#36d6ff" strokeWidth="28" opacity=".4" filter="url(#bl2)" />
            <path d={tube} stroke="#7df9ff" strokeWidth="9" opacity=".85" />
          </g>
        ))}
      </svg>
      {/* the running light, kept apart from the blurred glows (see RibbonFlows) */}
      <svg className="pipes pipes-b flows" viewBox={VIEWBOX} aria-hidden="true">
        {PIPES.map(({ tube }, i) => (
          <path key={i} className="flow" d={tube} fill="none" strokeLinecap="round" stroke="#fff" strokeWidth="5" strokeDasharray="34 260" opacity=".9" />
        ))}
      </svg>
    </>
  )
})

/** Front layer, above the riding balls: glass sheen on the tubes, gold collars and the holes. */
export const PipeBays = memo(function PipeBays() {
  return (
    <svg className="pipes pipes-f" viewBox={VIEWBOX} aria-hidden="true">
      {PIPES.map(({ tube, top, hole, color }, i) => (
        <g key={i}>
          <path d={tube} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".5" transform="translate(-19 0)" />
          <path d={tube} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".3" transform="translate(20 0)" />
          <Collar x={top.x} y={top.y} tilt={top.tilt} />
          <rect x={hole.x - 52} y={COLLAR_Y} width="104" height={hole.y - COLLAR_Y} fill="url(#goldC)" />
          <Collar x={hole.x} y={COLLAR_Y} w={92} />
          <circle cx={hole.x + 7} cy={hole.y + 6} r={HOLE_R + 6} fill="#5a3205" />
          <circle cx={hole.x} cy={hole.y} r={HOLE_R + 4} fill="none" stroke={color} strokeWidth="16" opacity=".5" filter="url(#bl2)" />
          <circle cx={hole.x} cy={hole.y} r={HOLE_R} fill="url(#bayG)" stroke="url(#gold)" strokeWidth="15" />
          <circle cx={hole.x} cy={hole.y} r={HOLE_R - 17} fill={color} opacity=".14" />
          <circle cx={hole.x} cy={hole.y} r={HOLE_R - 16} fill="none" stroke={color} strokeWidth="10" opacity=".7" filter="url(#bl2)" />
          <circle cx={hole.x} cy={hole.y} r={HOLE_R - 16} fill="none" stroke={color} strokeWidth="5" />
          <circle cx={hole.x} cy={hole.y} r={HOLE_R + 8} fill="none" stroke="#ffffff55" strokeWidth="2" />
        </g>
      ))}
    </svg>
  )
})
