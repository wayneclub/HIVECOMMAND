import React, { useState, useEffect } from 'react';
import { useMission } from '../context/MissionContext';
import logoUrl from '../assets/logo.svg';

export default function TopNav() {
  const { role } = useMission();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const timeStr = time.toLocaleTimeString('en-GB', { hour12: false }) + ' UTC';

  return (
    <div style={{ height: '60px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logoUrl} alt="HiveCommand Logo" style={{ width: '32px', height: '32px' }} />
          <h1 className="display" style={{ margin: 0, fontSize: '24px', letterSpacing: '2px' }}>
            <span style={{ color: '#FFFFFF' }}>HIVE</span><span style={{ color: '#00BDDC' }}>COMMAND</span>
          </h1>
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
        <span className="mono text-main" style={{ letterSpacing: '1px', fontWeight: 'bold' }}>MISSION: ISLAND RECON</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <div className="flex-column" style={{ alignItems: 'flex-end' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>{dateStr}</span>
           <span className="mono text-cyan" style={{ fontSize: '14px', fontWeight: 'bold' }}>{timeStr}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <span className="mono text-main" style={{ fontSize: '14px', letterSpacing: '1px' }}>
             {role === 'COMMANDER' ? 'COMMANDER INDIANA 6' : 'OPERATOR INDIANA 1'}
           </span>
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
             <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
             <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
             <line x1="12" y1="20" x2="12.01" y2="20"></line>
           </svg>
           <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
             <div style={{ width: '3px', height: '4px', background: 'var(--cyan-primary)' }}></div>
             <div style={{ width: '3px', height: '8px', background: 'var(--cyan-primary)' }}></div>
             <div style={{ width: '3px', height: '12px', background: 'var(--cyan-primary)' }}></div>
             <div style={{ width: '3px', height: '16px', background: 'var(--cyan-primary)' }}></div>
           </div>
        </div>
      </div>
      
    </div>
  );
}
