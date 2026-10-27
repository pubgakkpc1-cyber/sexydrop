import { useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { MobileShell } from './components/shell/MobileShell'
import { SplashScreen } from './components/shell/SplashScreen'
import DevUiScreen from './screens/DevUiScreen'
import { CaseDetailScreen } from './screens/CaseDetailScreen'
import { CrashScreen } from './screens/CrashScreen'
import { CraftScreen } from './screens/CraftScreen'
import { DiceScreen } from './screens/DiceScreen'
import { GamesScreen } from './screens/GamesScreen'
import { HomeScreen } from './screens/HomeScreen'
import { InventoryScreen } from './screens/InventoryScreen'
import { InviteScreen } from './screens/InviteScreen'
import { MinesScreen } from './screens/MinesScreen'
import { PlinkoScreen } from './screens/PlinkoScreen'
import { SpinsScreen } from './screens/SpinsScreen'
import { RatingScreen } from './screens/RatingScreen'
import { RewardsScreen } from './screens/RewardsScreen'
import { PvpScreen } from './screens/PvpScreen'
import { JackpotScreen } from './screens/JackpotScreen'
import { TvtScreen } from './screens/TvtScreen'
import { UpgradeScreen } from './screens/UpgradeScreen'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <HashRouter>
        <Routes>
        <Route element={<MobileShell />}>
          <Route index element={<HomeScreen />} />
          <Route path="inventory" element={<InventoryScreen />} />
          <Route path="invite" element={<InviteScreen />} />
          <Route path="rating" element={<RatingScreen />} />
          <Route path="rewards" element={<RewardsScreen />} />
          <Route path="games" element={<GamesScreen />} />
          <Route path="games/crash" element={<CrashScreen />} />
          <Route path="games/upgrade" element={<UpgradeScreen />} />
          <Route path="games/craft" element={<CraftScreen />} />
          <Route path="games/plinko" element={<PlinkoScreen />} />
          <Route path="games/dice" element={<DiceScreen />} />
          <Route path="games/mines" element={<MinesScreen />} />
          <Route path="games/spins" element={<SpinsScreen />} />
          <Route path="pvp" element={<PvpScreen />} />
          <Route path="pvp/jackpot" element={<JackpotScreen />} />
          <Route path="pvp/tvt" element={<TvtScreen />} />
          <Route path="case/:caseId" element={<CaseDetailScreen />} />
          <Route path="dev/ui" element={<DevUiScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Route>
      </Routes>
    </HashRouter>
    </>
  )
}

export default App
