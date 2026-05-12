import React from 'react';
import { useMission } from '../context/MissionContext';

const UserRoleIcon = ({ role }) => {
  if (role === 'OBSERVER') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"></path>
        <circle cx="12" cy="12" r="2.8"></circle>
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19l5.5-5.5"></path>
      <path d="M14.5 9.5L20 4"></path>
      <path d="M8 6l3 3"></path>
      <path d="M13 11l5 5"></path>
      <path d="M5 21l4-1 9-9-3-3-9 9-1 4z"></path>
    </svg>
  );
};

const pageBg = {
  minHeight: '100%',
  overflowY: 'auto',
  background: `
    radial-gradient(circle at 15% 12%, rgba(72, 215, 255, 0.08), transparent 24%),
    radial-gradient(circle at 80% 10%, rgba(255, 179, 92, 0.06), transparent 20%),
    linear-gradient(180deg, rgba(6, 12, 21, 0.98), rgba(4, 8, 16, 1))
  `,
  padding: '30px 30px 40px'
};

const sectionCard = {
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'linear-gradient(180deg, rgba(13, 20, 33, 0.96), rgba(9, 14, 24, 0.94))',
  borderRadius: '22px',
  overflow: 'hidden',
  boxShadow: '0 16px 36px rgba(0,0,0,0.22)'
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  padding: '18px 20px'
};

const dividerStyle = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)'
};

const GroupHeader = ({ title, detail }) => (
  <div style={{ margin: '0 0 12px 6px' }}>
    <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '6px' }}>{title}</div>
    {detail && <div className="mono text-muted" style={{ fontSize: '10px', lineHeight: 1.6 }}>{detail}</div>}
  </div>
);

const SettingRow = ({ icon, title, subtitle, value, accent, onClick, children, clickable = false }) => (
  <div
    onClick={onClick}
    style={{
      ...rowStyle,
      cursor: clickable ? 'pointer' : 'default',
      transition: 'background 0.18s ease',
      background: clickable ? 'rgba(255,255,255,0.01)' : 'transparent'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '12px',
        border: `1px solid ${accent || 'rgba(72, 215, 255, 0.18)'}`,
        background: accent ? `${accent}18` : 'rgba(72, 215, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="display text-main" style={{ fontSize: '18px', marginBottom: subtitle ? '4px' : 0 }}>{title}</div>
        {subtitle && <div className="mono text-muted" style={{ fontSize: '10px', lineHeight: 1.6 }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
      {children || (value && <div className="mono text-main" style={{ fontSize: '11px', letterSpacing: '0.12em' }}>{value}</div>)}
      {clickable && <span className="mono text-muted" style={{ fontSize: '14px' }}>›</span>}
    </div>
  </div>
);

const ChoicePill = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      border: `1px solid ${active ? 'rgba(72, 215, 255, 0.28)' : 'rgba(255,255,255,0.08)'}`,
      background: active ? 'linear-gradient(135deg, rgba(72, 215, 255, 0.14), rgba(72, 215, 255, 0.04))' : 'rgba(255,255,255,0.02)',
      color: active ? '#dffcff' : 'var(--text-muted)',
      padding: '10px 14px',
      borderRadius: '999px',
      cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase'
    }}
  >
    {label}
  </button>
);

export default function RBACSettings() {
  const {
    setActiveScreen,
    LOCATIONS,
    changeGlobalLocation,
    selectedLocationKey,
    unitSystem,
    setUnitSystem,
    currentUser,
    formatAltitude,
    formatDistance,
    formatSpeed,
    formatTemperature,
    formatVisibility
  } = useMission();

  return (
    <div style={pageBg}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 360px', gap: '26px', alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: '24px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '10px' }}>SYSTEM_SETTINGS</div>
            <div className="display text-main" style={{ fontSize: '40px', marginBottom: '10px' }}>Command Preferences</div>
            <div className="mono text-muted" style={{ fontSize: '12px', lineHeight: 1.8, maxWidth: '760px' }}>
              Configure active user access, station location, and measurement behavior for the tactical surface.
            </div>
          </div>

          <div style={{ display: 'grid', gap: '22px' }}>
            <div>
              <GroupHeader title="ACCOUNT" detail="Identity and access routing for the currently signed-in control station." />
              <div style={sectionCard}>
                <SettingRow
                  icon={<UserRoleIcon role={currentUser?.role || 'OPERATOR'} />}
                  title={currentUser ? `${currentUser.role} ${currentUser.name}` : 'No Active User'}
                  subtitle={currentUser ? 'Current authenticated operator profile.' : 'Login required before entering tactical controls.'}
                  value={currentUser ? 'ACTIVE' : 'OFFLINE'}
                  accent="rgba(72, 215, 255, 0.26)"
                  onClick={() => setActiveScreen(10)}
                  clickable
                />
              </div>
            </div>

            <div>
              <GroupHeader title="STATION" detail="Select the command location used by the map, telemetry origin, and station reference data." />
              <div style={sectionCard}>
                <SettingRow
                  icon={(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  )}
                  title="Primary Station"
                  subtitle="Used as the command origin and dashboard station focus."
                  value={String(selectedLocationKey || '').toUpperCase()}
                  accent="rgba(113, 255, 146, 0.24)"
                />
                <div style={dividerStyle} />
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {Object.keys(LOCATIONS || {}).map((locKey) => (
                      <ChoicePill
                        key={locKey}
                        active={selectedLocationKey === locKey}
                        label={locKey}
                        onClick={() => changeGlobalLocation(locKey)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <GroupHeader title="MEASUREMENTS" detail="Switch display units across altitude, speed, distance, and environmental readouts." />
              <div style={sectionCard}>
                <SettingRow
                  icon={(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19L19 4"></path>
                      <path d="M14 4h5v5"></path>
                      <path d="M5 10l5 5"></path>
                    </svg>
                  )}
                  title="Unit System"
                  subtitle="Choose how tactical telemetry is formatted across the interface."
                  value={unitSystem.toUpperCase()}
                  accent="rgba(255, 179, 92, 0.24)"
                />
                <div style={dividerStyle} />
                <div style={{ padding: '18px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <ChoicePill active={unitSystem === 'metric'} label="Metric" onClick={() => setUnitSystem('metric')} />
                  <ChoicePill active={unitSystem === 'imperial'} label="Imperial" onClick={() => setUnitSystem('imperial')} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', top: '24px', display: 'grid', gap: '18px' }}>
          <div style={{ ...sectionCard, padding: '22px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '14px' }}>FORMAT PREVIEW</div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                ['Altitude', formatAltitude(250)],
                ['Distance', formatDistance(4200)],
                ['Ground Speed', formatSpeed(80)],
                ['Visibility', formatVisibility(10)],
                ['Temperature', formatTemperature(24)]
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="mono text-muted" style={{ fontSize: '10px', letterSpacing: '0.12em' }}>{label.toUpperCase()}</span>
                  <span className="mono text-main" style={{ fontSize: '11px' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...sectionCard, padding: '22px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '14px' }}>DEVICE SUMMARY</div>
            <div className="mono text-main" style={{ fontSize: '12px', lineHeight: 1.9 }}>
              SESSION // {currentUser ? `${currentUser.role} ${currentUser.name}`.toUpperCase() : 'OFFLINE'}
              <br />
              STATION // {selectedLocationKey.toUpperCase()}
              <br />
              FORMAT // {unitSystem.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
