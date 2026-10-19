import { CalendarClock, Coins, Target, Trophy } from 'lucide-react'
import { useGame } from '../hooks/useGame'

export function PotBar() {
  const g = useGame()
  return (
    <div className="gp potbar">
      <div className="pot gold">
        <span className="ico">
          <Coins aria-hidden="true" />
        </span>
        <span className="tx">
          <em>Rolling Pot</em>
          <b>KES {g.potN.toLocaleString('en-US')}</b>
          <small>
            <Target aria-hidden="true" />
            An X by ball 21 wins it
          </small>
        </span>
      </div>
      <div className="psep" />
      <div className="pot fin">
        <span className="ico">
          <Trophy aria-hidden="true" />
        </span>
        <span className="tx">
          <em>Weekly Finale</em>
          <b>KES 1,000</b>
          <small>
            <CalendarClock aria-hidden="true" />
            Sunday · 21:00 EAT
          </small>
        </span>
      </div>
    </div>
  )
}
