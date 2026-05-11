import React, { useEffect, useMemo, useState } from 'react';
import { useMission } from '../context/MissionContext';
import { MapContainer, TileLayer, Circle, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
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
const getPointDistanceMeters = (pointA, pointB) => {
  if (!pointA || !pointB) return 0;
  const dx = (pointB[0] - pointA[0]) * 111320;
  const dy = (pointB[1] - pointA[1]) * 111320;
  return Math.sqrt(dx * dx + dy * dy);
};
const getMissionScopedSnapshot = (mission, snapshot) => {
  if (!snapshot) return [];

  if (mission?.targetDroneId) {
    const swarmMatch = (snapshot.swarms || []).flatMap((swarm) =>
      (swarm.drones || [])
        .filter((drone) => drone.id === mission.targetDroneId)
        .map((drone) => ({
          unitId: `UAV_${drone.id}`,
          groupId: `SWARM_${swarm.id}`,
          status: swarm.status,
          alt: drone.alt,
          speed: drone.speed,
          pwr: drone.pwr,
          lat: drone.lat,
          lng: drone.lng
        }))
    );
    if (swarmMatch.length) return swarmMatch;

    return (snapshot.unassignedDrones || [])
      .filter((drone) => drone.id === mission.targetDroneId)
      .map((drone) => ({
        unitId: `UAV_${drone.id}`,
        groupId: 'INDEPENDENT',
        status: drone.status,
        alt: drone.alt,
        speed: drone.speed,
        pwr: drone.pwr,
        lat: drone.lat,
        lng: drone.lng
      }));
  }

  if (mission?.swarmId) {
    const swarm = (snapshot.swarms || []).find((item) => item.id === mission.swarmId);
    if (!swarm) return [];
    return (swarm.drones || []).map((drone) => ({
      unitId: `UAV_${drone.id}`,
      groupId: `SWARM_${swarm.id}`,
      status: swarm.status,
      alt: drone.alt,
      speed: drone.speed,
      pwr: drone.pwr,
      lat: drone.lat,
      lng: drone.lng
    }));
  }

  return [];
};
const routeMarkerIcon = (label, color) => new L.DivIcon({
  className: '',
  html: `<div style="display:flex;align-items:center;justify-content:center;min-width:74px;height:28px;padding:0 10px;border:1px solid ${color};background:#080c14;color:${color};font-family:monospace;font-size:10px;font-weight:bold;letter-spacing:0.08em;">${label}</div>`,
  iconSize: [74, 28],
  iconAnchor: [37, 14]
});

function FitHistoryRoute({ route, routeDistanceMeters }) {
  const map = useMap();

  useEffect(() => {
    const validRoute = (route || []).filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (validRoute.length === 0) return;

    if (validRoute.length === 1) {
      map.setView(validRoute[0], 18, { animate: false });
      return;
    }

    const bounds = L.latLngBounds(validRoute.map(([lat, lng]) => [lat, lng]));
    const isShortRoute = routeDistanceMeters < 450;
    map.fitBounds(bounds, {
      padding: isShortRoute ? [90, 90] : [140, 140],
      maxZoom: isShortRoute ? 18 : 16,
      animate: false
    });
  }, [map, route, routeDistanceMeters]);

  return null;
}

export default function MissionPostMortem() {
  const { historyMissions, selectedHistoryId, setSelectedHistoryId, telemetry } = useMission();
  const assetBase = import.meta.env.BASE_URL;
  const droneVideoMap = useMemo(() => ({
    '01': `${assetBase}videos/drone-1.mp4`,
    '02': `${assetBase}videos/drone-2.mp4`,
    '03': `${assetBase}videos/drone-3.mp4`,
    '04': `${assetBase}videos/drone-4.mp4`,
    '05': `${assetBase}videos/drone-5.mp4`
  }), [assetBase]);

  const selectedMission = historyMissions.find(m => m.id === selectedHistoryId);
  const replayDroneIds = useMemo(() => {
    if (!selectedMission) return [];
    if (selectedMission.targetDroneId) return [selectedMission.targetDroneId];

    if (selectedMission.swarmId) {
      const liveSwarm = telemetry.swarms.find((swarm) => swarm.id === selectedMission.swarmId);
      const liveIds = liveSwarm?.drones?.map((drone) => drone.id) || [];
      if (liveIds.length) return liveIds;
    }

    return selectedMission.assets === 1 ? ['05'] : ['01', '02', '03', '04'];
  }, [selectedMission, telemetry.swarms]);
  const [selectedReplayDroneId, setSelectedReplayDroneId] = useState(null);

  useEffect(() => {
    if (!replayDroneIds.length) {
      setSelectedReplayDroneId(null);
      return;
    }
    if (!selectedReplayDroneId || !replayDroneIds.includes(selectedReplayDroneId)) {
      setSelectedReplayDroneId(replayDroneIds[0]);
    }
  }, [replayDroneIds, selectedReplayDroneId]);

  const plottedRoute = selectedMission?.actualRoute?.length ? selectedMission.actualRoute : (selectedMission?.route?.length ? selectedMission.route : [[34.0189, -118.2912], [34.0206925, -118.2895045]]);
  const timeline = selectedMission?.timeline?.length ? selectedMission.timeline : [
    { id: 'fallback-start', t: 'T+00:00:00', label: 'DEPLOYMENT', d: 'Mission record imported without event stream.' }
  ];
  const originPoint = plottedRoute[0];
  const destinationPoint = plottedRoute[plottedRoute.length - 1];
  const flightDistanceMeters = getRouteDistanceMeters(plottedRoute);
  const terminalDistanceMeters = getPointDistanceMeters(originPoint, destinationPoint);
  const tagOverlapRisk = terminalDistanceMeters < 170;
  const originTooltipDirection = tagOverlapRisk ? 'left' : 'top';
  const destinationTooltipDirection = tagOverlapRisk ? 'right' : 'top';
  const originTooltipOffset = tagOverlapRisk ? [-28, -4] : [0, -12];
  const destinationTooltipOffset = tagOverlapRisk ? [28, -4] : [0, -12];
  const replayVideoSrc = selectedReplayDroneId ? (droneVideoMap[selectedReplayDroneId] || droneVideoMap['01']) : null;
  const mapCenter = destinationPoint
    || originPoint
    || [selectedMission?.centerLat || 34.0206925, selectedMission?.centerLng || -118.2895045];
  const tacticalHistory = selectedMission?.tacticalLog || [];

  // If no mission is selected, show the Archive List
  if (!selectedHistoryId || !selectedMission) {
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
                   {mission.notes && (
                     <span className="mono text-muted" style={{ fontSize: '10px', marginTop: '6px', maxWidth: '620px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       NOTES: {mission.notes}
                     </span>
                   )}
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

      {selectedMission.notes && (
        <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px' }}>
          <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '10px' }}>MISSION_NOTES</div>
          <div className="mono text-main" style={{ fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {selectedMission.notes}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '32px', flex: 1 }}>
        <div style={{ width: '430px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
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

          <div>
            <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', marginBottom: '16px' }}>TACTICAL_LOG_ARCHIVE</h4>
            <div className="glass-panel" style={{ padding: '20px', maxHeight: '760px', overflowY: 'auto' }}>
              {tacticalHistory.length ? tacticalHistory.map((entry) => {
                const scopedUnits = getMissionScopedSnapshot(selectedMission, entry.telemetrySnapshot);
                return (
                  <div key={entry.id || `${entry.at}-${entry.message}`} style={{ marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="mono text-muted" style={{ fontSize: '10px' }}>[{entry.timestamp}] {entry.type}</span>
                      <span className="mono text-muted" style={{ fontSize: '10px' }}>{entry.phase || 'UNKNOWN_PHASE'}</span>
                    </div>
                    <div className="mono" style={{ fontSize: '12px', color: '#ff7d3b', lineHeight: 1.5 }}>
                      {entry.message}
                    </div>
                    {entry.coords && (
                      <div className="mono text-muted" style={{ fontSize: '10px', marginTop: '6px' }}>
                        COORD: {Number(entry.coords.lat || 0).toFixed(5)}, {Number(entry.coords.lng || 0).toFixed(5)}
                      </div>
                    )}
                    {scopedUnits.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                        {scopedUnits.map((unit) => (
                          <div key={`${entry.id}-${unit.unitId}`} style={{ border: '1px solid rgba(0,229,255,0.12)', background: 'rgba(255,255,255,0.02)', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                              <span className="mono text-main" style={{ fontSize: '11px' }}>{unit.unitId}</span>
                              <span className="mono text-muted" style={{ fontSize: '9px' }}>{unit.groupId}</span>
                            </div>
                            <div className="mono text-muted" style={{ fontSize: '9px', lineHeight: 1.6 }}>
                              ALT {Math.round(unit.alt || 0)}M | SPD {Math.round(unit.speed || 0)}KPH | PWR {Math.round(unit.pwr || 0)}%
                            </div>
                            <div className="mono text-muted" style={{ fontSize: '9px', lineHeight: 1.6 }}>
                              LAT {Number(unit.lat || 0).toFixed(4)} | LNG {Number(unit.lng || 0).toFixed(4)}
                            </div>
                            <div className="mono text-muted" style={{ fontSize: '9px', lineHeight: 1.6 }}>
                              STATUS {unit.status || 'UNKNOWN'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="mono text-muted" style={{ fontSize: '11px' }}>NO_TACTICAL_LOG_ARCHIVE_AVAILABLE</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px' }}>FLIGHT_DATA_VISUALIZATION</h4>
           <div className="glass-panel" style={{ flex: 1, minHeight: '300px', background: '#000' }}>
              <MapContainer center={mapCenter} zoom={16} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
                <FitHistoryRoute route={plottedRoute} routeDistanceMeters={flightDistanceMeters} />
                <Circle center={[selectedMission.centerLat || 34.0206925, selectedMission.centerLng || -118.2895045]} radius={300} pathOptions={{ color: 'var(--cyan-primary)', dashArray: '10, 10' }} />
                <Polyline positions={plottedRoute} pathOptions={{ color: 'var(--orange-primary)', weight: 3 }} />
                {originPoint && (
                  <Marker position={originPoint} icon={routeMarkerIcon('ORIGIN', 'var(--cyan-primary)')}>
                    <Tooltip direction={originTooltipDirection} offset={originTooltipOffset} opacity={1}>
                      <span className="mono" style={{ fontSize: '10px' }}>{originPoint[0].toFixed(6)}, {originPoint[1].toFixed(6)}</span>
                    </Tooltip>
                  </Marker>
                )}
                {destinationPoint && (
                  <Marker position={destinationPoint} icon={routeMarkerIcon('DESTINATION', 'var(--orange-primary)')}>
                    <Tooltip direction={destinationTooltipDirection} offset={destinationTooltipOffset} opacity={1}>
                      <span className="mono" style={{ fontSize: '10px' }}>{destinationPoint[0].toFixed(6)}, {destinationPoint[1].toFixed(6)}</span>
                    </Tooltip>
                  </Marker>
                )}
              </MapContainer>
           </div>

           <div className="glass-panel" style={{ padding: '24px', background: 'rgba(4, 8, 16, 0.94)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', margin: 0 }}>MISSION_FEED_REPLAY</h4>
                  <div className="mono text-muted" style={{ fontSize: '10px', marginTop: '6px' }}>
                    Select a drone feed and replay the archived mission visual context.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {replayDroneIds.map((droneId) => (
                    <button
                      key={droneId}
                      type="button"
                      onClick={() => setSelectedReplayDroneId(droneId)}
                      style={{
                        border: selectedReplayDroneId === droneId ? '1px solid var(--cyan-primary)' : '1px solid rgba(255,255,255,0.14)',
                        background: selectedReplayDroneId === droneId ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.03)',
                        color: selectedReplayDroneId === droneId ? 'var(--cyan-primary)' : '#d8e6f5',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        padding: '8px 12px',
                        cursor: 'pointer'
                      }}
                    >
                      UAV_{droneId}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative', minHeight: '300px', border: '1px solid rgba(92, 222, 255, 0.16)', background: '#02060c' }}>
                {replayVideoSrc ? (
                  <>
                    <video
                      key={`${selectedMission.id}-${selectedReplayDroneId}`}
                      src={replayVideoSrc}
                      controls
                      playsInline
                      style={{ width: '100%', height: '100%', minHeight: '300px', objectFit: 'cover', display: 'block', background: '#000' }}
                    />
                    <div style={{ position: 'absolute', top: '12px', left: '12px', padding: '3px 8px', background: 'rgba(5, 10, 16, 0.88)', border: '1px solid rgba(0,229,255,0.38)', color: 'var(--cyan-primary)', fontFamily: 'var(--font-mono)', fontSize: '10px', pointerEvents: 'none' }}>
                      REPLAY // UAV_{selectedReplayDroneId}
                    </div>
                  </>
                ) : (
                  <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.72)', fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.12em' }}>
                    NO_FEED_REPLAY_AVAILABLE
                  </div>
                )}
              </div>
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
