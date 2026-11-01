import { Suspense, lazy, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MobileShell } from './components/shell/MobileShell'
import { SplashScreen } from './components/shell/SplashScreen'
const DevUiScreen = lazy(() => import('./screens/DevUiScreen'))
const CaseDetailScreen = lazy(() => import('./screens/CaseDetailScreen').then((m) => ({ default: m.CaseDetailScreen })))
const CrashScreen = lazy(() => import('./screens/CrashScreen').then((m) => ({ default: m.CrashScreen })))
const DepositScreen = lazy(() => import('./screens/DepositScreen').then((m) => ({ default: m.DepositScreen })))
const CraftScreen = lazy(() => import('./screens/CraftScreen').then((m) => ({ default: m.CraftScreen })))
const DiceScreen = lazy(() => import('./screens/DiceScreen').then((m) => ({ default: m.DiceScreen })))
const GamesScreen = lazy(() => import('./screens/GamesScreen').then((m) => ({ default: m.GamesScreen })))
import { HomeScreen } from './screens/HomeScreen'
const InventoryScreen = lazy(() => import('./screens/InventoryScreen').then((m) => ({ default: m.InventoryScreen })))
const InviteScreen = lazy(() => import('./screens/InviteScreen').then((m) => ({ default: m.InviteScreen })))
const MinesScreen = lazy(() => import('./screens/MinesScreen').then((m) => ({ default: m.MinesScreen })))
const PlinkoScreen = lazy(() => import('./screens/PlinkoScreen').then((m) => ({ default: m.PlinkoScreen })))
const SpinsScreen = lazy(() => import('./screens/SpinsScreen').then((m) => ({ default: m.SpinsScreen })))
const RatingScreen = lazy(() => import('./screens/RatingScreen').then((m) => ({ default: m.RatingScreen })))
const RewardsScreen = lazy(() => import('./screens/RewardsScreen').then((m) => ({ default: m.RewardsScreen })))
const PvpScreen = lazy(() => import('./screens/PvpScreen').then((m) => ({ default: m.PvpScreen })))
const JackpotScreen = lazy(() => import('./screens/JackpotScreen').then((m) => ({ default: m.JackpotScreen })))
const TvtScreen = lazy(() => import('./screens/TvtScreen').then((m) => ({ default: m.TvtScreen })))
const UpgradeScreen = lazy(() => import('./screens/UpgradeScreen').then((m) => ({ default: m.UpgradeScreen })))
import { FEATURES } from './lib/features'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <HashRouter>
        <Suspense fallback={null}>
        <Routes>
        <Route element={<MobileShell />}>
          <Route index element={<HomeScreen />} />
          <Route path="deposit" element={<DepositScreen />} />
          <Route path="inventory" element={<InventoryScreen />} />
          <Route path="invite" element={<InviteScreen />} />
          <Route path="rating" element={<RatingScreen />} />
          <Route path="rewards" element={<RewardsScreen />} />
          <Route path="games" element={<GamesScreen />} />
          <Route path="games/crash" element={<CrashScreen />} />
          <Route path="games/upgrade" element={<UpgradeScreen />} />
          <Route path="games/craft" element={FEATURES.craft ? <CraftScreen /> : <Navigate to="/" replace />} />
          <Route path="games/plinko" element={FEATURES.plinko ? <PlinkoScreen /> : <Navigate to="/" replace />} />
          <Route path="games/dice" element={FEATURES.dice ? <DiceScreen /> : <Navigate to="/" replace />} />
          <Route path="games/mines" element={<MinesScreen />} />
          <Route path="games/spins" element={FEATURES.spins ? <SpinsScreen /> : <Navigate to="/" replace />} />
          <Route path="pvp" element={FEATURES.pvp ? <PvpScreen /> : <Navigate to="/" replace />} />
          <Route path="pvp/jackpot" element={FEATURES.pvp ? <JackpotScreen /> : <Navigate to="/" replace />} />
          <Route path="pvp/tvt" element={FEATURES.pvp ? <TvtScreen /> : <Navigate to="/" replace />} />
          <Route path="case/:caseId" element={<CaseDetailScreen />} />
          <Route path="dev/ui" element={<DevUiScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Route>
      </Routes>
        </Suspense>
    </HashRouter>
    </>
  )
}

export default App
