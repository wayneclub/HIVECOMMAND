import React from 'react';
import { useMission } from '../context/MissionContext';

export default function RBACSettings() {
  const { setRole, setActiveScreen } = useMission();

  const handleRoleChange = (roleName) => {
    if (roleName === 'BRIGADE COMMANDER') {
      setRole('COMMANDER');
      setActiveScreen(5); // Switch to Strategic Dashboard
    } else {
      setRole('OPERATOR');
      setActiveScreen(1); // Switch to Tactical Map
    }
  };

  const Toggle = ({ active }) => (
    <div style={{ width: '40px', height: '20px', background: active ? 'var(--cyan-primary)' : 'var(--bg-dark)', border: '1px solid ' + (active ? 'var(--cyan-primary)' : 'var(--border-color)'), borderRadius: '10px', position: 'relative', cursor: 'pointer' }}>
       <div style={{ position: 'absolute', top: '2px', left: active ? '22px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: active ? '#000' : 'var(--text-muted)', transition: 'left 0.2s' }}></div>
    </div>
  );

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: '32px', gap: '32px' }}>
      
      {/* Left Panel: Role Architecture */}
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <h3 className="mono text-main" style={{ fontSize: '14px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <svg width="16" height="16" fill="none" stroke="var(--cyan-primary)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
           ROLE ARCHITECTURE
         </h3>

         <div style={{ background: 'var(--bg-dark)', borderElement: '1px solid var(--border-color)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between' }}>
           <input type="text" placeholder="Enter new role name..." style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', width: '100%' }} />
           <span className="text-muted">+</span>
         </div>

         <div className="flex-column">
            <div onClick={() => handleRoleChange('BRIGADE COMMANDER')} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
               <span className="mono text-cyan" style={{ fontSize: '12px', fontWeight: 'bold' }}>BRIGADE COMMANDER</span>
               <span className="mono text-muted" style={{ fontSize: '10px' }}>[ROOT]</span>
            </div>
            <div onClick={() => handleRoleChange('OPERATOR')} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
               <span className="mono text-muted" style={{ fontSize: '12px' }}>TACTICAL OPERATIONS CENTER</span>
               <span className="mono text-muted" style={{ fontSize: '10px' }}>[OPS]</span>
            </div>
            <div onClick={() => handleRoleChange('OPERATOR')} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
               <span className="mono text-muted" style={{ fontSize: '12px' }}>SWARM OPERATOR</span>
               <span className="mono text-muted" style={{ fontSize: '10px' }}>[PILOT]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
               <span className="mono text-muted" style={{ fontSize: '12px' }}>STRIKE COORDINATOR</span>
               <span className="mono text-muted" style={{ fontSize: '10px' }}>[WPN]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
               <span className="mono text-muted" style={{ fontSize: '12px' }}>INTELLIGENCE ANALYST</span>
               <span className="mono text-muted" style={{ fontSize: '10px' }}>[INT]</span>
            </div>
         </div>
      </div>

      {/* Center Panel: Configuration */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div className="flex-between">
              <div>
                <h2 className="display text-main" style={{ margin: 0, fontSize: '24px' }}>BRIGADE COMMANDER <span style={{ fontSize: '12px', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--cyan-primary)', padding: '2px 6px', verticalAlign: 'middle', marginLeft: '8px' }}>[ROOT_ACCESS]</span></h2>
                <p className="mono text-muted" style={{ margin: '8px 0 0 0', fontSize: '10px', textTransform: 'uppercase' }}>Highest privilege tier: Complete theater oversight and authorization</p>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', border: '1px solid var(--cyan-primary)' }}></div><span className="mono text-cyan" style={{ fontSize: '10px' }}>VIEW</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: 'var(--cyan-primary)' }}></div><span className="mono text-cyan" style={{ fontSize: '10px' }}>COMMAND</span></div>
              </div>
            </div>
         </div>

         <div style={{ marginTop: '16px' }}>
            <h4 className="mono text-muted" style={{ fontSize: '10px', marginBottom: '16px' }}>ASSIGN PEOPLE (CALLSIGN)</h4>
            <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '16px', display: 'flex', justifyContent: 'space-between' }}>
               <span className="mono text-main">SIG_ID_OXX...</span>
               <span className="text-cyan">👤+</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
               <span className="mono" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '4px 8px', fontSize: '10px' }}>INDY_LEAD <span className="text-muted" style={{ marginLeft: '8px' }}>x</span></span>
               <span className="mono" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '4px 8px', fontSize: '10px' }}>COMMAND_01 <span className="text-muted" style={{ marginLeft: '8px' }}>x</span></span>
            </div>
         </div>

         <div style={{ marginTop: '32px' }}>
            <h4 className="mono text-muted" style={{ fontSize: '10px', marginBottom: '24px' }}>FUNCTIONAL FEATURE TOGGLES</h4>
            
            <div className="flex-column" style={{ gap: '24px' }}>
              <div className="flex-between">
                 <div>
                   <span className="mono text-main" style={{ fontSize: '12px', fontWeight: 'bold' }}>3D TACTICAL MAP - ALL OPERATIONS</span>
                   <p className="mono text-muted" style={{ margin: '4px 0 0 0', fontSize: '8px' }}>FULL RENDERING OF THEATER GRID AND NEUTRAL ZONES</p>
                 </div>
                 <Toggle active={true} />
              </div>

              <div className="flex-between">
                 <div>
                   <span className="mono text-muted" style={{ fontSize: '12px', fontWeight: 'bold' }}>3D TACTICAL MAP - SELECT OPERATORS</span>
                   <p className="mono text-muted" style={{ margin: '4px 0 0 0', fontSize: '8px' }}>RESTRICT VISUALIZATION TO SPECIFIC UNITS</p>
                 </div>
                 <Toggle active={false} />
              </div>

              <div className="flex-between">
                 <div>
                   <span className="mono text-main" style={{ fontSize: '12px', fontWeight: 'bold' }}>PENDING STRIKE REQUESTS - ALL OPERATIONS</span>
                   <p className="mono text-muted" style={{ margin: '4px 0 0 0', fontSize: '8px' }}>APPROVAL AUTHORIZATION FOR ALL KINETIC ACTIONS</p>
                 </div>
                 <Toggle active={true} />
              </div>
              
              <div className="flex-between">
                 <div>
                   <span className="mono text-main" style={{ fontSize: '12px', fontWeight: 'bold' }}>STRIKE EXECUTION TACTICAL VIEW - ALL OPERATIONS</span>
                   <p className="mono text-muted" style={{ margin: '4px 0 0 0', fontSize: '8px' }}>LIVE TELEMETRY OF MUNITIONS AND IMPACT VECTORS</p>
                 </div>
                 <Toggle active={true} />
              </div>
            </div>
         </div>

      </div>

      {/* Right Panel: Metrics */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
         <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-20px', top: '20px', fontSize: '100px', opacity: 0.05 }}>⌘</div>
            <span className="mono text-cyan" style={{ fontSize: '8px', background: 'rgba(0,229,255,0.1)', padding: '2px 4px' }}>SECURITY_MATRIX_ACTIVE</span>
            <h3 className="display text-cyan" style={{ margin: '16px 0 8px 0', fontSize: '48px' }}>98.4%</h3>
            <span className="mono text-muted" style={{ fontSize: '8px' }}>NODE INTEGRITY CONFIRMED</span>
         </div>
         <div className="glass-panel" style={{ padding: '24px' }}>
            <span className="mono text-muted" style={{ fontSize: '8px' }}>ACTIVE SESSIONS</span>
            <h3 className="display text-main" style={{ margin: '16px 0 8px 0', fontSize: '32px' }}>04</h3>
            <div style={{ width: '100%', height: '2px', background: 'var(--border-color)', marginTop: '8px' }}>
              <div style={{ width: '40%', height: '100%', background: 'var(--cyan-primary)' }}></div>
            </div>
         </div>
         <div className="glass-panel" style={{ padding: '24px' }}>
            <span className="mono text-muted" style={{ fontSize: '8px' }}>LAST UPDATE</span>
            <h3 className="display text-main" style={{ margin: '16px 0 8px 0', fontSize: '32px' }}>02:44:19</h3>
            <span className="mono text-muted" style={{ fontSize: '8px' }}>ENCRYPTED_SYNC_SUCCESS</span>
         </div>
         <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--orange-alert)' }}>
            <span className="mono text-muted" style={{ fontSize: '8px' }}>SECURITY BREACHES</span>
            <h3 className="display text-alert" style={{ margin: '16px 0 8px 0', fontSize: '32px' }}>00</h3>
            <span className="mono text-orange" style={{ fontSize: '8px' }}>THREAT_LEVEL: ZERO</span>
         </div>

         <button className="btn btn-primary" style={{ marginTop: 'auto', background: 'var(--cyan-primary)', color: '#000', padding: '24px 16px', fontSize: '16px' }}>
            AUTHORIZE SYSTEM RE-SYNC
         </button>
      </div>

    </div>
  );
}
