import { useEffect } from 'react'
import { SFX } from './audio/sfx'
import { game } from './game/store'
import { useGame } from './hooks/useGame'
import { Banner } from './components/Banner'
import { CalledPanel } from './components/CalledPanel'
import { CardModal } from './components/CardModal'
import { ChatPanel } from './components/ChatPanel'
import { Hero } from './components/Hero'
import { LeftPanel, NextBox } from './components/LeftPanel'
import { PotBar } from './components/PotBar'
import { SettingsPanel } from './components/SettingsPanel'
import { TicketsPanel } from './components/TicketsPanel'
import { WinPopup } from './components/WinPopup'
import { WinnersPanel } from './components/WinnersPanel'

export default function App() {
  const g = useGame()

  useEffect(() => {
    game.start()
    // Browsers only allow audio after a gesture.
    const unlock = () => SFX.init()
    addEventListener('pointerdown', unlock)
    return () => removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('noguide', !g.prefs.guide)
  }, [g.prefs.guide])

  return (
    <>
      <div className="arena">
        <div className="logo">
          QUICK BINGO<small>PLAY · WIN · ENJOY</small>
        </div>
        <PotBar />
        <LeftPanel />
        <NextBox />
        <Hero />
        <Banner />
        <CalledPanel />
        <WinnersPanel />
        <ChatPanel />
        <TicketsPanel />
        <div className="cover" />
      </div>
      <WinPopup />
      <SettingsPanel />
      <CardModal />
    </>
  )
}
