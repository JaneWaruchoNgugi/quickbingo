import { useEffect, useLayoutEffect, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight, Flame, X } from 'lucide-react'
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
        <div key={i} className={'c' + (v === 0 ? ' f' : '') + (g.modal.hot.has(v) ? ' hot' : '')}>
          {v === 0 ? '★' : v}
        </div>
      ))}
    </div>
  )
}

/**
 * Card picker. A 3D carousel shows one card large; beside it (below it on phones) a rail of every
 * card to jump to, and the selection: up to four cards, each removable, with the total and Buy.
 */
export function CardModal() {
  const g = useGame()
  const { open, pool, picked, idx, openKey, forNext, hot, quick } = g.modal
  const car = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLDivElement>(null)
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
        tf = 'translateZ(40px) scale(1.06)'
        op = 1
      } else if (a === 1) {
        tf = `translateX(${sg * W * 0.82}px) translateZ(-90px) rotateY(${-sg * 32}deg) scale(.82)`
        op = 0.75
      } else if (a === 2) {
        tf = `translateX(${sg * W * 1.38}px) translateZ(-180px) rotateY(${-sg * 45}deg) scale(.68)`
        op = 0.3
      } else {
        tf = `translateX(${sg * W * 1.6}px) translateZ(-260px) rotateY(${-sg * 50}deg) scale(.6)`
        op = 0
      }
      d.style.transform = tf
      d.style.opacity = String(op)
      d.style.zIndex = String(10 - a)
      d.style.pointerEvents = a > 2 ? 'none' : 'auto'
      d.style.filter = a === 0 ? 'none' : 'brightness(.6) saturate(.8)'
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
    if (!open) return
    place()
    // keep the current card's chip in view in the rail, without moving the page
    const r = rail.current
    const chip = r?.children[idx] as HTMLElement | undefined
    if (r && chip) r.scrollTo({ left: chip.offsetLeft - (r.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
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
  const sel = [...picked].sort((a, b) => a - b)
  const tot = sel.reduce((a, i) => a + pool[i].price, 0)
  const n = sel.length
  const ringDeg = forNext ? 360 : (g.secs / BUY_SECS) * 360

  return (
    <div className={'modal' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Pick your cards">
      <div className="mpanel">
        <header className="mhead">
          <div className="mring" style={{ background: `conic-gradient(var(--gold) ${ringDeg}deg,#ffffff1a 0)` }}>
            <div className={forNext ? 'nx' : ''}>{forNext ? 'NEXT' : g.secs}</div>
          </div>
          <div className="mtitle">
            <span className="demo">Demo mode</span>
            <h2>{quick ? `Your ${pool.length} cards · KSh ${quick} each` : forNext ? 'Pick cards for the next round' : 'Pick your cards'}</h2>
            <small>
              {quick
                ? `Look them over, then confirm${forNext ? ' · they join the next round' : ''}`
                : forNext
                  ? 'They join when this round ends · take up to 4'
                  : 'Swipe or tap a card · take up to 4'}
            </small>
          </div>
          <button className="mclose" aria-label="Close" onClick={() => g.closeModal()}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="hotrow">
          <span className="hl">
            <Flame aria-hidden="true" />
            {forNext ? 'Hot next round' : 'Hot this round'}
          </span>
          <div className="hots">
            {[...hot]
              .sort((a, b) => a - b)
              .map(h => (
                <i key={h} style={{ '--c': colorOf(h) } as React.CSSProperties}>
                  {h}
                </i>
              ))}
          </div>
        </div>

        <section className="mstage">
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
              return (
                <div
                  key={openKey + '-' + i}
                  className={'cc' + (i === idx ? ' mid' : '') + (picked.has(i) ? ' picked' : '')}
                  style={{ '--tc': tr[1] } as React.CSSProperties}
                  onClick={() => (i === idx && !quick ? g.take() : g.selectCard(i))}
                >
                  <span className="tierchip">{tr[0]}</span>
                  <CardFace card={t} />
                  <span className="price">KSh {t.price}</span>
                  <span className="tick">
                    <Check aria-hidden="true" />
                  </span>
                </div>
              )
            })}
          </div>

          <div className="tinfo">
            {cur && ctr && (
              <>
                <b style={{ color: ctr[1] }}>{ctr[0]}</b>
                <span>
                  <strong>{Math.round(cur.p1 * 100)}%</strong> line chance
                </span>
                <span>
                  <strong>{cur.hotN}</strong> hot numbers
                </span>
                <em>
                  <u style={{ width: Math.round(cur.p1 * 100) + '%', background: ctr[1] }} />
                </em>
              </>
            )}
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
                ? `Your ${pool.length} cards are ready`
                : cur && (picked.has(idx) ? 'Remove this card' : n >= 4 ? 'You have 4 cards' : `Take this card · KSh ${cur.price}`)}
            </button>
            <button className="ghost" aria-label="Next card" onClick={() => g.go(1)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside className="mside">
          <div className="mlabel">
            All cards <span>{pool.length}</span>
          </div>
          <div className="crail" ref={rail}>
            {pool.map((t, i) => {
              const tr = tierOf(t.price)
              return (
                <button
                  key={i}
                  className={'rchip' + (i === idx ? ' cur' : '') + (picked.has(i) ? ' on' : '')}
                  style={{ '--tc': tr[1] } as React.CSSProperties}
                  aria-label={`Card ${i + 1}, ${tr[0]}, KSh ${t.price}${picked.has(i) ? ', taken' : ''}`}
                  onClick={() => g.selectCard(i)}
                >
                  <b>KSh {t.price}</b>
                  <small>{tr[0]}</small>
                  {picked.has(i) && (
                    <span className="rok">
                      <Check aria-hidden="true" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mbasket">
            <div className="mlabel">
              Your cards <span>{n} / 4</span>
            </div>
            <div className="slots">
              {[0, 1, 2, 3].map(k => {
                const i = sel[k]
                if (i === undefined)
                  return (
                    <div key={'e' + k} className="slot">
                      <span>{k + 1}</span>
                    </div>
                  )
                const tr = tierOf(pool[i].price)
                return (
                  <button
                    key={i}
                    className="slot on"
                    style={{ '--tc': tr[1] } as React.CSSProperties}
                    aria-label={quick ? `KSh ${pool[i].price}` : `Remove KSh ${pool[i].price} card`}
                    disabled={!!quick}
                    onClick={() => g.unpick(i)}
                  >
                    <b>{pool[i].price}</b>
                    {!quick && <X aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
            <div className="macts">
              <button className="ghost" onClick={() => g.closeModal()}>
                {quick ? 'Cancel' : 'Close'}
              </button>
              <button id="mbuy" disabled={!n || tot > g.pts || !g.canPick} onClick={() => g.buy()}>
                {quick ? `Confirm · KSh ${tot}` : n ? `Buy ${n} card${n > 1 ? 's' : ''} · KSh ${tot}` : 'Take a card first'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
