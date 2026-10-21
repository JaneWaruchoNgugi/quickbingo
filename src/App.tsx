import { useEffect } from 'react'
import { SFX } from './audio/sfx'
import { game } from './game/store'
import { useGame } from './hooks/useGame'
import { Announcer } from './components/Announcer'
import { Banner } from './components/Banner'
import { CalledPanel } from './components/CalledPanel'
import { CardModal } from './components/CardModal'
import { ChatPanel } from './components/ChatPanel'
import { Hero, MobilePick } from './components/Hero'
import { LeftPanel, NextBox } from './components/LeftPanel'
import { TopBar } from './components/TopBar'
import { TicketsPanel } from './components/TicketsPanel'
import { WinPopup } from './components/WinPopup'
import { WinnersPanel } from './components/WinnersPanel'

export default function App() {
  const g = useGame()

  useEffect(() => {
    game.start()
    // browsers only let sound start from a tap or key press
    const unlock = () => SFX.init()
    const evs = ['pointerdown', 'keydown', 'touchend'] as const
    evs.forEach(e => window.addEventListener(e, unlock, { passive: true }))
    return () => evs.forEach(e => window.removeEventListener(e, unlock))
  }, [])

  useEffect(() => {
    document.body.classList.toggle('noguide', !g.prefs.guide)
  }, [g.prefs.guide])

  return (
    <>
      <div className={'arena' + (g.playing ? ' playing' : g.phase !== 'buy' ? ' watching' : '')}>
        <TopBar />
        <LeftPanel />
        <NextBox />
        <Hero />
        <MobilePick />
        <Banner />
        <CalledPanel />
        <WinnersPanel />
        <ChatPanel />
        <TicketsPanel />
        <div className="cover" />
      </div>
      <Announcer />
      <WinPopup />
      <CardModal />
    </>
  )
}
