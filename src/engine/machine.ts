import { rimOf, letterOf, rnd } from '../game/constants'

export interface Ball {
  n: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  gone?: boolean
  pick?: { t: number; t0?: number; k: number; cb?: () => void; ex: number }
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

  /** Lift ball `n` out of the swirl towards the exit; `cb` fires when it reaches the top. */
  pick(n: number, cb: () => void, ex = 0) {
    let b = this.balls.find(x => x.n === n && !x.pick)
    if (!b) {
      b = { n, x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0 }
      this.balls.push(b)
    }
    b.pick = { t: 0, k: 0, cb, ex }
  }

  remove(n: number) {
    const k = this.balls.findIndex(b => b.n === n)
    if (k >= 0) this.balls.splice(k, 1)
  }
}

const W = 640
const R = 300
const BR = 46

const mix = (h: string, t: number) => {
  const n = parseInt(h.slice(1), 16)
  const r = n >> 16
  const g = (n >> 8) & 255
  const bl = n & 255
  const k = t < 0 ? 0 : 255
  const a = Math.abs(t)
  return `rgb(${Math.round(r + (k - r) * a)},${Math.round(g + (k - g) * a)},${Math.round(bl + (k - bl) * a)})`
}

/** Starts the canvas loop. Returns a function that stops it. */
export function startMachine(cv: HTMLCanvasElement, ms: MachineState): () => void {
  const c = cv.getContext('2d')!
  let ang = 0
  let last = performance.now()
  let dt = 16.7
  let raf = 0

  function frame() {
    const bs = ms.balls
    const nw = performance.now()
    dt = Math.min(50, nw - last)
    last = nw
    const red = matchMedia('(prefers-reduced-motion:reduce)').matches
    const W1 = ms.busy ? 1 : 0
    const sw = 0.1 + W1 * 0.42
    const lift = 0.16 + W1 * 0.95
    bs.forEach(b => {
      if (b.gone) return
      if (b.pick) {
        const p = b.pick
        const now = performance.now()
        if (!p.t0) p.t0 = now
        const el = now - p.t0
        const f = 1 - Math.pow(1 - 0.07, dt / 16.7)
        b.x += ((p.ex || 0) - b.x) * f * 0.9
        b.z += (0 - b.z) * f * 0.9
        b.y += (R + BR * 1.3 - b.y) * f * 0.55 + (dt / 16.7) * 1.2
        p.k = 0
        if (b.y > R * 0.92 || el > 1500) {
          const cb = p.cb
          b.pick = undefined
          b.gone = true
          cb && cb()
        }
        return
      }
      const r = Math.hypot(b.x, b.z) || 1
      const tx = -b.z / r
      const tz = b.x / r
      b.vx += tx * sw * (0.4 + r / R) + (Math.random() - 0.5) * 0.5
      b.vz += tz * sw * (0.4 + r / R) + (Math.random() - 0.5) * 0.5
      b.vy += 0.24 + (Math.random() - 0.5) * 0.5
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
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    c.clearRect(0, 0, W, W)
    const pr = bs
      .filter(b => !b.gone)
      .map(b => {
        const x = b.x * ca + b.z * sa
        const z = -b.x * sa + b.z * ca
        const f = 0.88 + 0.2 * ((z + R) / (2 * R))
        return { b, x: W / 2 + ((x * (W / 2 - 24)) / R) * f, y: W / 2 + ((b.y * (W / 2 - 24)) / R) * f, z: b.pick ? 1e4 : z, s: f }
      })
      .sort((p, q) => p.z - q.z)

    pr.forEach(p => {
      const r = BR * p.s * (p.b.pick ? 1 + 0.35 * p.b.pick.k : 1)
      const rm = rimOf(p.b.n)
      const c0 = rm[0]
      const c1 = rm[1]
      const X = p.x
      const Y = p.y
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
      c.fillText(letterOf(p.b.n), X, Y - r * 0.36)
      c.font = `800 ${r * 0.44}px Rubik,system-ui,sans-serif`
      c.fillText(String(p.b.n), X, Y + r * 0.17)
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
    })
    // glass highlight over the whole sphere
    const hl = c.createRadialGradient(W * 0.3, W * 0.24, 10, W * 0.3, W * 0.24, W * 0.4)
    hl.addColorStop(0, 'rgba(255,255,255,.22)')
    hl.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = hl
    c.beginPath()
    c.arc(W / 2, W / 2, W / 2, 0, 7)
    c.fill()
    raf = requestAnimationFrame(frame)
  }
  frame()
  return () => cancelAnimationFrame(raf)
}
