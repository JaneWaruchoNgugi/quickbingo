/**
 * Every sound in the game: a casino-funk groove (two loops in ./samples, music and music-draw,
 * that crossfade on the beat when numbers are drawn), a chunk → travel → ding sequence for each
 * of the six pipes, card and chip handling, a jackpot fanfare and a hall that cheers and claps.
 * Clips in ./samples are used where they exist (see samples/CREDITS.md); every other sound, and
 * any clip that fails to load, is synthesized live. The context starts on the first user gesture.
 */
type Bus = 'sfx' | 'music' | 'pad' | 'crowd'
interface Opts {
  vol?: number
  a?: number
  /** hold the level until the end instead of decaying */
  sus?: boolean
  type?: OscillatorType
  to?: number
  gl?: number
  vib?: number
  det?: number
  lp?: number
  hp?: number
  q?: number
  send?: number
  pan?: number
  bus?: Bus
}
interface NoiseOpts extends Opts {
  ft?: BiquadFilterType
  f0?: number
  f1?: number
}
interface ClipOpts {
  vol?: number
  pan?: number
  rate?: number
  /** fit the clip to this many seconds (fades out at the end) */
  dur?: number
  bus?: Bus
}

/**
 * Recordings by file name without extension. `name-1`, `name-2`… are takes of one sound and
 * one is picked at random each time. Each clip ships as .ogg and .m4a; the browser gets the one
 * it can play. Optional names: travel1…travel6 and ding1…ding6 (one per pipe).
 */
const CLIPS = import.meta.glob('./samples/*.{mp3,ogg,wav,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
/** Clip levels, so each recording sits where its synthesized version did. */
const CLIP_VOL: Record<string, number> = {
  music: 0.08,
  chunk: 0.3,
  coin: 0.34,
  card: 1.35,
  swipe: 0.47,
  fan: 0.33,
  deal: 0.75,
  rattle: 0.3,
  land: 0.14,
  tick: 0.63,
  near: 0.32,
  jackpot: 0.55,
  cheer: 1,
  'cheer-small': 0.72,
  applause: 0.8,
}
/** the file to load for each clip name, in the format this browser plays best */
function clipFiles() {
  const a = typeof Audio !== 'undefined' ? new Audio() : undefined
  const ok = (t: string) => !!a && a.canPlayType(t) !== ''
  const order = [ok('audio/ogg; codecs="vorbis"') && 'ogg', ok('audio/mp4; codecs="mp4a.40.2"') && 'm4a', 'mp3', 'wav', 'ogg', 'm4a']
  const by: Record<string, Record<string, string>> = {}
  for (const [path, url] of Object.entries(CLIPS)) {
    const m = path.match(/([^/]+)\.(\w+)$/)!
    ;(by[m[1]] ??= {})[m[2]] = url
  }
  return Object.entries(by).map(([name, f]) => {
    const urls = [...new Set(order.filter(Boolean) as string[])].filter(x => f[x]).map(x => f[x])
    return { name, urls }
  })
}

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
/** F – Dm – B♭ – C: bright, hopeful and always pulling forward */
const PROG = [
  [65, 69, 72],
  [62, 65, 69],
  [62, 65, 70],
  [64, 67, 72],
]
const ROOT = [41, 38, 34, 36]
/** the lead hook, one note per 8th (0 = rest) */
const HOOK = [
  [77, 0, 81, 0, 84, 0, 81, 79],
  [77, 0, 74, 0, 77, 0, 81, 0],
  [82, 0, 81, 0, 79, 0, 77, 74],
  [76, 0, 79, 0, 84, 0, 0, 0],
]
/** arpeggio order over the three chord tones and their octave */
const ARP = [0, 1, 2, 3, 2, 1, 0, 1]
const BPM = 128
/** music level, and where it returns to after being ducked */
const MUSIC = 3.6
/**
 * Per-sound level trims in dB, measured by rendering each sound offline so the travel sounds
 * sit above the music, the crowd leads the win, and small UI sounds stay subtle but audible.
 */
const TRIM: Record<string, number> = { whirl: 12.5, go: 3.5, hit: 4.5, combo: 1.5, cheer: 15, aww: 14, star: 3.5, tick: 10, pop: 13, swipe: 24, shimmer: 6, coin: 8, end: -2, land: 11 }
const SLIDE_TRIM = [17, 7, 15.5, -3, 15, 7.5]
const DING_TRIM = [6, 6.5, 5.5, 8, 14, 0.5]
const db = (x: number) => 10 ** (x / 20)
const S16 = 60 / BPM / 4

function createSfx() {
  let ctx: AudioContext | undefined
  let master!: GainNode
  let revIn!: GainNode
  let sfxBus!: GainNode
  let musicBus!: GainNode
  let padBus!: GainNode
  let crowdBus!: GainNode
  let noiseBuf!: AudioBuffer
  const bank: Record<string, AudioBuffer> = {}
  let sfxOn = true
  let musicOn = true
  let crowdOn = true
  let loopT: number | undefined
  let ir!: AudioBuffer
  /** the groove pre-rendered once per mood, so a busy page can never make it stutter */
  const loops: { idle?: AudioBuffer; draw?: AudioBuffer } = {}
  interface Voice {
    src: AudioBufferSourceNode
    g: GainNode
  }
  let loopPlay: { t0: number; idle: Voice; draw?: Voice; drawing: boolean; rec: boolean; lvl: number } | undefined
  let drawing: () => boolean = () => false
  /** level multiplier applied to every envelope while one sound is being scheduled */
  let boost = 1

  // ---- the caller: a hall host's voice for the big moments (start of the draw, near wins, wins) ----
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  let voiceOn = true
  let speaking = false
  const lines: string[] = []
  let callerVoice: SpeechSynthesisVoice | null | undefined
  function pickVoice() {
    if (callerVoice !== undefined || !synth) return callerVoice
    const all = synth.getVoices().filter(v => /^en/i.test(v.lang))
    if (!all.length) return null
    const like = ['Google UK English Male', 'Daniel', 'Microsoft Ryan', 'Microsoft Guy', 'Google US English', 'Alex', 'Samantha']
    callerVoice = like.map(n => all.find(v => v.name.includes(n))).find(Boolean) || all.find(v => /en-GB/i.test(v.lang)) || all[0]
    return callerVoice
  }
  function speakNext() {
    if (!synth || speaking || !lines.length) return
    const u = new SpeechSynthesisUtterance(lines.shift()!)
    const v = pickVoice()
    if (v) u.voice = v
    u.lang = v?.lang || 'en-GB'
    u.rate = 1.05
    u.pitch = 0.95
    speaking = true
    // some browsers drop onend, so never let the queue jam
    const fail = setTimeout(done, 4000)
    function done() {
      clearTimeout(fail)
      speaking = false
      speakNext()
    }
    u.onend = u.onerror = done
    synth.speak(u)
  }
  /** queue a line for the caller; urgent lines cut in front of the ball calls */
  function speak(text: string, urgent = false) {
    if (!synth || !voiceOn || !ctx) return
    if (urgent) {
      lines.length = 0
      synth.cancel()
      speaking = false
    }
    lines.push(text)
    // stay with the action: drop calls that fell too far behind
    if (lines.length > 6) lines.splice(0, lines.length - 6)
    speakNext()
  }

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
    const c = ctx
    master = c.createGain()
    master.gain.value = 2.6
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -20
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.2
    // a brick-wall limiter after the glue compressor keeps the louder mix from clipping
    const limit = c.createDynamicsCompressor()
    limit.threshold.value = -2.5
    limit.knee.value = 0
    limit.ratio.value = 20
    limit.attack.value = 0.001
    limit.release.value = 0.1
    master.connect(comp)
    comp.connect(limit)
    limit.connect(c.destination)

    // a bright hall: decorrelated noise tails, darker towards the end
    const len = Math.floor(c.sampleRate * 2)
    ir = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const k = i / len
        lp += (Math.random() * 2 - 1 - lp) * (0.9 - k * 0.75)
        d[i] = lp * Math.pow(1 - k, 2.8) * (i < c.sampleRate * 0.01 ? i / (c.sampleRate * 0.01) : 1)
      }
    }
    const rev = c.createConvolver()
    rev.buffer = ir
    revIn = c.createGain()
    revIn.connect(rev)
    const wet = c.createGain()
    wet.gain.value = 0.38
    rev.connect(wet)
    wet.connect(master)

    const bus = (v: number, to: AudioNode = master) => {
      const g = c.createGain()
      g.gain.value = v
      g.connect(to)
      return g
    }
    sfxBus = bus(1.5)
    crowdBus = bus(1.4)
    musicBus = bus(MUSIC)
    padBus = bus(1, musicBus)

    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

    const load = async (urls: string[]): Promise<AudioBuffer> => {
      for (const url of urls) {
        try {
          // a single-file build inlines clips as data: URLs, which some pages may not fetch
          const b = url.startsWith('data:')
            ? Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), ch => ch.charCodeAt(0)).buffer
            : await (await fetch(url)).arrayBuffer()
          // the callback form, because older Safari has no promise version
          return await new Promise<AudioBuffer>((ok, no) => c.decodeAudioData(b, ok, no))
        } catch {
          // try the next format
        }
      }
      throw new Error('no playable file')
    }
    const music = clipFiles().map(({ name, urls }) =>
      load(urls).then(buf => {
        bank[name] = buf
        if (name.startsWith('music')) syncMusic()
      }),
    )
    // the synthesized groove is only rendered if the recorded music cannot be played
    Promise.allSettled(music).then(() => {
      if (bank.music) return
      renderLoop(false, LOOP_STEPS)
        .then(b => (loops.idle = b))
        .then(() => renderLoop(true, LOOP_STEPS / 2))
        .then(b => (loops.draw = b))
        .catch(() => {})
    })
    clearInterval(loopT)
    loopT = window.setInterval(syncMusic, 200)
    // a silent line during the first tap unlocks speech on iOS
    if (synth) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      synth.speak(u)
      synth.onvoiceschanged = () => (callerVoice = undefined)
    }
  }

  const ok = () => !!ctx && sfxOn && ctx.state === 'running'
  const okM = () => !!ctx && musicOn && ctx.state === 'running'
  const okC = () => !!ctx && crowdOn && ctx.state === 'running'
  const now = () => ctx!.currentTime + 0.01
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)

  function dest(b: Bus = 'sfx') {
    return b === 'music' ? musicBus : b === 'pad' ? padBus : b === 'crowd' ? crowdBus : sfxBus
  }

  function env(t: number, dur: number, v: number, a: number, sus?: boolean) {
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    v *= boost
    g.gain.linearRampToValueAtTime(v, t + a)
    if (sus) {
      g.gain.setValueAtTime(v, Math.max(t + a, t + dur - 0.35))
      g.gain.linearRampToValueAtTime(0.0001, t + dur)
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    return g
  }

  function panner(pan: number) {
    const c = ctx!
    if (!c.createStereoPanner) return null
    const p = c.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    return p
  }

  /** source → filters → envelope → panner → bus, with a reverb send */
  function route(src: AudioNode, g: GainNode, o: Opts) {
    const c = ctx!
    let n = src
    for (const [type, f] of [
      ['lowpass', o.lp],
      ['highpass', o.hp],
    ] as [BiquadFilterType, number | undefined][]) {
      if (!f) continue
      const bq = c.createBiquadFilter()
      bq.type = type
      bq.frequency.value = f
      bq.Q.value = o.q ?? 0.7
      n.connect(bq)
      n = bq
    }
    n.connect(g)
    let last: AudioNode = g
    const p = o.pan ? panner(o.pan) : null
    if (p) {
      g.connect(p)
      last = p
    }
    last.connect(dest(o.bus))
    const s = o.send ?? 0.2
    if (s > 0) {
      const sg = c.createGain()
      sg.gain.value = s
      last.connect(sg)
      sg.connect(revIn)
    }
  }

  function tone(f: number, t: number, dur: number, o: Opts = {}) {
    const c = ctx!
    const os = c.createOscillator()
    os.type = o.type || 'sine'
    os.frequency.setValueAtTime(f, t)
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur * (o.gl ?? 1))
    if (o.det) os.detune.value = o.det
    if (o.vib) {
      const l = c.createOscillator()
      const lg = c.createGain()
      l.frequency.value = 5.5
      lg.gain.value = o.vib
      l.connect(lg)
      lg.connect(os.frequency)
      l.start(t)
      l.stop(t + dur + 0.05)
    }
    route(os, env(t, dur, o.vol ?? 0.1, o.a ?? 0.005, o.sus), o)
    os.start(t)
    os.stop(t + dur + 0.05)
  }

  function noiseSrc(t: number, dur: number) {
    const src = ctx!.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.05)
    return src
  }

  function noise(t: number, dur: number, o: NoiseOpts = {}) {
    const bq = ctx!.createBiquadFilter()
    bq.type = o.ft || 'bandpass'
    bq.frequency.setValueAtTime(o.f0 ?? 1000, t)
    if (o.f1) bq.frequency.exponentialRampToValueAtTime(o.f1, t + dur)
    bq.Q.value = o.q ?? 1
    noiseSrc(t, dur).connect(bq)
    route(bq, env(t, dur, o.vol ?? 0.1, o.a ?? 0.003, o.sus), { ...o, lp: undefined, hp: undefined })
  }

  /** the clip `name`, or a random take of it (name-1, name-2…) */
  function take(name: string) {
    if (bank[name]) return bank[name]
    const all: AudioBuffer[] = []
    for (let k = 1; bank[name + '-' + k]; k++) all.push(bank[name + '-' + k])
    return all.length ? all[Math.floor(Math.random() * all.length)] : undefined
  }

  /** play a recorded clip if one was supplied; false means use the synthesized sound */
  function clip(name: string, t: number, o: ClipOpts = {}) {
    const buf = take(name)
    if (!buf) return false
    const c = ctx!
    const src = c.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = o.rate ?? 1
    const g = c.createGain()
    // clips are levelled by CLIP_VOL, not by the synth trims
    const v = (o.vol ?? 1) * (CLIP_VOL[name] ?? 1)
    g.gain.setValueAtTime(v, t)
    if (o.dur) {
      g.gain.setValueAtTime(v, t + Math.max(0, o.dur - 0.15))
      g.gain.linearRampToValueAtTime(0.0001, t + o.dur)
    }
    src.connect(g)
    const p = o.pan ? panner(o.pan) : null
    if (p) {
      g.connect(p)
      p.connect(dest(o.bus))
    } else g.connect(dest(o.bus))
    src.start(t)
    if (o.dur) src.stop(t + o.dur + 0.05)
    return true
  }

  /** FM bell: a bright strike that melts into a pure tone */
  function bell(f: number, t: number, v: number, dur = 1.4, o: Opts = {}, ratio = 3.5, idx = 2.2) {
    const c = ctx!
    const car = c.createOscillator()
    const mod = c.createOscillator()
    const mg = c.createGain()
    car.frequency.value = f
    mod.frequency.value = f * ratio
    mg.gain.setValueAtTime(f * idx, t)
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.5)
    mod.connect(mg)
    mg.connect(car.frequency)
    route(car, env(t, dur, v, 0.002), { send: 0.35, ...o })
    car.start(t)
    mod.start(t)
    car.stop(t + dur + 0.05)
    mod.stop(t + dur + 0.05)
  }

  /** a bright plucked synth for the arpeggio: two detuned saws through a snappy filter */
  function pluckSynth(f: number, t: number, v: number, pan = 0) {
    for (const d of [-7, 7]) tone(f, t, 0.2, { vol: v, type: 'sawtooth', det: d, lp: 2600, q: 2, a: 0.002, pan, send: 0.3, bus: 'pad' })
  }
  /** the lead: a soft square voice doubled by a glockenspiel */
  function lead(f: number, t: number, dur: number, v: number) {
    tone(f, t, dur, { vol: v, type: 'square', lp: 3000, a: 0.005, vib: 4, pan: 0.15, send: 0.35, bus: 'music' })
    bell(f * 2, t, v * 0.9, 0.6, { bus: 'music', pan: -0.15, send: 0.4 }, 3.5, 1.2)
  }
  /** a pumping off-beat bass, like a house record */
  function bassNote(f: number, t: number, v: number) {
    tone(f, t, S16 * 1.7, { vol: v, a: 0.004, send: 0, bus: 'music' })
    tone(f, t, S16 * 1.5, { vol: v * 0.35, type: 'sawtooth', lp: 900, a: 0.004, send: 0, bus: 'music' })
  }
  function clap(t: number, v: number) {
    for (let k = 0; k < 3; k++) noise(t + k * 0.01, 0.02, { f0: 1400, q: 1.5, vol: v, bus: 'music', send: 0.15 })
    noise(t + 0.03, 0.14, { f0: 1300, q: 1, vol: v * 0.6, bus: 'music', send: 0.35 })
  }
  /** a sweep of tiny bells, like coins spilling, every few bars */
  function coinSweep(t: number, v: number) {
    ;[84, 86, 89, 91, 93, 96, 98, 101].forEach((m, k) => bell(mtof(m), t + k * 0.03, v, 0.4, { bus: 'music', pan: -0.5 + k * 0.14, send: 0.5 }))
  }

  /** a metal coin: inharmonic partials and a bright scrape */
  function clink(f: number, t: number, v: number, pan = 0) {
    ;[1, 2.76, 5.4, 8.93].forEach((r, k) => tone(f * r, t, 0.5 / (k + 1), { vol: v / (k + 1.4), a: 0.001, pan, send: 0.3 }))
    noise(t, 0.04, { ft: 'highpass', f0: 7000, vol: v * 0.6, pan })
  }

  /** two plastic balls knocking together */
  function clack(t: number, v: number, pan = 0) {
    const f = rnd(1600, 3200)
    tone(f, t, 0.045, { vol: v, to: f * 0.85, a: 0.001, pan, send: 0.15 })
    noise(t, 0.025, { f0: rnd(2500, 4500), q: 3, vol: v * 0.9, pan, send: 0.1 })
  }

  function kick(t: number, v: number, bus: Bus = 'music') {
    tone(150, t, 0.3, { vol: v, to: 45, gl: 0.45, a: 0.002, send: 0, bus })
    noise(t, 0.012, { ft: 'highpass', f0: 3000, vol: v * 0.25, send: 0, bus })
  }
  function snare(t: number, v: number) {
    tone(200, t, 0.1, { vol: v * 0.6, to: 140, a: 0.001, send: 0.1, bus: 'music' })
    noise(t, 0.16, { ft: 'highpass', f0: 1800, vol: v, a: 0.001, send: 0.25, bus: 'music' })
  }
  function hat(t: number, v: number, open = false) {
    noise(t, open ? 0.16 : 0.035, { ft: 'highpass', f0: 8500, vol: v, bus: 'music', send: 0.08, pan: open ? 0.25 : -0.2 })
  }
  function crash(t: number, v: number, dur = 2.2) {
    noise(t, dur, { ft: 'highpass', f0: 5200, f1: 3500, vol: v, a: 0.002, send: 0.5 })
    noise(t, dur * 0.5, { f0: 9000, q: 0.6, vol: v * 0.5, send: 0.3 })
  }
  function brass(f: number, t: number, dur: number, v: number, pan = 0, bus: Bus = 'sfx') {
    ;[-9, 0, 9].forEach(d => tone(f, t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.03, lp: 2800, q: 1.2, pan, send: 0.35, bus }))
  }

  // ---- the pipe sequence: chunk → travel → ding ----
  /** the latch that lets a ball into its pipe */
  function chunk(t: number, pan: number, deep = 1) {
    tone(150 * deep, t, 0.16, { vol: 0.24, to: 50 * deep, a: 0.002, pan, send: 0.1 })
    noise(t, 0.06, { f0: 900 * deep, q: 2, vol: 0.12, pan, send: 0.1 })
    tone(3200, t + 0.005, 0.02, { vol: 0.05, a: 0.001, pan, send: 0 })
  }
  /** a glass marble rolling: resonant ticks that speed up, over a soft hiss */
  function marbleRoll(t: number, d: number, pan: number) {
    let x = 0
    let gap = 0.075
    while (x < d) {
      const f = rnd(2200, 3400)
      noise(t + x, 0.03, { f0: f, q: 14, vol: 0.05 + (x / d) * 0.06, pan: pan + rnd(-0.08, 0.08), send: 0.2 })
      x += gap * rnd(0.8, 1.2)
      gap = Math.max(0.028, gap * 0.94)
    }
    noise(t, d, { f0: 5000, f1: 7000, q: 0.8, vol: 0.02, a: d * 0.5, pan, send: 0.2 })
  }
  /** a pneumatic tube: a breathy rush with a Doppler tone that passes by */
  function pneumatic(t: number, d: number, pan: number) {
    const c = ctx!
    const bq = c.createBiquadFilter()
    bq.type = 'lowpass'
    bq.Q.value = 3
    bq.frequency.setValueAtTime(400, t)
    bq.frequency.exponentialRampToValueAtTime(3200, t + d * 0.7)
    bq.frequency.exponentialRampToValueAtTime(700, t + d)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09 * boost, t + d * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08)
    noiseSrc(t, d + 0.1).connect(bq)
    route(bq, g, { pan, send: 0.3 })
    tone(520, t, d, { vol: 0.03, to: 380, gl: 1, a: d * 0.6, type: 'triangle', pan, send: 0.3 })
  }
  /** a spiral ride: the air wobbles around the ball as it turns */
  function wobble(t: number, d: number, pan: number) {
    const c = ctx!
    const bq = c.createBiquadFilter()
    bq.type = 'bandpass'
    bq.Q.value = 5
    bq.frequency.value = 1200
    const l = c.createOscillator()
    const lg = c.createGain()
    l.frequency.setValueAtTime(4, t)
    l.frequency.linearRampToValueAtTime(11, t + d)
    lg.gain.value = 700
    l.connect(lg)
    lg.connect(bq.frequency)
    noiseSrc(t, d + 0.1).connect(bq)
    route(bq, env(t, d + 0.08, 0.13, d * 0.4), { pan, send: 0.3 })
    l.start(t)
    l.stop(t + d + 0.15)
  }
  /** a deep vacuum pull: a low engine-like glide with rumble */
  function vacuum(t: number, d: number, pan: number) {
    tone(70, t, d + 0.1, { vol: 0.11, to: 150, a: d * 0.5, pan, send: 0.1 })
    tone(140, t, d + 0.1, { vol: 0.035, to: 300, a: d * 0.5, type: 'sawtooth', lp: 500, pan })
    noise(t, d + 0.1, { ft: 'lowpass', f0: 220, f1: 420, vol: 0.09, a: d * 0.5, pan, send: 0.05 })
  }
  /** a trail of tiny bells climbing all the way down the tube */
  function sparkleTrail(t: number, d: number, pan: number) {
    const notes = [84, 86, 88, 91, 93, 96, 98, 100]
    const n = Math.max(6, Math.round(d * 9))
    for (let k = 0; k < n; k++) {
      const x = (k / n) * d
      bell(mtof(notes[Math.min(notes.length - 1, Math.floor((k / n) * notes.length))]), t + x, 0.025 + (k / n) * 0.02, 0.35, { pan: pan + rnd(-0.15, 0.15), send: 0.45 })
    }
    noise(t, d, { ft: 'highpass', f0: 7000, f1: 10000, vol: 0.02, a: d * 0.7, pan, send: 0.4 })
  }
  /** a kalimba-like pluck: a warm tine with a woody knock */
  function kalimba(f: number, t: number, v: number, pan: number, dur = 1.1) {
    tone(f, t, dur, { vol: v, a: 0.002, pan, send: 0.35 })
    tone(f * 5.4, t, 0.09, { vol: v * 0.25, a: 0.001, pan, send: 0.2 })
    tone(f * 2, t, dur * 0.4, { vol: v * 0.18, a: 0.002, pan, send: 0.3 })
    noise(t, 0.02, { f0: 1800, q: 2, vol: v * 0.5, pan, send: 0.1 })
  }
  /** the ball pops up out of the hole: a quick rising blip and a soft thump */
  function popIn(t: number, pan: number, f = 300) {
    tone(f, t, 0.12, { vol: 0.09, to: f * 3, gl: 0.6, a: 0.002, pan, send: 0.15 })
    tone(110, t, 0.14, { vol: 0.12, to: 60, a: 0.002, pan, send: 0 })
  }

  // ---- crowd ----
  /** one pair of hands: a sharp double transient */
  function handClap(t: number, v: number, pan: number) {
    const f = rnd(900, 2600)
    noise(t, rnd(0.02, 0.045), { f0: f, q: rnd(0.8, 2), vol: v, a: 0.001, pan, bus: 'crowd', send: 0.25 })
    noise(t + 0.008, 0.03, { f0: f * 1.3, q: 1.5, vol: v * 0.5, a: 0.001, pan, bus: 'crowd', send: 0.2 })
  }
  /** a crowd voice: a gliding buzz through vowel formants */
  function voice(t: number, f0: number, f1: number, dur: number, v: number, fm: [number, number], pan: number) {
    const c = ctx!
    const os = c.createOscillator()
    os.type = 'sawtooth'
    os.frequency.setValueAtTime(f0, t)
    os.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6)
    const g = env(t, dur, v, 0.12)
    for (const f of fm) {
      const bq = c.createBiquadFilter()
      bq.type = 'bandpass'
      bq.frequency.value = f
      bq.Q.value = 5
      os.connect(bq)
      bq.connect(g)
    }
    route(g, c.createGain(), { pan, bus: 'crowd', send: 0.45 })
    os.start(t)
    os.stop(t + dur + 0.05)
  }
  function whistle(t: number, v: number) {
    const f = rnd(1900, 2600)
    tone(f, t, 0.8, { vol: v, to: f * 1.35, gl: 0.3, vib: 40, a: 0.04, pan: rnd(-0.7, 0.7), bus: 'crowd', send: 0.4 })
  }
  /** a hall full of people cheering and clapping: swells in, holds, then thins out */
  function crowd(t: number, d: number, size: number) {
    const rate = 38 * size
    for (let k = 0, n = Math.floor(rate * d); k < n; k++) {
      const x = Math.random() * d
      const lvl = Math.min(1, x / 0.35) * (x > d * 0.6 ? 1 - (x - d * 0.6) / (d * 0.4) : 1)
      handClap(t + x, 0.09 * (0.3 + 0.7 * lvl) * rnd(0.5, 1), rnd(-0.9, 0.9))
    }
    // the roar under the claps
    noise(t, d, { f0: 700, f1: 1100, q: 0.6, vol: 0.06 * size, a: 0.3, bus: 'crowd', send: 0.4 })
    noise(t, d * 0.8, { f0: 300, q: 0.8, vol: 0.05 * size, a: 0.25, bus: 'crowd', send: 0.3 })
    for (let k = 0; k < 12 * size; k++) {
      const f = rnd(200, 460)
      voice(t + Math.random() * 1.2, f, f * rnd(1.3, 1.8), rnd(0.8, 1.6), 0.028, k % 2 ? [700, 1150] : [380, 850], rnd(-0.85, 0.85))
    }
    for (let k = 0; k < 3 * size; k++) whistle(t + 0.2 + Math.random() * d * 0.5, 0.035)
  }
  /** pull the music down under a big moment */
  function duck(t: number, depth: number, hold: number) {
    const g = musicBus.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(MUSIC, t)
    g.linearRampToValueAtTime(MUSIC * depth, t + 0.05)
    g.setValueAtTime(MUSIC * depth, t + hold)
    g.linearRampToValueAtTime(MUSIC, t + hold + 0.6)
  }

  // ---- the groove ----
  /** eight bars while waiting (the hook plays every other time round); the draw loop is half that */
  const LOOP_STEPS = 128

  /**
   * Render the groove offline. The tail that rings past the end is folded back
   * onto the start, so the buffer loops without a seam.
   */
  async function renderLoop(draw: boolean, steps: number) {
    const real = { ctx, revIn, musicBus, padBus }
    const sr = real.ctx!.sampleRate
    const n = Math.round(steps * S16 * sr)
    const off = new OfflineAudioContext(2, n + sr * 2, sr)
    const rv = off.createConvolver()
    rv.buffer = ir
    const wet = off.createGain()
    // the loop is played through the music bus, so take its gain back out of the reverb
    wet.gain.value = 0.38 / MUSIC
    rv.connect(wet)
    wet.connect(off.destination)
    ctx = off as unknown as AudioContext
    revIn = off.createGain()
    revIn.connect(rv)
    musicBus = off.createGain()
    musicBus.connect(off.destination)
    padBus = off.createGain()
    padBus.connect(musicBus)
    try {
      for (let s = 0; s < steps; s++) beat(s % 64, s * S16, draw, s >> 6)
    } finally {
      ;({ ctx, revIn, musicBus, padBus } = real)
    }
    const out = await off.startRendering()
    const buf = real.ctx!.createBuffer(2, n, sr)
    for (let ch = 0; ch < 2; ch++) {
      const src = out.getChannelData(ch)
      const dst = buf.getChannelData(ch)
      dst.set(src.subarray(0, n))
      for (let i = n; i < src.length; i++) dst[i - n] += src[i]
    }
    return buf
  }

  /** start, stop and crossfade the music to match the settings and the game */
  function syncMusic() {
    if (!ctx) return
    const c = ctx
    const stop = () => {
      loopPlay?.idle.src.stop()
      loopPlay?.draw?.src.stop()
      loopPlay = undefined
    }
    if (!okM()) return stop()
    // the recorded loops when they loaded, otherwise the synthesized ones
    const rec = !!bank.music
    const idle = rec ? bank.music : loops.idle
    const draw = rec ? bank['music-draw'] : loops.draw
    const lvl = rec ? CLIP_VOL.music : 1
    if (loopPlay && loopPlay.rec !== rec) stop()
    const t = c.currentTime + 0.05
    // both loops run against the same clock, so switching between them lands on the beat
    const voice = (b: AudioBuffer, v: number, t0: number): Voice => {
      const src = c.createBufferSource()
      src.buffer = b
      src.loop = true
      const g = c.createGain()
      g.gain.value = v
      src.connect(g)
      g.connect(musicBus)
      src.start(t, (t - t0) % b.duration)
      return { src, g }
    }
    const d = drawing()
    if (!loopPlay) {
      if (!idle) return
      loopPlay = { t0: t, idle: voice(idle, lvl, t), drawing: false, rec, lvl }
    }
    if (!loopPlay.draw && draw) loopPlay.draw = voice(draw, 0, loopPlay.t0)
    if (loopPlay.draw && loopPlay.drawing !== d) {
      loopPlay.drawing = d
      // switch on the next beat, with a short crossfade
      const at = nextBeat(c.currentTime + 0.02)
      loopPlay.idle.g.gain.setTargetAtTime(d ? 0 : lvl, at, 0.06)
      loopPlay.draw.g.gain.setTargetAtTime(d ? lvl : 0, at, 0.06)
    }
  }

  /** the first beat (every `every` beats) of the music at or after time t */
  function nextBeat(t: number, every = 1) {
    if (!loopPlay) return t
    const b = (S16 * 4) * every
    return loopPlay.t0 + Math.ceil((t - loopPlay.t0 - 0.001) / b) * b
  }

  function beat(s: number, t: number, draw: boolean, cycle: number) {
    const bar = (s >> 4) & 3
    const p = s & 15
    const ch = PROG[bar]
    if (draw ? p % 4 === 0 : p === 0 || p === 8) {
      kick(t, draw ? 0.34 : 0.26)
      padBus.gain.setValueAtTime(0.5, t)
      padBus.gain.linearRampToValueAtTime(1, t + S16 * 3)
    }
    if (p === 4 || p === 12) clap(t, draw ? 0.08 : 0.055)
    // a clap roll into the top of the loop while the balls are drawn
    if (draw && bar === 3 && p >= 12) clap(t + S16 / 2, 0.02 + (p - 12) * 0.012)
    if (p % 4 === 2) hat(t, draw ? 0.05 : 0.035, true)
    else if (draw || p % 2 === 0) hat(t, 0.015)
    // off-beat bass on every "and"
    if (p % 4 === 2 || (draw && p % 4 === 3)) bassNote(mtof(ROOT[bar] + (p % 4 === 3 ? 12 : 0)), t, draw ? 0.1 : 0.085)
    // sparkling arpeggio: 8ths while waiting, 16ths during the draw, an octave up in the second half
    if (draw || p % 2 === 0) {
      const tones = [...ch, ch[0] + 12]
      pluckSynth(mtof(tones[ARP[p % 8]] + (draw && p >= 8 ? 12 : 0)), t, draw ? 0.02 : 0.016, Math.sin(s * 0.9) * 0.5)
    }
    // the hook: every other time round while waiting, every time while drawing
    if (p % 2 === 0 && (draw || cycle % 2 === 0)) {
      const m = HOOK[bar][p / 2]
      if (m) lead(mtof(m), t, S16 * 1.6, draw ? 0.03 : 0.024)
    }
    if (bar === 3 && p === 12) coinSweep(t, draw ? 0.03 : 0.022)
  }

  const api = {
    init,
    /** The music gets busier while numbers are being drawn. */
    bindDrawing(fn: () => boolean) {
      drawing = fn
    },
    set(k: 'sfx' | 'music' | 'crowd' | 'voice', v: boolean) {
      init()
      if (k === 'sfx') sfxOn = crowdOn = v
      if (k === 'music') musicOn = v
      if (k === 'crowd') crowdOn = v
      if (k === 'voice') {
        voiceOn = v
        if (!v) {
          lines.length = 0
          synth?.cancel()
        }
      }
      if (ctx) syncMusic()
    },
    /** the caller says something; urgent cuts off the ball calls */
    say(text: string, urgent = false) {
      speak(text, urgent)
    },
    /** the blower kicks in and the balls rattle around the globe */
    whirl() {
      if (!ok()) return
      const t = now()
      noise(t, 1.5, { f0: 380, f1: 1500, q: 0.9, vol: 0.12, a: 0.25, send: 0.3 })
      noise(t, 1.5, { ft: 'lowpass', f0: 180, f1: 320, vol: 0.11, a: 0.3, send: 0 })
      // recorded dice give the plastic rattle; the synthesized clacks fill it out
      const real = clip('rattle', t + 0.1, { pan: -0.35, rate: rnd(1.05, 1.2), dur: 1.4 })
      if (real) clip('rattle', t + 0.25, { pan: 0.35, rate: rnd(0.9, 1.05), dur: 1.3, vol: 0.8 })
      for (let k = 0; k < (real ? 18 : 34); k++) clack(t + 0.1 + Math.pow(Math.random(), 0.8) * 1.3, rnd(0.03, 0.09), rnd(-0.8, 0.8))
    },
    /** pipe i takes its ball: the chunk, then a travel sound lasting the whole ride (dur seconds) */
    slide(i = 0, dur = 1.1) {
      if (!ok()) return
      const t = now()
      const pan = (i - 2.5) / 3
      const deep = i === 3 ? 0.75 : i === 5 ? 0.85 : 1 + i * 0.04
      // the latch: a metal clunk, pitched per pipe, over the synthesized thump
      if (clip('chunk', t, { pan, rate: deep })) tone(120 * deep, t, 0.14, { vol: 0.14, to: 50, a: 0.002, pan, send: 0 })
      else chunk(t, pan, deep)
      boost = db(SLIDE_TRIM[i] ?? 0)
      const s = t + 0.05
      const d = Math.max(0.4, dur - 0.05)
      if (i === 5 || clip('travel' + (i + 1), s, { pan, dur: d, vol: 0.8 })) return
      if (i === 0) marbleRoll(s, d, pan)
      else if (i === 1) pneumatic(s, d, pan)
      else if (i === 2) wobble(s, d, pan)
      else if (i === 3) vacuum(s, d, pan)
      else if (i === 4) sparkleTrail(s, d, pan)
      // the sixth ball rides in silence so its reveal lands on its own
    },
    /** the ball arrives at its hole: each pipe has its own ding, the sixth a reveal */
    ding(i: number) {
      if (!ok()) return
      const t = now()
      const pan = (i - 2.5) / 3
      boost = db(DING_TRIM[i] ?? 0)
      if (clip('ding' + (i + 1), t, { pan, vol: 0.8 })) return
      // the six arrivals climb C – E – G – A – C – E, so every draw plays a little rising tune
      popIn(t, pan, 260 + i * 40)
      if (i === 0) kalimba(mtof(72), t + 0.03, 0.16, pan)
      else if (i === 1) {
        kalimba(mtof(76), t + 0.03, 0.15, pan)
        bell(mtof(88), t + 0.03, 0.04, 0.8, { pan })
      } else if (i === 2) {
        kalimba(mtof(79), t + 0.03, 0.14, pan)
        kalimba(mtof(84), t + 0.13, 0.08, pan, 0.6)
      } else if (i === 3) {
        kalimba(mtof(81), t + 0.03, 0.15, pan)
        tone(mtof(57), t + 0.03, 0.9, { vol: 0.06, type: 'triangle', pan })
      } else if (i === 4) {
        kalimba(mtof(84), t + 0.03, 0.14, pan)
        for (let k = 0; k < 5; k++) bell(mtof([96, 100, 103, 108][k % 4]), t + 0.08 + k * 0.05, 0.02, 0.35, { pan: pan + rnd(-0.3, 0.3) })
      } else {
        // the last ball: a full chord blooms, with a low boom and a shimmer
        kick(t, 0.4, 'sfx')
        ;[60, 64, 67, 72, 76].forEach((m, k) => kalimba(mtof(m + 12), t + 0.03 + k * 0.045, 0.1, -0.5 + k * 0.25, 1.6))
        tone(mtof(36), t, 1.4, { vol: 0.1, a: 0.005 })
        bell(mtof(100), t + 0.3, 0.05, 1.6, { send: 0.6 })
        noise(t + 0.1, 1.2, { ft: 'highpass', f0: 7000, f1: 11000, vol: 0.04, a: 0.15, send: 0.6 })
      }
    },
    /** the ball settles in the tray under its hole */
    land(_n: number, i: number) {
      if (!ok()) return
      const t = now()
      const pan = (i - 2.5) / 3
      if (clip('land', t, { pan, rate: rnd(0.9, 1.1) })) return
      tone(900, t, 0.05, { vol: 0.06, to: 600, a: 0.001, pan, send: 0.1 })
      tone(180, t, 0.08, { vol: 0.08, to: 110, a: 0.001, pan, send: 0 })
    },
    /** one of your numbers came up */
    hit() {
      if (!ok()) return
      const t = now()
      ;[0, 4, 7, 12].forEach((s, k) => bell(mtof(84 + s), t + k * 0.055, 0.1, 1.1, { pan: -0.4 + k * 0.27 }))
      noise(t + 0.1, 0.5, { ft: 'highpass', f0: 7000, f1: 11000, vol: 0.04, send: 0.5 })
    },
    /** end of a round you played */
    cheer(big: boolean) {
      if (!okC()) return
      const t = now()
      if (clip(big ? 'cheer' : 'cheer-small', t, { bus: 'crowd', dur: big ? 4.5 : 3 })) {
        return
      }
      crowd(t, big ? 3 : 2, big ? 1 : 0.6)
    },
    aww() {
      if (!okC()) return
      const t = now()
      noise(t, 1.6, { f0: 450, f1: 260, q: 0.6, vol: 0.05, a: 0.2, bus: 'crowd' })
      for (let k = 0; k < 9; k++) {
        const f = rnd(200, 360)
        voice(t + Math.random() * 0.25, f * 1.15, f * 0.6, rnd(1.2, 1.6), 0.035, [650, 1000], rnd(-0.8, 0.8))
      }
      for (let k = 0; k < 14; k++) handClap(t + 1.3 + Math.random() * 0.8, 0.04, rnd(-0.8, 0.8))
    },
    star(i: number) {
      if (!ok()) return
      const t = now()
      const m = [76, 79, 84, 88][Math.min(3, i)]
      bell(mtof(m), t, 0.13, 1.4)
      bell(mtof(m + 7), t + 0.07, 0.06, 1, { pan: 0.4 })
      noise(t, 0.35, { ft: 'highpass', f0: 8000, vol: 0.03, send: 0.5 })
    },
    /** several of your numbers in one draw */
    combo(n: number) {
      if (!ok()) return
      const t = now()
      const run = [72, 74, 76, 79, 81, 84, 86, 88, 91]
      const steps = Math.min(run.length, n + 3)
      for (let k = 0; k < steps; k++) bell(mtof(run[k]), t + k * 0.06, 0.09, 0.8, { pan: -0.6 + (1.2 * k) / steps })
      noise(t, 0.4, { f0: 600, f1: 5000, q: 1, vol: 0.05 })
      kick(t + steps * 0.06, 0.35, 'sfx')
      brass(mtof(run[steps - 1] - 12), t + steps * 0.06, 0.35, 0.03)
    },
    /** one number away: a heartbeat and a rising tension */
    near() {
      if (!ok()) return
      const t = now()
      if (clip('near', t)) return
      ;[0, 0.22, 0.75, 0.97].forEach((d, k) => tone(62, t + d, 0.22, { vol: k % 2 ? 0.16 : 0.24, to: 40, a: 0.004, send: 0 }))
      noise(t, 1.4, { f0: 300, f1: 4000, q: 4, vol: 0.05, a: 1.2, send: 0.5 })
      tone(mtof(64), t, 1.4, { vol: 0.05, to: mtof(76), type: 'sawtooth', lp: 1800, a: 0.6, vib: 9, send: 0.5 })
      bell(mtof(88), t + 1.35, 0.07, 1)
    },
    /** countdown woodblock in the last seconds, with a thump at the very end */
    tick(k: number) {
      if (!ok()) return
      const t = now()
      const f = k <= 1 ? 1500 : k <= 3 ? 1250 : 1000
      if (clip('tick', t, { rate: f / 1000 })) {
        // the clock hand, plus a thump that grows in the last seconds
        if (k <= 3) tone(80, t, 0.2, { vol: k <= 1 ? 0.2 : 0.13, to: 45, a: 0.002, send: 0 })
        return
      }
      tone(f, t, 0.06, { vol: 0.16, a: 0.001, send: 0.08 })
      tone(f * 2.4, t, 0.03, { vol: 0.05, a: 0.001, send: 0 })
      noise(t, 0.015, { f0: 3000, q: 2, vol: 0.05, send: 0 })
      if (k <= 2) tone(70, t, 0.18, { vol: 0.14, to: 45, send: 0 })
    },
    pop() {
      if (!ok()) return
      const t = now()
      if (clip('card', t, { rate: rnd(0.95, 1.08) })) return
      tone(380, t, 0.09, { vol: 0.14, to: 1100, a: 0.002, send: 0.12 })
      tone(1600, t + 0.03, 0.05, { vol: 0.04, a: 0.001 })
    },
    swipe() {
      if (!ok()) return
      const t = now()
      const pan = rnd(-0.4, 0.4)
      if (clip('swipe', t, { pan, rate: rnd(0.95, 1.1) })) return
      noise(t, 0.2, { f0: 900, f1: 4200, q: 1.3, vol: 0.07, a: 0.04, pan, send: 0.15 })
      noise(t + 0.17, 0.02, { f0: 3000, q: 2, vol: 0.04, pan })
    },
    /** quick pick: a fresh pack is opened and dealt */
    deal() {
      if (!ok()) return
      const t = now()
      if (!clip('deal', t)) api.shimmer()
      else clip('swipe', t + 0.35, { rate: 1.1 })
    },
    /** a harp glissando */
    shimmer() {
      if (!ok()) return
      const t = now()
      // the cards fan out over the harp
      if (clip('fan', t)) boost *= 0.6
      ;[72, 74, 76, 79, 81, 84, 86, 88, 91].forEach((m, k) => {
        tone(mtof(m), t + k * 0.035, 0.7, { vol: 0.05, type: 'triangle', a: 0.002, pan: -0.6 + k * 0.15, send: 0.45 })
        tone(mtof(m + 12), t + k * 0.035, 0.25, { vol: 0.015, a: 0.002, pan: -0.6 + k * 0.15 })
      })
    },
    /** cha-ching */
    coin() {
      if (!ok()) return
      const t = now()
      // chips hitting the stack, under the synthesized cha-ching
      if (clip('coin', t)) clip('coin', t + 0.09, { vol: 0.7, rate: 1.1, pan: 0.3 })
      tone(110, t, 0.12, { vol: 0.12, to: 60, send: 0 })
      clink(2100, t + 0.02, 0.07, -0.3)
      clink(2650, t + 0.1, 0.08, 0.3)
      noise(t + 0.1, 0.5, { ft: 'highpass', f0: 6000, vol: 0.05, send: 0.4 })
      bell(mtof(96), t + 0.14, 0.05, 0.9)
    },
    /** the draw starts: a riser into an impact */
    go() {
      if (!ok()) return
      const t = now()
      // the impact lands on a beat of the music
      const hit = nextBeat(t + 0.45)
      const r = hit - t
      noise(t, r, { f0: 400, f1: 6000, q: 1.5, vol: 0.08, a: r * 0.8, send: 0.4 })
      tone(110, t, r, { vol: 0.05, to: 880, type: 'sawtooth', lp: 3000, a: r * 0.7 })
      kick(hit, 0.5, 'sfx')
      crash(hit, 0.06, 1.4)
      ;[60, 64, 67, 72].forEach((m, k) => brass(mtof(m), hit, 0.45, 0.025, (k - 1.5) * 0.3))
    },
    /** round over: a gentle falling chime */
    end() {
      if (!ok()) return
      const t = now()
      ;[79, 76, 72].forEach((m, k) => bell(mtof(m), t + k * 0.16, 0.08, 1.4, { pan: 0.3 - k * 0.3 }))
      bell(mtof(48), t + 0.45, 0.12, 2.4, { send: 0.5 }, 1.4, 3)
    },
    /** the win popup: a short hit and the whole hall cheering and clapping */
    bingo() {
      if (!ctx || ctx.state !== 'running') return
      const t = now()
      duck(t, 0.2, 4)
      if (ok() && !clip('jackpot', t)) {
        kick(t, 0.55, 'sfx')
        crash(t, 0.08)
        ;[60, 64, 67, 72].forEach((m, k) => brass(mtof(m), t, 0.9, 0.025, (k - 1.5) * 0.3))
        ;[72, 76, 79, 84, 88].forEach((m, k) => bell(mtof(m), t + 0.05 + k * 0.06, 0.05, 1.4, { pan: -0.5 + k * 0.25 }))
      }
      if (!okC()) return
      // the cheer itself follows from cheer(), half a second later
      if (!clip('applause', t + 0.05, { bus: 'crowd', dur: 4.5 })) {
        boost = db(18)
        crowd(t + 0.05, 4, 1.3)
      }
    },
  }
  // every sound starts at its own trim and leaves the level at 1 for the next one
  for (const k of Object.keys(api) as (keyof typeof api)[]) {
    const f = api[k] as (...a: unknown[]) => void
    ;(api as Record<string, unknown>)[k] = (...a: unknown[]) => {
      boost = db(TRIM[k] ?? 0)
      try {
        f(...a)
      } finally {
        boost = 1
      }
    }
  }
  return api
}

export const SFX = createSfx()
