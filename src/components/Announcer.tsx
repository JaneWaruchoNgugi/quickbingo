import { Clock, CirclePlay, RotateCcw, Trophy, X } from 'lucide-react'
import { useGame } from '../hooks/useGame'

/** A short message at the bottom: the total won after a round, a nudge to try again, or news of saved cards. */
const LOOK = {
  win: { cls: 'win', label: 'Round won', Icon: Trophy },
  near: { cls: 'lose', label: 'Round over', Icon: RotateCcw },
  lose: { cls: 'lose', label: 'Round over', Icon: RotateCcw },
  saved: { cls: 'saved', label: 'Next round', Icon: Clock },
  live: { cls: 'saved', label: 'Cards in play', Icon: CirclePlay },
}

export function Announcer() {
  const g = useGame()
  const h = g.host
  if (!h) return null
  const { cls, label, Icon } = LOOK[h.mood]
  return (
    <div key={h.key} className={'host ' + cls} role="status" aria-live="polite" onClick={() => g.hideHost()}>
      <span className="hav" aria-hidden="true">
        <Icon />
      </span>
      <div className="hbub">
        <span className="hname">{label}</span>
        <p>{h.text}</p>
      </div>
      <button className="hx" aria-label="Close" onClick={() => g.hideHost()}>
        <X aria-hidden="true" />
      </button>
    </div>
  )
}
