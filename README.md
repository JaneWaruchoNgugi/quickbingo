# Quick Bingo

Demo bingo room (single player, simulated bots, demo KSh points) built with React + Vite + TypeScript.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build in dist/
npm run preview
```

## Structure

```
src/
  main.tsx, App.tsx          entry and layout (the "arena")
  assets/                    stage.webp, podium.webp
  styles/                    CSS split by area, imported in cascade order by index.css
  game/
    constants.ts             rules, prize tiers, ball colours, helpers
    cards.ts                 card generation, lines, hot numbers, weighted draw, card pricing
    store.ts                 Game class: rounds, draw sequence, prizes, card picker, win popup, settings
  engine/machine.ts          canvas physics + rendering of the 85 balls in the globe
  audio/sfx.ts               Web Audio synth: music loop, effects, crowd
  hooks/useGame.ts           subscribes components to the store
  components/                PotBar, LeftPanel, Hero/Globe (+ PipeArt), CalledPanel, WinnersPanel,
                             ChatPanel, TicketsPanel, CardModal, WinPopup, SettingsPanel, Banner
```

## Rules in short

- 36 numbers are called, 3 at a time, from 1–75 (B 1–15, I 16–30, N 31–45, G 46–60, O 61–75).
- Each round 3 numbers per letter are "hot" and drawn three times as often; cards that hold more
  hot numbers have a higher simulated line chance and cost more (KSh 10–100).
- Payout = card price × tier: 1 line ×0.5, 2 lines ×1.2, 3 lines ×1.4, 4 lines ×1.6, full house ×1.8.
- Settings (sound, music, crowd, guide light) are saved in `localStorage` (`qbprefs`).
