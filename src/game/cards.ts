import { MAXCALL, rnd } from './constants'

export type Grid = number[][]

/** A card on offer or bought: 5×5 grid (rows, 0 = FREE) plus the pricing data. */
export interface Card {
  rows: Grid
  flat: number[]
  p1: number
  p2: number
  hotN: number
  price: number
}

export function makeGrid(): Grid {
  const cols: number[][] = []
  ;[[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]].forEach(([a, b]) => {
    const p: number[] = []
    while (p.length < 5) {
      const v = a + rnd(b - a + 1)
      if (!p.includes(v)) p.push(v)
    }
    cols.push(p)
  })
  const rows = [0, 1, 2, 3, 4].map(r => cols.map(c => c[r]))
  rows[2][2] = 0
  return rows
}

export function lineList(t: Grid): number[][] {
  const L: number[][] = []
  for (let i = 0; i < 5; i++) {
    L.push(t[i])
    L.push(t.map(r => r[i]))
  }
  L.push([0, 1, 2, 3, 4].map(i => t[i][i]))
  L.push([0, 1, 2, 3, 4].map(i => t[i][4 - i]))
  return L
}

/** Cell indexes (row-major) of the same 12 lines as `lineList`. */
export const LINE_IDX: number[][] = (() => {
  const IDX: number[][] = []
  for (let i = 0; i < 5; i++) {
    IDX.push([0, 1, 2, 3, 4].map(c => i * 5 + c))
    IDX.push([0, 1, 2, 3, 4].map(r => r * 5 + i))
  }
  IDX.push([0, 6, 12, 18, 24])
  IDX.push([4, 8, 12, 16, 20])
  return IDX
})()

/** Number of completed lines. */
export const lines = (t: Grid, set: Set<number>) => lineList(t).filter(l => l.every(v => v === 0 || set.has(v))).length

/** Cell indexes (row-major) of every completed line. */
export function lineCells(flat: number[], set: Set<number>): Set<number> {
  const out = new Set<number>()
  LINE_IDX.forEach(l => {
    if (l.every(i => flat[i] === 0 || set.has(flat[i]))) l.forEach(i => out.add(i))
  })
  return out
}

/** Most marked cells in any single line. */
export function bestRow(t: Grid, set: Set<number>) {
  let best = 0
  lineList(t).forEach(l => {
    best = Math.max(best, l.filter(v => v === 0 || set.has(v)).length)
  })
  return best
}

export function pickHot(): Set<number> {
  const hot = new Set<number>()
  for (let c = 0; c < 5; c++) {
    let k = 0
    while (k < 3) {
      const n = 1 + c * 15 + rnd(15)
      if (!hot.has(n)) {
        hot.add(n)
        k++
      }
    }
  }
  return hot
}

/** Weighted draw: hot numbers come up 3× as often. */
export function drawNum(ex: Set<number>, hot: Set<number>) {
  const w: number[] = []
  let tot = 0
  for (let n = 1; n <= 75; n++) {
    const x = ex.has(n) ? 0 : hot.has(n) ? 3 : 1
    w[n] = x
    tot += x
  }
  let r = Math.random() * tot
  for (let n = 1; n <= 75; n++) {
    if (!w[n]) continue
    r -= w[n]
    if (r <= 0) return n
  }
  return 1
}

/**
 * Ten cards priced KES 10–100. 260 simulated rounds estimate each candidate's chance of a
 * line (p1) and of two lines (p2); better cards cost more.
 */
export function buildPool(hot: Set<number>): Card[] {
  const S = 260
  const sims: Uint8Array[] = []
  for (let k = 0; k < S; k++) {
    const keys: [number, number][] = []
    for (let n = 1; n <= 75; n++) keys.push([-Math.log(Math.random()) / (hot.has(n) ? 3 : 1), n])
    keys.sort((a, b) => a[0] - b[0])
    const c = new Uint8Array(76)
    for (let j = 0; j < MAXCALL; j++) c[keys[j][1]] = 1
    sims.push(c)
  }
  const cand = Array.from({ length: 30 }, () => {
    const rows = makeGrid()
    const L = lineList(rows)
    let l1 = 0
    let l2 = 0
    sims.forEach(c => {
      let n = 0
      L.forEach(l => {
        if (l.every(v => v === 0 || c[v])) n++
      })
      if (n >= 1) l1++
      if (n >= 2) l2++
    })
    const flat = rows.flat()
    return { rows, flat, p1: l1 / S, p2: l2 / S, hotN: flat.filter(v => hot.has(v)).length, price: 0 } as Card
  })
  cand.sort((a, b) => a.p2 - b.p2 || a.hotN - b.hotN)
  const pick: Card[] = []
  for (let k = 0; k < 10; k++) {
    const t = cand[Math.round((k * 29) / 9)]
    t.price = Math.round((10 + (90 * k) / 9) / 5) * 5
    pick.push(t)
  }
  for (let i = pick.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[pick[i], pick[j]] = [pick[j], pick[i]]
  }
  return pick
}

export const tierOf = (p: number): [string, string] =>
  p >= 80 ? ['JACKPOT HUNTER', '#ff5d73'] : p >= 55 ? ['HOT CARD', '#ff9f1c'] : p >= 35 ? ['STEADY', '#38bdf8'] : ['LONG SHOT', '#a3e635']

/** Cells (row-major indexes) to nudge: the unmarked ones of the line closest to completing (≥3 marked). */
export function needCells(rows: Grid, set: Set<number>): Set<number> {
  const v = rows.flat()
  const marked = (i: number) => v[i] === 0 || set.has(v[i])
  let best: number[] | null = null
  let bc = 1
  LINE_IDX.forEach(l => {
    const c = l.filter(marked).length
    if (c < 5 && c > bc) {
      bc = c
      best = l
    }
  })
  const out = new Set<number>()
  if (best && bc >= 3) (best as number[]).forEach(i => !marked(i) && out.add(i))
  return out
}
