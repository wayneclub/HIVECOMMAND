import React from 'react';
import { useMission } from '../context/MissionContext';
import { MapContainer, TileLayer, Circle, Polyline } from 'react-leaflet';

export default function MissionPostMortem() {
  const { historyMissions, selectedHistoryId, setSelectedHistoryId } = useMission();

  const selectedMission = historyMissions.find(m => m.id === selectedHistoryId);

  // If no mission is selected, show the Archive List
  if (!selectedHistoryId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '32px', background: 'var(--bg-dark)', overflowY: 'auto' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '24px', marginBottom: '32px' }}>
           <h2 className="display text-cyan" style={{ margin: 0, fontSize: '28px', letterSpacing: '2px' }}>MISSION_HISTORY_ARCHIVE</h2>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>ENCRYPTED_LOGS // ACCESS_LEVEL_SILVER</span>
        </div>

        <div className="flex-column" style={{ gap: '16px' }}>
          {historyMissions.map((mission, idx) => (
            <div 
              key={mission.id} 
              onClick={() => setSelectedHistoryId(mission.id)}
              className="glass-panel" 
              style={{ 
                padding: '24px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                transition: 'transform 0.2s, border-color 0.2s',
                borderLeft: `4px solid ${mission.status === 'SUCCESS' ? 'var(--cyan-primary)' : 'var(--orange-alert)'}`
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cyan-primary)'; e.currentTarget.style.transform = 'translateX(8px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <span className="mono text-muted" style={{ fontSize: '12px' }}>#{idx.toString().padStart(3, '0')}</span>
                <div className="flex-column">
                   <span className="mono text-main" style={{ fontSize: '16px', fontWeight: 'bold' }}>{mission.name}</span>
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>ID: {mission.id} // DATE: {mission.date}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '48px', alignItems: 'center' }}>
                <div className="flex-column" style={{ alignItems: 'center' }}>
                   <span className="mono text-muted" style={{ fontSize: '8px' }}>DURATION</span>
                   <span className="mono text-main" style={{ fontSize: '14px' }}>{mission.duration}</span>
                </div>
                <div className="flex-column" style={{ alignItems: 'center' }}>
                   <span className="mono text-muted" style={{ fontSize: '8px' }}>STATUS</span>
                   <span className="mono" style={{ fontSize: '12px', color: mission.status === 'SUCCESS' ? 'var(--cyan-primary)' : 'var(--orange-alert)' }}>{mission.status}</span>
                </div>
                <span className="text-cyan">➔</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If a mission is selected, show the Post-Mortem Detail View
  return (
    <div className="print-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '32px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
      
      {/* Detail Header */}
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button 
            onClick={() => setSelectedHistoryId(null)} 
            className="btn" 
            style={{ padding: '8px 12px', fontSize: '10px', height: 'fit-content' }}
          >
            BACK
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 className="display text-main" style={{ margin: 0, fontSize: '28px', letterSpacing: '1px' }}>REPORT: {selectedMission.name}</h2>
              <span className="mono" style={{ background: 'rgba(0, 229, 255, 0.1)', color: 'var(--cyan-primary)', border: '1px solid var(--border-cyan)', padding: '4px 12px', fontSize: '12px' }}>{selectedMission.status}</span>
            </div>
            <p className="mono text-muted" style={{ margin: '8px 0 0 0', fontSize: '10px' }}>SECURITY CLEARANCE: LEVEL 5 // LOG_ID: {selectedMission.id}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }} className="no-print">
          <button className="btn btn-primary" style={{ fontSize: '12px', padding: '12px 24px' }} onClick={() => window.print()}>EXPORT_PDF</button>
        </div>
      </div>

      {/* Report Content (Simplified original style) */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--cyan-primary)', padding: '24px' }}>
          <span className="mono text-muted" style={{ fontSize: '10px' }}>ASSETS_TOTAL</span>
          <h3 className="display text-cyan" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{selectedMission.assets} UAVs</h3>
        </div>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--border-color)', padding: '24px' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>MISSION_CLOCK</span>
           <h3 className="display text-main" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{selectedMission.duration}</h3>
        </div>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--border-color)', padding: '24px' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>PATH_NODES</span>
           <h3 className="display text-main" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{selectedMission.paths}</h3>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '32px', flex: 1 }}>
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column' }}>
           <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', marginBottom: '16px' }}>DECISION_TIMELINE</h4>
           <div className="glass-panel" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {[
                { t: 'T+00:00', label: 'DEPLOYMENT', d: 'Fleet launched from command center.' },
                { t: 'T+05:12', label: 'WAYPOINT_1', d: 'First waypoint reached. Signal check OK.' },
                { t: 'T+12:44', label: 'AI_RECOGNITION', d: 'Target identified via onboard sensors.', isCyan: true },
                { t: 'T+18:02', label: 'VOICE_COMMAND', d: 'Manual override: FORMATION_CIRCLE' },
                { t: 'T+22:15', label: 'OBJECTIVE_COMPLETE', d: 'Mission parameters satisfied.', isCyan: true },
              ].map((ev, i) => (
                <div key={i} style={{ marginBottom: '24px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-5px', top: '0', width: '9px', height: '9px', background: ev.isCyan ? 'var(--cyan-primary)' : 'var(--text-muted)', borderRadius: '50%' }}></div>
                  <span className="mono text-muted" style={{ fontSize: '10px' }}>{ev.t}</span><br/>
                  <span className="mono text-main" style={{ fontSize: '12px', fontWeight: 'bold' }}>{ev.label}</span><br/>
                  <span className="mono text-muted" style={{ fontSize: '10px' }}>{ev.d}</span>
                </div>
              ))}
           </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px' }}>FLIGHT_DATA_VISUALIZATION</h4>
           <div className="glass-panel" style={{ flex: 1, minHeight: '300px', background: '#000' }}>
              <MapContainer center={[24.7869, 120.9975]} zoom={15} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
                <Circle center={[24.7869, 120.9975]} radius={300} pathOptions={{ color: 'var(--cyan-primary)', dashArray: '10, 10' }} />
                <Polyline positions={[[24.782, 120.992], [24.7869, 120.9975]]} pathOptions={{ color: 'var(--orange-primary)', weight: 2 }} />
              </MapContainer>
           </div>
           
           <div className="glass-panel" style={{ padding: '24px' }}>
              <h4 className="mono text-muted" style={{ fontSize: '10px', marginBottom: '12px' }}>OFFICIAL_STAMP</h4>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                 <div style={{ width: '60px', height: '60px', border: '2px solid var(--text-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                    <span className="mono" style={{ fontSize: '8px' }}>AEGIS_SEC</span>
                 </div>
                 <div className="flex-column">
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>CERTIFIED BY: AEGIS CENTRAL COMMAND</span>
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>TIMESTAMP: {new Date().toISOString()}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
