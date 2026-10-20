import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { useGame } from '../hooks/useGame'
import type { PrefKey } from '../game/store'

const ROWS: { k: PrefKey; label: string }[] = [
  { k: 'sfx', label: 'Game sounds' },
  { k: 'music', label: 'Music' },
  { k: 'guide', label: 'Hint glow' },
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
      <div className="spanel" hidden={!open}>
        {ROWS.map(({ k, label }) => (
          <div className="srow" key={k}>
            <span>{label}</span>
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
              <i />
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
