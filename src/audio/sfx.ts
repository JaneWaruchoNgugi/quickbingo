/**
 * Web Audio synth for every sound in the game: a marimba/bass groove plus short effects.
 * Everything is generated live (no audio files). The context starts on the first user gesture.
 */
type Wave = OscillatorType
interface ToneOpts {
  vol?: number
  a?: number
  type?: Wave
  to?: number
  gl?: number
  vib?: number
  lp?: number
  send?: number
}

const F = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880,
  C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568,
}
const PENT = [F.C5, F.D5, F.E5, F.G5, F.A5, F.C6, F.D6, F.E6]
const LET = [F.C5, F.D5, F.E5, F.G5, F.A5]
const CH = [
  [F.C4, F.E4, F.G4, F.C5],
  [F.G4 / 2, F.D4, F.G4, F.D5],
  [F.A4 / 2, F.E4, F.A4, F.C5],
  [F.C4 * 0.667, F.C4, F.A4, F.C5],
]
const BASS = [130.81, 98, 110, 87.31]

function createSfx() {
  let ctx: AudioContext | undefined
  let master!: GainNode
  let rev!: ConvolverNode
  let sfxOn = true
  let musicOn = true
  let crowdOn = true
  let padT: number | undefined
  let step = 0
  let nextT = 0
  let drawing: () => boolean = () => false

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    } catch {
      return
    }
    master = ctx.createGain()
    master.gain.value = 0.85
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ctx.destination)
    const len = Math.floor(ctx.sampleRate * 1.4)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    }
    rev = ctx.createConvolver()
    rev.buffer = buf
    const w = ctx.createGain()
    w.gain.value = 0.3
    rev.connect(w)
    w.connect(master)
    nextT = ctx.currentTime + 0.2
    startLoop()
  }

  const ok = () => !!ctx && sfxOn && ctx.state === 'running'
  const okM = () => !!ctx && musicOn && ctx.state === 'running'
  const okC = () => !!ctx && crowdOn && ctx.state === 'running'

  function out(g: GainNode, send?: number) {
    g.connect(master)
    if (send) {
      const s = ctx!.createGain()
      s.gain.value = send
      g.connect(s)
      s.connect(rev)
    }
  }

  function tone(f: number, t: number, dur: number, o: ToneOpts = {}) {
    const c = ctx!
    const os = c.createOscillator()
    const g = c.createGain()
    const v = o.vol == null ? 0.2 : o.vol
    const a = o.a || 0.004
    os.type = o.type || 'sine'
    os.frequency.setValueAtTime(f, t)
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur * (o.gl || 1))
    if (o.vib) {
      const l = c.createOscillator()
      const lg = c.createGain()
      l.frequency.value = o.vib
      lg.gain.value = f * 0.03
      l.connect(lg)
      lg.connect(os.frequency)
      l.start(t)
      l.stop(t + dur + 0.05)
    }
    if (o.lp) {
      const fl = c.createBiquadFilter()
      fl.type = 'lowpass'
      fl.frequency.setValueAtTime(o.lp, t)
      fl.frequency.exponentialRampToValueAtTime(Math.max(200, o.lp * 0.2), t + dur)
      os.connect(fl)
      fl.connect(g)
    } else os.connect(g)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(v, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    out(g, o.send == null ? 0.3 : o.send)
    os.start(t)
    os.stop(t + dur + 0.05)
  }

  function marimba(f: number, t: number, v: number, d = 0.55) {
    tone(f, t, d, { vol: v, a: 0.003, send: 0.25 })
    tone(f * 4, t, 0.12, { vol: v * 0.35, a: 0.002 })
    tone(f * 10, t, 0.04, { vol: v * 0.15, a: 0.001 })
  }
  function xylo(f: number, t: number, v: number) {
    tone(f, t, 0.45, { vol: v, type: 'triangle', a: 0.002, send: 0.4 })
    tone(f * 3, t, 0.2, { vol: v * 0.3 })
  }
  function bubble(t: number, f: number, v?: number) {
    tone(f, t, 0.12, { vol: v || 0.1, to: f * 1.9, a: 0.005, send: 0.3 })
  }

  function noise(t: number, dur: number, f0: number, f1: number, q: number, v: number, typ?: BiquadFilterType) {
    const c = ctx!
    const n = Math.floor(c.sampleRate * dur)
    const b = c.createBuffer(1, n, c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const s = c.createBufferSource()
    s.buffer = b
    const bp = c.createBiquadFilter()
    bp.type = typ || 'bandpass'
    bp.Q.value = q
    bp.frequency.setValueAtTime(f0, t)
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(v, t + dur * 0.3)
    g.gain.linearRampToValueAtTime(0, t + dur)
    s.connect(bp)
    bp.connect(g)
    out(g, 0.25)
    s.start(t)
  }

  /** One sung "ooh/aah" of the crowd: sawtooth through formant filters with vibrato. */
  function voice(t: number, f0: number, f1: number, dur: number, vol: number, fm: number[]) {
    const c = ctx!
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f0, t)
    o.frequency.linearRampToValueAtTime(f1, t + dur)
    const l = c.createOscillator()
    const lg = c.createGain()
    l.frequency.value = 5 + Math.random() * 2
    lg.gain.value = f0 * 0.025
    l.connect(lg)
    lg.connect(o.frequency)
    l.start(t)
    l.stop(t + dur + 0.1)
    fm.forEach((fr, i) => {
      const b = c.createBiquadFilter()
      b.type = 'bandpass'
      b.frequency.value = fr * (0.94 + Math.random() * 0.12)
      b.Q.value = 7
      const bg = c.createGain()
      bg.gain.value = i ? 0.6 : 1
      o.connect(b)
      b.connect(bg)
      bg.connect(g)
    })
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.25)
    g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7)
    g.gain.linearRampToValueAtTime(0, t + dur)
    out(g, 0.45)
    o.start(t)
    o.stop(t + dur + 0.1)
  }

  function claps(t: number, dur: number, n: number, vol: number) {
    const c = ctx!
    const nb = Math.floor(c.sampleRate * 0.03)
    const b = c.createBuffer(1, nb, c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < nb; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nb, 2)
    for (let i = 0; i < n; i++) {
      const tt = t + Math.random() * dur
      const sw = Math.sin((Math.PI * (tt - t)) / dur) ** 0.6
      const s = c.createBufferSource()
      s.buffer = b
      s.playbackRate.value = 0.8 + Math.random() * 0.8
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1500 + Math.random() * 3000
      bp.Q.value = 0.7
      const g = c.createGain()
      g.gain.value = vol * sw * (0.4 + Math.random() * 0.6)
      s.connect(bp)
      bp.connect(g)
      out(g, 0.3)
      s.start(tt)
    }
  }

  /** Scheduler for the looping groove (104 BPM): bass, marimba arpeggio and a hi-hat tick. */
  function startLoop() {
    clearInterval(padT)
    const BPM = 104
    const EIGHTH = 60 / BPM / 2
    padT = window.setInterval(() => {
      if (!ctx) return
      while (nextT < ctx.currentTime + 0.4) {
        const t = nextT
        const k = step++
        const bar = Math.floor(k / 8) % 4
        const i8 = k % 8
        nextT += EIGHTH
        if (!okM()) continue
        const draw = drawing()
        const ch = CH[bar]
        if (i8 % 4 === 0) {
          tone(BASS[bar], t, 0.34, { vol: 0.075, type: 'triangle', a: 0.006, send: 0.1 })
          if (i8 === 4) tone(BASS[bar] * 2, t + EIGHTH, 0.2, { vol: 0.04, type: 'triangle' })
        }
        if (i8 % 2 === 0 || draw) {
          const n = ch[(k * 3 + (i8 >> 1)) % 4] * (i8 % 3 === 0 ? 2 : 1)
          marimba(n, t, draw ? 0.04 : 0.032, 0.4)
        }
        if (i8 === 2 || i8 === 6) noise(t, 0.05, 7000, 9000, 2, draw ? 0.025 : 0.015, 'highpass')
      }
    }, 120)
  }

  return {
    init,
    /** The music gets busier while numbers are being drawn. */
    bindDrawing(fn: () => boolean) {
      drawing = fn
    },
    set(k: 'sfx' | 'music' | 'crowd', v: boolean) {
      init()
      if (k === 'sfx') sfxOn = v
      if (k === 'music') musicOn = v
      if (k === 'crowd') crowdOn = v
    },
    whirl() {
      if (!ok()) return
      const t = ctx!.currentTime
      for (let i = 0; i < 14; i++) bubble(t + i * 0.065, PENT[i % PENT.length] * (i > 8 ? 1 : 0.5), 0.07 + i * 0.004)
      noise(t, 0.95, 300, 1800, 1.2, 0.12)
    },
    slide() {
      if (!ok()) return
      const t = ctx!.currentTime
      ;[F.G5, F.E5, F.C5].forEach((f, i) => tone(f * 1.6, t + i * 0.07, 0.55, { vol: 0.08, to: f * 0.45, vib: 9, type: 'sine' }))
    },
    spout() {
      if (!ok()) return
      const t = ctx!.currentTime
      tone(300, t, 0.12, { vol: 0.18, to: 90, a: 0.002, send: 0.1 })
      noise(t, 0.12, 2500, 900, 1, 0.07)
    },
    land(n: number, i: number) {
      if (!ok()) return
      const t = ctx!.currentTime + (i || 0) * 0.07
      const f = LET[Math.floor((n - 1) / 15)]
      marimba(f, t, 0.2, 0.9)
      tone(f * 0.5, t, 0.5, { vol: 0.08, to: f * 0.52, vib: 6 })
      tone(f * 2, t + 0.03, 0.3, { vol: 0.05, type: 'triangle' })
    },
    hit() {
      if (!ok()) return
      const t = ctx!.currentTime
      ;[F.G5, F.C6, F.E6].forEach((f, i) => xylo(f, t + 0.1 + i * 0.07, 0.1))
      noise(t + 0.1, 0.2, 6000, 10000, 0.8, 0.05, 'highpass')
    },
    cheer(big: boolean) {
      if (!okC()) return
      const t = ctx!.currentTime
      const d = big ? 3.4 : 1.9
      claps(t, d, big ? 170 : 80, 0.5)
      noise(t, d, 700, 1600, 0.5, big ? 0.12 : 0.07)
      const nv = big ? 7 : 4
      for (let i = 0; i < nv; i++) {
        const st = t + 0.05 + Math.random() * 0.7
        const f = 240 + Math.random() * 180
        voice(st, f, f * 1.5, 0.9 + Math.random() * 0.6, big ? 0.035 : 0.025, [i % 2 ? 700 : 400, i % 2 ? 1100 : 850])
      }
      if (big) for (let i = 0; i < 3; i++) voice(t + 0.3 + i * 0.25, 330 + i * 40, 520 + i * 60, 0.8, 0.03, [800, 1200])
    },
    aww() {
      if (!okC()) return
      const t = ctx!.currentTime
      noise(t, 1.6, 400, 260, 0.6, 0.07)
      for (let i = 0; i < 6; i++) {
        const st = t + Math.random() * 0.4
        const f = 360 + Math.random() * 120
        voice(st, f, f * 0.55, 1.2 + Math.random() * 0.4, 0.04, [680, 1050])
      }
      for (let i = 0; i < 3; i++) voice(t + 0.2 + i * 0.1, 170 + i * 10, 120, 1.3, 0.04, [350, 800])
      claps(t + 1.2, 0.8, 12, 0.08)
    },
    star(i: number) {
      if (!ok()) return
      const t = ctx!.currentTime
      marimba(PENT[2 + i * 2], t, 0.2, 0.8)
      tone(PENT[2 + i * 2] * 2, t, 0.4, { vol: 0.06, type: 'triangle' })
    },
    combo(n: number) {
      if (!ok()) return
      const t = ctx!.currentTime
      for (let i = 0; i < 4 + n; i++) xylo(PENT[Math.min(i, 7)], t + i * 0.055, 0.11)
      tone(F.C6, t + 0.35, 0.5, { vol: 0.07, type: 'square', lp: 3000 })
    },
    near() {
      if (!ok()) return
      const t = ctx!.currentTime
      tone(F.E5, t, 0.9, { vol: 0.09, to: F.C6, vib: 12, gl: 0.9, type: 'triangle' })
      for (let i = 0; i < 6; i++) tone(F.G5, t + i * 0.12, 0.08, { vol: 0.05, type: 'square', lp: 2000, send: 0.05 })
    },
    tick(k: number) {
      if (!ok()) return
      const t = ctx!.currentTime
      tone(k <= 2 ? 1200 : 900, t, 0.07, { vol: 0.14, type: 'triangle', a: 0.001, send: 0.05 })
      if (k <= 2) tone(F.G5, t + 0.05, 0.1, { vol: 0.05 })
    },
    pop() {
      if (!ok()) return
      const t = ctx!.currentTime
      tone(420, t, 0.1, { vol: 0.16, to: 900, a: 0.003, send: 0.15 })
    },
    swipe() {
      if (!ok()) return
      const t = ctx!.currentTime
      noise(t, 0.18, 700, 3000, 1.4, 0.06)
      tone(F.D5, t, 0.1, { vol: 0.05, to: F.A5, type: 'triangle' })
    },
    shimmer() {
      if (!ok()) return
      const t = ctx!.currentTime
      PENT.slice(0, 6).forEach((f, i) => xylo(f, t + i * 0.05, 0.07))
    },
    coin() {
      if (!ok()) return
      const t = ctx!.currentTime
      ;[F.E5, F.G5, F.C6, F.E6, F.G6].forEach((f, i) => {
        tone(f, t + i * 0.06, 0.35, { vol: 0.1, type: 'square', lp: 4000, a: 0.002 })
        tone(f * 2, t + i * 0.06, 0.2, { vol: 0.03 })
      })
    },
    go() {
      if (!ok()) return
      const t = ctx!.currentTime
      ;[F.C5, F.E5, F.G5, F.C6].forEach((f, i) => marimba(f, t + i * 0.1, 0.16, 0.7))
      tone(300, t, 0.5, { vol: 0.1, to: 1200, type: 'sawtooth', lp: 2500, send: 0.4 })
    },
    end() {
      if (!ok()) return
      const t = ctx!.currentTime
      ;[F.G5, F.E5, F.D5, F.C5].forEach((f, i) => marimba(f, t + i * 0.16, 0.15, 0.8))
    },
    bingo() {
      if (!ok()) return
      const t = ctx!.currentTime
      const brass = (f: number, tt: number, d: number) => {
        tone(f, tt, d, { vol: 0.11, type: 'sawtooth', lp: 2600, a: 0.02, send: 0.35 })
        tone(f * 1.005, tt, d, { vol: 0.07, type: 'square', lp: 1800, a: 0.02 })
      }
      ;[[F.C5, 0], [F.C5, 0.14], [F.C5, 0.28], [F.E5, 0.42], [F.G5, 0.62]].forEach(([f, d]) => brass(f, t + d, 0.2))
      brass(F.C6, t + 0.85, 0.7)
      brass(F.E5, t + 0.85, 0.7)
      brass(F.G5, t + 0.85, 0.7)
      for (let i = 0; i < 10; i++) xylo(PENT[i % 8] * (i > 7 ? 2 : 1), t + 0.9 + i * 0.06, 0.09)
      noise(t + 0.85, 0.9, 5000, 12000, 0.7, 0.1, 'highpass')
      tone(400, t, 0.7, { vol: 0.08, to: 1800, vib: 8, gl: 0.9 })
    },
  }
}

export const SFX = createSfx()
