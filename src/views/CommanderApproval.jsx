import React, { useState } from 'react';
import { useMission } from '../context/MissionContext';
import { MapContainer, TileLayer } from 'react-leaflet';

export default function CommanderApproval() {
  const { setActiveScreen, setTacticalPhase, telemetry } = useMission();
  const [isCanceled, setIsCanceled] = useState(false);

  const handleAuthorize = () => {
    setTacticalPhase('STRIKE_MONITORING');
    setActiveScreen(7);
  };

  const handleAbort = () => {
    setIsCanceled(true);
    setTimeout(() => setActiveScreen(5), 1000);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}>
      
      {/* Target Backdrop (Satellite Scan) */}
      <div style={{ flex: 1, position: 'relative' }}>
         <MapContainer center={[24.7869, 120.9975]} zoom={16} zoomControl={false} style={{ width: '100%', height: '100%' }}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
         </MapContainer>
         <div style={{ position: 'absolute', top:0, left:0, right:0, bottom:0, background: 'rgba(10, 20, 30, 0.6) radial-gradient(circle, transparent 30%, #000 100%)', zIndex: 400, pointerEvents: 'none' }}></div>
         
         {/* Moving Scan Line */}
         <div style={{ 
           position: 'absolute', top: 0, left: 0, width: '100%', height: '2px', 
           background: 'rgba(0, 229, 255, 0.5)', boxShadow: '0 0 15px var(--cyan-primary)',
           animation: 'scan-vertical 3s infinite linear', zIndex: 450
         }}></div>

         {/* Target Box Overlay */}
         <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '200px', border: '1px solid var(--orange-alert)', zIndex: 450 }}>
            <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '20px', height: '20px', borderTop: '4px solid var(--orange-alert)', borderLeft: '4px solid var(--orange-alert)' }}></div>
            <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '20px', height: '20px', borderBottom: '4px solid var(--orange-alert)', borderRight: '4px solid var(--orange-alert)' }}></div>
            <span className="mono text-orange" style={{ position: 'absolute', bottom: '-30px', width: '100%', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>TGT_LOCK_ACQUIRED</span>
         </div>
      </div>

      {/* Right Authorization Blade */}
      <div style={{ width: '450px', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-dark)', zIndex: 600, display: 'flex', flexDirection: 'column', padding: '40px' }}>
         <div style={{ marginBottom: '40px' }}>
            <span className="mono text-cyan" style={{ fontSize: '10px' }}>[ AUTH_LEVEL_5_REQUIRED ]</span>
            <h2 className="display text-main" style={{ margin: '8px 0', fontSize: '28px', letterSpacing: '2px' }}>STRIKE_PERMISSION</h2>
         </div>

         <div className="flex-column gap-6" style={{ flex: 1 }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
               <h4 className="mono text-muted" style={{ fontSize: '10px', marginBottom: '16px' }}>NEURAL_VALIDATION</h4>
               <div className="flex-column gap-3">
                  <div className="flex-between"><span className="mono" style={{ fontSize: '12px' }}>STRIKE_CONFIDENCE</span> <span className="text-cyan display">99.1%</span></div>
                  <div className="flex-between"><span className="mono" style={{ fontSize: '12px' }}>COLLATERAL_EST.</span> <span className="text-cyan display">ZERO</span></div>
               </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--orange-dark)', background: 'rgba(255, 87, 34, 0.05)' }}>
               <h4 className="mono text-orange" style={{ fontSize: '10px', marginBottom: '16px' }}>CAUTION: KINETIC_AUTHORIZATION</h4>
               <p className="mono text-muted" style={{ fontSize: '11px', lineHeight: '1.6' }}>
                  Proceeding will authorize absolute kinetic engagement via {telemetry.swarms.length} active swarms. This action is recorded in the permanent mission log.
               </p>
            </div>
         </div>

         {/* Biometric Button Container */}
         <div className="flex-column gap-4" style={{ marginTop: 'auto' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleAuthorize}
              style={{ padding: '32px', background: 'var(--cyan-primary)', color: '#000', fontSize: '18px', fontWeight: 'bold', letterSpacing: '4px', border: 'none', position: 'relative', overflow: 'hidden' }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '10%', background: 'rgba(255,255,255,0.2)', animation: 'slide-right 2s infinite' }}></div>
              CONFIRM_EXECUTION
            </button>
            <button className="btn" onClick={handleAbort} style={{ padding: '16px', borderColor: 'var(--orange-alert)', color: 'var(--orange-alert)' }}>
               ⊗ ABORT_ALL_OPERATIONS
            </button>
         </div>
      </div>

      {isCanceled && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--orange-alert)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <h1 className="display" style={{ color: '#000', fontSize: '64px' }}>MISSION_ABORTED</h1>
        </div>
      )}

    </div>
  );
}
