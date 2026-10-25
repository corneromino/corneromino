import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { observeDialogViewport } from '@/lib/dialogViewport'
import { Play } from '@/features/play/Play'
import { ClassicTutorial } from '@/features/play/ClassicTutorial'
import { MainMenu } from '@/features/main-menu/MainMenu'
import { SavedGames } from '@/features/saved-games/SavedGames'
import { Sandbox } from '@/features/sandbox/Sandbox'
import { SandboxWorld } from '@/features/sandbox/SandboxWorld'
import { Cascade } from '@/features/cascade/Cascade'
import { CascadeMenu } from '@/features/cascade/CascadeMenu'
import { VsLocalGrid } from '@/features/vs/VsLocalGrid'
import { VsMenu } from '@/features/vs/VsMenu'
import { Settings } from '@/features/settings/Settings'

function App() {
  useEffect(() => observeDialogViewport(window.visualViewport, document.documentElement), [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<MainMenu />} path="/" />
        <Route element={<Play />} path="/play" />
        <Route element={<ClassicTutorial />} path="/play/tutorial" />
        <Route element={<Sandbox />} path="/sandbox" />
        <Route element={<SandboxWorld />} path="/sandbox/new" />
        <Route element={<SandboxWorld />} path="/sandbox/:worldId" />
        <Route element={<SavedGames />} path="/saved" />
        <Route element={<CascadeMenu />} path="/cascade" />
        <Route element={<Cascade startNew />} path="/cascade/game/new" />
        <Route element={<Cascade />} path="/cascade/game/continue" />
        <Route element={<VsMenu />} path="/vs" />
        <Route element={<VsLocalGrid />} path="/vs/local" />
        <Route element={<Settings />} path="/settings" />
        <Route element={<MainMenu />} path="*" />
      </Routes>
    </HashRouter>
  )
}

export default App
