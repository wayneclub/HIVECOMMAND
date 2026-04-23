import React, { useState, useEffect } from 'react';
import { useMission } from '../context/MissionContext';

export default function OperatorAttackMonitor() {
  const { telemetry, setActiveScreen } = useMission();
  const [log, setLog] = useState([
    "22:42:01 SYSTEM INITIALIZED",
    "OPERATOR_ID: IND_1 // AUTH: VERIFIED",
  ]);

  useEffect(() => {
    const messages = [
      "22:43:10 SWARM_HANDSHAKE_ESTABLISHED",
      "22:44:02 TARGET_VECTORS_LOCKED",
      "22:44:30 MANEUVER: PINCER_V3_ACTIVE",
      "22:45:10 STRIKE_READY // AWAITING_APPROVAL"
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLog(prev => [...prev, messages[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--bg-dark)' }}>
      
      {/* Left Data Column */}
      <div style={{ width: '350px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '24px', zIndex: 10 }}>
        <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
          <h3 className="mono text-cyan" style={{ fontSize: '14px', letterSpacing: '1px' }}>ATTACK_VECTORS</h3>
          <span className="mono text-muted" style={{ fontSize: '8px' }}>LIVE_TELEMETRY</span>
        </div>

        <div className="flex-column gap-4" style={{ flex: 1, overflowY: 'auto' }}>
           {telemetry.swarms.map(s => (
             <div key={s.id} className="glass-panel" style={{ padding: '16px', borderLeft: `2px solid ${s.color}` }}>
                <div className="flex-between" style={{ marginBottom: '8px' }}>
                   <span className="mono" style={{ color: s.color, fontWeight: 'bold' }}>SWARM_{s.id}</span>
                   <span className="mono text-cyan" style={{ fontSize: '10px' }}>{s.dist.toFixed(1)}KM</span>
                </div>
                <div className="flex-between">
                   <span className="mono text-muted" style={{ fontSize: '8px' }}>PWR</span>
                   <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', margin: '0 12px' }}>
                      <div style={{ width: `${s.pwr}%`, height: '100%', background: s.color }}></div>
                   </div>
                   <span className="mono text-main" style={{ fontSize: '10px' }}>{s.pwr.toFixed(0)}%</span>
                </div>
             </div>
           ))}
        </div>

        <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(255, 87, 34, 0.05)', border: '1px solid var(--orange-dark)' }}>
           <span className="mono text-orange" style={{ fontSize: '12px', fontWeight: 'bold' }}>STRIKE_STATE: ARMED</span>
           <p className="mono text-muted" style={{ margin: '8px 0 0 0', fontSize: '9px' }}>Waiting for Commander authorization via encrypted link.</p>
        </div>
      </div>

      {/* Center Radar View */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
         {/* Animated Radar Rings */}
         {[1, 2, 3].map(i => (
           <div key={i} className="radar-ring" style={{ 
             position: 'absolute', 
             width: `${i * 30}%`, 
             paddingBottom: `${i * 30}%`, 
             border: '1px solid rgba(0, 229, 255, 0.1)', 
             borderRadius: '50%',
             animation: `pulse ${4 + i}s infinite linear`
           }}></div>
         ))}
         
         {/* Rotating Scanner */}
         <div style={{ 
           position: 'absolute', 
           width: '100%', height: '100%', 
           background: 'conic-gradient(from 0deg, transparent 0%, rgba(0, 229, 255, 0.05) 50%, transparent 100%)',
           animation: 'rotate 4s infinite linear'
         }}></div>

         {/* Target Lock Visual */}
         <div style={{ position: 'relative', width: '80px', height: '80px', border: '2px solid var(--orange-alert)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: '120%', height: '1px', background: 'var(--orange-alert)', opacity: 0.3 }}></div>
            <div style={{ position: 'absolute', height: '120%', width: '1px', background: 'var(--orange-alert)', opacity: 0.3 }}></div>
            <span className="mono text-orange" style={{ fontSize: '10px', position: 'absolute', top: '-15px' }}>LOCKED</span>
         </div>

         {/* Float Labels */}
         <div style={{ position: 'absolute', top: '40px', left: '40px' }} className="flex-column gap-1">
            <h2 className="display text-main" style={{ margin: 0, fontSize: '24px' }}>OPERATOR_MONITOR</h2>
            <span className="mono text-cyan" style={{ fontSize: '10px' }}>TRACKING: NYCU_CTR_LOGISTICS</span>
         </div>
      </div>

      {/* Right Column: Terminal Log */}
      <div style={{ width: '350px', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '24px' }}>
         <h3 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', marginBottom: '24px' }}>COMMAND_AUDIT_LOG</h3>
         <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {log.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                 <span className="mono" style={{ fontSize: '10px', color: line.includes('READY') ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>{line}</span>
              </div>
            ))}
            <div className="mono text-cyan" style={{ animation: 'blink 1s infinite' }}>_</div>
         </div>
         
         {/* Commander Bypass (For Demo) */}
         <button className="btn" onClick={() => setActiveScreen(6)} style={{ marginTop: '24px', borderColor: 'var(--orange-alert)', color: 'var(--orange-alert)' }}>
            [ EMERGENCY_COMMAND_BYPASS ]
         </button>
      </div>

    </div>
  );
}
