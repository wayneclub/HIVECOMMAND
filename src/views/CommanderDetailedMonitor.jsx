import React, { useState, useEffect } from 'react';
import { useMission } from '../context/MissionContext';

export default function CommanderDetailedMonitor() {
  const { setActiveScreen, setTacticalPhase, telemetry } = useMission();
  const [countdown, setCountdown] = useState(15);
  const [log, setLog] = useState([
    "22:38:12 FINAL_APPROACH_INITIATED.",
    "22:39:45 KINETIC_LINK_LOCKED.",
  ]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(c => c - 1);
        if (countdown === 10) setLog(p => [...p, "22:40:02 WARNING: THERMAL_SPIKE_DETECTED"]);
        if (countdown === 5) setLog(p => [...p, "22:40:15 SWARM_03_ENGAGING_PRIM_VECTOR"]);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setTacticalPhase('COMPLETED');
      setActiveScreen(8);
    }
  }, [countdown, setActiveScreen, setTacticalPhase]);

  const handleAbort = () => {
    setActiveScreen(5);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#05080c', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Pulse Effect */}
      <div style={{ 
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
        background: 'radial-gradient(circle, rgba(255, 59, 48, 0.05) 0%, transparent 70%)',
        animation: 'pulse 2s infinite'
      }}></div>

      {/* Left Telemetry Column */}
      <div style={{ width: '380px', borderRight: '1px solid var(--border-color)', background: 'var(--bg-dark)', zIndex: 10, padding: '32px' }} className="flex-column gap-6">
         <h3 className="mono text-cyan" style={{ fontSize: '14px', letterSpacing: '1px' }}>KINETIC_FLOW_DATA</h3>
         <div className="flex-column gap-4">
            {telemetry.swarms.map(s => (
              <div key={s.id} className="glass-panel" style={{ padding: '16px', borderLeft: `2px solid ${s.color}` }}>
                 <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <span className="mono" style={{ color: s.color }}>SWARM_{s.id}</span>
                    <span className="mono text-main" style={{ fontSize: '10px' }}>{s.speed.toFixed(0)} KTS</span>
                 </div>
                 <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ width: `${(countdown/15)*100}%`, height: '100%', background: s.color, transition: 'width 1s linear' }}></div>
                 </div>
              </div>
            ))}
         </div>

         <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>ENCRYPTION</span>
            <p className="mono text-cyan" style={{ margin: '4px 0 0 0' }}>AES-512-MIL-SPEC</p>
         </div>
      </div>

      {/* Center Countdown Stage */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
         {/* Cyber Rings */}
         <div style={{ position: 'absolute', width: '500px', height: '500px', border: '1px solid rgba(0, 229, 255, 0.1)', borderRadius: '50%' }}></div>
         <div style={{ position: 'absolute', width: '400px', height: '400px', border: '1px dashed rgba(255, 59, 48, 0.2)', borderRadius: '50%', animation: 'rotate 10s infinite linear' }}></div>

         <div className="flex-column" style={{ alignItems: 'center', gap: '32px', zIndex: 100 }}>
            <div className="flex-column" style={{ alignItems: 'center' }}>
               <span className="mono text-orange" style={{ fontSize: '12px', letterSpacing: '4px' }}>STRIKE_CONFIRMED</span>
               <h1 className="display" style={{ fontSize: '120px', color: 'var(--orange-alert)', margin: 0, textShadow: '0 0 30px rgba(255, 59, 48, 0.5)' }}>
                 {countdown.toString().padStart(2, '0')}
               </h1>
            </div>

            <button onClick={handleAbort} style={{ 
              background: 'var(--orange-alert)', color: '#000', border: 'none', 
              padding: '20px 60px', fontSize: '24px', fontWeight: 'bold', letterSpacing: '8px',
              fontFamily: 'Rajdhani', cursor: 'pointer', boxShadow: '0 0 20px var(--orange-alert)'
            }}>
               FORCE_ABORT
            </button>
         </div>
      </div>

      {/* Right Column: Tactical Log */}
      <div style={{ width: '380px', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-dark)', zIndex: 10, padding: '32px' }}>
         <h3 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', marginBottom: '24px' }}>ENGAGEMENT_SEQUENCE</h3>
         <div style={{ flex: 1, overflowY: 'auto' }} className="flex-column gap-6">
            {log.map((entry, idx) => (
               <div key={idx} className="flex-column gap-2">
                  <span className="mono text-cyan" style={{ fontSize: '10px' }}>{entry.substring(0, 8)}</span>
                  <span className="mono text-main" style={{ fontSize: '11px', lineHeight: '1.4' }}>{entry.substring(9)}</span>
               </div>
            ))}
         </div>
      </div>

    </div>
  );
}
