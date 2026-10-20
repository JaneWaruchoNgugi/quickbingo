import { useGame } from '../hooks/useGame'
import { Globe } from './Globe'
import { PickButton, QuickPick, ringBg } from './LeftPanel'

/** The stage: globe + (phone only) countdown ring and the Pick-your-cards button (also shown during a draw, for the next round), and the popup toasts. */
export function Hero() {
  const g = useGame()
  return (
    <div className={'hero' + (g.phase === 'buy' ? ' buying' : ' nextbuy')}>
      <div className="hring" style={{ background: ringBg(g.ringDeg) }}>
        <div>
          <span>{g.timerText}</span>
          <small>until draw</small>
        </div>
      </div>
      <div className="mpick">
        <QuickPick />
        <PickButton className="mbtn" />
      </div>
      <Globe />
      {g.toasts.map(t => (
        <div key={t.id} className={'toast ' + t.cls}>
          {t.txt}
        </div>
      ))}
    </div>
  )
}
