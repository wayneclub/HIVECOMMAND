import React, { useState, useEffect } from 'react';
import { useMission } from '../context/MissionContext';

const NavItem = ({ label, active, onClick, children }) => (
  <div 
    onClick={onClick}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 0', cursor: 'pointer', transition: '0.2s', position: 'relative',
      background: active ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
      width: '100%'
    }}
  >
    {active && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--cyan-primary)', pointerEvents: 'none' }}></div>}
    <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {children}
      <span className="mono" style={{ fontSize: '10px', marginTop: '8px', color: active ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>{label}</span>
    </div>
  </div>
);

export default function Sidebar() {
  const { activeScreen, setActiveScreen, role } = useMission();

  // Route groupings base logic (can be refined per exact screen needs)
  const isTactical = [1, 2, 3, 4].includes(activeScreen);
  const isStrategic = [5, 6, 7].includes(activeScreen);
  const isHistory = activeScreen === 8;
  const isSettings = activeScreen === 9;

  return (
    <div style={{ width: '80px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 5000 }}>
      
      <div style={{ padding: '24px 0', textAlign: 'center', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
        <p className="mono text-cyan" style={{ fontSize: '12px', fontWeight: 'bold' }}>ID_{role === 'COMMANDER' ? 'COM' : '1'}</p>
        <p className="mono text-muted" style={{ fontSize: '8px' }}>STATUS: ACTIVE</p>
      </div>

      <NavItem label="TACTICAL" active={isTactical} onClick={() => setActiveScreen(1)}>
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isTactical ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="12" y1="2" x2="12" y2="4"></line>
            <line x1="12" y1="20" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="4" y2="12"></line>
            <line x1="20" y1="12" x2="22" y2="12"></line>
         </svg>
      </NavItem>

      <NavItem label="STRATEGIC" active={isStrategic} onClick={() => setActiveScreen(5)}>
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isStrategic ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
         </svg>
      </NavItem>

      <NavItem label="HISTORY" active={isHistory} onClick={() => setActiveScreen(8)}>
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isHistory ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
            <path d="M12 7v5l4 2"></path>
         </svg>
      </NavItem>

      <NavItem label="SETTINGS" active={isSettings} onClick={() => setActiveScreen(9)}>
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isSettings ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
         </svg>
      </NavItem>

      <div style={{ marginTop: 'auto', padding: '24px 0', borderTop: '1px solid var(--border-color)' }}>
         <NavItem label="LOGOUT" active={false} onClick={() => {}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
               <polyline points="16 17 21 12 16 7"></polyline>
               <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
         </NavItem>
      </div>

    </div>
  );
}
