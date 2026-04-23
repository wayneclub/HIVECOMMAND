import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useMission } from '../context/MissionContext';
import L from 'leaflet';

const commanderIcon = new L.DivIcon({
  className: 'custom',
  html: `<div style="display: flex; flex-direction: column; align-items: center;"><div style="width: 24px; height: 24px; border-radius: 50%; background: var(--cyan-primary); border: 4px solid var(--bg-dark); display: flex; align-items: center; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #000;"></div></div><div style="background: var(--cyan-primary); color: #000; padding: 2px 6px; font-weight: bold; font-size: 10px; margin-top: 4px;" class="mono">COMMANDER</div></div>`,
  iconSize: [80, 40]
});

const swarmLabelIcon = (id, color) => new L.DivIcon({
  className: 'custom-icon',
  html: `<div style="background: rgba(0,0,0,0.5); padding: 4px 8px; border: 1px solid ${color}; font-size: 10px; font-weight: bold; cursor: pointer; white-space: nowrap; margin-left: 10px; color: ${color};" class="mono">SWARM_${id}</div>`,
  iconSize: [0, 0]
});

const targetCrosshairIcon = new L.DivIcon({
  className: 'custom-icon',
  html: `<div style="width: 24px; height: 24px; border: 2px dashed var(--orange-alert); border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="width: 4px; height: 4px; background: var(--orange-alert); border-radius: 50%; box-shadow: 0 0 10px var(--orange-alert);"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function MapTracker() {
  const map = useMap();
  const { telemetry, targetLock, focusDrone } = useMission();
  
  useEffect(() => {
    // 1. Follow explicitly focused drone if set
    if (focusDrone) {
      const parentSwarm = telemetry.swarms.find(s => s.id === focusDrone.swarmId);
      if (parentSwarm) {
         const drone = parentSwarm.drones.find(d => d.id === focusDrone.droneId);
         if (drone) {
             const currentZoom = map.getZoom();
             const targetZoom = currentZoom < 18 ? 19 : currentZoom; 
             map.setView([drone.lat, drone.lng], targetZoom, { animate: false });
             return;
         }
      }
    }
  }, [telemetry, focusDrone, map]);

  return null;
}

export default function CommanderDefault() {
  const { setActiveScreen, setRole, telemetry, activeVideoFeeds } = useMission();

  React.useEffect(() => {
    setRole('COMMANDER');
  }, [setRole]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '32px', background: 'var(--bg-dark)', overflowY: 'auto' }}>
      
      {/* Strategic Header */}
      <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '32px' }}>
        <div>
           <h2 className="display text-cyan" style={{ margin: 0, fontSize: '28px', letterSpacing: '2px' }}>STRATEGIC_READY_ROOM</h2>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>THEATER_ID: AEGIS-V2 // LEVEL_5_OVERWATCH</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
           <div className="flex-column" style={{ alignItems: 'flex-end' }}>
              <span className="mono text-muted" style={{ fontSize: '10px' }}>THREAT_LEVEL</span>
              <span className="mono text-alert" style={{ fontSize: '18px', fontWeight: 'bold' }}>CODE_ORANGE</span>
           </div>
           <button className="btn btn-primary" style={{ background: 'var(--cyan-primary)', color: '#000' }}>AUTHORIZE_GLOBAL_STRIKE</button>
        </div>
      </div>

      {/* KPI Gauges Row */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        {[
          { label: 'FLEET_READY', val: '86%', color: 'var(--cyan-primary)' },
          { label: 'POWER_RESERVE', val: '92%', color: 'var(--cyan-primary)' },
          { label: 'SIGNAL_INTEGRITY', val: '98%', color: 'var(--cyan-primary)' },
          { label: 'AREA_CONTROL', val: '64%', color: 'var(--orange-primary)' }
        ].map((kpi, i) => (
          <div key={i} className="glass-panel" style={{ flex: 1, padding: '24px', position: 'relative', overflow: 'hidden' }}>
             <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: kpi.color }}></div>
             <span className="mono text-muted" style={{ fontSize: '10px' }}>{kpi.label}</span>
             <h3 className="display" style={{ margin: '12px 0 0 0', fontSize: '32px', color: kpi.color }}>{kpi.val}</h3>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '32px', flex: 1 }}>
        {/* Left: Sector Readiness List */}
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px' }}>ACTIVE_SECTOR_OVERVIEW</h4>
          
          <div className="flex-column" style={{ gap: '16px' }}>
            {telemetry.swarms.map(swarm => (
              <div key={swarm.id} className="glass-panel" style={{ padding: '16px', borderLeft: `2px solid ${swarm.color}` }}>
                <div className="flex-between" style={{ marginBottom: '12px' }}>
                  <span className="mono" style={{ color: swarm.color, fontWeight: 'bold' }}>SWARM_{swarm.id}</span>
                  <span className="mono text-muted" style={{ fontSize: '10px' }}>{swarm.status}</span>
                </div>
                <div className="flex-between">
                  <div className="flex-column">
                    <span className="mono text-muted" style={{ fontSize: '8px' }}>POWER</span>
                    <span className="mono text-main" style={{ fontSize: '14px' }}>{swarm.pwr}%</span>
                  </div>
                  <div className="flex-column" style={{ alignItems: 'flex-end' }}>
                    <span className="mono text-muted" style={{ fontSize: '8px' }}>DRONE_HEALTH</span>
                    <span className="mono text-cyan" style={{ fontSize: '14px' }}>{swarm.drones.length}/05</span>
                  </div>
                </div>
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', marginTop: '12px' }}>
                  <div style={{ height: '100%', width: `${swarm.pwr}%`, background: swarm.color }}></div>
                </div>
              </div>
            ))}
            {telemetry.swarms.length === 0 && (
              <div className="mono text-muted" style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-color)' }}>NO ACTIVE FLEETS IN SECTOR.</div>
            )}
          </div>
        </div>

        {/* Right: Theater Map (Macro View) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px' }}>GLOBAL_OPERATIONS_MAP</h4>
           <div className="glass-panel" style={{ flex: 1, padding: 0, position: 'relative', overflow: 'hidden' }}>
             <MapContainer center={[24.7869, 120.9975]} zoom={13} zoomControl={false} style={{ width: '100%', height: '100%', background: '#000' }}>
               <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
               {telemetry.swarms.map(swarm => (
                 <React.Fragment key={swarm.id}>
                   <Circle center={[swarm.baseLat, swarm.baseLng]} radius={800} pathOptions={{ color: swarm.color, fillOpacity: 0.1, weight: 1, dashArray: '10 10' }} />
                   <CircleMarker center={[swarm.baseLat, swarm.baseLng]} radius={6} pathOptions={{ color: swarm.color, fillOpacity: 1 }} />
                 </React.Fragment>
               ))}
             </MapContainer>
             
             {/* Bottom Map Controls Overlay */}
             <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(8,12,20,0.8)', border: '1px solid var(--border-color)', padding: '12px', zIndex: 1000 }} className="flex-column gap-2">
                <span className="mono text-cyan" style={{ fontSize: '10px' }}>SENSORS: ACTIVE</span>
                <span className="mono text-muted" style={{ fontSize: '8px' }}>RELIANCE: {activeVideoFeeds.length} CHANNELS</span>
             </div>
           </div>
        </div>
      </div>

    </div>
  );
}
