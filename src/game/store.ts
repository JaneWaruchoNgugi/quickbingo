import { SFX } from '../audio/sfx'
import { MachineState, PICK_MS, UNIT_VB } from '../engine/machine'
import { GLOBE, PIPES } from '../components/PipeArt'
import {
  ACC, QUICK_CARDS, BOT_NAMES, BUY_SECS, END_SECS, CHAT_LINES, CHATTERS, MAXCALL, PER, PRICE, START_POINTS, TIERS,
  LITE, colorOf, fmt, rnd,
} from './constants'
import { bestRow, buildPool, drawNum, lineCells, lines, makeGrid, pickHot, type Card, type Grid } from './cards'

export type Phase = 'buy' | 'draw' | 'end'

export interface ChatMsg { id: number; who: string; msg: string }
export interface WinRow { id: number; label: string; x: number }
export interface Toast { id: number; txt: string; cls: string }
export interface Bot { name: string; ts: Grid[] }
export interface Prefs { sfx: boolean; music: boolean; voice: boolean; guide: boolean }

/** The host's line after a round: what the bubble shows and how it is coloured. */
export interface HostLine { key: number; text: string; mood: 'win' | 'near' | 'lose' }
export type PrefKey = keyof Prefs

export interface ConfettiPiece {
  cls: string
  left: string
  dx: string
  dy: string
  rot: string
  bg?: string
  delay: string
  dur: string
}

export interface BingoView {
  key: number
  accent: string
  title: string
  sub: string
  mini: { cls: string; label: string; color: string; delay: number }[]
  none: boolean
  plabel: string
  win: number
  chip: string
  next: string
  /** last numbers called, shown as balls floating around the card */
  balls: number[]
  /** which of the player's cards won (1-based), out of how many, and its price */
  card: number
  cards: number
  price: number
  /** numbers called so far, e.g. "30 / 36" */
  calls: string
  stars: number
  starsOn: number
  lvl: number
  gain: number
  xpFrom: number
  xpTo: number
  tier: string
  confetti: ConfettiPiece[]
}

/** Hooks the globe component registers so the game can run the pipe/spout animations. */
export interface Effects {
  pipeRide(i: number, n: number, done: () => void, mine?: boolean): void
  fireSpouts(only?: number): void
}

const XP_PER_LEVEL = 150
/** ms between balls leaving the globe, so each one can be followed down its pipe */
const PICK_GAP = 320
/** ms the finished six stay in the tray before the next draw spins up */
const BATCH_GAP = 400
/** ms the globe spins before the first ball of a draw is picked */
const SPIN_UP = 450

function loadPrefs(): Prefs {
  let raw: Partial<Prefs> = {}
  try {
    raw = JSON.parse(localStorage.getItem('qbprefs') || '{}')
  } catch {
    raw = {}
  }
  return { sfx: raw.sfx !== false, music: raw.music !== false, voice: raw.voice !== false, guide: raw.guide !== false }
}

/**
 * All game state and rules. React components subscribe through `useGame` and re-render on every
 * `emit`; animations that need DOM access (pipes, sparks) are delegated to `fx`.
 */
export class Game {
  // ---- observable state ----
  pts = START_POINTS
  phase: Phase = 'buy'
  secs = BUY_SECS
  timerText = fmt(BUY_SECS)
  ringDeg = 360
  startDeg = 360
  startN = BUY_SECS
  phaseLabel = 'Ticket Buying Phase'
  tl = 'until draw'
  banner = 'Buy your tickets before the draw starts.'
  shakeKey = 0
  called: number[] = []
  mine: Card[] = []
  bots: Bot[] = []
  won: Record<number, string> = {}
  myBought = false
  tab = 0
  roundWin = 0
  batchWin = 0
  hot = new Set<number>()
  /** hot numbers of the next round, fixed early so cards can be bought for it during a draw */
  nextHot = pickHot()
  /** cards bought during a draw or after it, waiting for the next round */
  queued: Card[] = []
  fresh = new Set<number>()
  tray: (number | null)[] = Array(PER).fill(null)
  swirl = false
  winners: WinRow[] = []
  chatLog: ChatMsg[] = []
  toasts: Toast[] = []
  potN = 5091
  xp = 0
  prefs: Prefs = loadPrefs()
  bingo: BingoView | null = null
  host: HostLine | null = null
  modal = { open: false, pool: [] as Card[], picked: new Set<number>(), idx: 0, openKey: 0, forNext: false, hot: new Set<number>(), quick: 0 }

  // ---- machinery ----
  readonly machine = new MachineState()
  fx: Effects | null = null

  private prevLn: number[] = []
  private wasNear = false
  private timer: number | undefined
  private bingoTimer: number | undefined
  private advTimer: number | undefined
  private uid = 0
  private started = false
  private version = 0
  private listeners = new Set<() => void>()

  // ---- store plumbing ----
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getVersion = () => this.version
  emit() {
    this.version++
    this.listeners.forEach(l => l())
  }

  // ---- derived ----
  get participants() {
    return this.myBought ? 25 : 24
  }
  get avail() {
    const sold = this.bots.reduce((a, b) => a + b.ts.length, 0) + this.mine.length
    return Math.max(0, 40 - Math.floor(sold / 2.5))
  }
  /** The player has cards in a round that is still running: picking is hidden and the cards get the space. */
  get playing() {
    return this.mine.length > 0 && this.phase !== 'end'
  }
  /** Cards can be bought for this round while it is buying, otherwise for the next round. */
  get canPick() {
    return this.phase === 'buy' ? !this.myBought : !this.queued.length
  }
  get calledSet() {
    return new Set(this.called)
  }

  /** Boot: apply saved sound settings, start the first round and the ambient timers. Safe to call twice. */
  start() {
    if (this.started) return
    this.started = true
    SFX.bindDrawing(() => this.phase === 'draw')
    SFX.set('sfx', this.prefs.sfx)
    SFX.set('music', this.prefs.music)
    SFX.set('voice', this.prefs.voice)
    this.say('QueenBingo', 'This looks amazing!')
    this.say('LuckyStar', 'Good luck everyone!')
    this.startRound()
    setInterval(() => {
      if (Math.random() < 0.5) this.say(CHATTERS[rnd(4)], CHAT_LINES[rnd(CHAT_LINES.length)])
    }, 4000)
    setInterval(() => {
      if (this.phase === 'buy') {
        this.potN += 10 * (1 + Math.floor(Math.random() * 4))
        this.emit()
      }
    }, 1200)
  }

  say(who: string, msg: string) {
    this.chatLog.push({ id: ++this.uid, who, msg })
    // keep the chat short: an endless log slowly fills the page and memory
    if (this.chatLog.length > 40) this.chatLog = this.chatLog.slice(-40)
    this.emit()
  }

  // ---- rounds ----
  private tick = () => {
    this.secs--
    this.startN = Math.max(this.secs, 0)
    this.startDeg = (this.secs / BUY_SECS) * 360
    this.timerText = fmt(this.secs)
    this.ringDeg = (this.secs / BUY_SECS) * 360
    if (this.phase === 'buy' && this.secs > 0 && this.secs <= 5) SFX.tick(this.secs)
    if (this.secs <= 0) {
      clearInterval(this.timer)
      this.startDraw()
    } else this.emit()
  }

  startRound() {
    this.wasNear = false
    this.hot = this.nextHot
    this.nextHot = pickHot()
    this.phase = 'buy'
    this.secs = BUY_SECS
    this.called = []
    this.mine = this.queued
    this.queued = []
    this.won = {}
    this.myBought = this.mine.length > 0
    this.tab = 0
    this.prevLn = []
    this.roundWin = 0
    this.batchWin = 0
    this.tray = Array(PER).fill(null)
    this.machine.reset()
    this.bots = Array.from({ length: 23 }, (_, i) => ({
      name: BOT_NAMES[i % 12] + (i >= 12 ? i : ''),
      ts: Array.from({ length: 1 + rnd(2) }, makeGrid),
    }))
    this.winners = []
    this.phaseLabel = 'Ticket Buying Phase'
    this.tl = 'until draw'
    this.banner = 'Buy your tickets before the draw starts.'
    clearInterval(this.timer)
    this.timer = window.setInterval(this.tick, 1000)
    this.tick()
    this.secs = BUY_SECS
    this.timerText = fmt(this.secs)
    this.render()
  }

  private startDraw() {
    this.phase = 'draw'
    this.phaseLabel = 'Live Draw'
    this.tl = 'drawing now'
    // an open card picker stays open: whatever is bought now plays in the next round
    if (this.modal.open) this.modal = { ...this.modal, forNext: true, hot: this.nextHot }
    this.render()
    // the machine starts on the riser's impact, so the fanfare doesn't land on top of the first ball
    const lead = SFX.go()
    this.say('Host', `Draw is live. ${PER} numbers per draw.`)
    setTimeout(() => {
      if (this.phase === 'draw') this.next()
    }, lead * 1000)
  }

  private next() {
    this.timerText = 'LIVE'
    this.ringDeg = 360
    this.callBatch()
  }

  /** Recompute the banner for the current phase and notify the UI. */
  render() {
    const set = this.calledSet
    const bests = this.mine.map(t => bestRow(t.rows, set))
    if (this.phase === 'buy') {
      this.banner = this.myBought ? this.mine.length + ' CARD' + (this.mine.length > 1 ? 'S' : '') + ' READY ✓' : 'Buy your cards before the draw'
    } else if (this.phase === 'draw' && this.mine.length) {
      const m = Math.min(...bests.map(b => 5 - b))
      this.banner = m <= 0 ? 'LINE!' : m + ' TO A LINE'
    } else if (this.phase === 'end') {
      this.banner = this.roundWin > 0 ? 'YOU WON KSh ' + this.roundWin : this.mine.length ? 'NO WIN THIS ROUND' : 'ROUND OVER'
    }
    this.emit()
  }

  private endRound() {
    this.phase = 'end'
    this.phaseLabel = 'Round Over'
    this.tl = 'next round'
    let s = END_SECS
    this.banner = this.won[12]
      ? this.won[12] === 'You' ? 'BINGO! You hit the Full House!' : this.won[12] + ' got the Full House.'
      : 'All 36 numbers called. Round over.'
    this.render()
    SFX.end()
    setTimeout(() => {
      if (this.mine.length) this.roundWin > 0 ? SFX.cheer(true) : SFX.aww()
    }, 800)
    if (this.mine.length) {
      const set = this.calledSet
      this.hostAfterRound(this.roundWin, this.mine.some(t => bestRow(t.rows, set) === 4))
    }
    this.timer = window.setInterval(() => {
      // hold the finished round while the win popup is up, so the cards behind it still show the line
      if (this.bingo) return
      s--
      this.timerText = fmt(s)
      if (s <= 0) {
        clearInterval(this.timer)
        this.startRound()
      } else this.emit()
    }, 1000)
    this.timerText = fmt(s)
    this.emit()
  }

  // ---- the draw ----
  private callBatch() {
    if (this.phase !== 'draw' || this.machine.busy) return
    const m = this.machine
    m.busy = true
    this.swirl = true
    const got: number[] = []
    this.banner = `Drawing ${PER} numbers…`
    // the rattle runs until the first ball is sucked into its pipe
    SFX.whirl((SPIN_UP + PICK_MS) / 1000)
    while (got.length < PER) got.push(drawNum(new Set([...this.called, ...got]), this.hot))
    this.emit()

    const spit = () => {
      if (this.phase !== 'draw') {
        got.forEach(n => m.remove(n))
        m.busy = false
        return
      }
      setTimeout(() => {
        got.forEach(n => {
          this.called.push(n)
          this.fresh.add(n)
          m.remove(n)
        })
        this.batchWin = 0
        this.check()
        this.lineCheck()
        this.render()
        setTimeout(() => {
          this.fresh = new Set()
        }, 900)
        this.engage(got)
        m.busy = false
        if (this.called.length >= MAXCALL || this.won[12]) this.endRound()
        else setTimeout(() => this.callBatch(), BATCH_GAP)
        this.swirl = false
        this.emit()
      }, 0)
    }

    setTimeout(() => {
      if (this.phase !== 'draw') {
        got.forEach(n => m.remove(n))
        m.busy = false
        return
      }
      // the last six stay in the tray through the spin-up, then make room for the new ones
      this.tray = Array(PER).fill(null)
      this.emit()
      // one ball per pipe, left to right, each one sliding down as soon as it is sucked in
      let ride = 0
      got.forEach((n, i) => {
        const mouth = PIPES[i].top
        setTimeout(() => {
          if (this.phase !== 'draw') {
            got.forEach(x => m.remove(x))
            m.busy = false
            return
          }
          m.pick(
            n,
            () => {
              // the landing sounds are scheduled by the ride itself, timed to the ball
              const mine = this.mine.some(tk => tk.flat.includes(n))
              this.fx?.pipeRide(
                i,
                n,
                () => {
                  this.tray[i] = n
                  this.emit()
                  if (++ride === PER) spit()
                },
                mine,
              )
            },
            (mouth.x - GLOBE.cx) / UNIT_VB,
            (mouth.y - GLOBE.cy) / UNIT_VB,
          )
        }, i * PICK_GAP)
      })
    }, SPIN_UP)
  }

  private toast(txt: string, cls: string) {
    const id = ++this.uid
    this.toasts.push({ id, txt, cls })
    this.emit()
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id)
      this.emit()
    }, 1700)
  }

  private engage(got: number[]) {
    if (!this.mine.length) return
    const hits = got.filter(n => this.mine.some(tk => tk.flat.includes(n))).length
    const set = this.calledSet
    const near = this.mine.some(t => bestRow(t.rows, set) === 4)
    if (hits >= 2) {
      setTimeout(() => {
        this.toast('COMBO ×' + hits + '!', 'combo')
        SFX.combo(hits)
      }, 450)
    }
    if (near && !this.wasNear) {
      setTimeout(() => {
        this.toast('SO CLOSE!', 'near')
        SFX.near()
        this.shakeKey++
        this.emit()
      }, hits >= 2 ? 1300 : 500)
    }
    this.wasNear = near
  }

  private check() {
    const set = this.calledSet
    TIERS.forEach(t => {
      if (this.won[t.n]) return
      let who: string | null = null
      let mineWin = false
      let wtk: Card | null = null
      this.mine.forEach(tk => {
        if (lines(tk.rows, set) >= t.n && !who) {
          who = 'You'
          mineWin = true
          wtk = tk
        }
      })
      if (!who) {
        const b = this.bots.find(b => b.ts.some(tk => lines(tk, set) >= t.n))
        if (b) who = b.name
      }
      if (who) {
        this.won[t.n] = who
        const pay = Math.round(((wtk as Card | null)?.price ?? PRICE) * t.x)
        if (mineWin) {
          this.pts += pay
          this.batchWin += pay
          this.roundWin += pay
          this.say('Host', 'You won ' + t.l + '! +KSh ' + pay)
        }
        this.winners.unshift({ id: ++this.uid, label: t.l + ' · ' + who, x: t.x })
        this.say('Host', who + ' won ' + t.l)
      }
    })
  }

  private lineCheck() {
    const set = this.calledSet
    let hit = -1
    this.mine.forEach((t, i) => {
      const n = lines(t.rows, set)
      if (n > (this.prevLn[i] || 0) && hit < 0) hit = i
      this.prevLn[i] = n
    })
    if (hit < 0) return
    // a single other card on screen would hide the winning one: show the card that won
    if (this.tab && this.tab !== hit + 1) this.tab = hit + 1
    this.showBingo(hit + 1, this.batchWin)
  }

  // ---- win popup ----
  private showBingo(card: number, win: number) {
    const tk = this.mine[card - 1]
    const set = this.calledSet
    const nl = tk ? lines(tk.rows, set) : 1
    const full = nl >= 12
    const stars = full ? 3 : nl >= 3 ? 3 : nl >= 2 ? 2 : 1
    const key = ++this.uid
    const accent = ACC[Math.min(nl, 4) >= 4 && !full ? 4 : full ? 12 : nl] || '#ffd24a'
    const title = full ? 'FULL HOUSE!' : nl === 1 ? 'LINE WIN!' : nl === 2 ? 'DOUBLE LINE!' : nl === 3 ? 'TRIPLE LINE!' : nl + ' LINES!'

    const mini: BingoView['mini'] = []
    if (tk) {
      const hl = lineCells(tk.flat, set)
      tk.flat.forEach((n, i) =>
        mini.push({
          cls: (n === 0 ? 'f' : set.has(n) ? 'm' : '') + (hl.has(i) ? ' w' : ''),
          label: n === 0 ? '★' : String(n),
          color: n ? colorOf(n) : '#ffd24a',
          delay: hl.has(i) ? (i % 7) * 0.07 : 0,
        }),
      )
    }

    const next = TIERS.find(x => x.n > nl)
    const cur = [...TIERS].reverse().find(x => x.n <= nl)
    const pr = tk ? tk.price : PRICE
    const gain = win > 0 ? 100 + nl * 20 : 25
    const oldF = (this.xp % XP_PER_LEVEL) / XP_PER_LEVEL
    this.xp += gain
    const nlv = Math.floor(this.xp / XP_PER_LEVEL)

    const cols = ['#f6b93b', '#38bdf8', '#ef4444', '#a855f7', '#22c55e', '#ec4899', '#fde047']
    const confetti: ConfettiPiece[] = []
    for (let side = 0; side < 2; side++)
      for (let i = 0; i < (LITE ? 12 : 34); i++) {
        const coin = i % 5 === 0
        const dir = side ? -1 : 1
        const sp = 0.4 + Math.random() * 0.8
        confetti.push({
          cls: 'shot' + (coin ? ' coin' : i % 3 === 0 ? ' rnd' : ''),
          left: side ? '94%' : '6%',
          dx: dir * (40 + Math.random() * 34) * sp + 'vw',
          dy: -(45 + Math.random() * 50) + 'vh',
          rot: Math.random() * 900 - 450 + 'deg',
          bg: coin ? undefined : cols[i % cols.length],
          delay: 0.15 + Math.random() * 0.5 + 's',
          dur: 2.4 + Math.random() * 1.4 + 's',
        })
      }

    this.bingo = {
      key,
      accent,
      title,
      sub: 'CARD ' + card + (tk ? ' · KSh ' + tk.price + ' CARD' : ''),
      mini,
      none: !(win > 0),
      plabel: win > 0 ? (full ? 'FULL HOUSE WIN' : nl > 1 ? nl + ' LINES WIN' : 'LINE WIN') : 'LINE COMPLETE',
      win,
      chip: win > 0 && cur ? '×' + cur.x + ' · ' + cur.l.toUpperCase() : '',
      next: next ? 'Next: ' + next.l + ' pays KSh ' + Math.round(pr * next.x) : 'Keep going!',
      stars,
      starsOn: 0,
      lvl: nlv + 1,
      gain,
      xpFrom: oldF * 100,
      xpTo: ((this.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100,
      tier: this.called.length + ' OF ' + MAXCALL + ' NUMBERS CALLED',
      calls: this.called.length + ' / ' + MAXCALL,
      balls: this.called.slice(-6),
      card,
      cards: this.mine.length,
      price: tk ? tk.price : 0,
      confetti,
    }
    for (let i = 0; i < stars; i++)
      setTimeout(() => {
        if (this.bingo?.key !== key) return
        this.bingo.starsOn = i + 1
        SFX.star(i)
        this.emit()
      }, 900 + i * 350)
    SFX.bingo()
    setTimeout(() => SFX.cheer(win > 0), 500)
    clearTimeout(this.bingoTimer)
    this.bingoTimer = window.setTimeout(() => this.hideBingo(), 6500)
  }

  /**
   * After the crowd's cheer or groan, the host speaks to the player: the total won this round, or a
   * nudge to play again. The line waits for the win popup to close so the two never overlap.
   */
  private hostAfterRound(win: number, near: boolean) {
    type Line = [shown: string, spoken: string, mood: HostLine['mood']]
    const pick = (a: Line[]) => a[rnd(a.length)]
    const [text, spoken, mood] =
      win > 0
        ? pick([
            [`Congratulations! You won KSh ${win} this round. Keep that luck rolling!`, `Congratulations! You won ${win} shillings this round. Keep that luck rolling!`, 'win'],
            [`What a round! KSh ${win} is yours. Ready to win again?`, `What a round! ${win} shillings is yours. Ready to win again?`, 'win'],
            [`Winner! KSh ${win} added to your balance. The next round starts now!`, `Winner! ${win} shillings added to your balance. The next round starts now!`, 'win'],
          ])
        : near
          ? pick([
              ['So close! Just one number away. Your luck is warming up, try again!', 'So close! Just one number away. Your luck is warming up, try again!', 'near'],
              ['One more number and that was yours! Grab your cards, the next one could be it.', 'One more number and that was yours! Grab your cards, the next one could be it.', 'near'],
            ])
          : pick([
              ['Not this time, but every round is a fresh chance. Try your luck again!', 'Not this time, but every round is a fresh chance. Try your luck again!', 'lose'],
              ["Hard luck this round! Pick your cards, the next winner could be you.", 'Hard luck this round! Pick your cards, the next winner could be you.', 'lose'],
              ["Don't give up! Fortune favours the brave. The next round starts now!", "Don't give up! Fortune favours the brave. The next round starts now!", 'lose'],
            ])
    const key = ++this.uid
    let waited = 0
    const go = () => {
      if (this.bingo && waited < 8000) {
        waited += 300
        return setTimeout(go, 300)
      }
      this.host = { key, text, mood }
      this.say('Host', text)
      SFX.say(spoken, true)
      this.emit()
      setTimeout(() => {
        if (this.host?.key !== key) return
        this.host = null
        this.emit()
      }, 6500)
    }
    // after the cheer or groan has had its moment
    setTimeout(go, 2000)
  }

  hideHost() {
    if (!this.host) return
    this.host = null
    this.emit()
  }

  hideBingo() {
    if (!this.bingo) return
    this.bingo = null
    this.emit()
  }

  // ---- tickets ----
  setTab(i: number) {
    this.tab = i
    this.render()
  }

  // ---- card picker ----
  private mod(i: number) {
    const n = this.modal.pool.length
    return (i + n) % n
  }

  openModal() {
    if (!this.canPick) return
    const forNext = this.phase !== 'buy'
    const hot = forNext ? this.nextHot : this.hot
    this.modal = { open: true, pool: buildPool(hot), picked: new Set(), idx: 0, openKey: ++this.uid, forNext, hot, quick: 0 }
    SFX.shimmer()
    this.emit()
  }

  /** Instant play: deal four cards at `price` each and open them, already selected, for confirmation. */
  openQuick(price: number) {
    if (!this.canPick || price * QUICK_CARDS > this.pts) return
    const forNext = this.phase !== 'buy'
    const hot = forNext ? this.nextHot : this.hot
    // every pool holds one card per price step, so each pool gives one card at this price
    const pool = Array.from({ length: QUICK_CARDS }, () => buildPool(hot).find(c => c.price === price)!)
    this.modal = {
      open: true,
      pool,
      picked: new Set(pool.map((_, i) => i)),
      idx: 0,
      openKey: ++this.uid,
      forNext,
      hot,
      quick: price,
    }
    SFX.deal()
    this.emit()
  }

  closeModal() {
    if (!this.modal.open) return
    this.modal = { ...this.modal, open: false }
    this.emit()
  }

  go(d: number) {
    this.modal.idx = this.mod(this.modal.idx + d)
    SFX.swipe()
    this.emit()
  }

  selectCard(i: number) {
    if (this.modal.idx !== i) {
      SFX.swipe()
      this.modal.idx = i
      this.emit()
    }
  }

  /** "Take this card": toggles the current card and, when added, moves on to the next one. */
  take() {
    const m = this.modal
    if (m.quick) return
    clearTimeout(this.advTimer)
    SFX.pop()
    if (m.picked.has(m.idx)) {
      m.picked.delete(m.idx)
      this.emit()
      return
    }
    if (m.picked.size >= 4) return
    m.picked.add(m.idx)
    this.emit()
    const at = m.idx
    this.advTimer = window.setTimeout(() => {
      if (this.modal.idx !== at || !this.modal.open) return
      SFX.swipe()
      this.modal.idx = this.mod(this.modal.idx + 1)
      this.emit()
    }, 450)
  }

  buy() {
    const m = this.modal
    if (!this.canPick || !m.picked.size) return
    const n = m.picked.size
    const cards = [...m.picked].map(i => m.pool[i])
    this.pts -= cards.reduce((a, c) => a + c.price, 0)
    SFX.coin()
    const s = n > 1 ? 's' : ''
    if (this.phase === 'buy') {
      this.mine = cards
      this.myBought = true
      this.say('Host', `You bought ${n} card${s}`)
    } else {
      this.queued = cards
      this.say('Host', `You bought ${n} card${s} for the next round. They join when this round ends.`)
    }
    this.closeModal()
    this.render()
  }

  // ---- settings ----
  setPref(k: PrefKey, v: boolean) {
    this.prefs = { ...this.prefs, [k]: v }
    if (k === 'guide') this.render()
    else SFX.set(k, v)
    SFX.pop()
    try {
      localStorage.setItem('qbprefs', JSON.stringify(this.prefs))
    } catch {
      /* storage unavailable */
    }
    this.emit()
  }
}

export const game = new Game()
