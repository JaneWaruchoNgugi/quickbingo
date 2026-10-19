import { useEffect, useLayoutEffect, useRef } from 'react'
import { Flame } from 'lucide-react'
import { BUY_SECS, colorOf } from '../game/constants'
import { tierOf, type Card } from '../game/cards'
import { useGame } from '../hooks/useGame'

function CardFace({ card }: { card: Card }) {
  const g = useGame()
  return (
    <div className="grid5">
      {'BINGO'.split('').map((l, i) => (
        <div key={l} className={`hd h${i}`}>
          {l}
        </div>
      ))}
      {card.flat.map((v, i) => (
        <div key={i} className={'c' + (v === 0 ? ' f' : '') + (g.hot.has(v) ? ' hot' : '')}>
          {v === 0 ? '★' : v}
        </div>
      ))}
    </div>
  )
}

/** Card picker: a 3D carousel of ten priced cards, up to four can be bought. */
export function CardModal() {
  const g = useGame()
  const { open, pool, picked, idx, openKey } = g.modal
  const car = useRef<HTMLDivElement>(null)
  const touchX = useRef(0)

  /** Lay the cards out around the centre one: scale, tilt and fade by distance. */
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
        tf = 'translateZ(60px) scale(1.12)'
        op = 1
      } else if (a === 1) {
        tf = `translateX(${sg * W * 0.98}px) translateZ(-80px) rotateY(${-sg * 40}deg) scale(.8)`
        op = 0.8
      } else if (a === 2) {
        tf = `translateX(${sg * W * 1.6}px) translateZ(-160px) rotateY(${-sg * 55}deg) scale(.7)`
        op = 0.35
      } else {
        tf = `translateX(${sg * W * 1.8}px) translateZ(-260px) rotateY(${-sg * 60}deg) scale(.6)`
        op = 0
      }
      d.style.transform = tf
      d.style.opacity = String(op)
      d.style.zIndex = String(10 - a)
      d.style.pointerEvents = a > 2 ? 'none' : 'auto'
      d.style.filter = a === 0 ? 'none' : 'brightness(.7)'
    })
  }

  // On open: measure, start every card hidden below, then let them fly into place.
  useLayoutEffect(() => {
    const el = car.current
    if (!open || !el) return
    const cards = [...el.children] as HTMLElement[]
    cards.forEach(d => d.style.setProperty('--h', d.offsetHeight + 'px'))
    cards.forEach(d => {
      d.style.transition = 'none'
      d.style.opacity = '0'
      d.style.transform = 'translateY(80px) scale(.5)'
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
  const ctr = cur ? tierOf(cur.price) : null
  const tot = [...picked].reduce((a, i) => a + pool[i].price, 0)
  const n = picked.size

  return (
    <div className={'modal' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Pick your cards">
      <div className="demo">DEMO MODE</div>
      <div className="mh">
        <div className="mring" style={{ background: `conic-gradient(var(--gold) ${(g.secs / BUY_SECS) * 360}deg,var(--line) 0)` }}>
          <div>{g.secs}</div>
        </div>
        <div>
          <h2>Pick your cards</h2>
          <small>Swipe · take up to 4</small>
        </div>
      </div>
      <div className="hotrow">
        <span className="hl">
          <Flame aria-hidden="true" />
          Hot numbers this round
        </span>
        {[...g.hot]
          .sort((a, b) => a - b)
          .map(h => (
            <i key={h} style={{ '--c': colorOf(h) } as React.CSSProperties}>
              {h}
            </i>
          ))}
      </div>
      <div
        className="car"
        ref={car}
        onTouchStart={e => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 40) g.go(dx < 0 ? 1 : -1)
        }}
      >
        {pool.map((t, i) => {
          const tr = tierOf(t.price)
          const n0 = pool.length
          let o = (((i - idx) % n0) + n0) % n0
          if (o > n0 / 2) o -= n0
          return (
            <div
              key={openKey + '-' + i}
              className={'cc' + (o === 0 ? ' mid' : '') + (picked.has(i) ? ' picked' : '')}
              style={{ '--tc': tr[1] } as React.CSSProperties}
              onClick={() => g.selectCard(i)}
            >
              <CardFace card={t} />
              <span className="tierchip">{tr[0]}</span>
              <span className="price">KSh {t.price}</span>
              <span className="tick">✓</span>
            </div>
          )
        })}
      </div>
      <div className="tinfo">
        {cur && ctr && (
          <>
            <b style={{ color: ctr[1] }}>{ctr[0]}</b>
            <span>{Math.round(cur.p1 * 100)}% line chance</span>
            <span>{cur.hotN} hot numbers</span>
            <em>
              <u style={{ width: Math.round(cur.p1 * 100) + '%', background: ctr[1] }} />
            </em>
          </>
        )}
      </div>
      <div className="mnav">
        <button className="ghost" aria-label="Previous card" onClick={() => g.go(-1)}>
          ‹
        </button>
        <button id="takebtn" onClick={() => g.take()}>
          {cur && (picked.has(idx) ? 'Remove this card' : 'Take this card · KSh ' + cur.price)}
        </button>
        <button className="ghost" aria-label="Next card" onClick={() => g.go(1)}>
          ›
        </button>
      </div>
      <div className="slots">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={'slot' + (i < n ? ' on' : '')}>
            {i < n ? '✓' : ''}
          </div>
        ))}
      </div>
      <div className="macts">
        <button className="ghost" onClick={() => g.closeModal()}>
          Close
        </button>
        <button id="mbuy" disabled={!n || tot > g.pts || g.phase !== 'buy'} onClick={() => g.buy()}>
          {n ? `Buy ${n} · KSh ${tot}` : 'Pick a card'}
        </button>
      </div>
    </div>
  )
}
