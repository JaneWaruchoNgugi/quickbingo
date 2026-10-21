"""Render the game's sound effects to WAV (mono, 44.1 kHz). Physical-ish models: struck metal
modes for coins and bells, filtered noise for paper and air, a short room for glue."""
import numpy as np, sys, os
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)


def t_(d):
    return np.arange(int(d * SR)) / SR


def place(buf, x, at):
    i = int(at * SR)
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += x[:n]
    return buf


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def sweep_bp(x, f0, f1, q=1.5, blocks=64):
    """band-pass whose centre glides from f0 to f1 (block-wise, crossfaded)"""
    out = np.zeros_like(x)
    n = len(x)
    edges = np.linspace(0, n, blocks + 1).astype(int)
    for k in range(blocks):
        a, b = edges[k], edges[k + 1]
        fc = f0 * (f1 / f0) ** (k / max(1, blocks - 1))
        bw = fc / q
        lo, hi = max(40, fc - bw / 2), min(SR / 2 - 100, fc + bw / 2)
        pad = 512
        s = max(0, a - pad)
        y = bp(x[s:b], lo, hi)
        out[a:b] = y[a - s:]
    return out


def room(x, size=0.35, mix=0.12, bright=5000):
    n = int(size * SR)
    ir = rng.standard_normal(n) * np.exp(-t_(size) * 7 / size)
    ir = lp(ir, bright)
    ir[:int(0.008 * SR)] = 0
    wet = fftconvolve(x, ir)[:len(x) + n]
    n = len(wet) - len(x)
    wet /= np.max(np.abs(wet)) + 1e-9
    dry = np.concatenate([x, np.zeros(n)])
    return dry + wet * mix * np.max(np.abs(x))


def fade_tail(x, ms=8):
    n = int(ms / 1000 * SR)
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    x[:32] *= np.linspace(0, 1, 32)
    return x


def trim(x, thresh=4e-3):
    idx = np.where(np.abs(x) > thresh * np.max(np.abs(x)))[0]
    return x[:idx[-1] + int(0.01 * SR)] if len(idx) else x


def modal(f0, ratios, decays, amps, d, detune=0.0):
    t = t_(d)
    y = np.zeros_like(t)
    for r, dc, a in zip(ratios, decays, amps):
        f = f0 * r * (1 + detune * rng.uniform(-1, 1))
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / dc)
    return y


def click(d=0.004, lo=2000, hi=12000, amp=1.0):
    n = rng.standard_normal(int(d * SR)) * np.exp(-t_(d) / (d / 4))
    return bp(n, lo, hi) * amp


# ---------- coins: a small struck disc, strike + bounce ----------
COIN_R = [1, 1.52, 2.27, 2.98, 3.71, 4.95]


def coin_hit(f0, d=0.5, amp=1.0, dec=1.0):
    y = modal(f0, COIN_R, [0.22 * dec, 0.15 * dec, 0.11 * dec, 0.07 * dec, 0.05 * dec, 0.03 * dec],
              [1, 0.7, 0.55, 0.4, 0.3, 0.2], d, detune=0.004)
    c = click(0.003, 3000, 14000, 1.6)
    y[:len(c)] += c
    return y * amp


def coin(seed):
    r = np.random.default_rng(seed)
    f0 = r.uniform(2300, 3000)
    out = np.zeros(int(0.5 * SR))
    place(out, coin_hit(f0, 0.45), 0)
    # a quick second clink off the stack, then a little rattle
    place(out, coin_hit(f0 * r.uniform(1.08, 1.2), 0.35, 0.55, 0.7), r.uniform(0.045, 0.07))
    place(out, coin_hit(f0 * r.uniform(0.9, 1.0), 0.2, 0.22, 0.4), r.uniform(0.11, 0.14))
    return room(hp(out, 900), 0.25, 0.1)


# ---------- card snap / UI pop ----------
def card(seed):
    r = np.random.default_rng(seed)
    d = 0.16
    t = t_(d)
    paper = bp(r.standard_normal(len(t)), 1800, 7500) * np.exp(-t / 0.012)
    thump = np.sin(2 * np.pi * (170 + 0 * t) * t) * np.exp(-t / 0.025) * 0.5
    # a small bright "pop" that makes a tap feel rewarding
    f = r.uniform(700, 880)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.9 * (1 - np.exp(-t / 0.02)))) / SR
    pop = np.sin(ph) * np.exp(-t / 0.03) * 0.45
    y = paper * 1.2 + thump + pop
    return room(y, 0.2, 0.08)


# ---------- whoosh ----------
def swipe(seed):
    r = np.random.default_rng(seed)
    d = r.uniform(0.2, 0.3)
    t = t_(d)
    n = r.standard_normal(len(t))
    y = sweep_bp(n, r.uniform(700, 1000), r.uniform(3500, 5500), q=1.4)
    peak = r.uniform(0.55, 0.7)
    envl = np.sin(np.pi * np.clip(t / d, 0, 1) ** (np.log(0.5) / np.log(peak))) ** 2
    return room(y * envl, 0.25, 0.1)


# ---------- card flick (used in deal and fan) ----------
def flick(r, amp=1.0):
    d = 0.05
    t = t_(d)
    y = bp(r.standard_normal(len(t)), 1500, 9000) * np.exp(-t / 0.007)
    y += np.sin(2 * np.pi * r.uniform(220, 300) * t) * np.exp(-t / 0.01) * 0.25
    return y * amp


def deal():
    r = np.random.default_rng(11)
    out = np.zeros(int(0.75 * SR))
    at, gap = 0.0, 0.045
    for k in range(13):
        place(out, flick(r, 0.5 + 0.5 * k / 12), at)
        at += gap
        gap *= 0.93
    # the pack squares up
    place(out, card(5) * 1.3, at + 0.05)
    return room(out, 0.3, 0.1)


def fan():
    r = np.random.default_rng(21)
    out = np.zeros(int(0.55 * SR))
    for k in range(7):
        place(out, flick(r, 0.7), k * 0.032)
    # a light airy sparkle as the cards spread
    t = t_(0.45)
    sh = sweep_bp(r.standard_normal(len(t)), 3000, 9000, q=2) * np.sin(np.pi * t / 0.45) ** 2 * 0.25
    place(out, sh, 0.02)
    return room(out, 0.3, 0.12)


# ---------- countdown tick: a woodblock ----------
def tick():
    y = modal(1000, [1, 2.71, 4.1], [0.03, 0.012, 0.006], [1, 0.4, 0.2], 0.09)
    c = click(0.002, 2000, 9000, 0.8)
    y[:len(c)] += c
    return room(y, 0.15, 0.06)


# ---------- bells for chimes ----------
BELL_R = [0.5, 1, 1.19, 1.5, 2.0, 2.52, 3.0, 4.07]


def bell(f, d=1.2, amp=1.0, dec=1.0):
    y = modal(f, BELL_R, [x * dec for x in [0.9, 0.7, 0.4, 0.35, 0.3, 0.18, 0.12, 0.07]],
              [0.25, 1, 0.3, 0.35, 0.5, 0.2, 0.15, 0.08], d, detune=0.001)
    a = int(0.002 * SR)
    y[:a] *= np.linspace(0, 1, a)
    return y * amp


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def star(i):
    m = [76, 79, 84, 88][i]
    out = np.zeros(int(1.2 * SR))
    place(out, bell(mtof(m), 1.1), 0)
    place(out, bell(mtof(m + 7), 0.8, 0.4, 0.7), 0.07)
    t = t_(0.3)
    place(out, hp(rng.standard_normal(len(t)), 7000) * np.exp(-t / 0.08) * 0.12, 0)
    return room(out, 0.8, 0.25)


def end():
    out = np.zeros(int(2.0 * SR))
    for k, m in enumerate([79, 76, 72]):
        place(out, bell(mtof(m), 1.3, 0.8), k * 0.16)
    place(out, bell(mtof(60), 1.5, 0.6, 1.2), 0.45)
    return room(out, 1.0, 0.25)


# ---------- near: heartbeat under a rising swell ----------
def near():
    d = 1.6
    out = np.zeros(int(d * SR))
    for at, a in [(0, 1), (0.2, 0.7), (0.72, 1), (0.92, 0.7)]:
        t = t_(0.25)
        f = 70 * np.exp(-t / 0.08) + 42
        ph = 2 * np.pi * np.cumsum(f) / SR
        place(out, np.sin(ph) * np.exp(-t / 0.07) * a, at)
    t = t_(1.4)
    swell = sweep_bp(rng.standard_normal(len(t)), 400, 4500, q=3) * (t / 1.4) ** 2 * 0.25
    place(out, swell, 0)
    f = mtof(64) * (2 ** (t / 1.4))
    rise = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / 1.4) ** 1.5 * 0.12
    place(out, rise, 0)
    place(out, bell(mtof(88), 0.25, 0.4, 0.4), 1.33)
    return room(out, 0.6, 0.2)


# ---------- jackpot: impact, brass stab, rising arpeggio, coin shower ----------
def brass(f, d, amp=1.0):
    t = t_(d)
    y = np.zeros_like(t)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.3, 0, 1)
    for h in range(1, 12):
        y += np.sin(2 * np.pi * f * h * np.cumsum(vib) / SR) / h ** 1.1
    a = np.clip(t / 0.03, 0, 1)
    rel = np.clip((d - t) / 0.25, 0, 1)
    y = lp(y * a * rel, 3500)
    return y * amp


def jackpot():
    d = 2.6
    out = np.zeros(int(d * SR))
    t = t_(0.4)
    kick = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t / 0.05) + 45) / SR) * np.exp(-t / 0.12)
    place(out, kick * 1.2, 0)
    t = t_(1.2)
    crash = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t / 0.35) * 0.3
    place(out, crash, 0)
    for k, m in enumerate([60, 64, 67, 72]):
        place(out, brass(mtof(m), 0.7, 0.18), 0)
    for k, m in enumerate([72, 76, 79, 84, 88, 91]):
        place(out, bell(mtof(m), 1.4, 0.55), 0.08 + k * 0.07)
    # coins raining down
    r = np.random.default_rng(3)
    for k in range(26):
        at = 0.25 + r.uniform(0, 1.6) ** 1.3
        if at < d - 0.3:
            place(out, coin_hit(r.uniform(2400, 3600), 0.3, r.uniform(0.08, 0.2), 0.6), at)
    out *= np.clip((d - t_(d)) / 0.5, 0, 1)
    return room(out, 1.0, 0.22)


SOUNDS = {
    **{f'coin-{k}': (lambda k=k: coin(k)) for k in (1, 2, 3)},
    **{f'card-{k}': (lambda k=k: card(k)) for k in (1, 2, 3)},
    **{f'swipe-{k}': (lambda k=k: swipe(k)) for k in (1, 2, 3)},
    'deal': deal, 'fan': fan, 'tick': tick, 'near': near, 'jackpot': jackpot,
    **{f'star-{k + 1}': (lambda k=k: star(k)) for k in range(4)},
    'end': end,
}

for name, fn in SOUNDS.items():
    y = fade_tail(trim(fn()))
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
    wavfile.write(f'{OUT}/{name}.wav', SR, (y * 32767).astype(np.int16))
    print(name, f'{len(y) / SR:.2f}s')
