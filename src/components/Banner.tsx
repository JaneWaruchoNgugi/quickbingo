import { useGame } from '../hooks/useGame'

export function Banner() {
  const g = useGame()
  // The key restarts the shake animation each time "SO CLOSE" fires.
  return (
    <div key={g.shakeKey} className={'banner' + (g.shakeKey ? ' shake' : '')}>
      {g.banner}
    </div>
  )
}
