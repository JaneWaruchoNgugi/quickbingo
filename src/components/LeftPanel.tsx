import { Ticket, Zap } from 'lucide-react'
import { QUICK_CARDS, QUICK_PRICES } from '../game/constants'
import type { Game } from '../game/store'
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
      <QuickPick />
      <PickButton />
    </div>
  )
}

function pickLabel(g: Game) {
  if (g.phase === 'buy') return g.myBought ? 'Cards bought' : 'Pick your cards'
  return g.queued.length ? 'Saved for next round ✓' : 'Pick cards for next round'
}

/** Instant play: tap a price to get four cards at that price, ready to confirm. */
export function QuickPick({ className }: { className?: string }) {
  const g = useGame()
  return (
    <div className={'qpick' + (className ? ' ' + className : '')}>
      <div className="qhead">
        <span className="qlabel">
          <Zap aria-hidden="true" />
          {g.phase === 'buy' ? 'Instant play' : 'Next round'}
        </span>
        <span className="qmeta">{QUICK_CARDS} cards · KSh each</span>
      </div>
      <div className="qchips">
        {QUICK_PRICES.map(p => (
          <button
            key={p}
            type="button"
            className="qchip"
            aria-label={`${QUICK_CARDS} cards at KSh ${p} each, KSh ${p * QUICK_CARDS} total`}
            disabled={!g.canPick || p * QUICK_CARDS > g.pts}
            onClick={() => g.openQuick(p)}
          >
            <span className="qcoin">
              <small>KSh</small>
              <b>{p}</b>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function PickButton({ className }: { className?: string }) {
  const g = useGame()
  return (
    <button
      className={'pickbtn' + (className ? ' ' + className : '')}
      disabled={!g.canPick || g.pts < 10}
      onClick={() => g.openModal()}
    >
      <Ticket aria-hidden="true" />
      <span>{pickLabel(g)}</span>
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
