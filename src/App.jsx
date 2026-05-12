import React from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import { MissionProvider, useMission } from './context/MissionContext';

// Import all views
import OperatorDefault from './views/OperatorDefault';
import VoiceCaptureModal from './views/VoiceCaptureModal';
import AIParsedReview from './views/AIParsedReview';
import OperatorAttackMonitor from './views/OperatorAttackMonitor';
import CommanderApproval from './views/CommanderApproval';
import CommanderDetailedMonitor from './views/CommanderDetailedMonitor';
import MissionPostMortem from './views/MissionPostMortem';
import RBACSettings from './views/RBACSettings'; // We will create this next
import ProfileHub from './views/ProfileHub';
import DashboardHome from './views/DashboardHome';

function MainLayout() {
  const mission = useMission() || {};
  const { activeScreen = 11, currentUser = null } = mission;
  const effectiveScreen = currentUser ? activeScreen : (activeScreen === 10 ? 10 : 11);

  const renderScreen = () => {
    console.log("[DEBUG] Rendering screen:", effectiveScreen);
    switch(effectiveScreen) {
      case 1: return <OperatorDefault />;
      case 2: return <VoiceCaptureModal />;
      case 3: return <AIParsedReview />;
      case 4: return <OperatorAttackMonitor />;
      case 6: return <CommanderApproval />;
      case 7: return <CommanderDetailedMonitor />;
      case 8: return <MissionPostMortem />;
      case 9: return <RBACSettings />;
      case 10: return <ProfileHub />;
      case 11: return <DashboardHome />;
      default: return <OperatorDefault />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <TopNav />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} key={effectiveScreen}>
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <MissionProvider>
      <MainLayout />
    </MissionProvider>
  );
}

export default App;
