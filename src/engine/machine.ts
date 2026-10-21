import { LITE, rimOf, letterOf, rnd } from '../game/constants'

export interface Ball {
  n: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** position before the last physics step, for interpolated drawing */
  px?: number
  py?: number
  pz?: number
  /** slowly drifting random push, so balls tumble instead of jittering */
  wx?: number
  wy?: number
  wz?: number
  gone?: boolean
  pick?: Pick
}

interface Pick {
  t0?: number
  /** 0..1 progress towards the exit; the ball shrinks as it enters the pipe */
  k: number
  sx?: number
  sy?: number
  ex: number
  ey: number
  cb?: () => void
}

/** Physics state shared between the game (which asks for balls) and the canvas renderer. */
export class MachineState {
  balls: Ball[] = []
  /** true while the whirlwind is running */
  busy = false

  constructor() {
    this.reset()
  }

  reset() {
    this.balls = Array.from({ length: 85 }, (_, i) => ({
      n: i < 75 ? i + 1 : 1 + rnd(75),
      x: (Math.random() - 0.5) * 400,
      y: 60 + Math.random() * 180,
      z: (Math.random() - 0.5) * 400,
      vx: Math.random() * 4 - 2,
      vy: Math.random() * 4 - 2,
      vz: Math.random() * 4 - 2,
    }))
  }

  /**
   * Draw ball `n` out of the swirl into the pipe mouth at (`ex`, `ey`) in machine units (screen
   * space, unrotated); `cb` fires when it has entered the pipe.
   */
  pick(n: number, cb: () => void, ex = 0, ey = R * 0.92) {
    let b = this.balls.find(x => x.n === n && !x.pick && !x.gone)
    if (!b) {
      b = { n, x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0 }
      this.balls.push(b)
    }
    b.pick = { k: 0, cb, ex, ey }
  }

  remove(n: number) {
    const k = this.balls.findIndex(b => b.n === n)
    if (k >= 0) this.balls.splice(k, 1)
  }
}

const W = 640
const R = 300
const BR = 46
/** Machine units → globe viewBox units (canvas is 772.4 viewBox units wide, see 02-panels.css). */
export const UNIT_VB = ((W / 2 - 24) / R) * (772.4 / W)
/** Fixed physics step: motion is the same on 60 Hz and 120 Hz screens. */
const STEP = 1000 / 60
/** Scale of a picked ball when it reaches the pipe mouth (matches the pipe ball). */
export const PICK_SCALE = 0.55
export const PICK_MS = 750

const mix = (h: string, t: number) => {
  const n = parseInt(h.slice(1), 16)
  const r = n >> 16
  const g = (n >> 8) & 255
  const bl = n & 255
  const k = t < 0 ? 0 : 255
  const a = Math.abs(t)
  return `rgb(${Math.round(r + (k - r) * a)},${Math.round(g + (k - g) * a)},${Math.round(bl + (k - bl) * a)})`
}

/** Largest on-canvas ball radius (a front ball, f = 1.08); sprites are drawn at this size and only ever scaled down. */
const SPR_R = Math.ceil(BR * 1.08)
/** Half the sprite's side, in ball radii: room for the ground shadow under the ball. */
const SPR_PAD = 1.2

/**
 * Paints ball `n` of radius `r` centred on (X, Y). Painting a ball takes five gradients and two
 * text runs, far too much to repeat for 85 balls every frame, so it is done once per number into
 * a sprite (see `sprite`) and the frame loop only copies the sprites.
 */
function paintBall(c: CanvasRenderingContext2D, n: number, X: number, Y: number, r: number) {
  const rm = rimOf(n)
  const c0 = rm[0]
  const c1 = rm[1]
  // ground shadow
  c.fillStyle = 'rgba(0,0,0,.28)'
  c.beginPath()
  c.ellipse(X + r * 0.08, Y + r * 0.98, r * 0.75, r * 0.16, 0, 0, 7)
  c.fill()
  // body
  const g = c.createRadialGradient(X - r * 0.35, Y - r * 0.4, r * 0.05, X, Y, r)
  g.addColorStop(0, mix(c0, 0.6))
  g.addColorStop(0.32, mix(c0, 0.12))
  g.addColorStop(0.8, mix(c1, -0.18))
  g.addColorStop(1, mix(c1, -0.45))
  c.fillStyle = g
  c.beginPath()
  c.arc(X, Y, r, 0, 7)
  c.fill()
  if (c.createConicGradient) {
    const cg = c.createConicGradient(0.6, X, Y)
    cg.addColorStop(0, 'rgba(255,255,255,.28)')
    cg.addColorStop(0.3, 'rgba(255,255,255,0)')
    cg.addColorStop(0.6, 'rgba(255,255,255,.18)')
    cg.addColorStop(1, 'rgba(255,255,255,.28)')
    c.fillStyle = cg
    c.beginPath()
    c.arc(X, Y, r, 0, 7)
    c.fill()
  }
  const rg2 = c.createRadialGradient(X + r * 0.45, Y + r * 0.55, r * 0.1, X + r * 0.45, Y + r * 0.55, r * 0.75)
  rg2.addColorStop(0, mix(c0, 0.45))
  rg2.addColorStop(1, 'rgba(255,255,255,0)')
  c.globalAlpha = 0.45
  c.fillStyle = rg2
  c.beginPath()
  c.arc(X, Y, r, 0, 7)
  c.fill()
  c.globalAlpha = 1
  // label disc
  const lr = r * 0.64
  c.fillStyle = 'rgba(0,0,0,.3)'
  c.beginPath()
  c.arc(X, Y + r * 0.03, lr * 1.05, 0, 7)
  c.fill()
  const dg = c.createRadialGradient(X - lr * 0.2, Y - lr * 0.3, lr * 0.05, X, Y, lr)
  dg.addColorStop(0, '#ffffff')
  dg.addColorStop(0.75, '#f8f9ff')
  dg.addColorStop(1, '#d9e0f2')
  c.fillStyle = dg
  c.beginPath()
  c.arc(X, Y, lr, 0, 7)
  c.fill()
  c.strokeStyle = mix(c0, -0.2)
  c.lineWidth = Math.max(1, r * 0.05)
  c.stroke()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#17184a'
  c.font = `800 ${r * 0.34}px Rubik,system-ui,sans-serif`
  c.fillText(letterOf(n), X, Y - r * 0.36)
  c.font = `800 ${r * 0.44}px Rubik,system-ui,sans-serif`
  c.fillText(String(n), X, Y + r * 0.17)
  // highlights
  c.save()
  c.translate(X - r * 0.42, Y - r * 0.62)
  c.rotate(-0.55)
  const hg = c.createLinearGradient(0, -r * 0.14, 0, r * 0.14)
  hg.addColorStop(0, 'rgba(255,255,255,.95)')
  hg.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = hg
  c.beginPath()
  c.ellipse(0, 0, r * 0.3, r * 0.12, 0, 0, 7)
  c.fill()
  c.restore()
  c.fillStyle = 'rgba(255,255,255,.9)'
  c.beginPath()
  c.arc(X - r * 0.58, Y - r * 0.5, r * 0.07, 0, 7)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,.35)'
  c.lineWidth = Math.max(1, r * 0.045)
  c.beginPath()
  c.arc(X, Y, r * 0.95, Math.PI * 0.15, Math.PI * 0.55)
  c.stroke()
}

const sprites = new Map<number, HTMLCanvasElement>()
// a sprite painted before the web font arrived would keep the fallback font
document.fonts?.addEventListener?.('loadingdone', () => sprites.clear())

/** The cached picture of ball `n` at radius SPR_R, centred in a square of side 2 * SPR_PAD * SPR_R. */
function sprite(n: number) {
  let s = sprites.get(n)
  if (!s) {
    s = document.createElement('canvas')
    s.width = s.height = Math.ceil(2 * SPR_PAD * SPR_R)
    const half = s.width / 2
    paintBall(s.getContext('2d')!, n, half, half, SPR_R)
    sprites.set(n, s)
  }
  return s
}

/** Starts the canvas loop. Returns a function that stops it. */
export function startMachine(cv: HTMLCanvasElement, ms: MachineState): () => void {
  const c = cv.getContext('2d')!
  let ang = 0
  let last = performance.now()
  let acc = 0
  let power = 0
  let raf = 0
  const reduce = matchMedia('(prefers-reduced-motion:reduce)')
  // a busy phone may drop the canvas memory; the cached ball pictures go with it, so repaint them
  const restore = () => sprites.clear()
  cv.addEventListener('contextrestored', restore)
  // glass highlight over the whole sphere; it never changes, so it is built once
  const hl = c.createRadialGradient(W * 0.3, W * 0.24, 10, W * 0.3, W * 0.24, W * 0.4)
  hl.addColorStop(0, 'rgba(255,255,255,.22)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')

  function physics(red: boolean) {
    const bs = ms.balls
    // the air jet spins up and down smoothly instead of switching on and off
    power += ((ms.busy ? 1 : 0) - power) * (1 - Math.exp(-STEP / 380))
    const sw = 0.1 + power * 0.42
    const lift = 0.16 + power * 0.95
    const jig = 0.5 + power * 0.7
    bs.forEach(b => {
      b.px = b.x
      b.py = b.y
      b.pz = b.z
      if (b.gone || b.pick) return
      b.wx = ((b.wx ?? 0) + (Math.random() - 0.5) * 0.3) * 0.9
      b.wy = ((b.wy ?? 0) + (Math.random() - 0.5) * 0.3) * 0.9
      b.wz = ((b.wz ?? 0) + (Math.random() - 0.5) * 0.3) * 0.9
      const r = Math.hypot(b.x, b.z) || 1
      const tx = -b.z / r
      const tz = b.x / r
      b.vx += tx * sw * (0.4 + r / R) + b.wx * jig
      b.vz += tz * sw * (0.4 + r / R) + b.wz * jig
      b.vy += 0.24 + b.wy * jig
      if (r < 170 && b.y > -90) b.vy -= lift * (1.15 - r / 170)
      if (r > 110) {
        b.vx -= (b.x / r) * sw * 0.5
        b.vz -= (b.z / r) * sw * 0.5
      }
      b.vx *= 0.985
      b.vy *= 0.985
      b.vz *= 0.985
      const sp = Math.hypot(b.vx, b.vy, b.vz)
      const mx = 9
      if (sp > mx) {
        b.vx *= mx / sp
        b.vy *= mx / sp
        b.vz *= mx / sp
      }
      if (!red) {
        b.x += b.vx
        b.y += b.vy
        b.z += b.vz
      }
      const d = Math.hypot(b.x, b.y, b.z)
      const lim = R - BR
      if (d > lim) {
        const q = lim / d
        b.x *= q
        b.y *= q
        b.z *= q
        const nx = b.x / lim
        const ny = b.y / lim
        const nz = b.z / lim
        const dot = b.vx * nx + b.vy * ny + b.vz * nz
        if (dot > 0) {
          b.vx -= 1.5 * dot * nx
          b.vy -= 1.5 * dot * ny
          b.vz -= 1.5 * dot * nz
        }
      }
    })

    for (let it = 0; it < 2; it++)
      for (let i = 0; i < bs.length; i++)
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i]
          const b = bs[j]
          if (a.pick || b.pick || a.gone || b.gone) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dz = b.z - a.z
          const d2 = dx * dx + dy * dy + dz * dz
          const md = BR * 1.85
          if (d2 < md * md && d2 > 0.0001) {
            const d = Math.sqrt(d2)
            const nx = dx / d
            const ny = dy / d
            const nz = dz / d
            const o = (md - d) / 2
            a.x -= nx * o
            a.y -= ny * o
            a.z -= nz * o
            b.x += nx * o
            b.y += ny * o
            b.z += nz * o
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz
            if (rv < 0) {
              const im = -rv * 0.8
              a.vx -= nx * im
              a.vy -= ny * im
              a.vz -= nz * im
              b.vx += nx * im
              b.vy += ny * im
              b.vz += nz * im
            }
          }
        }

    ang += 0.012
  }

  /** A picked ball glides (in screen space) to its pipe mouth, speeding up as the pipe sucks it in. */
  function pickMove(b: Ball, now: number, ca: number, sa: number) {
    const p = b.pick!
    if (p.t0 === undefined) {
      p.t0 = now
      p.sx = b.x * ca + b.z * sa
      p.sy = b.y
    }
    const k = Math.min(1, (now - p.t0) / PICK_MS)
    const ex = k * k * (3 - 2 * k)
    const ey = k * k * (2 - k)
    // a small sideways wobble while it is lifted out of the pile
    const wob = Math.sin(k * Math.PI * 2) * (1 - k) * 10
    b.x = p.sx! + (p.ex - p.sx!) * ex + wob
    b.y = p.sy! + (p.ey - p.sy!) * ey
    b.z = 0
    b.px = b.x
    b.py = b.y
    b.pz = 0
    p.k = k
    if (k >= 1) {
      const cb = p.cb
      b.pick = undefined
      b.gone = true
      cb && cb()
    }
  }

  // phones draw the machine at 30 fps; physics runs on a fixed step, so the motion is unchanged
  const minGap = LITE ? 1000 / 30 - 2 : 0
  let drawn = 0
  // nothing is drawn while the machine is scrolled out of view
  let onScreen = true
  const io = new IntersectionObserver(es => (onScreen = es[0].isIntersecting))
  io.observe(cv)

  function frame() {
    const nw = performance.now()
    if (!onScreen || nw - drawn < minGap) {
      // keep the clock running so the balls don't jump when drawing resumes
      if (!onScreen) {
        ms.balls.forEach(b => b.pick && !b.gone && pickMove(b, nw, Math.cos(ang), Math.sin(ang)))
        last = nw
      }
      raf = requestAnimationFrame(frame)
      return
    }
    drawn = nw
    acc += Math.min(100, nw - last)
    last = nw
    const red = reduce.matches
    let steps = 0
    while (acc >= STEP && steps++ < 5) {
      physics(red)
      acc -= STEP
    }
    if (acc > STEP) acc = 0
    // draw between the last two physics states so motion stays smooth at any frame rate
    const al = acc / STEP
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    ms.balls.forEach(b => b.pick && !b.gone && pickMove(b, nw, ca, sa))
    c.clearRect(0, 0, W, W)
    const pr = ms.balls
      .filter(b => !b.gone)
      .map(b => {
        const bx = (b.px ?? b.x) + (b.x - (b.px ?? b.x)) * al
        const by = (b.py ?? b.y) + (b.y - (b.py ?? b.y)) * al
        const bz = (b.pz ?? b.z) + (b.z - (b.pz ?? b.z)) * al
        // picked balls already live in screen space
        const x = b.pick ? bx : bx * ca + bz * sa
        const z = b.pick ? R : -bx * sa + bz * ca
        const f = b.pick ? 1 : 0.88 + 0.2 * ((z + R) / (2 * R))
        return { b, x: W / 2 + ((x * (W / 2 - 24)) / R) * f, y: W / 2 + ((by * (W / 2 - 24)) / R) * f, z: b.pick ? 1e4 : z, s: f }
      })
      .sort((p, q) => p.z - q.z)

    pr.forEach(p => {
      const r = BR * p.s * (p.b.pick ? 1 - (1 - PICK_SCALE) * p.b.pick.k : 1)
      const h = SPR_PAD * r
      c.drawImage(sprite(p.b.n), p.x - h, p.y - h, 2 * h, 2 * h)
    })
    c.fillStyle = hl
    c.beginPath()
    c.arc(W / 2, W / 2, W / 2, 0, 7)
    c.fill()
    raf = requestAnimationFrame(frame)
  }
  frame()
  return () => {
    cancelAnimationFrame(raf)
    io.disconnect()
    cv.removeEventListener('contextrestored', restore)
  }
}
