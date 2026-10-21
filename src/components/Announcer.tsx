import { Mic, X } from 'lucide-react'
import { useGame } from '../hooks/useGame'

/** The host after a round: a speech bubble beside the announcer, saying what was won or cheering the player on. */
export function Announcer() {
  const g = useGame()
  const h = g.host
  if (!h) return null
  return (
    <div key={h.key} className={'host ' + h.mood} role="status" aria-live="polite" onClick={() => g.hideHost()}>
      <div className="hav" aria-hidden="true">
        <Mic />
        <span className="hbars">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="hbub">
        <span className="hname">{h.mood === 'win' ? 'Host · Winner!' : 'Host'}</span>
        <p>{h.text}</p>
      </div>
      <button className="hx" aria-label="Close" onClick={() => g.hideHost()}>
        <X aria-hidden="true" />
      </button>
    </div>
  )
}
