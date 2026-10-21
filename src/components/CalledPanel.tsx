import { MAXCALL, ballBg, letterOf } from '../game/constants'
import { useGame } from '../hooks/useGame'

/** The draw so far: the latest ball large beside the count, then every ball called this round in order. */
export function CalledPanel() {
  const g = useGame()
  const n = g.called.length
  const last = g.called[n - 1]
  return (
    <div className="gp calledp">
      <div className="chead">
        {last ? (
          <div key={last} className="cbig" style={{ background: ballBg(last) }}>
            <small>{letterOf(last)}</small>
            <b>{last}</b>
          </div>
        ) : (
          <div className="cbig empty">?</div>
        )}
        <div className="cinfo">
          <div className="pt">
            Called Numbers
            <span className="ccount">
              <b>{n}</b> / {MAXCALL}
            </span>
          </div>
          <div className="cbar">
            <i style={{ width: (n / MAXCALL) * 100 + '%' }} />
          </div>
          <span className="clast">{last ? `Latest ball: ${letterOf(last)} ${last}` : 'Waiting for the first ball'}</span>
        </div>
      </div>
      <div className="balls">
        {Array.from({ length: MAXCALL }, (_, i) => {
          const v = g.called[i]
          return v ? (
            <div key={i} className={'ball bl' + (i === n - 1 ? ' nw' : '')} style={{ background: ballBg(v) }}>
              <small>{letterOf(v)}</small>
              <b>{v}</b>
            </div>
          ) : (
            <div key={i} className={'ball' + (i === n ? ' nx' : '')}>
              <span>{i + 1}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
