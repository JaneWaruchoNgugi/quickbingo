import { useGame } from '../hooks/useGame'
import { Globe } from './Globe'
import { Timer } from 'lucide-react'
import { PickButton, QuickPick } from './LeftPanel'

/** The stage: globe + (phone and tablet only) the draw countdown, and the popup toasts. */
export function Hero() {
  const g = useGame()
  return (
    <div className={'hero' + (g.phase === 'buy' ? ' buying' : ' nextbuy')}>
      <div className={'hcount' + (g.secs <= 5 ? ' hot' : '')} role="timer" aria-label={`Draw starts in ${g.secs} seconds`}>
        <span className="hic" aria-hidden="true">
          <Timer />
        </span>
        <span className="htx">
          <small>Draw starts in</small>
          <b>{g.timerText}</b>
        </span>
        <i aria-hidden="true">
          <u style={{ width: (g.ringDeg / 360) * 100 + '%' }} />
        </i>
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

/** Phone only: instant play and the Pick-your-cards button (also during a draw, for the next round), under the machine so it never covers the balls. */
export function MobilePick() {
  return (
    <div className="mpick">
      <QuickPick />
      <PickButton className="mbtn" />
    </div>
  )
}
