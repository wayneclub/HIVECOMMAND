import React, { useState, useEffect } from 'react';
import { useMission } from '../context/MissionContext';
import logoUrl from '../assets/logo.svg';

export default function TopNav() {
  const mission = useMission() || {};
  const {
    role = 'OBSERVER',
    tacticalPhase = 'IDLE',
    lastAIParsedCommand = null,
    formatWind = (value) => value?.condition || 'STABLE',
    formatTemperature = (value) => `${value}°C`,
    formatVisibility = (value) => `${value} KM`,
    currentUser = null
  } = mission;
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const timeStr = time.toLocaleTimeString('en-GB', { hour12: false }) + ' UTC';
  const missionIsActive = tacticalPhase === 'TRANSIT' || tacticalPhase === 'STRIKE_MONITORING' || tacticalPhase === 'COMPLETED';
  const missionTitle = missionIsActive && lastAIParsedCommand
    ? `MISSION: ${(lastAIParsedCommand.missionName || lastAIParsedCommand.destName || 'ACTIVE OP').replace(/_/g, ' ').toUpperCase()}`
    : null;
  const stationWeather = lastAIParsedCommand?.missionWeather || {
    condition: 'STABLE',
    windSpeedKts: 6,
    windDirection: 'NE',
    visibilityKm: 10,
    tempC: 24
  };

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
        {missionTitle && (
          <span className="mono text-main" style={{ letterSpacing: '1px', fontWeight: 'bold' }}>{missionTitle}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <span className="mono text-muted" style={{ fontSize: '10px', letterSpacing: '0.12em' }}>STATION WX</span>
          <span className="mono text-main" style={{ fontSize: '10px' }}>{stationWeather.condition}</span>
          <span className="mono text-muted" style={{ fontSize: '10px' }}>|</span>
          <span className="mono text-main" style={{ fontSize: '10px' }}>{formatTemperature(stationWeather.tempC)}</span>
          <span className="mono text-muted" style={{ fontSize: '10px' }}>|</span>
          <span className="mono text-main" style={{ fontSize: '10px' }}>{formatWind(stationWeather)}</span>
          <span className="mono text-muted" style={{ fontSize: '10px' }}>|</span>
          <span className="mono text-main" style={{ fontSize: '10px' }}>VIS {formatVisibility(stationWeather.visibilityKm)}</span>
        </div>
        <div className="flex-column" style={{ alignItems: 'flex-end' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>{dateStr}</span>
           <span className="mono text-cyan" style={{ fontSize: '14px', fontWeight: 'bold' }}>{timeStr}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <span className="mono text-main" style={{ fontSize: '14px', letterSpacing: '1px' }}>
             {currentUser ? `${currentUser.role} ${currentUser.name}`.toUpperCase() : 'NO ACTIVE USER'}
           </span>
           {role === 'OBSERVER' ? (
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"></path>
               <circle cx="12" cy="12" r="2.8"></circle>
             </svg>
           ) : (
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M5 19l5.5-5.5"></path>
               <path d="M14.5 9.5L20 4"></path>
               <path d="M8 6l3 3"></path>
               <path d="M13 11l5 5"></path>
               <path d="M5 21l4-1 9-9-3-3-9 9-1 4z"></path>
             </svg>
           )}
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
