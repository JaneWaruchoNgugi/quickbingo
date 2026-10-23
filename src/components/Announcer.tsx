import { Clock, CirclePlay, X } from 'lucide-react'
import { useGame } from '../hooks/useGame'

/** A short message at the bottom: news of saved cards. */
const LOOK = {
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
