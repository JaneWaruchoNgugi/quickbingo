/**
 * Phones and small or low-memory devices get a lighter show: fewer particles, a 30 fps machine
 * and no running lights. The full show on such devices could run out of graphics memory and go black.
 */
export const LITE =
  typeof window !== 'undefined' &&
  (matchMedia('(max-width:899px)').matches ||
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4 ||
    (navigator.hardwareConcurrency || 8) <= 4)

export const MAXCALL = 36
/** Numbers per draw: one down each of the six pipes. */
export const PER = 6
export const PRICE = 20
/** Instant play: card prices a player can tap to get four cards at that price. */
export const QUICK_PRICES = [10, 20, 50, 100]
export const QUICK_CARDS = 4
export const BUY_SECS = 15
/** Pause after the last ball before the next round's card picking starts. */
export const END_SECS = 2
export const START_POINTS = 2450

export interface Tier {
  n: number
  l: string
  x: number
}

/** Prize tiers: a card that completes `n` lines pays price × x. */
export const TIERS: Tier[] = [
  { n: 1, l: '1 Line', x: 0.5 },
  { n: 2, l: '2 Lines', x: 1.2 },
  { n: 3, l: '3 Lines', x: 1.4 },
  { n: 4, l: '4 Lines', x: 1.6 },
  { n: 12, l: 'Full House', x: 1.8 },
]

/** B sky blue, I red, N yellow, G purple, O green. */
export const LC = ['#38bdf8', '#ef4444', '#fbbf24', '#a855f7', '#22c55e']
export const RIMS = [
  ['#38bdf8', '#6366f1', '#22d3ee'],
  ['#ef4444', '#f97316', '#ef4444'],
  ['#fde047', '#facc15', '#fde047'],
  ['#a855f7', '#ec4899', '#7c3aed'],
  ['#22c55e', '#a3e635', '#22c55e'],
]
/** Accent colour of the win popup by number of lines (12 = full house). */
export const ACC: Record<number, string> = { 1: '#38bdf8', 2: '#a3e635', 3: '#ff9f1c', 4: '#ec4899', 12: '#ff4d6d' }

export const BOT_NAMES = ['QueenBingo', 'LuckyStar', 'BingoPro', 'TopPlayer', 'Player_4D2F', 'Mia', 'Kofi', 'Zed', 'Anya', 'Leo', 'Tariq', 'Nova']
export const CHAT_LINES = ['Good luck everyone!', 'This looks amazing!', 'Come on 41!', 'Just joined the room', 'Anyone got a good strategy?', 'So close!', 'Nice setup!']
export const CHATTERS = ['QueenBingo', 'LuckyStar', 'BingoPro', 'TopPlayer']

const col = (n: number) => Math.floor((n - 1) / 15)
export const colorOf = (n: number) => LC[col(n)]
export const rimOf = (n: number) => RIMS[col(n)]
export const letterOf = (n: number) => 'BINGO'[col(n)]

/** CSS background of a bingo ball (rim colours + glossy highlights). */
export const ballBg = (n: number) => {
  const r = rimOf(n)
  return `radial-gradient(circle at 30% 24%,#ffffffb0 0,#fff0 24%),radial-gradient(circle at 36% 30%,#fff0 40%,#0000 55%,#0006 100%),radial-gradient(circle,transparent 62%,#0004 100%),conic-gradient(from 25deg,${r[0]},${r[1]},${r[2]},${r[0]})`
}

export const fmt = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
export const rnd = (n: number) => Math.floor(Math.random() * n)
