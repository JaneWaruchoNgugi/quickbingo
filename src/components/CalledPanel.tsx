import { MAXCALL, ballBg, letterOf } from '../game/constants'
import { useGame } from '../hooks/useGame'

export function CalledPanel() {
  const g = useGame()
  return (
    <div className="gp calledp">
      <div className="pt">
        Called Numbers{' '}
        <span>
          {g.called.length} / {MAXCALL}
        </span>
      </div>
      <div className="balls">
        {Array.from({ length: MAXCALL }, (_, i) => {
          const n = g.called[i]
          return n ? (
            <div key={i} className="ball bl" style={{ background: ballBg(n) }}>
              <small>{letterOf(n)}</small>
              <b>{n}</b>
            </div>
          ) : (
            <div key={i} className="ball" />
          )
        })}
      </div>
    </div>
  )
}
