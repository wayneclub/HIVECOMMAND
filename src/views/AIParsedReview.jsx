import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useMission } from '../context/MissionContext';
import L from 'leaflet';

function FitMissionBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    const validPositions = positions.filter(
      (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );

    if (validPositions.length === 0) return;

    if (validPositions.length === 1) {
      map.setView(validPositions[0], 16, { animate: true });
      return;
    }

    map.fitBounds(validPositions, {
      padding: [180, 180],
      maxZoom: 16,
      animate: true
    });
  }, [map, positions]);

  return null;
}

const cardStyle = {
  background: 'rgba(10, 16, 28, 0.9)',
  border: '1px solid rgba(92, 222, 255, 0.18)',
  boxShadow: '0 14px 40px rgba(0, 0, 0, 0.35)',
  backdropFilter: 'blur(14px)'
};

const sectionTitleStyle = {
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: 'var(--cyan-primary)'
};

function reviewWaypointIcon(index, color) {
  return new L.DivIcon({
    className: '',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;
        border:2px solid ${color};background:rgba(8,12,20,0.92);box-shadow:0 0 0 4px rgba(92,222,255,0.08),0 0 18px ${color}55;">
        <span style="font-size:11px;font-weight:700;color:#fff;font-family:monospace;">${index + 1}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function targetIcon() {
  return new L.DivIcon({
    className: '',
    html: `
      <div style="width:34px;height:34px;border-radius:999px;border:2px solid var(--orange-alert);
        box-shadow:0 0 0 6px rgba(255,107,0,0.12),0 0 20px rgba(255,107,0,0.45);background:rgba(255,107,0,0.08);"></div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

export default function AIParsedReview() {
  const {
    setActiveScreen,
    setTacticalPhase,
    telemetry,
    lastAIParsedCommand,
    addWaypointToSwarm,
    addWaypointToDrone,
    addMissionToHistory,
    clearSwarmWaypoints,
    formatDistance,
    formatSpeed,
    formatVisibility,
    formatTemperature,
    formatWind
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
    addMissionToHistory(lastAIParsedCommand);

    if (lastAIParsedCommand.intent === 'ABORT_MOTION') {
      clearSwarmWaypoints(lastAIParsedCommand.swarmId);
      setTacticalPhase('IDLE');
      setActiveScreen(1);
      return;
    }

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
  };

  const isAbort = lastAIParsedCommand.intent === 'ABORT_MOTION';
  const swarm = lastAIParsedCommand.swarmId ? telemetry.swarms.find((s) => s.id === lastAIParsedCommand.swarmId) : null;
  const drone = lastAIParsedCommand.swarmId 
    ? swarm?.drones?.find(d => d.id === lastAIParsedCommand.targetDroneId) 
    : (telemetry.unassignedDrones || []).find(d => d.id === lastAIParsedCommand.targetDroneId);
  const pathWaypoints = lastAIParsedCommand.waypoints || [];

  const assetColor = swarm ? swarm.color : '#ffcc00'; // Amber for unassigned drones
  const fallbackCenter = [swarm?.baseLat || drone?.lat || 34.0224, swarm?.baseLng || drone?.lng || -118.2851];
  const originPosition = swarm ? [swarm.baseLat, swarm.baseLng] : drone ? [drone.lat, drone.lng] : null;

  const mapPositions = useMemo(() => {
    const origin = originPosition ? [originPosition] : [];
    const routePoints = pathWaypoints.map((wp) => [wp.lat, wp.lng]);
    if (routePoints.length > 0) return [...origin, ...routePoints];
    if (!isAbort && lastAIParsedCommand.destination) {
      return [...origin, [lastAIParsedCommand.destination.lat, lastAIParsedCommand.destination.lng]];
    }
    return origin;
  }, [originPosition, pathWaypoints, isAbort, lastAIParsedCommand.destination]);

  const manifestRows = (lastAIParsedCommand.waypoints || [
    {
      ...lastAIParsedCommand.destination,
      label: 'FINAL_APPROACH',
      distance: lastAIParsedCommand.distance,
      eta: lastAIParsedCommand.eta
    }
  ]).map((wp, index) => ({
    ...wp,
    label: wp.label || `WAYPOINT_${index + 1}`,
    distance: wp.distance || lastAIParsedCommand.distance,
    eta: wp.eta || lastAIParsedCommand.eta
  }));

  const assignedAssetLabel = lastAIParsedCommand.targetDroneId
    ? `UAV_${lastAIParsedCommand.targetDroneId}`
    : `SWARM_${lastAIParsedCommand.swarmId}`;
  const totalDistanceMeters = Number.isFinite(Number(lastAIParsedCommand.distanceMeters))
    ? Number(lastAIParsedCommand.distanceMeters)
    : Number(lastAIParsedCommand.distance || 0) * 1000;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapContainer center={fallbackCenter} zoom={15} zoomControl={false} style={{ width: '100%', height: '100%', zIndex: 1 }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
          <FitMissionBounds positions={mapPositions} />

          {(swarm || drone) && (
            <>
              {mapPositions.length > 1 && (
                <>
                  <Polyline
                    positions={mapPositions}
                    pathOptions={{ color: assetColor, weight: 10, opacity: 0.16, lineCap: 'round', lineJoin: 'round' }}
                  />
                  <Polyline
                    positions={mapPositions}
                    pathOptions={{ color: assetColor, weight: 3, dashArray: '10 12', opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
                  />
                </>
              )}

              {originPosition && (
                <Marker
                  position={originPosition}
                  icon={new L.DivIcon({
                    className: '',
                    html: `
                      <div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;
                        background:${assetColor};box-shadow:0 0 0 4px ${assetColor}22,0 0 14px ${assetColor};"></div>
                    `,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                  })}
                >
                  <Tooltip permanent direction="top" offset={[0, -18]} opacity={1} className="review-tooltip">
                    <span className="mono" style={{ fontSize: '10px' }}>ORIGIN // {assignedAssetLabel}</span>
                  </Tooltip>
                </Marker>
              )}

              {manifestRows.map((wp, idx) => {
                const direction = idx % 2 === 0 ? 'top' : 'right';
                const offset = direction === 'top' ? [0, -18] : [22, 0];

                return (
                  <Marker key={wp.id || `${wp.label}-${idx}`} position={[wp.lat, wp.lng]} icon={reviewWaypointIcon(idx, assetColor)}>
                    <Tooltip permanent direction={direction} offset={offset} opacity={1} className="review-tooltip">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                        <span className="mono" style={{ fontSize: '10px', color: '#fff' }}>{wp.label}</span>
                        <span className="mono" style={{ fontSize: '9px', color: 'var(--cyan-primary)' }}>{formatDistance(Number.isFinite(Number(wp.distanceMeters)) ? Number(wp.distanceMeters) : Number(wp.distance || 0) * 1000)}</span>
                        <span className="mono" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>ETA {wp.eta}</span>
                      </div>
                    </Tooltip>
                  </Marker>
                );
              })}

              {!lastAIParsedCommand.waypoints && lastAIParsedCommand.destination && (
                <Marker position={[lastAIParsedCommand.destination.lat, lastAIParsedCommand.destination.lng]} icon={targetIcon()} />
              )}
            </>
          )}
        </MapContainer>

        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8, 12, 20, 0.56)', zIndex: 400, pointerEvents: 'none' }} />
      </div>

      <div style={{ position: 'absolute', top: '28px', left: '28px', zIndex: 500, width: '410px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, padding: '22px 24px', borderLeft: '4px solid var(--cyan-primary)' }}>
          <div className="mono" style={sectionTitleStyle}>MISSION PLAN REVIEW</div>
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="display text-main" style={{ fontSize: '15px', letterSpacing: '0.08em' }}>OBJECTIVE</div>
            <div className="display" style={{ fontSize: '30px', color: 'var(--cyan-primary)', lineHeight: 1.05 }}>
              {lastAIParsedCommand.intent}
            </div>
            <div className="mono text-muted" style={{ fontSize: '10px', lineHeight: 1.6 }}>
              SOURCE // {lastAIParsedCommand.raw === 'MANUAL_TACTICAL_PLAN' ? 'MANUAL_OPERATOR_INPUT' : 'NEURAL_VOICE_CAPTURE'}
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '20px 24px' }}>
          <div className="mono" style={sectionTitleStyle}>WAYPOINT MANIFEST</div>
          <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="mono text-muted" style={{ fontSize: '9px' }}>PNT</span>
            <span className="mono text-muted" style={{ fontSize: '9px' }}>DISTANCE</span>
            <span className="mono text-muted" style={{ fontSize: '9px', textAlign: 'right' }}>EST_ETA</span>
          </div>
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {manifestRows.map((wp, i) => (
              <div
                key={wp.id || `${wp.label}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr 1fr',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: i === manifestRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '999px', border: '1px solid var(--cyan-primary)', color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                    {i + 1}
                  </div>
                  <span className="mono text-main" style={{ fontSize: '10px' }}>{wp.label}</span>
                </div>
                <span className="mono text-main" style={{ fontSize: '10px' }}>{formatDistance(Number.isFinite(Number(wp.distanceMeters)) ? Number(wp.distanceMeters) : Number(wp.distance || 0) * 1000)}</span>
                <span className="mono text-cyan" style={{ fontSize: '10px', textAlign: 'right', fontWeight: 'bold' }}>{wp.eta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', top: '28px', right: '28px', zIndex: 500, width: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, padding: '22px 24px' }}>
          <div className="mono" style={sectionTitleStyle}>TACTICAL METRICS</div>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
              <span className="mono text-muted" style={{ fontSize: '10px' }}>ASSET</span>
              <span className="mono text-main" style={{ fontSize: '11px' }}>{assignedAssetLabel}</span>
              <span className="mono text-muted" style={{ fontSize: '10px' }}>TOTAL_DIST</span>
              <span className="mono text-cyan" style={{ fontSize: '11px' }}>{formatDistance(totalDistanceMeters)}</span>
              <span className="mono text-muted" style={{ fontSize: '10px' }}>AVG_GS</span>
              <span className="mono text-main" style={{ fontSize: '11px' }}>{formatSpeed(lastAIParsedCommand.predictedGS)}</span>
            </div>

            <div style={{ paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
              <span className="mono text-muted" style={{ fontSize: '10px' }}>FINAL_ETA</span>
              <span className="display text-cyan" style={{ fontSize: '28px', lineHeight: 1 }}>{lastAIParsedCommand.eta}</span>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '22px 24px', background: 'rgba(16, 26, 40, 0.92)' }}>
          <div className="mono" style={sectionTitleStyle}>ENVIRONMENTAL DATA</div>
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '12px', columnGap: '12px' }}>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>CONDITION</span>
            <span className="mono text-main" style={{ fontSize: '10px' }}>{lastAIParsedCommand.missionWeather.condition}</span>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>WIND</span>
            <span className="mono text-main" style={{ fontSize: '10px' }}>{formatWind(lastAIParsedCommand.missionWeather)}</span>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>VISIBILITY</span>
            <span className="mono text-main" style={{ fontSize: '10px' }}>{formatVisibility(lastAIParsedCommand.missionWeather.visibilityKm ?? Number(String(lastAIParsedCommand.missionWeather.vis || '0').replace(/[^\d.]/g, '')))}</span>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>TEMP</span>
            <span className="mono text-main" style={{ fontSize: '10px' }}>{formatTemperature(lastAIParsedCommand.missionWeather.tempC ?? Number(String(lastAIParsedCommand.missionWeather.temp || '0').replace(/[^\d.]/g, '')))}</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '36px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: '18px' }}>
        <button className="btn" onClick={() => setActiveScreen(1)} style={{ padding: '14px 28px', fontSize: '12px', minWidth: '220px' }}>
          ABORT_PLANNING
        </button>
        <button
          className="btn btn-primary"
          onClick={handleDeploy}
          style={{
            padding: '16px 44px',
            minWidth: '420px',
            background: 'var(--cyan-primary)',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 0 30px rgba(0, 229, 255, 0.5)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          AUTHORIZE TACTICAL DEPLOYMENT →
        </button>
      </div>

      <style>{`
        .review-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .review-tooltip::before {
          display: none !important;
        }
        .review-tooltip .leaflet-tooltip-content {
          margin: 0 !important;
          padding: 10px 12px !important;
          border-radius: 10px !important;
          background: rgba(8, 12, 20, 0.92) !important;
          border: 1px solid rgba(92, 222, 255, 0.18) !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28) !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
