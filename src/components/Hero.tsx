import { useGame } from '../hooks/useGame'
import { Globe } from './Globe'
import { PickButton, ringBg } from './LeftPanel'

/** The stage: globe + (phone only) countdown ring and Pick-your-cards button, and the popup toasts. */
export function Hero() {
  const g = useGame()
  return (
    <div className={'hero' + (g.phase === 'buy' ? ' buying' : '')}>
      <div className="hring" style={{ background: ringBg(g.ringDeg) }}>
        <div>
          <span>{g.timerText}</span>
          <small>until draw</small>
        </div>
      </div>
      <PickButton className="mbtn" />
      <Globe />
      {g.toasts.map(t => (
        <div key={t.id} className={'toast ' + t.cls}>
          {t.txt}
        </div>
      ))}
    </div>
  )
}
