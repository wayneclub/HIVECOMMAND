import React from 'react';
import { useMission } from '../context/MissionContext';
import { MapContainer, TileLayer, Circle, Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

const formatDateTime = (timestamp) => {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};
const getRouteDistanceMeters = (route = []) => {
  if (!Array.isArray(route) || route.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    const [prevLat, prevLng] = route[i - 1];
    const [nextLat, nextLng] = route[i];
    const dx = (nextLat - prevLat) * 111320;
    const dy = (nextLng - prevLng) * 111320;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
};
const routeMarkerIcon = (label, color) => new L.DivIcon({
  className: '',
  html: `<div style="display:flex;align-items:center;justify-content:center;min-width:74px;height:28px;padding:0 10px;border:1px solid ${color};background:#080c14;color:${color};font-family:monospace;font-size:10px;font-weight:bold;letter-spacing:0.08em;">${label}</div>`,
  iconSize: [74, 28],
  iconAnchor: [37, 14]
});

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
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>OPERATOR: {mission.operatorName} // COMMANDER: {mission.commanderName}</span>
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

  const plottedRoute = selectedMission.actualRoute?.length ? selectedMission.actualRoute : (selectedMission.route?.length ? selectedMission.route : [[34.0189, -118.2912], [34.0206925, -118.2895045]]);
  const timeline = selectedMission.timeline?.length ? selectedMission.timeline : [
    { id: 'fallback-start', t: 'T+00:00:00', label: 'DEPLOYMENT', d: 'Mission record imported without event stream.' }
  ];
  const originPoint = plottedRoute[0];
  const destinationPoint = plottedRoute[plottedRoute.length - 1];
  const flightDistanceMeters = getRouteDistanceMeters(plottedRoute);

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
           <h3 className="display text-main" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{plottedRoute.length}</h3>
        </div>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--border-color)', padding: '24px' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>FLIGHT_DISTANCE</span>
           <h3 className="display text-main" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{(flightDistanceMeters / 1000).toFixed(2)} KM</h3>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>OPERATOR</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{selectedMission.operatorName}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>COMMANDER</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{selectedMission.commanderName}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>STARTED_AT</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{formatDateTime(selectedMission.startedAt)}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>ENDED_AT</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{formatDateTime(selectedMission.endedAt)}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>LAST_KNOWN_ALT</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{Math.round(selectedMission.lastKnownAlt || 0)} M</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>LAST_KNOWN_SPEED</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{Math.round(selectedMission.lastKnownSpeed || 0)} KPH</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>ORIGIN_COORD</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{originPoint ? `${originPoint[0].toFixed(6)}, ${originPoint[1].toFixed(6)}` : '--'}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>DESTINATION_COORD</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{destinationPoint ? `${destinationPoint[0].toFixed(6)}, ${destinationPoint[1].toFixed(6)}` : '--'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '32px', flex: 1 }}>
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column' }}>
           <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', marginBottom: '16px' }}>DECISION_TIMELINE</h4>
           <div className="glass-panel" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {timeline.map((ev, i) => (
                <div key={i} style={{ marginBottom: '24px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-5px', top: '0', width: '9px', height: '9px', background: /COMPLETE|SUCCESS/.test(ev.label) ? 'var(--cyan-primary)' : /ABORT/.test(ev.label) ? 'var(--orange-alert)' : 'var(--text-muted)', borderRadius: '50%' }}></div>
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
              <MapContainer center={[selectedMission.centerLat || 34.0206925, selectedMission.centerLng || -118.2895045]} zoom={15} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
                <Circle center={[selectedMission.centerLat || 34.0206925, selectedMission.centerLng || -118.2895045]} radius={300} pathOptions={{ color: 'var(--cyan-primary)', dashArray: '10, 10' }} />
                <Polyline positions={plottedRoute} pathOptions={{ color: 'var(--orange-primary)', weight: 3 }} />
                {originPoint && (
                  <Marker position={originPoint} icon={routeMarkerIcon('ORIGIN', 'var(--cyan-primary)')}>
                    <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                      <span className="mono" style={{ fontSize: '10px' }}>{originPoint[0].toFixed(6)}, {originPoint[1].toFixed(6)}</span>
                    </Tooltip>
                  </Marker>
                )}
                {destinationPoint && (
                  <Marker position={destinationPoint} icon={routeMarkerIcon('DESTINATION', 'var(--orange-primary)')}>
                    <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                      <span className="mono" style={{ fontSize: '10px' }}>{destinationPoint[0].toFixed(6)}, {destinationPoint[1].toFixed(6)}</span>
                    </Tooltip>
                  </Marker>
                )}
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
