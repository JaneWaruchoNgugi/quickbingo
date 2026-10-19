import { useGame } from '../hooks/useGame'

export function WinnersPanel() {
  const g = useGame()
  return (
    <div className="gp winp">
      <div className="pt">Recent Winners</div>
      <div className="winlist">
        {g.winners.map(w => (
          <div className="win-row" key={w.id}>
            <span>{w.label}</span>
            <em>{w.x}x</em>
          </div>
        ))}
      </div>
    </div>
  )
}
