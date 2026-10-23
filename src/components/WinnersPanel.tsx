import { useGame } from '../hooks/useGame'

export function WinnersPanel() {
  const g = useGame()
  const now = g.winners.filter(w => w.round === g.round)
  const before = g.winners.filter(w => w.round !== g.round)
  const rows = (list: typeof g.winners) =>
    list.map(w => (
      <div className="win-row" key={w.id}>
        <span>{w.label}</span>
        <em>{w.x}x</em>
      </div>
    ))
  return (
    <div className="gp winp">
      <div className="pt">Recent Winners</div>
      <div className="winlist">
        {!g.winners.length && <div className="empty winempty">No winners yet. Every line won shows up here.</div>}
        {now.length > 0 && <div className="wgroup">This round</div>}
        {rows(now)}
        {before.length > 0 && <div className="wgroup">Earlier rounds</div>}
        {rows(before)}
      </div>
    </div>
  )
}
