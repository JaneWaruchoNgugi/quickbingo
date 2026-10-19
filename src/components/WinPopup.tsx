import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Coins, Star, Trophy } from 'lucide-react'
import { useGame } from '../hooks/useGame'

/** Prize number counting up from 0 over 1.1 s. */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const up = (now: number) => {
      const k = Math.min(1, (now - t0) / 1100)
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(up)
    }
    up(t0)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>KSh {v.toLocaleString('en-US')}</>
}

export function WinPopup() {
  const g = useGame()
  const b = g.bingo
  const bar = useRef<HTMLElement>(null)

  // XP bar: start at the old value with no transition, then animate to the new one.
  useLayoutEffect(() => {
    const el = bar.current
    if (!b || !el) return
    el.style.transition = 'none'
    el.style.width = b.xpFrom + '%'
    void el.offsetWidth
    el.style.transition = ''
    el.style.width = b.xpTo + '%'
  }, [b?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!b) return null
  return (
    <div className="bingo" onClick={() => g.hideBingo()}>
      <div className="rays" />
      <div className="wcard" key={b.key} style={{ '--ac': b.accent } as React.CSSProperties}>
        <div className="wmedal">
          <span className="ring" />
          <span className="disc">
            <Trophy strokeWidth={1.8} aria-hidden="true" />
          </span>
        </div>
        <div className="wtitle">{b.title}</div>
        <div className="wsub">{b.sub}</div>
        <div className="wmini">
          {b.mini.map((m, i) => (
            <i key={i} className={m.cls} style={{ '--c': m.color, '--d': m.delay + 's' } as React.CSSProperties}>
              {m.label}
            </i>
          ))}
        </div>
        <div className={'wprize' + (b.none ? ' none' : '')}>
          <small>{b.plabel}</small>
          <div className="wpv">
            <span className="wcoin">
              <Coins aria-hidden="true" />
            </span>
            <b>{b.win > 0 ? <CountUp to={b.win} /> : b.next}</b>
          </div>
          <span className="wchip">{b.chip}</span>
        </div>
        <div className="wstars">
          {[0, 1, 2].map(i => (
            <i key={i} className={i < b.starsOn ? 'on' : ''}>
              <Star aria-hidden="true" />
            </i>
          ))}
        </div>
        <div className="wxp">
          <div className="wxl">
            <span>LEVEL {b.lvl}</span>
            <span>+{b.gain} XP</span>
          </div>
          <div className="wxb">
            <u ref={bar} />
          </div>
        </div>
        <div className="wmeta">
          <span>{b.tier}</span>
        </div>
        <button className="wbtn" type="button">
          <span>COLLECT</span>
          <u />
        </button>
      </div>
      <div id="confetti">
        {b.confetti.map((c, i) => (
          <i
            key={i}
            className={c.cls}
            style={
              {
                left: c.left,
                top: '96%',
                '--dx': c.dx,
                '--dy': c.dy,
                '--rot': c.rot,
                background: c.bg,
                animationDelay: c.delay,
                animationDuration: c.dur,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}
