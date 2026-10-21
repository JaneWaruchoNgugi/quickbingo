import { bestRow, lineCells, needCells } from '../game/cards'
import { useGame } from '../hooks/useGame'

export function TicketsPanel() {
  const g = useGame()
  const set = g.calledSet
  const bests = g.mine.map(t => bestRow(t.rows, set))
  const guide = g.prefs.guide && g.phase === 'draw'
  const total = g.mine.reduce((a, t) => a + t.price, 0)

  const tabs: { label: React.ReactNode; i: number; cls: string }[] = [
    { label: <>▦<br />ALL</>, i: 0, cls: 'all' },
    ...[1, 2, 3, 4].map(i => ({ label: <>CARD {i}</>, i, cls: '' })),
  ]

  return (
    <div className="gp tkp">
      <div className="tabs">
        {tabs.map(({ label, i, cls }) => (
          <button
            key={i}
            className={'tab ' + cls + (g.tab === i ? ' on' : '')}
            disabled={i > g.mine.length}
            onClick={() => g.setTab(i)}
          >
            {label}
            {i > 0 && g.mine[i - 1] && (
              <div className="dots">
                {[0, 1, 2, 3, 4].map(k => (
                  <i key={k} className={k < bests[i - 1] ? 'on' : ''} />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
      <div className={'frame' + (g.myBought ? ' bought' : '')}>
        <div className="badge" hidden={!g.myBought && !g.queued.length}>
          {g.myBought && `✓ ${g.mine.length} CARD${g.mine.length > 1 ? 'S' : ''} BOUGHT · KSh ${total}`}
          {g.myBought && g.queued.length > 0 && ' · '}
          {g.queued.length > 0 && `${g.queued.length} SAVED FOR NEXT ROUND`}
        </div>
        <div className="tickets">
          {g.mine.map((t, i) => {
            if (g.tab && g.tab !== i + 1) return null
            const need = guide ? needCells(t.rows, set) : new Set<number>()
            const won = lineCells(t.flat, set)
            return (
              <div key={i} className={'tk a' + (i % 4) + (won.size ? ' win' : '')}>
                <div className="tkh">
                  <b>CARD {i + 1}</b>
                  <span className="tkprice">KSh {t.price}</span>
                  <span className="togo">
                    {won.size ? 'BINGO!' : bests[i] >= 4 ? '1 to go!' : `${5 - bests[i]} to go`}
                  </span>
                </div>
                <div className="grid5">
                  {'BINGO'.split('').map((l, k) => (
                    <div key={l} className={`hd h${k}`}>
                      {l}
                    </div>
                  ))}
                  {t.flat.map((v, k) => {
                    const state = v === 0 ? ' f' : set.has(v) ? ' m' + (g.fresh.has(v) ? ' nw' : '') : ''
                    return (
                      <div key={k} className={`c col${k % 5}${state}${need.has(k) ? ' need' : ''}${won.has(k) ? ' w' : ''}`}>
                        {v === 0 ? 'FREE' : v}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {!g.mine.length && (
            <div className="empty">
              {g.phase === 'buy'
                ? 'No cards yet. Pick your cards before the draw starts.'
                : g.queued.length
                  ? `Your ${g.queued.length} card${g.queued.length > 1 ? 's are' : ' is'} saved. ${g.queued.length > 1 ? 'They join' : 'It joins'} the next round when this one ends.`
                  : 'This round has started. You can pick cards now for the next round.'}
            </div>
          )}
        </div>
        <div className="start" hidden={!(g.phase === 'buy' && g.myBought)}>
          <span>GAME STARTS IN</span>
          <div className="sring" style={{ background: `conic-gradient(var(--gold) ${g.startDeg}deg,#33407a 0)` }}>
            <b>{g.startN}</b>
          </div>
          <em>Good luck!</em>
        </div>
      </div>
    </div>
  )
}
