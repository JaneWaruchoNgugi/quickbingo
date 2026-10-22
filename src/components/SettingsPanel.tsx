import { useEffect, useState } from 'react'
import { Check, Music, Settings, Sparkles, Volume2, X, type LucideIcon } from 'lucide-react'
import { useGame } from '../hooks/useGame'
import type { PrefKey } from '../game/store'

const ROWS: { k: PrefKey; label: string; hint: string; Icon: LucideIcon; c: string }[] = [
  { k: 'sfx', label: 'Game sounds', hint: 'Balls, coins and the crowd', Icon: Volume2, c: '#38bdf8' },
  { k: 'music', label: 'Music', hint: 'Background track', Icon: Music, c: '#a855f7' },
  { k: 'guide', label: 'Hint glow', hint: 'Lights up the numbers you need', Icon: Sparkles, c: '#22c55e' },
]

/** Gear button (top left) with the sound, music and guide-light switches. */
export function SettingsPanel() {
  const g = useGame()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest('.spanel,#snd')) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  return (
    <>
      <div className="spanel" hidden={!open} role="dialog" aria-label="Settings">
        <div className="shead">
          <Settings aria-hidden="true" />
          <b>Settings</b>
          <button className="sx" aria-label="Close settings" onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </div>
        {ROWS.map(({ k, label, hint, Icon, c }) => (
          <div className={'srow' + (g.prefs[k] ? ' on' : '')} key={k} style={{ '--sc': c } as React.CSSProperties}>
            <span className="sico" aria-hidden="true">
              <Icon />
            </span>
            <span className="stx">
              <b>{label}</b>
              <small>{hint}</small>
            </span>
            <button
              className={'sw' + (g.prefs[k] ? ' on' : '')}
              role="switch"
              aria-checked={g.prefs[k]}
              aria-label={label}
              onClick={e => {
                e.stopPropagation()
                g.setPref(k, !g.prefs[k])
              }}
            >
              <i>{g.prefs[k] ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}</i>
            </button>
          </div>
        ))}
      </div>
      <button
        id="snd"
        aria-label="Settings"
        title="Settings"
        onClick={e => {
          e.stopPropagation()
          setOpen(o => !o)
        }}
      >
        <Settings aria-hidden="true" />
      </button>
    </>
  )
}
