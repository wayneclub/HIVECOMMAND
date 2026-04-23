import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Tooltip } from 'react-leaflet';
import { useMission } from '../context/MissionContext';
import L from 'leaflet';

export default function AIParsedReview() {
  const { 
    setActiveScreen, 
    setTacticalPhase, 
    telemetry, 
    lastAIParsedCommand, 
    addWaypointToSwarm,
    addWaypointToDrone,
    addMissionToHistory,
    clearSwarmWaypoints
  } = useMission();

  if (!lastAIParsedCommand) {
    return (
      <div className="flex-center" style={{ height: '100%', background: '#000', color: 'var(--cyan-primary)' }}>
        <span className="mono">NO_ACTIVE_MISSION_PLAN // RE-START PLANNING</span>
        <button className="btn" onClick={() => setActiveScreen(1)} style={{ marginTop: '20px' }}>BACK TO MAP</button>
      </div>
    );
  }

  const handleDeploy = () => {
    // Audit Logging: Add to History
    addMissionToHistory(lastAIParsedCommand);

    if (lastAIParsedCommand.intent === 'ABORT_MOTION') {
       clearSwarmWaypoints(lastAIParsedCommand.swarmId);
       setTacticalPhase('IDLE');
       setActiveScreen(1);
    } else {
       // Support both single destination and multi-point path
       const waypoints = lastAIParsedCommand.waypoints || [lastAIParsedCommand.destination];
       
       if (lastAIParsedCommand.targetDroneId) {
          addWaypointToDrone(lastAIParsedCommand.swarmId, lastAIParsedCommand.targetDroneId, waypoints);
       } else {
          addWaypointToSwarm(lastAIParsedCommand.swarmId, waypoints);
       }
       
       if (lastAIParsedCommand.intent === 'STRIKE') {
         setTacticalPhase('AWAITING_COMMANDER');
         setActiveScreen(4); 
       } else {
         setTacticalPhase('TRANSIT');
         setActiveScreen(1); 
       }
    }
  };

  const isAbort = lastAIParsedCommand.intent === 'ABORT_MOTION';
  const swarm = telemetry.swarms.find(s => s.id === lastAIParsedCommand.swarmId);
  const center = isAbort ? [swarm?.baseLat || 24.7869, swarm?.baseLng || 120.9975] : [lastAIParsedCommand.destination.lat, lastAIParsedCommand.destination.lng];

  // For multi-point paths, we draw all segments
  const pathWaypoints = lastAIParsedCommand.waypoints || [];
  const fullPathPositions = [[swarm?.baseLat, swarm?.baseLng], ...pathWaypoints.map(wp => [wp.lat, wp.lng])];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
      
      {/* High-Fidelity Topo Map */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <MapContainer center={center} zoom={14} zoomControl={false} style={{ width: '100%', height: '100%', zIndex: 1 }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
          
          {swarm && (
            <React.Fragment>
               {/* Full Multi-Point Path */}
               <Polyline 
                 positions={fullPathPositions} 
                 pathOptions={{ color: swarm.color, weight: 6, opacity: 0.15, lineJoin: 'round' }} 
               />
               <Polyline 
                 positions={fullPathPositions} 
                 pathOptions={{ color: swarm.color, weight: 2, dashArray: '10 15', opacity: 1, lineJoin: 'round' }} 
               />

               {/* Waypoint Markers */}
               {pathWaypoints.map((wp, idx) => (
                 <Marker 
                   key={idx}
                   position={[wp.lat, wp.lng]} 
                   icon={new L.DivIcon({
                     className: 'wp-pin',
                     html: `
                      <div style="display: flex; flex-direction: column; align-items: center;">
                        <div style="width: 24px; height: 24px; background: rgba(0,229,255,0.2); border: 2px solid var(--cyan-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px var(--cyan-primary);">
                          <span style="font-size: 10px; color: #fff; font-weight: bold;">${idx+1}</span>
                        </div>
                      </div>
                     `,
                     iconSize: [30, 30],
                     iconAnchor: [15, 15]
                   })}
                 >
                   <Tooltip permanent direction="top" offset={[0, -10]}>
                      <span className="mono" style={{ fontSize: '9px' }}>ETA: {wp.eta}</span>
                   </Tooltip>
                 </Marker>
               ))}

               {/* Final Target Highlight if single destination */}
               {!lastAIParsedCommand.waypoints && (
                 <Marker position={center} icon={new L.DivIcon({
                    className: 'target-pin',
                    html: `<div style="width: 32px; height: 32px; border: 2px solid var(--orange-alert); border-radius: 50%; animation: pulse 2s infinite;"></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                 })} />
               )}
            </React.Fragment>
          )}
        </MapContainer>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(8, 12, 20, 0.6)', zIndex: 400, pointerEvents: 'none' }}></div>
      </div>

      {/* Intelligence HUD */}
      <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 500, width: '400px' }} className="flex-column gap-3">
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--cyan-primary)' }}>
           <span className="mono text-cyan" style={{ fontSize: '9px' }}>[ MISSION_PLAN_REVIEW ]</span>
           <h2 className="display text-main" style={{ margin: '8px 0', fontSize: '20px' }}>OBJECTIVE: <span className="text-cyan">{lastAIParsedCommand.intent}</span></h2>
           <p className="mono text-muted" style={{ fontSize: '10px' }}>SOURCE: {lastAIParsedCommand.raw === "MANUAL_TACTICAL_PLAN" ? "MANUAL_OPERATOR_INPUT" : "NEURAL_VOICE_CAPTURE"}</p>
        </div>

        {/* Waypoint Manifest Table */}
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(0,0,0,0.4)', maxHeight: '400px', overflowY: 'auto' }}>
           <h4 className="mono text-cyan" style={{ fontSize: '11px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>WAYPOINT_MANIFEST</h4>
           <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                 <tr style={{ textAlign: 'left' }}>
                    <th className="mono text-muted" style={{ fontSize: '9px', paddingBottom: '8px' }}>PNT</th>
                    <th className="mono text-muted" style={{ fontSize: '9px', paddingBottom: '8px' }}>DISTANCE</th>
                    <th className="mono text-muted" style={{ fontSize: '9px', paddingBottom: '8px', textAlign: 'right' }}>EST_ETA</th>
                 </tr>
              </thead>
              <tbody>
                 {(lastAIParsedCommand.waypoints || [{ ...lastAIParsedCommand.destination, label: 'FINAL', distance: lastAIParsedCommand.distance, eta: lastAIParsedCommand.eta }]).map((wp, i) => (
                   <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="mono text-main" style={{ fontSize: '10px', padding: '8px 0' }}>{wp.label}</td>
                      <td className="mono text-main" style={{ fontSize: '10px', padding: '8px 0' }}>{wp.distance} KM</td>
                      <td className="mono text-cyan" style={{ fontSize: '10px', padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>{wp.eta}</td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      {/* Stats Sidebar */}
      <div style={{ position: 'absolute', top: '30px', right: '30px', zIndex: 500, width: '320px' }} className="flex-column gap-3">
         <div className="glass-panel" style={{ padding: '20px' }}>
            <span className="mono text-muted" style={{ fontSize: '9px' }}>TACTICAL_METRICS</span>
            <div style={{ marginTop: '12px' }} className="flex-column gap-2">
               <div className="flex-between">
                  <span className="mono text-muted" style={{ fontSize: '10px' }}>ASSET</span>
                  <span className="mono text-main" style={{ fontSize: '11px' }}>SWARM_{lastAIParsedCommand.swarmId}</span>
               </div>
               <div className="flex-between">
                  <span className="mono text-muted" style={{ fontSize: '10px' }}>TOTAL_DIST</span>
                  <span className="mono text-cyan" style={{ fontSize: '11px' }}>{lastAIParsedCommand.distance} KM</span>
               </div>
               <div className="flex-between">
                 <span className="mono text-muted" style={{ fontSize: '10px' }}>AVG_GS</span>
                 <span className="mono text-main" style={{ fontSize: '11px' }}>{lastAIParsedCommand.predictedGS} KPH</span>
               </div>
               <div className="flex-between" style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                 <span className="mono text-muted" style={{ fontSize: '10px' }}>FINAL_ETA</span>
                 <span className="mono text-cyan" style={{ fontSize: '16px', fontWeight: 'bold' }}>{lastAIParsedCommand.eta}</span>
               </div>
            </div>
         </div>

         <div className="glass-panel" style={{ padding: '20px', background: 'rgba(0, 229, 255, 0.05)' }}>
            <h4 className="mono text-cyan" style={{ fontSize: '9px', marginBottom: '10px' }}>ENVIRONMENTAL_DATA</h4>
            <div className="flex-column gap-1">
               <div className="flex-between"><span className="mono text-muted" style={{ fontSize: '9px' }}>WIND</span><span className="mono text-main" style={{ fontSize: '9px' }}>{lastAIParsedCommand.missionWeather.wind}</span></div>
               <div className="flex-between"><span className="mono text-muted" style={{ fontSize: '9px' }}>VIS</span><span className="mono text-main" style={{ fontSize: '9px' }}>{lastAIParsedCommand.missionWeather.vis}</span></div>
            </div>
         </div>
      </div>

      {/* Action Footer */}
      <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: '20px' }}>
         <button className="btn" onClick={() => setActiveScreen(1)} style={{ padding: '14px 28px', fontSize: '12px' }}>ABORT_PLANNING</button>
         <button className="btn btn-primary" onClick={handleDeploy} style={{ 
           padding: '16px 60px', background: 'var(--cyan-primary)', color: '#000', fontWeight: 'bold', fontSize: '14px', 
           boxShadow: '0 0 30px rgba(0, 229, 255, 0.5)', border: 'none', cursor: 'pointer' 
         }}>
            AUTHORIZE_TACTICAL_DEPLOYMENT →
         </button>
      </div>

    </div>
  );
}
