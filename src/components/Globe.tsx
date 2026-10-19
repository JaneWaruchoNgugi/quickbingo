import { useEffect, useRef } from 'react'
import { SFX } from '../audio/sfx'
import { game } from '../game/store'
import { ballBg, letterOf } from '../game/constants'
import { startMachine } from '../engine/machine'
import { useGame } from '../hooks/useGame'
import podium from '../assets/podium.webp'
import { PipeLayers, FrontRibbons, BackRibbons, PipeBays } from './PipeArt'

const VB_W = 1189
const VB_H = 1323

const SPARK_COLORS = ['#fde047', '#38bdf8', '#f472b6', '#fff', '#a3e635']

/** The glass globe on its podium: canvas ball machine, ribbons, three exit pipes and the ball tray. */
export function Globe() {
  const g = useGame()
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tray = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stop = startMachine(canvas.current!, game.machine)

    const fireSpouts = () => {
      const gb = host.current!
      const gr = gb.getBoundingClientRect()
      const spouts = gb.querySelectorAll('.spout')
      SFX.spout()
      spouts.forEach(e => {
        const r = e.getBoundingClientRect()
        for (let k = 0; k < 12; k++) {
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

    /** A ball rides pipe `i` (SVG path #pp{i}), then drops into its tray slot. */
    const pipeRide = (i: number, n: number, done: () => void) => {
      const h = host.current!
      const path = h.querySelector<SVGPathElement>('#pp' + i)!
      const len = path.getTotalLength()
      const el = document.createElement('div')
      el.className = 'tb pb'
      el.style.background = ballBg(n)
      el.innerHTML = '<small>' + letterOf(n) + '</small><b>' + n + '</b>'
      h.appendChild(el)
      const t0 = performance.now()
      const D = 620

      const drop = () => {
        const gr = h.getBoundingClientRect()
        const sl = tray.current!.children[i].getBoundingClientRect()
        const sx = parseFloat(el.style.left)
        const sy = parseFloat(el.style.top)
        const ex = ((sl.left + sl.width / 2 - gr.left) / gr.width) * 100
        const ey = ((sl.top + sl.height / 2 - gr.top) / gr.height) * 100
        const sc = sl.width / el.getBoundingClientRect().width || 1
        const t1 = performance.now()
        const D2 = 380
        el.style.zIndex = '9'
        fireSpouts()
        const fall = (now: number) => {
          const k = Math.min(1, (now - t1) / D2)
          const e = k * k * (3 - 2 * k)
          const s = 1 + (sc - 1) * e
          el.style.left = sx + (ex - sx) * e + '%'
          el.style.top = sy + (ey - sy) * (k * k) + '%'
          el.style.transform = 'translate(-50%,-50%) scale(' + s + ')'
          if (k < 1) requestAnimationFrame(fall)
          else {
            el.remove()
            done()
          }
        }
        fall(t1)
      }

      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / D)
        const pt = path.getPointAtLength(len * Math.pow(k, 1.4))
        el.style.left = (pt.x / VB_W) * 100 + '%'
        el.style.top = (pt.y / VB_H) * 100 + '%'
        if (k < 1) requestAnimationFrame(step)
        else drop()
      }
      step(t0)
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
      <i className="spout" style={{ left: '36.7%', top: '81.2%' }} />
      <i className="spout" style={{ left: '50%', top: '81.2%' }} />
      <i className="spout" style={{ left: '63.3%', top: '81.2%' }} />
      <img alt="" src={podium} />
      <div className="tray" ref={tray}>
        {g.tray.map((n, i) =>
          n === null ? (
            <div key={'e' + i} className="tb empty" />
          ) : (
            <div key={n} className="tb" style={{ background: ballBg(n) }}>
              <small>{letterOf(n)}</small>
              <b>{n}</b>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
