import { useEffect, useRef } from 'react'
import { game } from '../game/store'
import { LITE, ballBg, letterOf } from '../game/constants'
import { startMachine } from '../engine/machine'
import { SFX } from '../audio/sfx'
import { useGame } from '../hooks/useGame'
import podium from '../assets/podium.webp'
import { PipeLayers, FrontRibbons, BackRibbons, PipeBays, PIPES, VB_W, VB_H } from './PipeArt'

/** CSS left/top of a viewBox point inside the globe box. */
const pos = (p: { x: number; y: number }) => ({ left: (p.x / VB_W) * 100 + '%', top: (p.y / VB_H) * 100 + '%' })

const SPARK_COLORS = ['#fde047', '#38bdf8', '#f472b6', '#fff', '#a3e635']

/**
 * Pipe `i`'s ride path, sampled once into a table: asking the SVG path for a point every frame
 * is slow on phones, a table lookup is not.
 */
const rides: { len: number; at: (s: number) => { x: number; y: number } }[] = []
function ridePath(h: HTMLElement, i: number) {
  if (rides[i]) return rides[i]
  const path = h.querySelector<SVGPathElement>('#pp' + i)!
  const len = path.getTotalLength()
  const N = 240
  const xs = new Float32Array(N + 1)
  const ys = new Float32Array(N + 1)
  for (let k = 0; k <= N; k++) {
    const p = path.getPointAtLength((len * k) / N)
    xs[k] = p.x
    ys[k] = p.y
  }
  const at = (s: number) => {
    const f = Math.max(0, Math.min(N, (s / len) * N))
    const k = Math.min(N - 1, Math.floor(f))
    const u = f - k
    return { x: xs[k] + (xs[k + 1] - xs[k]) * u, y: ys[k] + (ys[k + 1] - ys[k]) * u }
  }
  return (rides[i] = { len, at })
}

/** The glass globe on its podium: canvas ball machine, ribbons, six exit pipes and the holes the balls land in. */
export function Globe() {
  const g = useGame()
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tray = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stop = startMachine(canvas.current!, game.machine)

    /** Sparks out of hole `only`, or out of every hole. */
    const fireSpouts = (only?: number) => {
      const gb = host.current!
      const gr = gb.getBoundingClientRect()
      const all = [...gb.querySelectorAll('.spout')]
      const spouts = only === undefined ? all : all.slice(only, only + 1)
      spouts.forEach(e => {
        const r = e.getBoundingClientRect()
        for (let k = 0; k < (LITE ? 5 : 12); k++) {
          const d = document.createElement('i')
          d.className = 'spark'
          d.style.left = ((r.left + r.width / 2 - gr.left) / gr.width) * 100 + '%'
          d.style.top = ((r.top + r.height / 2 - gr.top) / gr.height) * 100 + '%'
          const a = Math.random() * Math.PI * 2
          const m = 3 + Math.random() * 7
          d.style.setProperty('--x', Math.cos(a) * m * 9 + 'px')
          d.style.setProperty('--y', Math.sin(a) * m * 7 - 8 + 'px')
          d.style.setProperty('--c', SPARK_COLORS[k % 5])
          gb.appendChild(d)
          setTimeout(() => d.remove(), 750)
        }
      })
      spouts.forEach(e => {
        e.classList.add('fire')
        setTimeout(() => e.classList.remove('fire'), 700)
      })
    }

    /**
     * A ball rides pipe `i` (SVG path #pp{i}), rolling and speeding up, then pops out of its hole.
     * The whole ride is timed up front and its sounds are scheduled on the audio clock for the
     * moments the ball reaches them, so they stay in sync however busy the screen is.
     */
    const pipeRide = (i: number, n: number, done: () => void, mine = false) => {
      const h = host.current!
      const { len, at } = ridePath(h, i)
      const el = document.createElement('div')
      el.className = 'tb pb'
      el.style.background = ballBg(n)
      el.innerHTML = '<span class="lb"><small>' + letterOf(n) + '</small><b>' + n + '</b></span>'
      const lb = el.firstElementChild as HTMLElement
      h.appendChild(el)
      // the ball moves by transform only (in % of the globe box), so the ride needs no layout or repaint
      const hw = h.offsetWidth
      const hh = h.offsetHeight
      let bx = 0
      let by = 0
      const move = (x: number, y: number, scale = 1) => {
        bx = x
        by = y
        el.style.transform = `translate(${(x / 100) * hw}px,${(y / 100) * hh}px) translate(-50%,-50%) scale(${scale})`
      }
      const place = (x: number, y: number) => move((x / VB_W) * 100, (y / VB_H) * 100)
      // the ball waits at the pipe mouth for as long as the speakers lag, so the latch is heard as it moves
      const t0 = performance.now() + SFX.leadMs()
      // roughly constant acceleration, starting with the speed the ball had entering the pipe
      const D = 700 + len * 1.1
      const D2 = 520
      // the fall first reaches the hole here (ease-out-back below), before its overshoot settles
      const TOUCH = 0.455
      const BALL_R = 30
      // the latch and the ride sound, lasting exactly as long as the ball is in the pipe
      SFX.slide(i, D / 1000, SFX.at(t0))
      SFX.ding(i, SFX.at(t0 + D))
      SFX.land(n, i, SFX.at(t0 + D + D2 * TOUCH))
      if (mine) SFX.hit(SFX.at(t0 + D + D2 * TOUCH))

      const pop = () => {
        const gr = h.getBoundingClientRect()
        const sl = tray.current!.children[i].getBoundingClientRect()
        const sx = bx
        const sy = by
        const ex = ((sl.left + sl.width / 2 - gr.left) / gr.width) * 100
        const ey = ((sl.top + sl.height / 2 - gr.top) / gr.height) * 100
        const sc = sl.width / el.getBoundingClientRect().width || 1
        // the fall keeps the ride's clock, so a late frame doesn't push the landing past its sound
        const t1 = t0 + D
        el.style.zIndex = '9'
        fireSpouts(i)
        const fall = (now: number) => {
          const k = Math.max(0, Math.min(1, (now - t1) / D2))
          // ease-out-back: it shoots out of the hole, overshoots a little and settles
          const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)
          move(sx + (ex - sx) * Math.min(1, e), sy + (ey - sy) * Math.min(1, e), 1 + (sc - 1) * e)
          lb.style.transform = 'rotate(' + (1 - k) * 40 + 'deg)'
          if (k < 1) requestAnimationFrame(fall)
          else {
            done()
            // let React draw the ball in its hole before this one goes away
            requestAnimationFrame(() => requestAnimationFrame(() => el.remove()))
          }
        }
        fall(performance.now())
      }

      const step = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - t0) / D))
        const s = len * (0.35 * k + 0.65 * k * k)
        const pt = at(s)
        place(pt.x, pt.y)
        // roll: the label turns as far as the ball has travelled
        lb.style.transform = 'rotate(' + (s / BALL_R) * (180 / Math.PI) * (i < 3 ? -1 : 1) + 'deg)'
        if (k < 1) requestAnimationFrame(step)
        else pop()
      }
      step(performance.now())
    }

    game.fx = { pipeRide, fireSpouts }
    return () => {
      stop()
      game.fx = null
    }
  }, [])

  return (
    <div className={'gobj' + (g.swirl ? ' swirl' : '')} ref={host}>
      <canvas ref={canvas} width={640} height={640} aria-label="Lottery machine" />
      <i className="halo" />
      <i className="gl-back" />
      <BackRibbons />
      <i className="gl-shine" />
      <FrontRibbons />
      <PipeLayers />
      <PipeBays />
      {PIPES.map(({ hole }, i) => (
        <i key={i} className="spout" style={pos(hole)} />
      ))}
      <img alt="" src={podium} />
      <div className="tray" ref={tray}>
        {g.tray.map((n, i) =>
          n === null ? (
            <div key={'e' + i} className="tb empty" style={pos(PIPES[i].hole)} />
          ) : (
            <div key={n} className="tb" style={{ ...pos(PIPES[i].hole), background: ballBg(n) }}>
              <small>{letterOf(n)}</small>
              <b>{n}</b>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
