import React from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import { MissionProvider, useMission } from './context/MissionContext';

// Import all views
import OperatorDefault from './views/OperatorDefault';
import VoiceCaptureModal from './views/VoiceCaptureModal';
import AIParsedReview from './views/AIParsedReview';
import OperatorAttackMonitor from './views/OperatorAttackMonitor';
import CommanderDefault from './views/CommanderDefault';
import CommanderApproval from './views/CommanderApproval';
import CommanderDetailedMonitor from './views/CommanderDetailedMonitor';
import MissionPostMortem from './views/MissionPostMortem';
import RBACSettings from './views/RBACSettings'; // We will create this next

function MainLayout() {
  const { activeScreen } = useMission();

  const renderScreen = () => {
    console.log("[DEBUG] Rendering screen:", activeScreen);
    switch(activeScreen) {
      case 1: return <OperatorDefault />;
      case 2: return <VoiceCaptureModal />;
      case 3: return <AIParsedReview />;
      case 4: return <OperatorAttackMonitor />;
      case 5: return <CommanderDefault />;
      case 6: return <CommanderApproval />;
      case 7: return <CommanderDetailedMonitor />;
      case 8: return <MissionPostMortem />;
      case 9: return <RBACSettings />;
      default: return <OperatorDefault />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <TopNav />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} key={activeScreen}>
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
