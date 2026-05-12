import React, { useState } from 'react';
import { useMission } from '../context/MissionContext';
import logoUrl from '../assets/logo.svg';

const NavItem = ({ label, active, onClick, children }) => {
  const [hovered, setHovered] = useState(false);
  const accent = active || hovered;

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 0',
        cursor: 'pointer',
        transition: 'transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease',
        position: 'relative',
        background: active
          ? 'linear-gradient(180deg, rgba(0, 229, 255, 0.12), rgba(0, 229, 255, 0.04))'
          : hovered
            ? 'linear-gradient(180deg, rgba(0, 229, 255, 0.08), rgba(0, 229, 255, 0.02))'
            : 'transparent',
        width: '100%',
        transform: hovered ? 'translateX(2px)' : 'translateX(0)',
        boxShadow: hovered ? 'inset 0 0 0 1px rgba(0, 229, 255, 0.08), 0 0 24px rgba(0, 229, 255, 0.08)' : 'none'
      }}
    >
      {active && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--cyan-primary)', pointerEvents: 'none', boxShadow: '0 0 18px rgba(0, 229, 255, 0.45)' }}></div>}
      <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: `1px solid ${accent ? 'rgba(0, 229, 255, 0.42)' : 'rgba(255,255,255,0.03)'}`,
          background: accent ? 'rgba(0, 229, 255, 0.06)' : 'rgba(255,255,255,0.01)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: accent ? '0 0 24px rgba(0, 229, 255, 0.12), inset 0 0 18px rgba(0, 229, 255, 0.05)' : 'none',
          transition: 'all 0.18s ease'
        }}>
          {children}
        </div>
      </div>
      {hovered && (
        <div style={{
          position: 'absolute',
          left: '74px',
          top: '50%',
          transform: 'translateY(-50%)',
          padding: '10px 14px',
          border: '1px solid rgba(0, 229, 255, 0.24)',
          background: 'linear-gradient(135deg, rgba(8, 18, 30, 0.82), rgba(7, 14, 24, 0.62))',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 0 28px rgba(0, 229, 255, 0.12), inset 0 0 18px rgba(255,255,255,0.02)',
          borderRadius: '12px',
          whiteSpace: 'nowrap',
          zIndex: 30
        }}>
          <span className="mono" style={{ fontSize: '11px', color: '#d7f8ff', letterSpacing: '0.18em' }}>{label}</span>
        </div>
      )}
    </div>
  );
};

export default function Sidebar() {
  const mission = useMission() || {};
  const {
    activeScreen = 11,
    setActiveScreen = () => {},
    currentUser = null,
    logoutUser = () => {}
  } = mission;
  const [dashboardHovered, setDashboardHovered] = useState(false);
  const currentRole = currentUser?.role || null;

  // Route groupings base logic (can be refined per exact screen needs)
  const isDashboard = activeScreen === 11;
  const isTactical = [1, 2, 3, 4].includes(activeScreen);
  const isHistory = activeScreen === 8;
  const isSettings = activeScreen === 9;
  const isProfile = activeScreen === 10;
  const navDisabled = !currentUser;

  const renderProfileIcon = () => {
    if (currentRole === 'OBSERVER') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isProfile ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      );
    }

    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isProfile ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8"></circle>
        <circle cx="12" cy="12" r="2.5"></circle>
        <line x1="12" y1="2.5" x2="12" y2="5"></line>
        <line x1="12" y1="19" x2="12" y2="21.5"></line>
        <line x1="2.5" y1="12" x2="5" y2="12"></line>
        <line x1="19" y1="12" x2="21.5" y2="12"></line>
      </svg>
    );
  };

  const renderSessionIcon = () => {
    if (currentUser) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      );
    }

    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v4"></path>
        <polyline points="10 14 15 9 20 14"></polyline>
        <line x1="15" y1="9" x2="15" y2="21"></line>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      </svg>
    );
  };

  return (
    <div style={{ width: '80px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 5000 }}>
      
      <div
        onClick={() => setActiveScreen(11)}
        onMouseEnter={() => setDashboardHovered(true)}
        onMouseLeave={() => setDashboardHovered(false)}
        style={{
          padding: '18px 8px 18px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '8px',
          cursor: 'pointer',
          background: isDashboard
            ? 'linear-gradient(180deg, rgba(0, 229, 255, 0.14), rgba(0, 229, 255, 0.02))'
            : dashboardHovered
              ? 'linear-gradient(180deg, rgba(0, 229, 255, 0.08), rgba(0, 229, 255, 0.01))'
              : 'transparent',
          boxShadow: dashboardHovered || isDashboard ? 'inset 0 0 0 1px rgba(0, 229, 255, 0.08), 0 0 26px rgba(0, 229, 255, 0.08)' : 'none',
          transition: 'all 0.18s ease'
        }}
      >
        <div style={{
          width: '44px',
          height: '44px',
          margin: '0 auto',
          borderRadius: '14px',
          border: `1px solid ${isDashboard || dashboardHovered ? 'rgba(0, 229, 255, 0.34)' : 'rgba(255,255,255,0.06)'}`,
          background: isDashboard || dashboardHovered ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDashboard || dashboardHovered ? '0 0 26px rgba(0, 229, 255, 0.14)' : 'none',
          transition: 'all 0.18s ease'
        }}>
          <img src={logoUrl} alt="Dashboard" style={{ width: '24px', height: '24px', opacity: isDashboard || dashboardHovered ? 1 : 0.86 }} />
        </div>
        {dashboardHovered && (
          <div style={{
            position: 'absolute',
            left: '74px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '10px 14px',
            border: '1px solid rgba(0, 229, 255, 0.24)',
            background: 'linear-gradient(135deg, rgba(8, 18, 30, 0.82), rgba(7, 14, 24, 0.62))',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 0 28px rgba(0, 229, 255, 0.12), inset 0 0 18px rgba(255,255,255,0.02)',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
            zIndex: 30
          }}>
            <span className="mono" style={{ fontSize: '11px', color: '#d7f8ff', letterSpacing: '0.18em' }}>DASHBOARD</span>
          </div>
        )}
      </div>

      <NavItem label="TACTICAL" active={isTactical} onClick={() => !navDisabled && setActiveScreen(1)}>
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isTactical ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="12" y1="2" x2="12" y2="4"></line>
            <line x1="12" y1="20" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="4" y2="12"></line>
            <line x1="20" y1="12" x2="22" y2="12"></line>
         </svg>
      </NavItem>

      <div style={{ opacity: navDisabled ? 0.35 : 1, pointerEvents: navDisabled ? 'none' : 'auto' }}>
      <NavItem label="HISTORY" active={isHistory} onClick={() => setActiveScreen(8)}>
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isHistory ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
            <path d="M12 7v5l4 2"></path>
         </svg>
      </NavItem>
      </div>

      <div style={{ opacity: navDisabled ? 0.35 : 1, pointerEvents: navDisabled ? 'none' : 'auto' }}>
      <NavItem label="PROFILE" active={isProfile} onClick={() => setActiveScreen(10)}>
         {renderProfileIcon()}
      </NavItem>
      </div>

      <div style={{ opacity: navDisabled ? 0.35 : 1, pointerEvents: navDisabled ? 'none' : 'auto' }}>
      <NavItem label="SETTINGS" active={isSettings} onClick={() => setActiveScreen(9)}>
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isSettings ? "var(--cyan-primary)" : "var(--text-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
         </svg>
      </NavItem>
      </div>

      <div style={{ marginTop: 'auto', padding: '24px 0', borderTop: '1px solid var(--border-color)' }}>
         <NavItem label={currentUser ? "LOGOUT" : "LOGIN"} active={false} onClick={() => currentUser ? logoutUser() : setActiveScreen(10)}>
            {renderSessionIcon()}
         </NavItem>
      </div>

    </div>
  );
}
