import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Coins, RotateCw, Star, Trophy } from 'lucide-react'
import { ballBg, letterOf } from '../game/constants'
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
  return <>KES {v.toLocaleString('en-US')}</>
}

/** Where the floating balls sit around the card (left/right edge, height). */
const BALL_SPOTS = [
  { side: 'l', top: '6%' },
  { side: 'r', top: '4%' },
  { side: 'l', top: '40%' },
  { side: 'r', top: '46%' },
  { side: 'l', top: '68%' },
  { side: 'r', top: '76%' },
]

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
      <div className="lw" key={b.key}>
        {b.balls.map((n, i) => {
          const s = BALL_SPOTS[i]
          return (
            <div
              key={n}
              className={'lwball ' + s.side}
              style={{ top: s.top, background: ballBg(n), '--d': i * 0.4 + 's' } as React.CSSProperties}
            >
              <small>{letterOf(n)}</small>
              <b>{n}</b>
            </div>
          )
        })}
        <div className="lwcard">
          <div className="lwhead">
            <div className="lwcup">
              <Star className="st l" aria-hidden="true" />
              <Trophy className="tr" strokeWidth={1.6} aria-hidden="true" />
              <Star className="st r" aria-hidden="true" />
            </div>
            <div className="lwbingo">BINGO</div>
            <div className="lwribbon">
              <span>{b.title}</span>
            </div>
          </div>
          <div className="lwwhich">
            <span className="lbl">Winning card</span>
            <div className="tabs">
              {Array.from({ length: b.cards }, (_, i) => (
                <span key={i} className={'tab' + (i + 1 === b.card ? ' on' : '')}>
                  CARD {i + 1}
                </span>
              ))}
            </div>
            {b.price > 0 && <span className="price">KES {b.price} card</span>}
          </div>
          <div className="lwgrid">
            {'BINGO'.split('').map((l, i) => (
              <div key={l} className={'lwh h' + i}>
                {l}
              </div>
            ))}
            {b.mini.map((m, i) => (
              <i key={i} className={m.cls} style={{ '--c': m.color, '--d': m.delay + 's' } as React.CSSProperties}>
                {m.label}
              </i>
            ))}
          </div>
          <div className={'lwprize' + (b.none ? ' none' : '')}>
            <span className="lwpill">{b.plabel}</span>
            <div className="lwpv">
              <Coins className="coin" aria-hidden="true" />
              <b>{b.win > 0 ? <CountUp to={b.win} /> : b.next}</b>
              <Star className="spk" aria-hidden="true" />
            </div>
            {b.chip && <span className="lwchip">{b.chip}</span>}
          </div>
          {b.total > 0 && (
            <div className="lwtotal">
              <span>Round total</span>
              <b>KES {b.total.toLocaleString('en-US')}</b>
            </div>
          )}
          <div className="lwxp">
            <div className="gain">
              <Star aria-hidden="true" />+{b.gain} XP
            </div>
            <div className="lvl">
              <div className="row">
                <span>LEVEL {b.lvl}</span>
                <span>
                  {b.calls} <Star aria-hidden="true" />
                </span>
              </div>
              <div className="bar">
                <u ref={bar} />
              </div>
            </div>
          </div>
          <button className="lwbtn gold" type="button">
            <Coins aria-hidden="true" />
            {b.win > 0 ? 'COLLECT WINNINGS' : 'CONTINUE'}
          </button>
          <button className="lwbtn ghost" type="button">
            <RotateCw aria-hidden="true" />
            KEEP PLAYING
          </button>
        </div>
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
