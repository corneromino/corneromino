import { useEffect } from 'react'
import { HashRouter, matchRoutes, useLocation, useRoutes } from 'react-router-dom'
import { MenuPageTransition } from '@/components/MenuPageTransition'
import { isGameMode } from '@/game/gameConfig'
import { observeDialogViewport } from '@/lib/dialogViewport'
import { Play } from '@/features/play/Play'
import { ClassicCareerMenu } from '@/features/play/ClassicCareerMenu'
import { ClassicModesMenu } from '@/features/play/ClassicModesMenu'
import { ClassicCreatePage } from '@/features/play/ClassicCreatePage'
import { ClassicTutorial } from '@/features/play/ClassicTutorial'
import { ClassicInfinitePage } from '@/features/play/ClassicInfinitePage'
import { InfiniteMenu } from '@/features/play/InfiniteMenu'
import { MainMenu } from '@/features/main-menu/MainMenu'
import { MiniGames } from '@/features/mini-games/MiniGames'
import { SavedGames } from '@/features/saved-games/SavedGames'
import { Sandbox } from '@/features/sandbox/Sandbox'
import { SandboxWorld } from '@/features/sandbox/SandboxWorld'
import { Cascade } from '@/features/cascade/Cascade'
import { CascadeMenu } from '@/features/cascade/CascadeMenu'
import { VsLocalGrid } from '@/features/vs/VsLocalGrid'
import { VsMenu } from '@/features/vs/VsMenu'
import { Settings } from '@/features/settings/Settings'
import { ToastProvider } from '@/components/toast'

const APP_ROUTES = [
  { path: '/', element: <MainMenu />, handle: { menu: true } },
  { path: '/mini-games', element: <MiniGames />, handle: { menu: true } },
  { path: '/play', element: <Play />, handle: { menu: true } },
  { path: '/play/levels', element: <ClassicCareerMenu />, handle: { menu: true } },
  { path: '/play/modes', element: <ClassicModesMenu />, handle: { menu: true } },
  { path: '/play/create', element: <ClassicCreatePage /> },
  { path: '/play/tutorial', element: <ClassicTutorial /> },
  { path: '/play/infinite', element: <ClassicInfinitePage /> },
  { path: '/infinite', element: <InfiniteMenu />, handle: { menu: true } },
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
  const playParams = new URLSearchParams(location.search)
  const isClassicGame = route?.path === '/play' && (isGameMode(playParams.get('mode')) || playParams.has('career'))
  const isMenu = route?.handle?.menu === true && !isClassicGame
  // Query changes within a game (including assigning its seed) keep the same wrapper.
  const pageKey = `${isMenu ? 'menu' : 'game'}:${location.pathname}`

  return <MenuPageTransition isMenu={isMenu} pageKey={pageKey}>{page}</MenuPageTransition>
}

function App() {
  useEffect(() => observeDialogViewport(window.visualViewport, document.documentElement), [])

  return (
    <HashRouter>
      <ToastProvider><AppRoutes /></ToastProvider>
    </HashRouter>
  )
}

export default App
