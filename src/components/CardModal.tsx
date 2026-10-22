import { useEffect, useLayoutEffect, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { BUY_SECS } from '../game/constants'
import { type Card } from '../game/cards'
import { useGame } from '../hooks/useGame'

function CardFace({ card, hot }: { card: Card; hot: Set<number> }) {
  return (
    <div className="grid5">
      {'BINGO'.split('').map((l, i) => (
        <div key={l} className={`hd h${i}`}>
          {l}
        </div>
      ))}
      {card.flat.map((v, i) => (
        <div key={i} className={'c' + (v === 0 ? ' f' : '') + (hot.has(v) ? ' hot' : '')}>
          {v === 0 ? '★' : v}
        </div>
      ))}
    </div>
  )
}

/**
 * Card picker: a 3D carousel with one card large in the middle. Swipe, or use the arrows, to look
 * through the cards; tap the middle card (or the button under it) to take it, up to four. The four
 * slots show what is taken, and Confirm buys them.
 */
export function CardModal() {
  const g = useGame()
  const { open, pool, picked, idx, openKey, forNext, hot, quick } = g.modal
  const car = useRef<HTMLDivElement>(null)
  const touchX = useRef(0)

  /** Lays the cards out around the centre one: scale, tilt and fade by distance. */
  const place = () => {
    const el = car.current
    if (!el) return
    const n = pool.length
    ;[...el.children].forEach((node, i) => {
      const d = node as HTMLElement
      let o = (((i - idx) % n) + n) % n
      if (o > n / 2) o -= n
      const a = Math.abs(o)
      const sg = Math.sign(o)
      const W = d.offsetWidth
      let tf: string
      let op: number
      if (a === 0) {
        tf = 'translateZ(30px)'
        op = 1
      } else if (a === 1) {
        tf = `translateX(${sg * W * 0.8}px) translateZ(-90px) rotateY(${-sg * 38}deg) scale(.82)`
        op = 0.85
      } else {
        tf = `translateX(${sg * W * 1.2}px) translateZ(-200px) rotateY(${-sg * 50}deg) scale(.6)`
        op = 0
      }
      d.style.transform = tf
      d.style.opacity = String(op)
      d.style.zIndex = String(10 - a)
      d.style.pointerEvents = a > 1 ? 'none' : 'auto'
    })
  }

  // on open: measure, start every card hidden below, then let them move into place
  useLayoutEffect(() => {
    const el = car.current
    if (!open || !el) return
    const cards = [...el.children] as HTMLElement[]
    cards.forEach(d => d.style.setProperty('--h', d.offsetHeight + 'px'))
    cards.forEach(d => {
      d.style.transition = 'none'
      d.style.opacity = '0'
      d.style.transform = 'translateY(60px) scale(.6)'
    })
    void el.offsetWidth
    cards.forEach(d => (d.style.transition = ''))
    place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey])

  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, picked.size, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') g.go(-1)
      if (e.key === 'ArrowRight') g.go(1)
      if (e.key === 'Escape') g.closeModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, g])

  const cur = pool[idx]
  const sel = [...picked].sort((a, b) => a - b)
  const tot = sel.reduce((a, i) => a + pool[i].price, 0)
  const n = sel.length
  const ringDeg = forNext ? 360 : (g.secs / BUY_SECS) * 360

  return (
    <div className={'modal pc' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Pick your cards">
      <header className="mh">
        <div className="mring" style={{ background: `conic-gradient(var(--gold) ${ringDeg}deg,#ffffff1f 0)` }}>
          <div className={forNext ? 'nx' : ''}>{forNext ? 'NEXT' : g.secs}</div>
        </div>
        <div>
          <span className="demo">DEMO MODE</span>
          <h2>{forNext ? 'Cards for next round' : 'Pick your cards'}</h2>
          <small>{quick ? 'Swipe to look · then confirm' : 'Swipe to look · tap to take up to 4'}</small>
        </div>
      </header>

      <div
        className="car"
        ref={car}
        onTouchStart={e => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 40) g.go(dx < 0 ? 1 : -1)
        }}
      >
        {pool.map((t, i) => (
          <div
            key={openKey + '-' + i}
            className={'cc' + (i === idx ? ' mid' : '') + (picked.has(i) ? ' picked' : '')}
            onClick={() => (i === idx ? !quick && g.take() : g.selectCard(i))}
          >
            <CardFace card={t} hot={hot} />
            <span className="price">KES {t.price}</span>
            <span className="tick">
              <Check aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>

      <div className="mnav">
        <button className="ghost" aria-label="Previous card" onClick={() => g.go(-1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          id="takebtn"
          className={!quick && cur && picked.has(idx) ? 'on' : ''}
          disabled={!!quick || (!picked.has(idx) && n >= 4)}
          onClick={() => g.take()}
        >
          {quick
            ? `Your ${pool.length} cards`
            : cur && (picked.has(idx) ? 'Remove card' : n >= 4 ? '4 cards taken' : `Take · KES ${cur.price}`)}
        </button>
        <button className="ghost" aria-label="Next card" onClick={() => g.go(1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="slots" aria-label={`${n} of 4 cards taken`}>
        {[0, 1, 2, 3].map(k => {
          const i = sel[k]
          return i === undefined ? (
            <span key={'e' + k} className="slot" />
          ) : (
            <button
              key={i}
              className="slot on"
              aria-label={quick ? `Card ${k + 1}` : `Remove card ${k + 1}`}
              disabled={!!quick}
              onClick={() => g.unpick(i)}
            >
              <Check aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <div className="macts">
        <button className="ghost" onClick={() => g.closeModal()}>
          Cancel
        </button>
        <button id="mbuy" disabled={!n || tot > g.pts || !g.canPick} onClick={() => g.buy()}>
          {n ? `Confirm · KES ${tot}` : 'Take a card'}
        </button>
      </div>
    </div>
  )
}
