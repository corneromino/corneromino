import { useEffect } from 'react'
import { HashRouter, matchRoutes, useLocation, useRoutes } from 'react-router-dom'
import { MenuPageTransition } from '@/components/MenuPageTransition'
import { isGameMode } from '@/game/gameConfig'
import { observeDialogViewport } from '@/lib/dialogViewport'
import { Play } from '@/features/play/Play'
import { ClassicTutorial } from '@/features/play/ClassicTutorial'
import { ClassicInfinitePage } from '@/features/play/ClassicInfinitePage'
import { MainMenu } from '@/features/main-menu/MainMenu'
import { SavedGames } from '@/features/saved-games/SavedGames'
import { Sandbox } from '@/features/sandbox/Sandbox'
import { SandboxWorld } from '@/features/sandbox/SandboxWorld'
import { Cascade } from '@/features/cascade/Cascade'
import { CascadeMenu } from '@/features/cascade/CascadeMenu'
import { VsLocalGrid } from '@/features/vs/VsLocalGrid'
import { VsMenu } from '@/features/vs/VsMenu'
import { Settings } from '@/features/settings/Settings'

const APP_ROUTES = [
  { path: '/', element: <MainMenu />, handle: { menu: true } },
  { path: '/play', element: <Play />, handle: { menu: true } },
  { path: '/play/tutorial', element: <ClassicTutorial /> },
  { path: '/play/infinite', element: <ClassicInfinitePage /> },
  { path: '/sandbox', element: <Sandbox />, handle: { menu: true } },
  { path: '/sandbox/new', element: <SandboxWorld /> },
  { path: '/sandbox/:worldId', element: <SandboxWorld /> },
  { path: '/saved', element: <SavedGames />, handle: { menu: true } },
  { path: '/cascade', element: <CascadeMenu />, handle: { menu: true } },
  { path: '/cascade/game/new', element: <Cascade startNew /> },
  { path: '/cascade/game/continue', element: <Cascade /> },
  { path: '/vs', element: <VsMenu />, handle: { menu: true } },
  { path: '/vs/local', element: <VsLocalGrid /> },
  { path: '/settings', element: <Settings />, handle: { menu: true } },
  { path: '*', element: <MainMenu />, handle: { menu: true } },
]

function AppRoutes() {
  const location = useLocation()
  const page = useRoutes(APP_ROUTES, location)
  const route = matchRoutes(APP_ROUTES, location)?.at(-1)?.route
  const isClassicGame = route?.path === '/play' && isGameMode(new URLSearchParams(location.search).get('mode'))
  const isMenu = route?.handle?.menu === true && !isClassicGame
  // Query changes within a game (including assigning its seed) keep the same wrapper.
  const pageKey = `${isMenu ? 'menu' : 'game'}:${location.pathname}`

  return <MenuPageTransition isMenu={isMenu} pageKey={pageKey}>{page}</MenuPageTransition>
}

function App() {
  useEffect(() => observeDialogViewport(window.visualViewport, document.documentElement), [])

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}

export default App
