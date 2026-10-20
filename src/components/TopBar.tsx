import { useEffect, useState } from 'react'
import { Coins, Trophy } from 'lucide-react'
import { useGame } from '../hooks/useGame'
import { SettingsPanel } from './SettingsPanel'

/** Next Sunday 21:00 East Africa Time (UTC+3), as a timestamp. */
function nextFinale(now: number) {
  const d = new Date(now)
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 18)
  const day = new Date(t + 3 * 3600e3).getUTCDay()
  let at = t + ((7 - day) % 7) * 86400e3
  if (at <= now) at += 7 * 86400e3
  return at
}

/** "2d 04h 13m", or "04h 13m 09s" on the last day. */
function untilFinale(now: number) {
  const s = Math.floor((nextFinale(now) - now) / 1000)
  const d = Math.floor(s / 86400)
  const h = String(Math.floor(s / 3600) % 24).padStart(2, '0')
  const m = String(Math.floor(s / 60) % 60).padStart(2, '0')
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${String(s % 60).padStart(2, '0')}s`
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** The header: settings gear, the 3D logo and the player's balance, with the two pots in a glowing bar below. */
export function TopBar() {
  const g = useGame()
  const now = useNow(1000)
  return (
    <header className="topbar">
      <div className="trow">
        <SettingsPanel />
        <div className="tlogo" aria-label="Quick Bingo">
          <span className="l1">QUICK</span>
          <span className="l2">BINGO</span>
        </div>
        <div className="tbal">
          <em>Your balance</em>
          <b>KES {g.pts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
        </div>
      </div>
      <div className="tpots">
        <div className="tpot gold">
          <Coins className="tico" aria-hidden="true" />
          <span className="ttx">
            <em>Rolling pot</em>
            <b>KES {g.potN.toLocaleString('en-US')}</b>
            <small>An X by ball 21 wins it</small>
          </span>
        </div>
        <i className="tsep" />
        <div className="tpot fin">
          <Trophy className="tico" aria-hidden="true" />
          <span className="ttx">
            <em>Weekly finale</em>
            <b>KES 1,000</b>
            <small>Sunday · 21:00 EAT · in {untilFinale(now)}</small>
          </span>
        </div>
      </div>
    </header>
  )
}
