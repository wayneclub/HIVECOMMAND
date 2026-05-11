import React, { useEffect, useMemo, useState } from 'react';
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
  fontSize: '11px',
  letterSpacing: '0.12em',
  color: 'var(--cyan-primary)'
};

const formatMissionLabel = (label, fallback = 'UNKNOWN TARGET') => String(label || fallback).replace(/_/g, ' ').toUpperCase();
const formatLegDuration = (secondsValue, minutesValue) => {
  const safeSeconds = Number(secondsValue);
  if (Number.isFinite(safeSeconds) && safeSeconds > 0) {
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const seconds = String(Math.floor(safeSeconds % 60)).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  const safeMinutes = Number(minutesValue);
  if (Number.isFinite(safeMinutes) && safeMinutes > 0) {
    return `${String(safeMinutes).padStart(2, '0')}:00`;
  }

  return '00:00';
};
const normalizeObjectiveLabel = (intent) => {
  if (!intent) return 'TRANSIT';
  if (intent === 'MANUAL_PATH') return 'TRANSIT';
  return formatMissionLabel(intent, 'TRANSIT');
};
const shouldReverseLookupTargetName = (label) => {
  if (!label) return true;
  return /UNKNOWN|MULTIPOINT|MANUAL_PATH|FINAL_APPROACH|WAYPOINT/i.test(String(label));
};
const pickReverseLookupName = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const address = payload.address || {};
  return (
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.cycleway ||
    address.neighbourhood ||
    payload.namedetails?.name_en ||
    payload.namedetails?.int_name ||
    address.amenity ||
    address.building ||
    address.attraction ||
    address.university ||
    address.school ||
    address.office ||
    payload.name ||
    payload.display_name?.split(',')[0]?.replace(/[^\x00-\x7F]/g, '').trim() ||
    null
  );
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
    setLastAIParsedCommand,
    addWaypointToSwarm,
    addWaypointToDrone,
    addMissionToHistory,
    updateMissionHistoryStatus,
    clearSwarmWaypoints,
    formatDistance,
    formatSpeed,
    formatVisibility,
    formatTemperature,
    formatWind
  } = useMission();
  const [resolvedTargetName, setResolvedTargetName] = useState('');
  const [missionNameDraft, setMissionNameDraft] = useState(lastAIParsedCommand?.missionName || formatMissionLabel(lastAIParsedCommand?.destName, 'ACTIVE MISSION'));
  const [missionNotesDraft, setMissionNotesDraft] = useState(lastAIParsedCommand?.missionNotes || '');

  if (!lastAIParsedCommand) {
    return (
      <div className="flex-center" style={{ height: '100%', background: '#000', color: 'var(--cyan-primary)' }}>
        <span className="mono">NO_ACTIVE_MISSION_PLAN // RE-START PLANNING</span>
        <button className="btn" onClick={() => setActiveScreen(1)} style={{ marginTop: '20px' }}>BACK TO MAP</button>
      </div>
    );
  }

  const handleDeploy = () => {
    const preparedMission = {
      ...lastAIParsedCommand,
      missionName: missionNameDraft.trim() || formatMissionLabel(lastAIParsedCommand.destName, 'ACTIVE MISSION'),
      missionNotes: missionNotesDraft.trim()
    };
    setLastAIParsedCommand(preparedMission);
    addMissionToHistory(preparedMission);

    if (preparedMission.intent === 'ABORT_MOTION') {
      clearSwarmWaypoints(preparedMission.swarmId);
      updateMissionHistoryStatus('ABORTED');
      setTacticalPhase('IDLE');
      setActiveScreen(1);
      return;
    }

    const waypoints = preparedMission.waypoints || [preparedMission.destination];

    if (preparedMission.targetDroneId) {
      addWaypointToDrone(preparedMission.swarmId, preparedMission.targetDroneId, waypoints);
    } else {
      addWaypointToSwarm(preparedMission.swarmId, waypoints);
    }

    if (preparedMission.intent === 'STRIKE') {
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
  const fallbackCenter = [swarm?.baseLat || drone?.lat || 34.0206925, swarm?.baseLng || drone?.lng || -118.2895045];
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

  const assignedAssetLabel = lastAIParsedCommand.targetDroneId
    ? `UAV_${lastAIParsedCommand.targetDroneId}`
    : `SWARM_${lastAIParsedCommand.swarmId}`;
  const manifestRows = (lastAIParsedCommand.waypoints || [
    {
      ...lastAIParsedCommand.destination,
      label: lastAIParsedCommand.destName || 'FINAL_APPROACH',
      distance: lastAIParsedCommand.distance,
      eta: lastAIParsedCommand.eta
    }
  ]).map((wp, index) => {
    const fallbackSegmentDistanceMeters = Number.isFinite(Number(wp.segmentDistanceMeters))
      ? Number(wp.segmentDistanceMeters)
      : Number.isFinite(Number(wp.distanceMeters))
        ? Number(wp.distanceMeters)
        : Number(wp.distance || 0) * 1000;
    const fallbackCumulativeDistanceMeters = Number.isFinite(Number(wp.distanceMeters))
      ? Number(wp.distanceMeters)
      : Number(wp.distance || 0) * 1000;
    const sourceLabel = wp.sourceLabel || (index === 0 ? assignedAssetLabel : `WAYPOINT ${index}`);
    const targetLabel = wp.label || lastAIParsedCommand.destName || `WAYPOINT_${index + 1}`;

    return {
      ...wp,
      label: targetLabel,
      sourceLabel,
      targetLabel,
      legLabel: `LEG_${String(index + 1).padStart(2, '0')}`,
      segmentDistanceMeters: fallbackSegmentDistanceMeters,
      cumulativeDistanceMeters: fallbackCumulativeDistanceMeters,
      segmentDurationSec: Number.isFinite(Number(wp.segmentDurationSec)) ? Number(wp.segmentDurationSec) : null,
      segmentDurationMin: Number.isFinite(Number(wp.segmentDurationMin)) ? Number(wp.segmentDurationMin) : null,
      cumulativeDurationSec: Number.isFinite(Number(wp.cumulativeDurationSec)) ? Number(wp.cumulativeDurationSec) : null,
      eta: wp.eta || lastAIParsedCommand.eta
    };
  });
  const totalDistanceMeters = Number.isFinite(Number(lastAIParsedCommand.distanceMeters))
    ? Number(lastAIParsedCommand.distanceMeters)
    : Number(lastAIParsedCommand.distance || 0) * 1000;
  const targetWeather = lastAIParsedCommand.missionWeather;
  const targetDisplayName = resolvedTargetName || formatMissionLabel(lastAIParsedCommand.destName, 'FINAL APPROACH');

  useEffect(() => {
    setMissionNameDraft(lastAIParsedCommand?.missionName || formatMissionLabel(lastAIParsedCommand?.destName, 'ACTIVE MISSION'));
    setMissionNotesDraft(lastAIParsedCommand?.missionNotes || '');
  }, [lastAIParsedCommand?.missionName, lastAIParsedCommand?.missionNotes, lastAIParsedCommand?.destName]);

  useEffect(() => {
    const destination = lastAIParsedCommand?.destination;
    if (!destination?.lat || !destination?.lng) {
      setResolvedTargetName('');
      return;
    }

    if (!shouldReverseLookupTargetName(lastAIParsedCommand?.destName)) {
      setResolvedTargetName('');
      return;
    }

    const controller = new AbortController();
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${destination.lat}&lon=${destination.lng}&zoom=18&addressdetails=1`;

    fetch(reverseUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        const nextName = pickReverseLookupName(data);
        setResolvedTargetName(nextName ? formatMissionLabel(nextName) : '');
      })
      .catch(() => {
        setResolvedTargetName('');
      });

    return () => controller.abort();
  }, [lastAIParsedCommand?.destination?.lat, lastAIParsedCommand?.destination?.lng, lastAIParsedCommand?.destName]);

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
                const direction = idx % 3 === 0 ? 'top' : idx % 3 === 1 ? 'right' : 'left';
                const offset =
                  direction === 'top' ? [0, -18] :
                  direction === 'right' ? [22, 0] :
                  [-22, 0];

                return (
                  <Marker key={wp.id || `${wp.label}-${idx}`} position={[wp.lat, wp.lng]} icon={reviewWaypointIcon(idx, assetColor)}>
                    <Tooltip permanent direction={direction} offset={offset} opacity={1} className="review-tooltip">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '158px' }}>
                        <span className="mono" style={{ fontSize: '9px', color: 'var(--cyan-primary)' }}>{wp.legLabel}</span>
                        <span className="mono" style={{ fontSize: '10px', color: '#fff' }}>{formatMissionLabel(wp.sourceLabel)} → {formatMissionLabel(wp.targetLabel)}</span>
                        <span className="mono" style={{ fontSize: '9px', color: 'var(--cyan-primary)' }}>
                          LEG {formatDistance(wp.segmentDistanceMeters)} // {formatLegDuration(wp.segmentDurationSec, wp.segmentDurationMin)}
                        </span>
                        <span className="mono" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>
                          CUM {formatDistance(wp.cumulativeDistanceMeters)} // ETA {wp.eta}
                        </span>
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

      <div style={{ position: 'absolute', top: '28px', left: '36px', zIndex: 500, width: '460px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ ...cardStyle, padding: '24px 28px', borderLeft: '4px solid var(--cyan-primary)' }}>
          <div className="mono" style={sectionTitleStyle}>MISSION PLAN REVIEW</div>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="display text-main" style={{ fontSize: '16px', letterSpacing: '0.08em' }}>OBJECTIVE</div>
            <div className="display" style={{ fontSize: '42px', color: 'var(--cyan-primary)', lineHeight: 1.02 }}>
              {normalizeObjectiveLabel(lastAIParsedCommand.intent)}
            </div>
            <div className="mono text-muted" style={{ fontSize: '11px', lineHeight: 1.7 }}>
              SOURCE // {lastAIParsedCommand.raw === 'MANUAL_TACTICAL_PLAN' ? 'MANUAL_OPERATOR_INPUT' : 'NEURAL_VOICE_CAPTURE'}
            </div>
          </div>
        </div>

        {lastAIParsedCommand.destination && (
          <div style={{ ...cardStyle, padding: '24px 28px' }}>
            <div className="mono" style={sectionTitleStyle}>TARGET SOLUTION</div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="display text-main" style={{ fontSize: '20px', letterSpacing: '0.05em', lineHeight: 1.2 }}>
                {targetDisplayName}
              </div>
              <div className="mono text-muted" style={{ fontSize: '11px', lineHeight: 1.6 }}>
                {resolvedTargetName ? 'TARGET RESOLVED FROM GEOCOORDINATES' : 'PRIMARY TARGET DESIGNATION'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '6px' }}>LATITUDE</div>
                  <div className="mono text-main" style={{ fontSize: '16px' }}>{Number(lastAIParsedCommand.destination.lat).toFixed(6)}</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '6px' }}>LONGITUDE</div>
                  <div className="mono text-main" style={{ fontSize: '16px' }}>{Number(lastAIParsedCommand.destination.lng).toFixed(6)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ ...cardStyle, padding: '24px 28px' }}>
          <div className="mono" style={sectionTitleStyle}>MISSION IDENTITY</div>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '8px' }}>MISSION NAME</div>
              <input
                type="text"
                value={missionNameDraft}
                onChange={(e) => setMissionNameDraft(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: '15px',
                  padding: '12px 14px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none'
                }}
              />
            </div>
            <div>
              <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '8px' }}>MISSION NOTES</div>
              <textarea
                value={missionNotesDraft}
                onChange={(e) => setMissionNotesDraft(e.target.value)}
                rows={4}
                placeholder="Add tactical notes, context, or commander remarks..."
                style={{
                  width: '100%',
                  resize: 'vertical',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: '13px',
                  padding: '12px 14px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  lineHeight: 1.5
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '24px 28px' }}>
          <div className="mono" style={sectionTitleStyle}>WAYPOINT MANIFEST</div>
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1.5fr 0.9fr 0.8fr 0.8fr', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>LEG</span>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>LEG_DIST</span>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>LEG_TIME</span>
            <span className="mono text-muted" style={{ fontSize: '10px', textAlign: 'right' }}>ARRIVAL</span>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {manifestRows.map((wp, i) => (
              <div
                key={wp.id || `${wp.label}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 0.9fr 0.8fr 0.8fr',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '14px 0',
                  borderBottom: i === manifestRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '999px', border: '1px solid var(--cyan-primary)', color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    {i + 1}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="mono text-main" style={{ fontSize: '12px' }}>{wp.legLabel}</span>
                    <span className="mono text-muted" style={{ fontSize: '10px', lineHeight: 1.4 }}>
                      {formatMissionLabel(wp.sourceLabel)} → {formatMissionLabel(wp.targetLabel, `WAYPOINT ${i + 1}`)}
                    </span>
                  </div>
                </div>
                <span className="mono text-main" style={{ fontSize: '11px' }}>{formatDistance(wp.segmentDistanceMeters)}</span>
                <span className="mono text-main" style={{ fontSize: '11px' }}>{formatLegDuration(wp.segmentDurationSec, wp.segmentDurationMin)}</span>
                <span className="mono text-cyan" style={{ fontSize: '11px', textAlign: 'right', fontWeight: 'bold' }}>{wp.eta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', top: '28px', right: '36px', zIndex: 500, width: '380px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ ...cardStyle, padding: '24px 28px' }}>
          <div className="mono" style={sectionTitleStyle}>TACTICAL METRICS</div>
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
              <span className="mono text-muted" style={{ fontSize: '11px' }}>ASSET</span>
              <span className="mono text-main" style={{ fontSize: '13px' }}>{assignedAssetLabel}</span>
              <span className="mono text-muted" style={{ fontSize: '11px' }}>TOTAL_DIST</span>
              <span className="mono text-cyan" style={{ fontSize: '13px' }}>{formatDistance(totalDistanceMeters)}</span>
              <span className="mono text-muted" style={{ fontSize: '11px' }}>AVG_GS</span>
              <span className="mono text-main" style={{ fontSize: '13px' }}>{formatSpeed(lastAIParsedCommand.predictedGS)}</span>
              {manifestRows.length > 1 && (
                <>
                  <span className="mono text-muted" style={{ fontSize: '11px' }}>LEG_COUNT</span>
                  <span className="mono text-main" style={{ fontSize: '13px' }}>{manifestRows.length}</span>
                </>
              )}
            </div>

            <div style={{ paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
              <span className="mono text-muted" style={{ fontSize: '11px' }}>FINAL_ETA</span>
              <span className="display text-cyan" style={{ fontSize: '34px', lineHeight: 1 }}>{lastAIParsedCommand.eta}</span>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '24px 28px', background: 'rgba(16, 26, 40, 0.92)' }}>
          <div className="mono" style={sectionTitleStyle}>TARGET AREA WEATHER</div>
          <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '14px', columnGap: '14px' }}>
            <span className="mono text-muted" style={{ fontSize: '11px' }}>CONDITION</span>
            <span className="mono text-main" style={{ fontSize: '13px' }}>{targetWeather.condition}</span>
            <span className="mono text-muted" style={{ fontSize: '11px' }}>WIND</span>
            <span className="mono text-main" style={{ fontSize: '13px' }}>{formatWind(targetWeather)}</span>
            <span className="mono text-muted" style={{ fontSize: '11px' }}>VISIBILITY</span>
            <span className="mono text-main" style={{ fontSize: '13px' }}>{formatVisibility(targetWeather.visibilityKm ?? Number(String(targetWeather.vis || '0').replace(/[^\d.]/g, '')))}</span>
            <span className="mono text-muted" style={{ fontSize: '11px' }}>TEMP</span>
            <span className="mono text-main" style={{ fontSize: '13px' }}>{formatTemperature(targetWeather.tempC ?? Number(String(targetWeather.temp || '0').replace(/[^\d.]/g, '')))}</span>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '24px 28px', background: 'rgba(12, 20, 34, 0.92)' }}>
          <div className="mono" style={sectionTitleStyle}>TARGET SUMMARY</div>
          <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '14px', columnGap: '14px' }}>
            <span className="mono text-muted" style={{ fontSize: '11px' }}>TARGET_NAME</span>
            <span className="mono text-main" style={{ fontSize: '13px', textAlign: 'right' }}>{targetDisplayName}</span>
            <span className="mono text-muted" style={{ fontSize: '11px' }}>TARGET_LAT</span>
            <span className="mono text-main" style={{ fontSize: '13px' }}>{Number(lastAIParsedCommand.destination?.lat || 0).toFixed(6)}</span>
            <span className="mono text-muted" style={{ fontSize: '11px' }}>TARGET_LNG</span>
            <span className="mono text-main" style={{ fontSize: '13px' }}>{Number(lastAIParsedCommand.destination?.lng || 0).toFixed(6)}</span>
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
