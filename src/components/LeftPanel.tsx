import { useGame } from '../hooks/useGame'

const ringBg = (deg: number) => `conic-gradient(var(--gold) ${deg}deg,var(--line) 0)`

/** Desktop status panel: phase, countdown ring, ticket counts and the "Pick your cards" button. */
export function LeftPanel() {
  const g = useGame()
  return (
    <div className="gp left leftp">
      <div>
        <div className="pt">
          <span>{g.phaseLabel}</span>
        </div>
      </div>
      <div className="ring" style={{ background: ringBg(g.ringDeg) }}>
        <div>
          <span className="timer">{g.timerText}</span>
          <span>{g.tl}</span>
        </div>
      </div>
      <div className="row">
        Tickets Available<b>{g.avail} / 40</b>
      </div>
      <div className="row">
        Total Participants<b>{g.participants}</b>
      </div>
      <PickButton />
    </div>
  )
}

export function PickButton({ className }: { className?: string }) {
  const g = useGame()
  return (
    <button className={className} disabled={g.phase !== 'buy' || g.myBought || g.pts < 10} onClick={() => g.openModal()}>
      {g.myBought ? 'Cards bought' : 'Pick your cards'}
    </button>
  )
}

/** Mobile "next draw" box (hidden on desktop by CSS). */
export function NextBox() {
  const g = useGame()
  return (
    <div className="gp next nextbox">
      <div className="pt" style={{ margin: 0 }}>
        NEXT DRAW
      </div>
      <span className="timer">{g.timerText}</span>
      <div className="mut">Ticket Buying Ends</div>
      <div className="mut">Current Participants</div>
      <div className="big2">{g.participants} / 40</div>
    </div>
  )
}

export { ringBg }
