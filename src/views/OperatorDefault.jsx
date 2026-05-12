import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, CircleMarker, Polygon, Popup, useMapEvents, useMap, Tooltip, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import { useMission } from '../context/MissionContext';
import VoiceControlFAB from '../components/VoiceControlFAB';
import DeckGLMap from '../components/DeckGLMap';

const WeatherHUD = () => null; // Deprecated, moved to Top Bar

const TacticalHUDOverlay = () => null; // Deprecated, moved to Top Bar

const VISION_MODES = {
  EO: { label: 'EO', title: 'NORMAL', filter: 'none' },
  IR: { label: 'IR', title: 'INFRARED', filter: 'grayscale(1) invert(1) contrast(1.45)' },
  BW: { label: 'BW', title: 'BLACKWHITE', filter: 'grayscale(1) contrast(1.2)' },
  NV: { label: 'NV', title: 'NIGHT_VISION', filter: 'sepia(1) hue-rotate(65deg) saturate(2.2) brightness(1.05) contrast(1.15)' }
};
const AI_DETECTION_COLORS = {
  HUMAN: '#00e5ff',
  STRUCTURE: '#ff6b00',
  VEHICLE: '#ffe066'
};
const STRUCTURE_DETECTION_THRESHOLD = 0.88;
const HUMAN_DETECTION_THRESHOLD = 0.84;
const VEHICLE_DETECTION_THRESHOLD = 0.9;
const AI_DETECTION_PROFILES = {
  '01': {
    structure: { x: 0.37, y: 0.22, w: 0.24, h: 0.24, dx: 0.008, dy: 0.006, speed: 0.045, confidence: 0.93, flicker: 0.035, cadence: 0.48, window: 0.68 },
    vehicles: [
      { x: 0.68, y: 0.77, w: 0.09, h: 0.065, dx: 0.003, dy: 0.002, speed: 0.03, phase: 0.25, confidence: 0.93, flicker: 0.075, cadence: 0.82, window: 0.44 }
    ],
    humans: [
      { x: 0.24, y: 0.71, w: 0.048, h: 0.16, dx: 0.006, dy: 0.005, speed: 0.05, phase: 0.6, confidence: 0.85, flicker: 0.1, cadence: 1.05, window: 0.32 }
    ]
  },
  '02': {
    structure: { x: 0.45, y: 0.24, w: 0.22, h: 0.22, dx: 0.006, dy: 0.005, speed: 0.04, confidence: 0.92, flicker: 0.03, cadence: 0.45, window: 0.7 },
    vehicles: [
      { x: 0.16, y: 0.79, w: 0.085, h: 0.06, dx: 0.002, dy: 0.002, speed: 0.028, phase: 0.8, confidence: 0.91, flicker: 0.07, cadence: 0.78, window: 0.42 }
    ],
    humans: [
      { x: 0.53, y: 0.72, w: 0.046, h: 0.16, dx: 0.005, dy: 0.005, speed: 0.048, phase: 1.4, confidence: 0.83, flicker: 0.11, cadence: 0.96, window: 0.28 }
    ]
  },
  '03': {
    structure: { x: 0.42, y: 0.23, w: 0.25, h: 0.23, dx: 0.007, dy: 0.005, speed: 0.05, confidence: 0.93, flicker: 0.04, cadence: 0.52, window: 0.66 },
    vehicles: [
      { x: 0.74, y: 0.76, w: 0.086, h: 0.06, dx: 0.003, dy: 0.002, speed: 0.032, phase: 1.2, confidence: 0.9, flicker: 0.075, cadence: 0.88, window: 0.38 }
    ],
    humans: [
      { x: 0.31, y: 0.7, w: 0.045, h: 0.155, dx: 0.004, dy: 0.004, speed: 0.045, phase: 0.9, confidence: 0.81, flicker: 0.12, cadence: 1.08, window: 0.24 }
    ]
  },
  '04': {
    structure: { x: 0.48, y: 0.21, w: 0.21, h: 0.24, dx: 0.006, dy: 0.004, speed: 0.038, confidence: 0.91, flicker: 0.035, cadence: 0.41, window: 0.72 },
    vehicles: [],
    humans: [
      { x: 0.62, y: 0.72, w: 0.044, h: 0.155, dx: 0.004, dy: 0.004, speed: 0.042, phase: 1.8, confidence: 0.8, flicker: 0.12, cadence: 1.02, window: 0.22 }
    ]
  },
  '05': {
    structure: { x: 0.4, y: 0.2, w: 0.26, h: 0.25, dx: 0.006, dy: 0.005, speed: 0.035, confidence: 0.94, flicker: 0.028, cadence: 0.36, window: 0.75 },
    vehicles: [
      { x: 0.72, y: 0.8, w: 0.09, h: 0.065, dx: 0.002, dy: 0.002, speed: 0.025, phase: 0.55, confidence: 0.92, flicker: 0.07, cadence: 0.74, window: 0.4 }
    ],
    humans: []
  },
  default: {
    structure: { x: 0.43, y: 0.22, w: 0.23, h: 0.23, dx: 0.006, dy: 0.005, speed: 0.04, confidence: 0.91, flicker: 0.035, cadence: 0.44, window: 0.7 },
    vehicles: [],
    humans: [
      { x: 0.28, y: 0.71, w: 0.045, h: 0.155, dx: 0.004, dy: 0.004, speed: 0.045, phase: 1.1, confidence: 0.8, flicker: 0.11, cadence: 1.0, window: 0.24 }
    ]
  }
};

const isExecutionPhaseActive = (phase) => phase === 'TRANSIT' || phase === 'STRIKE_MONITORING';
const getSwarmZoneCenter = (swarm) => {
  if (!swarm?.drones?.length) {
    return { lat: swarm.baseLat, lng: swarm.baseLng };
  }

  return {
    lat: swarm.drones.reduce((sum, drone) => sum + drone.lat, 0) / swarm.drones.length,
    lng: swarm.drones.reduce((sum, drone) => sum + drone.lng, 0) / swarm.drones.length
  };
};

const getBearingDegrees = (fromLat, fromLng, toLat, toLng) => {
  const startLat = (fromLat * Math.PI) / 180;
  const startLng = (fromLng * Math.PI) / 180;
  const endLat = (toLat * Math.PI) / 180;
  const endLng = (toLng * Math.PI) / 180;
  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const getDroneHeadingLabel = (drone, ownerSwarm) => {
  const speed = Number(drone?.speed ?? ownerSwarm?.speed ?? 0);
  const nextWaypoint = drone?.waypoints?.[0] || ownerSwarm?.waypoints?.[0] || null;

  if (nextWaypoint && speed > 0.5) {
    return `${Math.round(getBearingDegrees(drone.lat, drone.lng, nextWaypoint.lat, nextWaypoint.lng))}°`;
  }

  if (ownerSwarm?.status === 'TRANSIT' && nextWaypoint) {
    return `${Math.round(getBearingDegrees(drone.lat, drone.lng, nextWaypoint.lat, nextWaypoint.lng))}°`;
  }

  return '---';
};

const resolveFocusedDroneData = (telemetry, focusDrone) => {
  if (!focusDrone?.droneId) {
    return {
      normalizedFocusDrone: null,
      activeSwarm: telemetry.swarms?.[0] || null,
      activeDrone: null
    };
  }

  const activeSwarm = focusDrone.swarmId != null && focusDrone.swarmId !== ''
    ? telemetry.swarms?.find((s) => s.id === focusDrone.swarmId)
    : telemetry.swarms?.find((s) => s.drones?.some((d) => d.id === focusDrone.droneId));

  const activeDrone = activeSwarm?.drones?.find((d) => d.id === focusDrone.droneId)
    || telemetry.unassignedDrones?.find((d) => d.id === focusDrone.droneId)
    || null;

  return {
    normalizedFocusDrone: activeDrone ? { ...focusDrone, swarmId: activeSwarm?.id ?? null } : focusDrone,
    activeSwarm: activeSwarm || null,
    activeDrone
  };
};
const getSimulatedDetections = (droneId, playbackTime = 0, frameWidth = 420, frameHeight = 248) => {
  const t = Number(playbackTime || 0);
  const profile = AI_DETECTION_PROFILES[String(droneId)] || AI_DETECTION_PROFILES.default;
  const clampBox = (x, y, width, height, paddingX = 14, paddingY = 18) => ({
    x: Math.max(paddingX, Math.min(frameWidth - width - paddingX, x)),
    y: Math.max(paddingY, Math.min(frameHeight - height - paddingY, y)),
    width,
    height
  });
  const buildBox = (anchor, box, tick, phase = 0) => {
    const width = Math.max(24, frameWidth * box.w);
    const height = Math.max(44, frameHeight * box.h);
    const x = frameWidth * anchor.x + Math.sin(tick * box.speed + phase) * (frameWidth * (box.dx || 0));
    const y = frameHeight * anchor.y + Math.cos(tick * box.speed * 0.85 + phase) * (frameHeight * (box.dy || 0));
    return clampBox(x, y, width, height);
  };
  const getLiveConfidence = (box, tick, phase = 0) => {
    const base = box.confidence ?? 0.9;
    const cadence = box.cadence ?? 0.5;
    const flicker = box.flicker ?? 0.06;
    const window = box.window ?? 0.65;
    const visibilityWave = (Math.sin(tick * cadence + phase) + 1) / 2;
    if (visibilityWave < (1 - window)) {
      return 0;
    }
    const variance = Math.cos(tick * (cadence * 1.7) + phase * 1.9) * flicker;
    return Math.max(0, Math.min(0.99, base + variance));
  };

  const detections = [];
  const structureConfidence = getLiveConfidence(profile.structure, t);
  if (structureConfidence >= STRUCTURE_DETECTION_THRESHOLD) {
    const structureBox = buildBox(
      { x: profile.structure.x, y: profile.structure.y },
      profile.structure,
      t
    );
    detections.push({
      id: `structure-${droneId}`,
      type: 'STRUCTURE',
      confidence: structureConfidence,
      ...structureBox
    });
  }

  profile.humans.forEach((human, index) => {
    const liveConfidence = getLiveConfidence(human, t, human.phase || 0);
    if (liveConfidence < HUMAN_DETECTION_THRESHOLD) {
      return;
    }
    const box = buildBox({ x: human.x, y: human.y }, human, t, human.phase || 0);
    detections.push({
      id: `human-${droneId}-${index}`,
      type: 'HUMAN',
      confidence: liveConfidence,
      ...box
    });
  });

  (profile.vehicles || []).forEach((vehicle, index) => {
    const liveConfidence = getLiveConfidence(vehicle, t, vehicle.phase || 0);
    if (liveConfidence < VEHICLE_DETECTION_THRESHOLD) {
      return;
    }
    const box = buildBox({ x: vehicle.x, y: vehicle.y }, vehicle, t, vehicle.phase || 0);
    detections.push({
      id: `vehicle-${droneId}-${index}`,
      type: 'VEHICLE',
      confidence: liveConfidence,
      ...box
    });
  });

  return detections;
};

function VideoAiHudOverlay({ detections }) {
  if (!detections?.length) return null;

  const humanCount = detections.filter((item) => item.type === 'HUMAN').length;
  const structureCount = detections.filter((item) => item.type === 'STRUCTURE').length;
  const vehicleCount = detections.filter((item) => item.type === 'VEHICLE').length;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 7 }}>
      {detections.map((detection) => (
        <div
          key={detection.id}
          style={{
            position: 'absolute',
            left: detection.x,
            top: detection.y,
            width: detection.width,
            height: detection.height,
            border: `2px solid ${AI_DETECTION_COLORS[detection.type]}`,
            boxShadow: `0 0 0 1px rgba(0,0,0,0.35), 0 0 14px ${AI_DETECTION_COLORS[detection.type]}55`,
            background: `linear-gradient(180deg, ${AI_DETECTION_COLORS[detection.type]}10, transparent 30%)`
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-18px',
              left: '-2px',
              padding: '2px 6px',
              background: 'rgba(5, 10, 16, 0.9)',
              border: `1px solid ${AI_DETECTION_COLORS[detection.type]}`,
              color: AI_DETECTION_COLORS[detection.type],
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap'
            }}
          >
            TRACKED {detection.type} {Math.round(detection.confidence * 100)}%
          </div>
          <div style={{ position: 'absolute', inset: '-2px', border: `1px dashed ${AI_DETECTION_COLORS[detection.type]}77` }} />
        </div>
      ))}

      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          padding: '3px 7px',
          background: 'rgba(5, 10, 16, 0.9)',
          border: '1px solid rgba(0,229,255,0.45)',
          color: 'var(--cyan-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.08em'
        }}>
          AI_HUD ASSIST
        </div>
        <div style={{
          padding: '3px 7px',
          background: 'rgba(5, 10, 16, 0.9)',
          border: '1px solid rgba(255,255,255,0.16)',
          color: '#d7ebf8',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px'
        }}>
          HUMAN {humanCount}
        </div>
        <div style={{
          padding: '3px 7px',
          background: 'rgba(5, 10, 16, 0.9)',
          border: '1px solid rgba(255,255,255,0.16)',
          color: '#d7ebf8',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px'
        }}>
          STRUCTURE {structureCount}
        </div>
        <div style={{
          padding: '3px 7px',
          background: 'rgba(5, 10, 16, 0.9)',
          border: '1px solid rgba(255,255,255,0.16)',
          color: '#d7ebf8',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px'
        }}>
          VEHICLE {vehicleCount}
        </div>
      </div>
    </div>
  );
}

function FocusedDroneHud({ details, displayUnit, formatAltitude, formatSpeed, formatWind, windSource }) {
  const accent = details?.color || displayUnit?.color || 'var(--cyan-primary)';
  const primaryItems = [
    { label: 'SPD', value: formatSpeed(displayUnit?.speed || 0) },
    { label: 'ALT', value: formatAltitude(displayUnit?.alt || 0) },
    { label: 'HDG', value: `${displayUnit?.heading || 300}°` },
    { label: 'WIND', value: formatWind(windSource) }
  ];
  const detailItems = details ? [
    { label: 'PWR', value: `${Math.round(details.power ?? 0)}%` },
    { label: 'SWARM', value: details.swarmLabel },
    { label: 'CMD', value: formatAltitude(details.targetAlt) },
    { label: 'STATUS', value: details.status }
  ] : [];
  const secondaryText = details
    ? `${Number(details.lat || 0).toFixed(4)}, ${Number(details.lng || 0).toFixed(4)}`
    : null;
  const allItems = [...primaryItems, ...detailItems].filter((item) => item.value !== undefined && item.value !== null && item.value !== '');

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(160px, 190px) auto',
      alignItems: 'center',
      border: '1px solid rgba(0, 229, 255, 0.38)',
      background: 'rgba(4, 8, 16, 0.9)',
      borderRadius: '10px',
      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35), inset 0 0 14px rgba(0, 229, 255, 0.06)',
      backdropFilter: 'blur(8px)',
      overflow: 'hidden',
      width: 'fit-content',
      maxWidth: 'min(560px, calc(100vw - 560px))'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '6px',
        padding: '10px 14px',
        borderRight: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '999px', background: accent, boxShadow: `0 0 10px ${accent}` }} />
          <div className="mono" style={{ fontSize: '9px', letterSpacing: '0.16em', color: 'var(--cyan-primary)' }}>FOCUSED UAV</div>
        </div>
        <div className="display" style={{ fontSize: '18px', lineHeight: 1, color: '#fff', letterSpacing: '0.05em' }}>
          {details?.idLabel || (displayUnit?.id ? `UAV_${displayUnit.id}` : (displayUnit?.name || 'NO_SELECTION'))}
        </div>
        {details && (
          <div className="mono" style={{ fontSize: '10px', color: accent, letterSpacing: '0.06em' }}>
            {details.swarmLabel} / {details.status}
          </div>
        )}
        {secondaryText && (
          <div className="mono text-muted" style={{ fontSize: '9px' }}>
            {secondaryText}
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(58px, auto))',
        gap: '0',
        padding: '4px 6px'
      }}>
        {allItems.map((item, index) => (
          <div
            key={item.label}
            style={{
              padding: '7px 8px',
              borderLeft: index % 4 === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              borderTop: index >= 4 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              minHeight: '40px'
            }}
          >
            <div className="mono text-muted" style={{ fontSize: '8px', marginBottom: '4px', letterSpacing: '0.1em' }}>{item.label}</div>
            <div className="mono" style={{ fontSize: item.label === 'SWARM' || item.label === 'STATUS' ? '10px' : '12px', color: item.label === 'SWARM' ? accent : '#fff', lineHeight: 1.05, wordBreak: 'break-word' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const swarmLabelIcon = (id, color, name) => {
  const text = name || 'SWARM_' + id;
  return new L.DivIcon({
    className: '',
    html: `<div style="
      background: #080c14;
      border: 1px solid ${color};
      color: ${color};
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
      white-space: nowrap;
      padding: 2px 10px;
      transform: translate(-50%, -150%);
      pointer-events: none;
    ">${text}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Memoized Mission Draft Component 
const MissionDraftLayers = React.memo(({ waypoints, onUpdateWaypoint }) => {
  if (!waypoints || waypoints.length === 0) return null;
  
  return (
    <>
      <Polyline 
        positions={waypoints.map(w => [w.lat, w.lng])}
        pathOptions={{ color: 'var(--orange-primary)', weight: 2, dashArray: '8 12', opacity: 0.8 }}
      />
      {waypoints.map((wp, idx) => (
        <Marker
          key={wp.id}
          position={[wp.lat, wp.lng]}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              onUpdateWaypoint(wp.id, { lat: position.lat, lng: position.lng });
            },
            dragstart: (e) => {
              const map = e.target._map;
              if (map) map.dragging.disable();
            }
          }}
          icon={new L.DivIcon({
            className: 'custom-icon',
            html: `
              <div style="display: flex; flex-direction: column; align-items: center;">
                <div style="width: 20px; height: 20px; border: 2px solid var(--orange-primary); background: rgba(255, 107, 0, 0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px var(--orange-primary);">
                   <span style="font-size: 9px; color: #fff; font-weight: bold;">${idx + 1}</span>
                </div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent className="target-tooltip">
            {`WP_${idx+1}: ${Number(wp.lat || 0).toFixed(4)}, ${Number(wp.lng || 0).toFixed(4)}`}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}, (prev, next) => {
  return JSON.stringify(prev.waypoints) === JSON.stringify(next.waypoints);
});

function DroneMarker({ drone, swarmColor, isFocused, onFocus, forcePopupTime, registerSelectionInteraction }) {
  const map = useMap();
  const [zoom, setZoom] = React.useState(map.getZoom());

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => { map.off('zoomend', handleZoom); };
  }, [map]);

  // Use a slightly larger hit area in 2D so UAV selection is easy.
  const baseRadius = Math.max(8, (zoom - 11) * 1.35);
  const finalRadius = isFocused ? baseRadius + 3 : baseRadius;

  return (
    <CircleMarker
      center={[drone.lat, drone.lng]}
      radius={finalRadius}
      pathOptions={{
        color: '#ffffff',
        weight: isFocused ? 2 : 1.5,
        fillColor: swarmColor,
        fillOpacity: 0.92
      }}
      bubblingMouseEvents={false}
      eventHandlers={{
        mousedown: (e) => {
          if (e && e.originalEvent) {
            L.DomEvent.stop(e.originalEvent);
          }
          if (registerSelectionInteraction) registerSelectionInteraction();
        },
        click: (e) => {
          if (e && e.originalEvent) {
            L.DomEvent.stop(e.originalEvent);
          }
          if (registerSelectionInteraction) registerSelectionInteraction();
          if (onFocus) onFocus();
        },
        dblclick: (e) => {
           if (e?.originalEvent) {
             L.DomEvent.stop(e.originalEvent);
           }
           if (registerSelectionInteraction) registerSelectionInteraction();
           if (onFocus) onFocus();
        }
      }}
    >
      {/* Persistent HUD Label for focused drone using a high-visibility Marker */}
      {isFocused && (
        <Marker
          position={[drone.lat, drone.lng]}
          interactive={false}
          zIndexOffset={2000}
          icon={new L.DivIcon({
            className: '',
            html: `
              <div style="position:relative;width:0;height:0;">
                <div style="
                  position:absolute;
                  bottom:15px;
                  left:50%;
                  transform:translateX(-50%);
                  color:#fff;
                  font-family:'Share Tech Mono', monospace;
                  font-size:12px;
                  font-weight:bold;
                  white-space:nowrap;
                  text-shadow: 2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;
                  pointer-events:none;
                ">UAV_${drone.id}</div>
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          })}
        />
      )}
    </CircleMarker>
  );
}

function MapEventsListener({ setAutoTrack, isTargeting, onMapClick, setFocusDrone, selectionInteractionRef }) {
  useMapEvents({
    dragstart: () => setAutoTrack(false),
    click: (e) => {
      if (isTargeting) {
        onMapClick(e.latlng);
      } else if (setFocusDrone) {
        if (Date.now() - (selectionInteractionRef?.current || 0) > 250) {
          setFocusDrone(null);
        }
      }
    }
  });
  return null;
}

function MapZoomSync({ onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    if (!onZoomChange) return undefined;
    const handleZoom = () => onZoomChange(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => map.off('zoomend', handleZoom);
  }, [map, onZoomChange]);

  return null;
}

function MapTracker({ isTargeting, autoTrack, normalizedFocusDrone }) {
  const map = useMap();
  const { telemetry, targetLock, lastAIParsedCommand } = useMission();
  const isFlyingRef = React.useRef(false);
  const targetIdRef = React.useRef(null);
  const releaseFlightRef = React.useRef(null);
  const lastTrackedPositionRef = React.useRef(null);
  const lastFollowAtRef = React.useRef(0);
  
  useEffect(() => {
    const onMoveStart = () => { isFlyingRef.current = true; };
    const onMoveEnd = () => { isFlyingRef.current = false; };
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
      if (releaseFlightRef.current) {
        window.clearTimeout(releaseFlightRef.current);
      }
    };
  }, [map]);
  
  useEffect(() => {
    if (isTargeting || !autoTrack) return;
    
    let target = null;
    let targetIdentifier = null;
    let targetLat = null;
    let targetLng = null;
    if (normalizedFocusDrone) {
      targetIdentifier = `drone-${normalizedFocusDrone.droneId}`;
      if (normalizedFocusDrone.swarmId) {
        const swarm = telemetry.swarms.find(s => s.id === normalizedFocusDrone.swarmId);
        target = swarm?.drones.find(d => d.id === normalizedFocusDrone.droneId);
      } else {
        target = telemetry.unassignedDrones?.find(d => d.id === normalizedFocusDrone.droneId);
      }
    } else if (lastAIParsedCommand) {
      targetIdentifier = `swarm-${lastAIParsedCommand.swarmId}`;
      target = telemetry.swarms.find(s => s.id === lastAIParsedCommand.swarmId);
    } else if (targetLock && targetLock.assignedSwarm) {
      targetIdentifier = `swarm-${targetLock.assignedSwarm}`;
      target = telemetry.swarms.find(s => s.id === targetLock.assignedSwarm);
    }

    if (target) {
      if (target.drones?.length) {
        const center = getSwarmZoneCenter(target);
        targetLat = center.lat;
        targetLng = center.lng;
      } else {
        targetLat = target.lat ?? target.baseLat;
        targetLng = target.lng ?? target.baseLng;
      }
      const lat = targetLat;
      const lng = targetLng;
      const nextPositionKey = `${lat.toFixed(6)}:${lng.toFixed(6)}`;
      
      // If we selected a NEW target, keep the same zoom and smoothly pan without bounce.
      if (targetIdRef.current !== targetIdentifier) {
        targetIdRef.current = targetIdentifier;
        lastTrackedPositionRef.current = nextPositionKey;
        isFlyingRef.current = true; // Synchronously block panTo
        if (releaseFlightRef.current) {
          window.clearTimeout(releaseFlightRef.current);
        }
        map.panTo([lat, lng], { animate: true, duration: 0.85, easeLinearity: 0.2 });
        releaseFlightRef.current = window.setTimeout(() => {
          isFlyingRef.current = false;
        }, 900);
        return;
      }
      
      // If we are tracking the SAME target, do not interrupt the flyTo animation!
      // Only follow when the target has actually moved enough and avoid stacking animations.
      if (!isFlyingRef.current) {
        if (lastTrackedPositionRef.current === nextPositionKey) {
          return;
        }

        const now = Date.now();
        if (now - lastFollowAtRef.current < 260) {
          return;
        }

        const center = map.getCenter();
        const distanceToTarget = map.distance(center, L.latLng(lat, lng));
        if (distanceToTarget < 6) {
          lastTrackedPositionRef.current = nextPositionKey;
          return;
        }

        lastTrackedPositionRef.current = nextPositionKey;
        lastFollowAtRef.current = now;
        map.panTo([lat, lng], { animate: true, duration: 0.3, easeLinearity: 0.25 });
      }
    } else {
      targetIdRef.current = null;
      lastTrackedPositionRef.current = null;
    }
  }, [map, telemetry, normalizedFocusDrone, targetLock, lastAIParsedCommand, isTargeting, autoTrack]);

  return null;
}



export default function OperatorDefault() {
  const DEFAULT_MAP_ZOOM = 16.3;
  const { 
    setActiveScreen, 
    telemetry, 
    expandedSwarms, 
    toggleSwarmExpand, 
    targetLock, 
    setTargetLock, 
    focusDrone, 
    setFocusDrone, 
    addSwarm, 
    removeSwarm, 
    addWaypointToSwarm, 
    activeVideoFeeds, 
    toggleVideoFeed, 
    enlargedFeed, 
    setEnlargedFeed, 
    lastAIParsedCommand,
    addMissionToHistory,
    updateDraftWaypoint,
    tacticalLogs,
    prepareManualReview,
    updateSwarmName,
    moveDroneToSwarm,
    controlMissionFlight,
    abortCountdown,
    updateDroneAlt,
    updateSwarmAlt,
    tacticalPhase,
    unitSystem,
    formatAltitude,
    formatSpeed,
    formatWind,
    altitudeToDisplayValue,
    altitudeInputToMeters,
    globalMapCenter
  } = useMission();

  const [transferDroneId, setTransferDroneId] = useState(null);
  const [isTargeting, setIsTargeting] = useState(false);
  const [autoTrack, setAutoTrack] = useState(true);
  const [mapType, setMapType] = useState('satellite');
  const [mapZoomLevel, setMapZoomLevel] = useState(DEFAULT_MAP_ZOOM);
  const [editingSwarmId, setEditingSwarmId] = useState(null);
  const [altitudeDrafts, setAltitudeDrafts] = useState({});
  const [maximizedFeed, setMaximizedFeed] = useState(null);
  const [floatingFeedWidgets, setFloatingFeedWidgets] = useState([]);
  const [feedHudTick, setFeedHudTick] = useState(0);
  const assetBase = import.meta.env.BASE_URL;
  const droneVideoMap = {
    '01': `${assetBase}videos/drone-1.mp4`,
    '02': `${assetBase}videos/drone-2.mp4`,
    '03': `${assetBase}videos/drone-3.mp4`,
    '04': `${assetBase}videos/drone-4.mp4`,
    '05': `${assetBase}videos/drone-5.mp4`
  };
  const mapCenter = useMemo(() => globalMapCenter, [globalMapCenter]);
  const droneCardRefs = React.useRef({});
  const selectionInteractionRef = React.useRef(0);
  const inlineVideoRefs = React.useRef({});
  const widgetVideoRefs = React.useRef({});
  const widgetInteractionRef = React.useRef(null);
  const widgetZCounterRef = React.useRef(1);
  const feedPlaybackTimeRef = React.useRef({});
  const feedEndedRef = React.useRef({});
  const enlargedVideoRef = React.useRef(null);
  const rootViewportRef = React.useRef(null);
  const getVisionMode = useCallback((modeKey) => VISION_MODES[modeKey] || VISION_MODES.EO, []);

  const setAltitudeDraft = useCallback((key, value) => {
    setAltitudeDrafts(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearAltitudeDraft = useCallback((key) => {
    setAltitudeDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const commitAltitudeDraft = useCallback((key, rawValue, fallbackValue, commitFn) => {
    const parsedValue = Number(rawValue);
    const finalValue = Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
    commitFn(finalValue);
    clearAltitudeDraft(key);
  }, [clearAltitudeDraft]);

  const handleMapClick = useCallback((latlng) => {
    setTargetLock(prev => ({
      ...prev,
      waypoints: [...(prev?.waypoints || []), { ...latlng, id: Date.now() + Math.random() }]
    }));
  }, [setTargetLock]);

  const syncFeedPlaybackTime = useCallback((droneId, videoEl) => {
    if (!droneId || !videoEl) return;
    const currentTime = videoEl.currentTime || 0;
    feedPlaybackTimeRef.current[droneId] = currentTime;
    const duration = Number(videoEl.duration);
    if (Number.isFinite(duration) && duration > 0 && currentTime < Math.max(0, duration - 0.2)) {
      feedEndedRef.current[droneId] = false;
    }
  }, []);
  const seekFeedToStoredTime = useCallback((droneId, videoEl, fallbackTime = 0) => {
    if (!droneId || !videoEl) return;
    const duration = Number(videoEl.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const finalFrameTime = Math.max(0, duration - 0.05);
    if (feedEndedRef.current[droneId]) {
      videoEl.currentTime = finalFrameTime;
      requestAnimationFrame(() => videoEl.pause());
      return;
    }
    const resumeTime = feedPlaybackTimeRef.current[droneId] ?? fallbackTime ?? 0;
    if (!Number.isFinite(resumeTime) || resumeTime <= 0) return;
    videoEl.currentTime = Math.min(resumeTime, finalFrameTime);
  }, []);
  const freezeFeedAtLastFrame = useCallback((droneId, videoEl) => {
    if (!droneId || !videoEl) return;
    const duration = Number(videoEl.duration);
    if (Number.isFinite(duration) && duration > 0) {
      const finalFrameTime = Math.max(0, duration - 0.05);
      videoEl.currentTime = finalFrameTime;
      feedPlaybackTimeRef.current[droneId] = finalFrameTime;
      feedEndedRef.current[droneId] = true;
    }
    videoEl.pause();
  }, []);
  const getLiveDroneFeedData = useCallback((droneId, widgetState = null) => {
    if (!droneId) return null;
    const ownerSwarm = telemetry.swarms.find((swarm) => swarm.drones.some((drone) => drone.id === droneId)) || null;
    const swarmDrone = ownerSwarm?.drones.find((drone) => drone.id === droneId) || null;
    const independentDrone = telemetry.unassignedDrones?.find((drone) => drone.id === droneId) || null;
    const liveDrone = swarmDrone || independentDrone;
    if (!liveDrone) return null;
    return {
      ...liveDrone,
      ownerSwarm,
      videoSrc: widgetState?.videoSrc || droneVideoMap[droneId] || droneVideoMap['01'],
      visionMode: widgetState?.visionMode || 'EO',
      playbackTime: widgetState?.playbackTime ?? feedPlaybackTimeRef.current[droneId] ?? 0
    };
  }, [telemetry, droneVideoMap]);
  const openFloatingFeedWidget = useCallback((drone, ownerSwarm) => {
    if (!drone?.id) return;
    const widgetId = `widget-${drone.id}`;
    const playbackTime = inlineVideoRefs.current[drone.id]?.currentTime ?? feedPlaybackTimeRef.current[drone.id] ?? 0;
    widgetZCounterRef.current += 1;
    setFloatingFeedWidgets(prev => {
      const existing = prev.find(widget => widget.id === widgetId);
      if (existing) {
        return prev.map(widget => widget.id === widgetId ? {
          ...widget,
          zIndex: widgetZCounterRef.current,
          playbackTime
        } : widget);
      }

      const nextWidget = {
        id: widgetId,
        droneId: drone.id,
        swarmId: ownerSwarm?.id || null,
        videoSrc: droneVideoMap[drone.id] || droneVideoMap['01'],
        visionMode: 'EO',
        aiHudEnabled: false,
        playbackTime,
        x: 420 + (prev.length % 3) * 46,
        y: 120 + (prev.length % 3) * 34,
        width: 420,
        height: 248,
        zIndex: widgetZCounterRef.current
      };

      return [...prev.slice(Math.max(0, prev.length - 2)), nextWidget];
    });
  }, [droneVideoMap]);
  const closeFloatingFeedWidget = useCallback((widgetId) => {
    setFloatingFeedWidgets(prev => prev.filter(widget => widget.id !== widgetId));
    delete widgetVideoRefs.current[widgetId];
  }, []);
  const updateFloatingFeedWidget = useCallback((widgetId, updates) => {
    setFloatingFeedWidgets(prev => prev.map(widget => widget.id === widgetId ? { ...widget, ...updates } : widget));
  }, []);
  const focusFloatingFeedWidget = useCallback((widgetId) => {
    widgetZCounterRef.current += 1;
    updateFloatingFeedWidget(widgetId, { zIndex: widgetZCounterRef.current });
  }, [updateFloatingFeedWidget]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFeedHudTick((tick) => (tick + 1) % 100000);
    }, 240);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const interaction = widgetInteractionRef.current;
      if (!interaction) return;
      const bounds = rootViewportRef.current?.getBoundingClientRect();
      const maxWidth = Math.max(320, (bounds?.width || window.innerWidth) - 24);
      const maxHeight = Math.max(190, (bounds?.height || window.innerHeight) - 24);

      if (interaction.type === 'move') {
        const nextX = Math.max(8, Math.min(interaction.startX + (event.clientX - interaction.pointerStartX), maxWidth - interaction.width - 8));
        const nextY = Math.max(8, Math.min(interaction.startY + (event.clientY - interaction.pointerStartY), maxHeight - interaction.height - 8));
        updateFloatingFeedWidget(interaction.widgetId, { x: nextX, y: nextY });
      }

      if (interaction.type === 'resize') {
        const nextWidth = Math.max(340, Math.min(interaction.startWidth + (event.clientX - interaction.pointerStartX), maxWidth - interaction.startX - 8));
        const nextHeight = Math.max(210, Math.min(interaction.startHeight + (event.clientY - interaction.pointerStartY), maxHeight - interaction.startY - 8));
        updateFloatingFeedWidget(interaction.widgetId, { width: nextWidth, height: nextHeight });
      }
    };

    const handlePointerUp = () => {
      widgetInteractionRef.current = null;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [updateFloatingFeedWidget]);

  const handleUpdateWaypoint = useCallback((id, newPos) => {
    updateDraftWaypoint(id, newPos);
  }, [updateDraftWaypoint]);

  // Handle Dynamic Panning from Logs
  const MapControlRef = React.useRef(null);
  const handleLogClick = (coords) => {
    if (coords && MapControlRef.current) {
      setAutoTrack(false);
      MapControlRef.current.setView([coords.lat, coords.lng], 16, { animate: true });
    }
  };

  useEffect(() => {
    if (isTargeting) {
      setAutoTrack(false);
    }
  }, [isTargeting]);

  // Keyboard shortcut: ESC to close enlarged feed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && enlargedFeed) {
        setEnlargedFeed(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enlargedFeed, setEnlargedFeed]);

  const deckRef = React.useRef(null);
  const registerSelectionInteraction = useCallback(() => {
    selectionInteractionRef.current = Date.now();
  }, []);

  const {
    normalizedFocusDrone,
    activeSwarm,
    activeDrone
  } = useMemo(() => resolveFocusedDroneData(telemetry, focusDrone), [telemetry, focusDrone]);
  const displayUnit = activeDrone ? {
    ...activeDrone,
    speed: activeDrone.speed ?? activeSwarm?.speed ?? 0,
    alt: activeDrone.alt ?? activeSwarm?.alt ?? 0,
    heading: activeDrone.waypoints?.length > 0 ? "LOCK" : (activeSwarm?.heading || 300)
  } : activeSwarm;
  const selectedUnitDetails = activeDrone ? {
    idLabel: `UAV_${activeDrone.id}`,
    swarmLabel: activeSwarm?.name || (activeSwarm?.id ? `SWARM ${activeSwarm.id}` : 'INDEPENDENT'),
    power: activeDrone.pwr ?? 0,
    lat: activeDrone.lat,
    lng: activeDrone.lng,
    status: activeDrone.status || activeSwarm?.status || 'ACTIVE',
    targetAlt: activeDrone.targetAlt ?? activeDrone.alt ?? activeSwarm?.targetAlt ?? activeSwarm?.alt ?? 0,
    color: activeSwarm?.color || '#ffcc00'
  } : null;
  const enlargedFeedOwnerSwarm = useMemo(
    () => enlargedFeed ? telemetry.swarms.find((s) => s.drones.some((dr) => dr.id === enlargedFeed.id)) || null : null,
    [telemetry, enlargedFeed]
  );
  const liveEnlargedFeed = useMemo(() => {
    if (!enlargedFeed?.id) return null;
    const ownerSwarm = telemetry.swarms.find((swarm) => swarm.drones.some((drone) => drone.id === enlargedFeed.id)) || null;
    const swarmDrone = ownerSwarm?.drones.find((drone) => drone.id === enlargedFeed.id) || null;
    const independentDrone = telemetry.unassignedDrones?.find((drone) => drone.id === enlargedFeed.id) || null;
    const liveDrone = swarmDrone || independentDrone;
    if (!liveDrone) return enlargedFeed;
    return {
      ...liveDrone,
      videoSrc: enlargedFeed.videoSrc,
      visionMode: enlargedFeed.visionMode || 'EO',
      playbackTime: enlargedFeed.playbackTime ?? 0
    };
  }, [telemetry, enlargedFeed]);
  const enlargedFeedMissionAssigned = Boolean(
    liveEnlargedFeed && (
      (liveEnlargedFeed.waypoints && liveEnlargedFeed.waypoints.length > 0) ||
      (enlargedFeedOwnerSwarm?.waypoints && enlargedFeedOwnerSwarm.waypoints.length > 0)
    )
  );
  const enlargedFeedCanPlay = Boolean(
    liveEnlargedFeed &&
    isExecutionPhaseActive(tacticalPhase) &&
    enlargedFeedMissionAssigned
  );
  const missionControlTarget = useMemo(() => {
    if (normalizedFocusDrone?.droneId) {
      const focusedSwarm = normalizedFocusDrone.swarmId
        ? telemetry.swarms.find((swarm) => swarm.id === normalizedFocusDrone.swarmId)
        : null;
      const focusedDrone = focusedSwarm?.drones.find((drone) => drone.id === normalizedFocusDrone.droneId)
        || telemetry.unassignedDrones?.find((drone) => drone.id === normalizedFocusDrone.droneId);

      if (focusedSwarm?.waypoints?.length && !(focusedDrone?.waypoints?.length)) {
        return {
          swarmId: focusedSwarm.id,
          droneId: null
        };
      }

      return {
        swarmId: normalizedFocusDrone.swarmId ?? null,
        droneId: normalizedFocusDrone.droneId
      };
    }

    if (lastAIParsedCommand?.targetDroneId) {
      return {
        swarmId: lastAIParsedCommand.swarmId ?? null,
        droneId: lastAIParsedCommand.targetDroneId
      };
    }

    if (lastAIParsedCommand?.swarmId) {
      return {
        swarmId: lastAIParsedCommand.swarmId,
        droneId: null
      };
    }

    const activeSwarm = telemetry.swarms.find((swarm) => swarm.waypoints?.length > 0 || swarm.drones.some((drone) => drone.waypoints?.length > 0));
    if (activeSwarm) {
      return { swarmId: activeSwarm.id, droneId: null };
    }

    const activeIndependent = telemetry.unassignedDrones?.find((drone) => drone.waypoints?.length > 0);
    if (activeIndependent) {
      return { swarmId: null, droneId: activeIndependent.id };
    }

    return null;
  }, [normalizedFocusDrone, lastAIParsedCommand, telemetry]);
  const missionControlDrone = missionControlTarget?.droneId
    ? (missionControlTarget.swarmId
        ? telemetry.swarms.find((swarm) => swarm.id === missionControlTarget.swarmId)?.drones.find((drone) => drone.id === missionControlTarget.droneId)
        : telemetry.unassignedDrones?.find((drone) => drone.id === missionControlTarget.droneId))
    : null;
  const missionControlSwarm = missionControlTarget?.swarmId
    ? telemetry.swarms.find((swarm) => swarm.id === missionControlTarget.swarmId) || null
    : null;
  const missionExecutionActive = isExecutionPhaseActive(tacticalPhase) && Boolean(missionControlTarget);
  const missionIsPaused = Boolean(missionControlDrone?.paused || missionControlSwarm?.paused);
  const missionAbortTargetKey = missionControlTarget
    ? (missionControlTarget.droneId ? `drone-${missionControlTarget.droneId}` : `swarm-${missionControlTarget.swarmId}`)
    : null;
  const abortPendingForTarget = Boolean(
    abortCountdown &&
    missionAbortTargetKey &&
    abortCountdown.targetKey === missionAbortTargetKey
  );

  useEffect(() => {
    if (!normalizedFocusDrone?.droneId) return;

    if (normalizedFocusDrone.swarmId && expandedSwarms[normalizedFocusDrone.swarmId] === false) {
      toggleSwarmExpand(normalizedFocusDrone.swarmId, true);
    }

    const scrollToCard = () => {
      const card = droneCardRefs.current[normalizedFocusDrone.droneId];
      if (card) {
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };

    const frame = window.requestAnimationFrame(scrollToCard);
    return () => window.cancelAnimationFrame(frame);
  }, [normalizedFocusDrone, expandedSwarms, toggleSwarmExpand]);

  const MapInstanceHook = () => {
    const map = useMap();
    useEffect(() => { MapControlRef.current = map; }, [map]);
    return null;
  };

  return (
    <div ref={rootViewportRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: '#040810', position: 'relative' }}>
      <style>{`
        .custom-map-btn {
          background: rgba(8, 12, 20, 0.85);
          border: 1px solid var(--cyan-primary);
          color: var(--cyan-primary);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(4px);
          transition: all 0.2s;
          border-radius: 4px;
          font-weight: bold;
          font-size: 18px;
          font-family: var(--font-mono);
          user-select: none;
        }
        .custom-map-btn:hover {
          background: rgba(0, 229, 255, 0.2);
        }
        
        /* Tactical Minimal Tooltip (for drone labels) */
        .minimal-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .minimal-tooltip::before {
          display: none !important;
        }

        /* Target Tooltip (for target waypoints in 2D) */
        .target-tooltip {
          background: rgba(8, 12, 20, 0.85) !important;
          border: 1px solid var(--orange-primary) !important;
          color: var(--orange-primary) !important;
          font-family: monospace !important;
          font-size: 10px !important;
          font-weight: bold !important;
          padding: 4px 8px !important;
          box-shadow: 0 4px 6px rgba(0,0,0,0.5) !important;
          border-radius: 4px !important;
          white-space: nowrap !important;
        }
        .target-tooltip::before {
          border-top-color: var(--orange-primary) !important;
        }

        /* Swarm label: tactical box outside circle */
        .swarm-label-tooltip {
          background: #080c14 !important;
          border: 1px solid var(--swarm-color, #00e5ff) !important;
          color: var(--swarm-color, #00e5ff) !important;
          font-family: monospace !important;
          font-size: 11px !important;
          font-weight: bold !important;
          padding: 2px 10px !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          white-space: nowrap !important;
        }
        .swarm-label-tooltip::before {
          display: none !important;
        }
      `}</style>
      
      {/* Floating Tactical Telemetry HUD */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        zIndex: 2000,
        pointerEvents: 'none' // Allow clicks to pass through if necessary, though the bar has content
      }}>
        <FocusedDroneHud
          details={selectedUnitDetails}
          displayUnit={displayUnit}
          formatAltitude={formatAltitude}
          formatSpeed={formatSpeed}
          formatWind={formatWind}
          windSource={lastAIParsedCommand?.missionWeather}
        />
      </div>

      {/* Main Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Panel: Swarms & Status */}
        <div style={{ width: '350px', background: 'var(--bg-dark)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 10, position: 'relative' }}>
           <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex-column" style={{ gap: '12px' }}>
                 <div className="flex-between">
                    <span className="mono text-muted" style={{ fontSize: '11px' }}>ACTIVE_UNITS</span>
                    <span className="mono text-main" style={{ fontSize: '11px' }}>{telemetry.swarms.length} SWARMS</span>
                 </div>
                 <div className="flex-between">
                    <span className="mono text-muted" style={{ fontSize: '11px' }}>NETWORK_STATUS</span>
                    <span className="mono text-cyan" style={{ fontSize: '11px' }}>LINKED</span>
                 </div>
              </div>
           </div>

         <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div className="flex-column" style={{ gap: '12px' }}>
              {telemetry.swarms.map((s, idx) => {
                const isExpanded = expandedSwarms[s.id] !== false; // Default to expanded
                return (
                 <div key={idx} 
                      onClick={() => {
                        setFocusDrone({ swarmId: s.id, droneId: s.drones[0].id });
                        registerSelectionInteraction();
                        if (!isExpanded) toggleSwarmExpand(s.id, true);
                      }}
                      className="flex-column" 
                      style={{ gap: '8px', padding: '12px', border: `1px solid ${normalizedFocusDrone?.swarmId === s.id ? 'rgba(0,229,255,0.75)' : 'var(--border-color)'}`, background: normalizedFocusDrone?.swarmId === s.id ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.02)', boxShadow: normalizedFocusDrone?.swarmId === s.id ? 'inset 0 0 0 1px rgba(0,229,255,0.2), 0 0 16px rgba(0,229,255,0.08)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                   <div className="flex-between">
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       {editingSwarmId === s.id ? (
                         <input 
                           autoFocus
                           type="text"
                           defaultValue={s.name || `SWARM ${s.id}`}
                           onBlur={(e) => {
                             if (e.target.value.trim()) updateSwarmName(s.id, e.target.value.trim());
                             setEditingSwarmId(null);
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               if (e.target.value.trim()) updateSwarmName(s.id, e.target.value.trim());
                               setEditingSwarmId(null);
                             }
                             if (e.key === 'Escape') setEditingSwarmId(null);
                           }}
                           style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${s.color}`, color: s.color, fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '2px 4px', width: '100px', outline: 'none' }}
                         />
                       ) : (
                         <>
                           <span className="mono" style={{ fontSize: '12px', color: s.color }}>{s.name || `SWARM ${s.id}`}</span>
                           <button onClick={(e) => { e.stopPropagation(); setEditingSwarmId(s.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px', padding: '0 4px' }} title="Edit Name">✎</button>
                         </>
                       )}
                     </div>
                     <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                       <span className="mono text-cyan" style={{ fontSize: '10px' }}>{s.pwr.toFixed(1)}% PWR</span>
                       <button onClick={(e) => { e.stopPropagation(); toggleSwarmExpand(s.id); }} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '8px', cursor: 'pointer', padding: '2px 4px' }}>{isExpanded ? '[-] COLLAPSE' : '[+] EXPAND'}</button>
                     </div>
                   </div>
                    <div className="flex-between">
                      <span className="mono text-muted" style={{ fontSize: '10px' }}>{s.role} / {s.status}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                         <span className="mono text-main" style={{ fontSize: '10px' }}>ALT:</span>
                         <input 
                            value={altitudeDrafts[`swarm-${s.id}`] ?? altitudeToDisplayValue(s.alt ?? 0)}
                            type="number" 
                            onChange={(e) => setAltitudeDraft(`swarm-${s.id}`, e.target.value)}
                            onBlur={(e) => commitAltitudeDraft(`swarm-${s.id}`, altitudeInputToMeters(e.target.value), s.targetAlt ?? s.alt, (value) => updateSwarmAlt(s.id, value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                commitAltitudeDraft(`swarm-${s.id}`, altitudeInputToMeters(e.currentTarget.value), s.targetAlt ?? s.alt, (value) => updateSwarmAlt(s.id, value));
                                e.target.blur();
                              } else if (e.key === 'Escape') {
                                clearAltitudeDraft(`swarm-${s.id}`);
                                e.target.blur();
                              }
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '40px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--cyan-primary)', fontSize: '10px', padding: '1px 2px', fontFamily: 'monospace', outline: 'none', textAlign: 'center' }}
                         />
                         <span className="mono text-muted" style={{ fontSize: '10px' }}>{unitSystem === 'imperial' ? 'ft' : 'm'}</span>
                         <span className="mono text-main" style={{ fontSize: '10px' }}>| SPD: {formatSpeed(s.speed, { includeUnit: false })}{unitSystem === 'imperial' ? 'mph' : 'kph'}</span>
                      </div>
                    </div>
                   
                   {isExpanded && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0 0 0', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                        {s.drones.map(d => (
                             <div  
                                key={d.id}
                                ref={(node) => {
                                  if (node) droneCardRefs.current[d.id] = node;
                                  else delete droneCardRefs.current[d.id];
                                }}
                                title={`UAV_${d.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocusDrone({ swarmId: s.id, droneId: d.id, forcePopup: null });
                                  setAutoTrack(true);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setFocusDrone({ swarmId: s.id, droneId: d.id, forcePopup: Date.now() });
                                  setAutoTrack(true);
                                }}
                                className="flex-between"
                              style={{ 
                                  padding: '8px',
                                  border: `1px solid ${normalizedFocusDrone?.droneId === d.id ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.1)'}`, 
                                  background: normalizedFocusDrone?.droneId === d.id ? 'rgba(0,229,255,0.1)' : 'transparent', 
                                  boxShadow: normalizedFocusDrone?.droneId === d.id ? '0 0 18px rgba(0,229,255,0.16), inset 0 0 0 1px rgba(0,229,255,0.18)' : 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   {/* Drone Icon */}
                                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={d.pwr > 50 ? s.color : "var(--orange-alert)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                     <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-1.6-.4-3.2.2-4 1.4-.2.4-.2.9 0 1.3l4.5 4.5L3.8 14.9c-.3.3-.4.8-.2 1.1s.8.3 1.1 0l1.5-1.5 4.5 4.5c.4.3.9.2 1.3 0 1.2-.8 1.8-2.4 1.4-4L16 13l3.5 3.5c1.5 1.5 3.5 2 4.5 1.5.5-1.5 0-3.5-1.5-4.5h0z"/>
                                   </svg>
                                   <span className="mono text-main" style={{ fontSize: '10px' }}>UAV_{d.id}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                    <span className="mono text-muted" style={{ fontSize: '9px' }}>ALT</span>
                                    <input 
                                      value={altitudeDrafts[`drone-${d.id}`] ?? altitudeToDisplayValue(d.alt ?? s.alt ?? 0)}
                                      type="number" 
                                      onChange={(e) => setAltitudeDraft(`drone-${d.id}`, e.target.value)}
                                      onBlur={(e) => commitAltitudeDraft(`drone-${d.id}`, altitudeInputToMeters(e.target.value), d.targetAlt ?? d.alt ?? s.targetAlt ?? s.alt, (value) => updateDroneAlt(d.id, value))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          commitAltitudeDraft(`drone-${d.id}`, altitudeInputToMeters(e.currentTarget.value), d.targetAlt ?? d.alt ?? s.targetAlt ?? s.alt, (value) => updateDroneAlt(d.id, value));
                                          e.target.blur();
                                        } else if (e.key === 'Escape') {
                                          clearAltitudeDraft(`drone-${d.id}`);
                                          e.target.blur();
                                        }
                                      }}
                                      style={{ width: '35px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--orange-primary)', fontSize: '9px', padding: '1px 2px', fontFamily: 'monospace', outline: 'none', textAlign: 'center' }}
                                    />
                                    <span className="mono text-muted" style={{ fontSize: '9px' }}>{unitSystem === 'imperial' ? 'ft' : 'm'}</span>
                                  </div>
                                  <span className="mono text-muted" style={{ fontSize: '9px' }}>{d.pwr.toFixed(0)}%</span>
                                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                     <button 
                                       onClick={(e) => { e.stopPropagation(); setTransferDroneId(transferDroneId === d.id ? null : d.id); }}
                                       style={{ background: 'transparent', border: 'none', color: 'var(--cyan-primary)', cursor: 'pointer', padding: '0 4px', fontSize: '12px' }}
                                       title="Transfer to Swarm"
                                     >↹</button>
                                     {transferDroneId === d.id && (
                                       <div style={{ position: 'absolute', right: 0, top: '20px', background: '#080c14', border: '1px solid var(--cyan-primary)', zIndex: 100, padding: '4px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <span className="mono text-muted" style={{ fontSize: '8px', whiteSpace: 'nowrap' }}>JOIN SWARM:</span>
                                          {telemetry.swarms.filter(sw => sw.id !== s.id).map(sw => (
                                             <button 
                                               key={sw.id}
                                               onClick={(e) => { e.stopPropagation(); moveDroneToSwarm(d.id, s.id, sw.id); setTransferDroneId(null); }}
                                               style={{ background: 'rgba(0,229,255,0.1)', border: 'none', color: sw.color, cursor: 'pointer', fontSize: '10px', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}
                                             >
                                               S{sw.id} {sw.name ? `(${sw.name})` : ''}
                                             </button>
                                          ))}
                                       </div>
                                     )}
                                  </div>
                                </div>
                             </div>
                        ))}
                     </div>
                   )}
                 </div>
               );
              })}

              {/* INDEPENDENT UNITS SECTION */}
              {telemetry.unassignedDrones && telemetry.unassignedDrones.length > 0 && (
                <div className="flex-column" style={{ gap: '8px', padding: '12px', border: `1px solid ${normalizedFocusDrone?.swarmId == null && normalizedFocusDrone?.droneId ? 'rgba(255,204,0,0.75)' : 'var(--border-color)'}`, background: normalizedFocusDrone?.swarmId == null && normalizedFocusDrone?.droneId ? 'rgba(255,204,0,0.06)' : 'rgba(255,255,255,0.02)', boxShadow: normalizedFocusDrone?.swarmId == null && normalizedFocusDrone?.droneId ? 'inset 0 0 0 1px rgba(255,204,0,0.18), 0 0 16px rgba(255,204,0,0.08)' : 'none', transition: 'all 0.2s' }}>
                   <div className="flex-between" style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                     <span className="mono" style={{ fontSize: '12px', color: '#fff' }}>INDEPENDENT UNITS</span>
                     <span className="mono text-muted" style={{ fontSize: '10px' }}>{telemetry.unassignedDrones.length} ACTIVE</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {telemetry.unassignedDrones.map(d => (
                         <div  
                            key={d.id}
                            ref={(node) => {
                              if (node) droneCardRefs.current[d.id] = node;
                              else delete droneCardRefs.current[d.id];
                            }}
                            title={`UAV_${d.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFocusDrone({ swarmId: null, droneId: d.id, forcePopup: null });
                              setAutoTrack(true);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setFocusDrone({ swarmId: null, droneId: d.id, forcePopup: Date.now() });
                              setAutoTrack(true);
                            }}
                            className="flex-between"
                            style={{ 
                              padding: '8px',
                              border: `1px solid ${normalizedFocusDrone?.droneId === d.id ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.1)'}`, 
                              background: normalizedFocusDrone?.droneId === d.id ? 'rgba(0,229,255,0.1)' : 'transparent', 
                              boxShadow: normalizedFocusDrone?.droneId === d.id ? '0 0 18px rgba(0,229,255,0.16), inset 0 0 0 1px rgba(0,229,255,0.18)' : 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               {/* Drone Icon */}
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={d.pwr > 50 ? "#ffffff" : "var(--orange-alert)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                 <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-1.6-.4-3.2.2-4 1.4-.2.4-.2.9 0 1.3l4.5 4.5L3.8 14.9c-.3.3-.4.8-.2 1.1s.8.3 1.1 0l1.5-1.5 4.5 4.5c.4.3.9.2 1.3 0 1.2-.8 1.8-2.4 1.4-4L16 13l3.5 3.5c1.5 1.5 3.5 2 4.5 1.5.5-1.5 0-3.5-1.5-4.5h0z"/>
                               </svg>
                               <span className="mono text-main" style={{ fontSize: '10px' }}>UAV_{d.id}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                <span className="mono text-muted" style={{ fontSize: '9px' }}>ALT</span>
                                <input 
                                  value={altitudeDrafts[`drone-${d.id}`] ?? altitudeToDisplayValue(d.alt ?? 0)}
                                  type="number" 
                                  onChange={(e) => setAltitudeDraft(`drone-${d.id}`, e.target.value)}
                                  onBlur={(e) => commitAltitudeDraft(`drone-${d.id}`, altitudeInputToMeters(e.target.value), d.targetAlt ?? d.alt ?? 120, (value) => updateDroneAlt(d.id, value))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      commitAltitudeDraft(`drone-${d.id}`, altitudeInputToMeters(e.currentTarget.value), d.targetAlt ?? d.alt ?? 120, (value) => updateDroneAlt(d.id, value));
                                      e.target.blur();
                                    } else if (e.key === 'Escape') {
                                      clearAltitudeDraft(`drone-${d.id}`);
                                      e.target.blur();
                                    }
                                  }}
                                  style={{ width: '35px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--orange-primary)', fontSize: '9px', padding: '1px 2px', fontFamily: 'monospace', outline: 'none', textAlign: 'center' }}
                                />
                                <span className="mono text-muted" style={{ fontSize: '9px' }}>{unitSystem === 'imperial' ? 'ft' : 'm'}</span>
                              </div>
                              <span className="mono text-muted" style={{ fontSize: '9px' }}>{d.pwr.toFixed(0)}%</span>
                              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); setTransferDroneId(transferDroneId === d.id ? null : d.id); }}
                                   style={{ background: 'transparent', border: 'none', color: 'var(--cyan-primary)', cursor: 'pointer', padding: '0 4px', fontSize: '12px' }}
                                   title="Assign to Swarm"
                                 >↹</button>
                                 {transferDroneId === d.id && (
                                   <div style={{ position: 'absolute', right: 0, top: '20px', background: '#080c14', border: '1px solid var(--cyan-primary)', zIndex: 100, padding: '4px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span className="mono text-muted" style={{ fontSize: '8px', whiteSpace: 'nowrap' }}>ASSIGN TO SWARM:</span>
                                      {telemetry.swarms.map(sw => (
                                         <button 
                                           key={sw.id}
                                           onClick={(e) => { e.stopPropagation(); moveDroneToSwarm(d.id, null, sw.id); setTransferDroneId(null); }}
                                           style={{ background: 'rgba(0,229,255,0.1)', border: 'none', color: sw.color, cursor: 'pointer', fontSize: '10px', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}
                                         >
                                           S{sw.id} {sw.name ? `(${sw.name})` : ''}
                                         </button>
                                      ))}
                                   </div>
                                 )}
                              </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
         </div>

         <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', minHeight: '140px' }}>
            <h3 className="mono text-cyan" style={{ fontSize: '12px', marginBottom: '12px' }}>MISSION TARGET DECK</h3>
            
            {!targetLock || targetLock.waypoints.length === 0 ? (
              <button 
                className={`btn ${isTargeting ? 'btn-alert' : ''}`}
                onClick={() => {
                  const nextTargeting = !isTargeting;
                  setIsTargeting(nextTargeting);
                  if (nextTargeting) {
                    setAutoTrack(false);
                  }
                }}
                style={{ width: '100%', height: '50px', borderStyle: 'dashed' }}
              >
                <span className="mono" style={{ fontSize: '11px' }}>
                  {isTargeting ? '>> CANCEL_PLANNING <<' : '🎯 DESIGNATE_TACTICAL_PATH'}
                </span>
              </button>
            ) : (
              <div className="flex-column" style={{ gap: '8px' }}>
                 <div className="flex-between">
                    <span className="mono text-orange" style={{ fontSize: '11px' }}>PATH_DRAFT: {targetLock.waypoints.length} PTS</span>
                    <button onClick={() => setTargetLock({ waypoints: [], assignedSwarm: null })} className="mono" style={{ background: 'transparent', border: 'none', color: 'var(--orange-alert)', fontSize: '10px', cursor: 'pointer' }}>[RESET]</button>
                 </div>
                 
                 {/* Waypoint Edit List */}
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto', paddingRight: '4px' }}>
                    {targetLock.waypoints.map((wp, idx) => (
                      <div key={wp.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,107,0,0.3)' }}>
                        <span className="mono text-orange" style={{ fontSize: '10px', width: '30px' }}>WP_{idx+1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '2px 4px', borderRadius: '2px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2" title="Latitude">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20M4 8h16M4 16h16"/>
                          </svg>
                          <input 
                            type="number" 
                            step="0.0001"
                            value={wp.lat} 
                            onChange={(e) => updateDraftWaypoint(wp.id, { lat: e.target.value === '' ? '' : e.target.value })}
                            onBlur={(e) => {
                               const val = parseFloat(e.target.value);
                               if (!isNaN(val)) updateDraftWaypoint(wp.id, { lat: val.toFixed(4) });
                            }}
                            style={{ width: '55px', background: 'transparent', border: 'none', color: '#fff', fontSize: '10px', padding: '0 0 0 4px', fontFamily: 'monospace', outline: 'none' }} 
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '2px 4px', borderRadius: '2px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2" title="Longitude">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2v20M8 3a10 10 0 0 0 0 18M16 3a10 10 0 0 1 0 18"/>
                          </svg>
                          <input 
                            type="number" 
                            step="0.0001"
                            value={wp.lng} 
                            onChange={(e) => updateDraftWaypoint(wp.id, { lng: e.target.value === '' ? '' : e.target.value })}
                            onBlur={(e) => {
                               const val = parseFloat(e.target.value);
                               if (!isNaN(val)) updateDraftWaypoint(wp.id, { lng: val.toFixed(4) });
                            }}
                            style={{ width: '55px', background: 'transparent', border: 'none', color: '#fff', fontSize: '10px', padding: '0 0 0 4px', fontFamily: 'monospace', outline: 'none' }} 
                          />
                        </div>
                        <button 
                          onClick={() => setTargetLock(prev => ({ ...prev, waypoints: prev.waypoints.filter(w => w.id !== wp.id) }))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--orange-alert)', cursor: 'pointer', fontSize: '10px', marginLeft: 'auto' }}
                          title="Remove Target"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                 </div>
                 
                 <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {normalizedFocusDrone ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
	                         {normalizedFocusDrone.swarmId && (
	                           <button 
	                              onClick={() => prepareManualReview(normalizedFocusDrone.swarmId, targetLock.waypoints)}
	                              className="btn-primary" 
	                              disabled={missionExecutionActive}
	                              style={{ flex: '1', padding: '6px', fontSize: '10px', border: '1px solid var(--cyan-primary)', background: 'rgba(0,229,255,0.1)', color: 'var(--cyan-primary)', cursor: missionExecutionActive ? 'not-allowed' : 'pointer', opacity: missionExecutionActive ? 0.45 : 1 }}
	                           >
	                             DEPLOY SWARM {normalizedFocusDrone.swarmId}
	                           </button>
	                         )}
	                         <button 
	                            onClick={() => prepareManualReview(normalizedFocusDrone.swarmId, targetLock.waypoints, normalizedFocusDrone.droneId)}
	                            className="btn-primary" 
	                            disabled={missionExecutionActive}
	                            style={{ flex: '1', padding: '6px', fontSize: '10px', border: '1px solid var(--orange-primary)', background: 'rgba(255,107,0,0.1)', color: 'var(--orange-primary)', cursor: missionExecutionActive ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: missionExecutionActive ? 0.45 : 1 }}
	                         >
	                           DEPLOY UAV {normalizedFocusDrone.droneId}
	                         </button>
                      </div>
                    ) : (
	                      telemetry.swarms.map(s => (
	                        <button 
	                           key={s.id} 
	                           onClick={() => prepareManualReview(s.id, targetLock.waypoints)}
	                           className="btn-primary" 
	                           disabled={missionExecutionActive}
	                           style={{ flex: '1 0 45%', padding: '6px', fontSize: '10px', border: '1px solid var(--cyan-primary)', background: 'rgba(0,229,255,0.1)', color: 'var(--cyan-primary)', cursor: missionExecutionActive ? 'not-allowed' : 'pointer', opacity: missionExecutionActive ? 0.45 : 1 }}
	                        >
	                          PLAN SWARM {s.id}
	                        </button>
	                      ))
                    )}
                 </div>
              </div>
            )}
         </div>
      </div>

      {/* Main Map View */}
      <div className="map-container-wrapper" style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: '280px', right: '20px', zIndex: 1000 }}>
          <button 
            onClick={() => setMapType(prev => prev === 'satellite' ? 'terrain' : 'satellite')}
            title={mapType === 'satellite' ? 'Switch to Topo Map' : 'Switch to Satellite'}
            className="mono" 
            style={{ 
              background: 'rgba(8,12,20,0.85)', 
              border: '1px solid var(--cyan-primary)', 
              color: 'var(--cyan-primary)', 
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s',
              borderRadius: '4px'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(8,12,20,0.85)'; }}
          >
            {mapType === 'satellite' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            )}
          </button>
        </div>
        <div className="map-container-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
          {mapType === 'terrain' ? (
            <DeckGLMap 
              ref={deckRef}
              telemetry={telemetry} 
              targetLock={targetLock} 
              mapCenter={mapCenter} 
              mapZoom={mapZoomLevel}
              onZoomChange={setMapZoomLevel}
              setTargetLock={setTargetLock} 
              isTargeting={isTargeting} 
              setFocusDrone={setFocusDrone}
              focusDrone={focusDrone}
              setAutoTrack={setAutoTrack}
              autoTrack={autoTrack}
              unitSystem={unitSystem}
              onSelectionInteraction={registerSelectionInteraction}
              activeMissionPlan={lastAIParsedCommand}
              tacticalPhase={tacticalPhase}
            />
          ) : (
            <MapContainer center={mapCenter} zoom={mapZoomLevel} zoomControl={false} style={{ width: '100%', height: '100%' }}>
              <TileLayer 
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" 
                maxZoom={22} 
                maxNativeZoom={20} 
                detectRetina={true} 
              />
              <MapInstanceHook />
              <MapZoomSync onZoomChange={setMapZoomLevel} />
              <MapEventsListener setAutoTrack={setAutoTrack} isTargeting={isTargeting} onMapClick={handleMapClick} setFocusDrone={setFocusDrone} selectionInteractionRef={selectionInteractionRef} />
              <MapTracker isTargeting={isTargeting} autoTrack={autoTrack} normalizedFocusDrone={normalizedFocusDrone} />
              <ScaleControl position="bottomleft" imperial={unitSystem === 'imperial'} />
              
              <MissionDraftLayers 
                waypoints={targetLock?.waypoints} 
                onUpdateWaypoint={handleUpdateWaypoint} 
              />

              {/* Layer 1: Swarm Decorators (Circles, Labels, Paths) */}
              {telemetry.swarms.map(swarm => {
                const isExpanded = expandedSwarms[swarm.id] !== false;
                const zoneCenter = getSwarmZoneCenter(swarm);
                const radiusDeg = (isExpanded ? 100 : 50) / 111000;
                const labelLat = zoneCenter.lat - radiusDeg - 0.00008;
                const labelText = swarm.name || 'SWARM_' + swarm.id;
                const labelIcon = new L.DivIcon({
                  className: '',
                  html: `<div style="position:relative;width:0;height:0;"><div style="position:absolute;top:0;left:0;transform:translateX(-50%);background:#080c14;border:1px solid ${swarm.color};color:${swarm.color};font-family:monospace;font-size:11px;font-weight:bold;white-space:nowrap;padding:3px 10px;pointer-events:none;">${labelText}</div></div>`,
                  iconSize: [0, 0],
                  iconAnchor: [0, 0]
                });

                return (
                  <React.Fragment key={`swarm-deco-${swarm.id}`}>
                    <Circle 
                      center={[zoneCenter.lat, zoneCenter.lng]} 
                      radius={isExpanded ? 100 : 50} 
                      pathOptions={{ color: swarm.color, fillColor: swarm.color, fillOpacity: 0.2 }}
                      interactive={false}
                    />
                    <Marker
                      position={[labelLat, zoneCenter.lng]}
                      icon={labelIcon}
                      interactive={true}
                      zIndexOffset={1000}
                      eventHandlers={{
                        click: (e) => {
                          if (e?.originalEvent) {
                            L.DomEvent.stop(e.originalEvent);
                          }
                          registerSelectionInteraction();
                          setFocusDrone({ swarmId: swarm.id, droneId: swarm.drones[0]?.id });
                          if (!isExpanded) toggleSwarmExpand(swarm.id, true);
                          setAutoTrack(true);
                        },
                        dblclick: (e) => {
                          if (e?.originalEvent) {
                            L.DomEvent.stop(e.originalEvent);
                          }
                          registerSelectionInteraction();
                          toggleSwarmExpand(swarm.id);
                        }
                      }}
                    />
                    {swarm.waypoints.length > 0 && (
                    <Polyline 
                        positions={[[zoneCenter.lat, zoneCenter.lng], ...swarm.waypoints.map(w => [w.lat, w.lng])]}
                        pathOptions={{ color: '#101826', weight: 8, opacity: 0.75 }}
                      />
                    )}
                    {swarm.waypoints.length > 0 && (
                      <Polyline 
                        positions={[[zoneCenter.lat, zoneCenter.lng], ...swarm.waypoints.map(w => [w.lat, w.lng])]}
                        pathOptions={{ color: 'var(--orange-primary)', weight: 4, opacity: 0.95 }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Layer 2: Independent Drone Markers (Stable Interaction Layer) */}
              {telemetry.swarms.flatMap(swarm => {
                const isExpanded = expandedSwarms[swarm.id] !== false;
                return swarm.drones.map(drone => (
                  <DroneMarker 
                    key={`drone-marker-${swarm.id}-${drone.id}`} 
                    drone={drone} 
                    swarmColor={swarm.color} 
                    isFocused={normalizedFocusDrone?.droneId === drone.id} 
                    forcePopupTime={normalizedFocusDrone?.droneId === drone.id ? normalizedFocusDrone?.forcePopup : null}
                    registerSelectionInteraction={registerSelectionInteraction}
                    onFocus={() => {
                        setFocusDrone({ swarmId: swarm.id, droneId: drone.id, forcePopup: null });
                        if (!isExpanded) toggleSwarmExpand(swarm.id, true);
                        setAutoTrack(true);
                    }}
                  />
                ));
              })}
              
              {/* Independent Drones */}
              {telemetry.unassignedDrones?.map(drone => (
                  <DroneMarker 
                    key={`drone-marker-indy-${drone.id}`} 
                    drone={drone} 
                    swarmColor={"#ffcc00"} 
                    isFocused={normalizedFocusDrone?.droneId === drone.id} 
                    forcePopupTime={normalizedFocusDrone?.droneId === drone.id ? normalizedFocusDrone?.forcePopup : null}
                    registerSelectionInteraction={registerSelectionInteraction}
                    onFocus={() => {
                        setFocusDrone({ swarmId: null, droneId: drone.id, forcePopup: null });
                        setAutoTrack(true);
                    }}
                  />
              ))}
            </MapContainer>
          )}

          {/* Global Map Controls */}
          <div style={{ position: 'absolute', bottom: '150px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className="custom-map-btn" 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (mapType === 'satellite' && MapControlRef.current) {
                  // Standard Leaflet is fixed North
                  MapControlRef.current.setView(MapControlRef.current.getCenter(), MapControlRef.current.getZoom(), { animate: true });
                } else if (mapType === 'terrain' && deckRef.current) {
                  deckRef.current.resetNorth();
                }
              }} 
              title="North Up"
              style={{ color: 'var(--orange-primary)', borderColor: 'var(--orange-primary)' }}
            >N</button>
            <button 
              className="custom-map-btn" 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (mapType === 'satellite' && MapControlRef.current) {
                  MapControlRef.current.setZoom(MapControlRef.current.getZoom() + 1);
                } else if (mapType === 'terrain' && deckRef.current) {
                  deckRef.current.zoomIn();
                }
              }} 
              title="Zoom In"
            >+</button>
            <button 
              className="custom-map-btn" 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (mapType === 'satellite' && MapControlRef.current) {
                  MapControlRef.current.setZoom(MapControlRef.current.getZoom() - 1);
                } else if (mapType === 'terrain' && deckRef.current) {
                  deckRef.current.zoomOut();
                }
              }} 
              title="Zoom Out"
            >-</button>
          </div>
        </div>

        
        {/* Atmospheric Layers */}
        <div className="map-scanlines"></div>
        <div className="map-dark-overlay" style={{ pointerEvents: 'none' }}></div>
        
        {/* Bottom Floating Voice Control */}
        <VoiceControlFAB />
      </div>

      {/* Right Panel */}
      <div style={{ width: '400px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
         {/* Live Matrix Section */}
         <div style={{ flex: 1, padding: '20px', overflowY: 'auto', borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
               <h3 className="mono text-cyan" style={{ fontSize: '13px' }}>VIDEO_FEED_MATRIX</h3>
               <span className="rec-dot"></span>
            </div>
            <div className="video-grid">
               {telemetry.swarms.flatMap(s => s.drones).concat(telemetry.unassignedDrones || []).slice(0, 6).map((d) => {
                 const videoSrc = droneVideoMap[d.id] || droneVideoMap['01'];
                 const ownerSwarm = telemetry.swarms.find(s => s.drones.some(dr => dr.id === d.id));
                 const isGrounded = Number(d.alt ?? 0) <= 0;
                 const missionAssigned = Boolean((d.waypoints && d.waypoints.length > 0) || (ownerSwarm?.waypoints && ownerSwarm.waypoints.length > 0));
                 const canPlayFeed = isExecutionPhaseActive(tacticalPhase) && missionAssigned;
                 const isFocusedFeed = normalizedFocusDrone?.droneId === d.id;
                 const headingLabel = getDroneHeadingLabel(d, ownerSwarm);

                 return (
                   <div 
                      key={d.id} 
                      className="video-feed-card" 
                      onClick={() => {
                        setFocusDrone({ swarmId: ownerSwarm?.id || null, droneId: d.id, forcePopup: null });
                        setAutoTrack(true);
                      }}
                      onDoubleClick={() => openFloatingFeedWidget(d, ownerSwarm)}
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        background: isFocusedFeed ? 'rgba(0, 229, 255, 0.12)' : '#050a10',
                        cursor: 'zoom-in',
                        border: isFocusedFeed ? '1px solid var(--cyan-primary)' : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: isFocusedFeed ? '0 0 0 1px rgba(0,229,255,0.35), 0 0 18px rgba(0,229,255,0.22)' : 'none',
                        transform: isFocusedFeed ? 'scale(1.02)' : 'scale(1)',
                        transition: 'all 0.2s ease'
                      }}
                   >
                      {isFocusedFeed && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          zIndex: 4,
                          padding: '2px 6px',
                          border: '1px solid var(--cyan-primary)',
                          background: 'rgba(8, 12, 20, 0.88)',
                          color: 'var(--cyan-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          letterSpacing: '0.08em'
                        }}>
                          TRACKING
                        </div>
                      )}
                      {!canPlayFeed ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'radial-gradient(circle at center, rgba(24, 32, 44, 0.7), rgba(4, 8, 16, 0.98))',
                            color: 'rgba(255,255,255,0.75)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            letterSpacing: '0.12em',
                            position: 'relative',
                            zIndex: 1
                          }}
                        >
                          {missionAssigned ? 'MISSION_LINK_READY' : 'NO_ACTIVE_MISSION'}
                        </div>
                      ) : (
                        <video 
                          ref={(node) => {
                            if (node) inlineVideoRefs.current[d.id] = node;
                            else delete inlineVideoRefs.current[d.id];
                          }}
                          src={videoSrc} 
                          autoPlay
                          loop={false}
                          muted
                          playsInline
                          onLoadedMetadata={(e) => seekFeedToStoredTime(d.id, e.currentTarget)}
                          onTimeUpdate={(e) => syncFeedPlaybackTime(d.id, e.currentTarget)}
                          onEnded={(e) => freezeFeedAtLastFrame(d.id, e.currentTarget)}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            filter: 'none',
                            position: 'relative',
                            zIndex: 1
                          }}
                        />
                      )}
                      <div className="video-hud-overlay" style={{ zIndex: 10 }}>
                         <div className="flex-between">
                            <span className="mono" style={{ fontSize: '9px', color: 'var(--cyan-primary)', background: 'rgba(0,0,0,0.7)', padding: '1px 4px' }}>UAV_{d.id}</span>
                            <span className="mono" style={{ fontSize: '8px', color: '#fff', background: isGrounded ? 'rgba(255,140,0,0.72)' : 'rgba(0,128,96,0.72)', padding: '1px 3px' }}>
                              {canPlayFeed ? 'NORMAL' : missionAssigned ? 'MISSION_HOLD' : 'STANDBY'}
                            </span>
                         </div>
                         <div className="flex-between" style={{ alignItems: 'flex-end' }}>
                            <div className="flex-column" style={{ gap: '2px' }}>
                               <span className="mono" style={{ fontSize: '7px', color: '#fff', textShadow: '1px 1px 2px #000' }}>LAT: {d.lat.toFixed(4)}</span>
                               <span className="mono" style={{ fontSize: '7px', color: '#fff', textShadow: '1px 1px 2px #000' }}>LNG: {d.lng.toFixed(4)}</span>
                            </div>
                            <span className="mono" style={{ fontSize: '8px', color: 'var(--cyan-primary)', textShadow: '1px 1px 2px #000' }}>HDG: {headingLabel}</span>
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>
         </div>
         
         {/* System Logs Section */}
         <div style={{ height: '220px', padding: '20px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)' }}>
            <h3 className="mono text-cyan" style={{ fontSize: '13px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>TACTICAL_LOG (AUTO_PAN_ENABLED)</h3>
            <div className="flex-column" style={{ gap: '8px' }}>
               {tacticalLogs.map((log, i) => (
                 <div key={i} 
                      onClick={() => handleLogClick(log.coords)}
                      className={`log-entry-interactive ${log.coords ? 'has-coords' : ''}`}
                      style={{ display: 'flex', gap: '8px', opacity: 1 - i * 0.1 }}>
                    <span className="mono text-muted" style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>[{log.timestamp}]</span>
                    <span className="mono" style={{ fontSize: '9px', color: log.type === 'TACTICAL' ? 'var(--orange-primary)' : log.type === 'ALERT' ? 'var(--orange-alert)' : 'var(--text-main)' }}>{log.message} {log.coords && '📍'}</span>
                 </div>
               ))}
            </div>
         </div>
         {missionExecutionActive && (
           <div style={{ padding: '16px 20px 20px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.24)' }}>
             <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '12px' }}>
               FLIGHT CONTROL // {missionControlTarget?.droneId ? `UAV_${missionControlTarget.droneId}` : `SWARM_${missionControlTarget?.swarmId}`}
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
               <button
                 className="btn"
                 onClick={() => controlMissionFlight({ action: 'abort', swarmId: missionControlTarget?.swarmId ?? null, droneId: missionControlTarget?.droneId ?? null })}
                 style={{ padding: '14px 12px', borderColor: 'var(--orange-alert)', color: 'var(--orange-alert)' }}
               >
                 {abortPendingForTarget ? `CANCEL_ABORT ${abortCountdown.remaining}s` : 'ABORT'}
               </button>
               <button
                 className="btn btn-primary"
                 onClick={() => controlMissionFlight({ action: missionIsPaused ? 'resume' : 'pause', swarmId: missionControlTarget?.swarmId ?? null, droneId: missionControlTarget?.droneId ?? null })}
                 style={{ padding: '14px 12px' }}
               >
                 {missionIsPaused ? 'RESUME' : 'PAUSE'}
               </button>
             </div>
             {abortPendingForTarget && (
               <div className="mono text-muted" style={{ fontSize: '9px', marginTop: '10px', color: 'var(--orange-primary)' }}>
                 ABORT WILL EXECUTE IN {abortCountdown.remaining} SECONDS UNLESS CANCELLED
               </div>
             )}
           </div>
         )}
      </div>

      {floatingFeedWidgets.map((widget) => {
        const liveWidgetFeed = getLiveDroneFeedData(widget.droneId, widget);
        const widgetMissionAssigned = Boolean(
          liveWidgetFeed && (
            (liveWidgetFeed.waypoints && liveWidgetFeed.waypoints.length > 0) ||
            (liveWidgetFeed.ownerSwarm?.waypoints && liveWidgetFeed.ownerSwarm.waypoints.length > 0)
          )
        );
        const widgetCanPlay = Boolean(liveWidgetFeed && isExecutionPhaseActive(tacticalPhase) && widgetMissionAssigned);
        const widgetPlaybackTime = widgetVideoRefs.current[widget.id]?.currentTime ?? liveWidgetFeed.playbackTime ?? 0;
        const widgetDetections = widget.aiHudEnabled
          ? getSimulatedDetections(liveWidgetFeed.id, widgetPlaybackTime + (feedHudTick * 0.04), widget.width, widget.height - 49)
          : [];
        if (!liveWidgetFeed) return null;

        return (
          <div
            key={widget.id}
            onMouseDown={() => focusFloatingFeedWidget(widget.id)}
            style={{
              position: 'absolute',
              left: widget.x,
              top: widget.y,
              width: widget.width,
              height: widget.height,
              zIndex: 1800 + (widget.zIndex || 1),
              background: 'rgba(4, 8, 16, 0.94)',
              border: '1px solid rgba(0, 229, 255, 0.32)',
              boxShadow: '0 18px 44px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(0, 229, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              overflow: 'hidden',
              borderRadius: '10px'
            }}
          >
            <div
              onMouseDown={(event) => {
                event.preventDefault();
                focusFloatingFeedWidget(widget.id);
                widgetInteractionRef.current = {
                  type: 'move',
                  widgetId: widget.id,
                  pointerStartX: event.clientX,
                  pointerStartY: event.clientY,
                  startX: widget.x,
                  startY: widget.y,
                  width: widget.width,
                  height: widget.height
                };
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                cursor: 'move',
                background: 'rgba(8, 12, 20, 0.9)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="mono text-cyan" style={{ fontSize: '11px' }}>UAV_{liveWidgetFeed.id}</span>
                <span className="mono text-muted" style={{ fontSize: '9px' }}>FLOATING_FEED_WIDGET</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {Object.entries(VISION_MODES).map(([modeKey, mode]) => (
                  <button
                    key={`${widget.id}-${modeKey}`}
                    type="button"
                    onClick={() => updateFloatingFeedWidget(widget.id, { visionMode: modeKey })}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '999px',
                      border: (widget.visionMode || 'EO') === modeKey ? '1px solid var(--cyan-primary)' : '1px solid rgba(255,255,255,0.18)',
                      background: (widget.visionMode || 'EO') === modeKey ? 'rgba(0,229,255,0.14)' : 'rgba(255,255,255,0.02)',
                      color: (widget.visionMode || 'EO') === modeKey ? 'var(--cyan-primary)' : '#d8e6f5',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      cursor: 'pointer'
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => updateFloatingFeedWidget(widget.id, { aiHudEnabled: !widget.aiHudEnabled })}
                  style={{
                    marginLeft: '2px',
                    border: widget.aiHudEnabled ? '1px solid var(--cyan-primary)' : '1px solid rgba(255,255,255,0.18)',
                    background: widget.aiHudEnabled ? 'rgba(0,229,255,0.14)' : 'rgba(255,255,255,0.02)',
                    color: widget.aiHudEnabled ? 'var(--cyan-primary)' : '#d8e6f5',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    padding: '5px 8px',
                    cursor: 'pointer'
                  }}
                >
                  AI HUD
                </button>
                <button
                  type="button"
                  onClick={() => closeFloatingFeedWidget(widget.id)}
                  style={{
                    marginLeft: '4px',
                    border: '1px solid rgba(255,107,0,0.5)',
                    background: 'rgba(255,107,0,0.08)',
                    color: 'var(--orange-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: 1,
                    padding: '5px 9px',
                    cursor: 'pointer'
                  }}
                >
                  X
                </button>
              </div>
            </div>
            <div style={{ position: 'relative', width: '100%', height: `calc(100% - 49px)` }}>
              {!widgetCanPlay ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle at center, rgba(18, 28, 40, 0.75), rgba(3, 6, 12, 1))',
                  color: 'rgba(255,255,255,0.78)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  letterSpacing: '0.14em'
                }}>
                  {widgetMissionAssigned ? 'MISSION_LINK_READY' : 'NO ACTIVE FLIGHT MISSION'}
                </div>
              ) : (
                <video
                  ref={(node) => {
                    if (node) widgetVideoRefs.current[widget.id] = node;
                    else delete widgetVideoRefs.current[widget.id];
                  }}
                  src={liveWidgetFeed.videoSrc}
                  autoPlay
                  loop={false}
                  muted
                  playsInline
                  onLoadedMetadata={(e) => seekFeedToStoredTime(liveWidgetFeed.id, e.currentTarget, widget.playbackTime ?? 0)}
                  onTimeUpdate={(e) => syncFeedPlaybackTime(liveWidgetFeed.id, e.currentTarget)}
                  onEnded={(e) => freezeFeedAtLastFrame(liveWidgetFeed.id, e.currentTarget)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: getVisionMode(widget.visionMode || 'EO').filter }}
                />
              )}
              {widget.aiHudEnabled && widgetCanPlay && (
                <VideoAiHudOverlay detections={widgetDetections} />
              )}
              <div style={{ position: 'absolute', inset: 0, padding: '12px', pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="flex-between">
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--cyan-primary)', background: 'rgba(0,0,0,0.72)', padding: '2px 6px' }}>UAV_{liveWidgetFeed.id}</span>
                  <span className="mono" style={{ fontSize: '9px', color: '#fff', background: 'rgba(0,128,96,0.72)', padding: '2px 6px' }}>
                    {widgetCanPlay ? 'NORMAL' : 'MISSION_HOLD'}
                  </span>
                </div>
                <div className="flex-between" style={{ alignItems: 'flex-end' }}>
                  <div style={{ background: 'rgba(0,0,0,0.58)', padding: '8px 10px', borderLeft: '2px solid var(--cyan-primary)' }}>
                    <div className="mono text-main" style={{ fontSize: '11px' }}>LAT: {liveWidgetFeed.lat.toFixed(6)}</div>
                    <div className="mono text-main" style={{ fontSize: '11px' }}>LNG: {liveWidgetFeed.lng.toFixed(6)}</div>
                    <div className="mono text-main" style={{ fontSize: '11px' }}>ALT: {formatAltitude(liveWidgetFeed.alt ?? 0)}</div>
                    <div className="mono text-main" style={{ fontSize: '11px' }}>FPS: 29.97</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span className="display text-orange" style={{ fontSize: '26px' }}>{liveWidgetFeed.pwr.toFixed(1)}%</span>
                    <span className="mono text-muted" style={{ fontSize: '10px' }}>BATTERY</span>
                  </div>
                </div>
              </div>
              <div
                onMouseDown={(event) => {
                  event.preventDefault();
                  focusFloatingFeedWidget(widget.id);
                  widgetInteractionRef.current = {
                    type: 'resize',
                    widgetId: widget.id,
                    pointerStartX: event.clientX,
                    pointerStartY: event.clientY,
                    startWidth: widget.width,
                    startHeight: widget.height,
                    startX: widget.x,
                    startY: widget.y
                  };
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  bottom: '8px',
                  width: '16px',
                  height: '16px',
                  borderRight: '2px solid var(--cyan-primary)',
                  borderBottom: '2px solid var(--cyan-primary)',
                  cursor: 'nwse-resize',
                  pointerEvents: 'auto'
                }}
              />
            </div>
          </div>
        );
      })}
      
      {/* Theater Mode Overlay */}
      {liveEnlargedFeed && (
        <div className="theater-mode-overlay" onClick={() => setEnlargedFeed(null)}>
           <div className="theater-window" onClick={e => e.stopPropagation()}>
	              <div className="video-hud-overlay" style={{ padding: '20px', zIndex: 10 }}>
	                 <div className="flex-between">
	                    <div className="flex-column">
	                       <span className="display text-cyan" style={{ fontSize: '24px' }}>UAV_{liveEnlargedFeed.id}</span>
	                       <span className="mono text-muted">TACTICAL_RECON_FEED // {getVisionMode(liveEnlargedFeed.visionMode).title}</span>
	                    </div>
	                    <button className="btn btn-alert" onClick={() => setEnlargedFeed(null)} style={{ padding: '8px 16px', pointerEvents: 'auto' }}>CLOSE_FEED [X]</button>
	                 </div>
	                 <div style={{ display: 'flex', gap: '8px', marginTop: '14px', pointerEvents: 'auto', flexWrap: 'wrap' }}>
	                    {Object.entries(VISION_MODES).map(([modeKey, mode]) => {
	                      const isActive = (liveEnlargedFeed.visionMode || 'EO') === modeKey;
	                      return (
	                        <button
	                          key={modeKey}
	                          type="button"
	                          onClick={() => setEnlargedFeed(prev => prev ? { ...prev, visionMode: modeKey } : prev)}
	                          style={{
	                            display: 'inline-flex',
	                            alignItems: 'center',
	                            gap: '8px',
	                            padding: '8px 12px',
	                            borderRadius: '999px',
	                            border: isActive ? '1px solid var(--cyan-primary)' : '1px solid rgba(255,255,255,0.18)',
	                            background: isActive ? 'rgba(0, 229, 255, 0.14)' : 'rgba(5, 10, 16, 0.78)',
	                            color: isActive ? 'var(--cyan-primary)' : '#d8e6f5',
	                            fontFamily: 'var(--font-mono)',
	                            fontSize: '10px',
	                            letterSpacing: '0.08em',
	                            cursor: 'pointer'
	                          }}
	                        >
	                          <span style={{
	                            width: '22px',
	                            height: '22px',
	                            borderRadius: '999px',
	                            display: 'inline-flex',
	                            alignItems: 'center',
	                            justifyContent: 'center',
	                            border: '1px solid currentColor',
	                            fontSize: '9px'
	                          }}>
	                            {mode.label}
	                          </span>
	                          <span>{mode.title}</span>
	                        </button>
	                      );
	                    })}
	                 </div>
	                 <div className="flex-between" style={{ marginTop: 'auto' }}>
	                    <div className="flex-column" style={{ background: 'rgba(0,0,0,0.6)', padding: '10px', borderLeft: '3px solid var(--cyan-primary)' }}>
	                       <span className="mono text-main">LAT: {liveEnlargedFeed.lat.toFixed(6)}</span>
	                       <span className="mono text-main">LNG: {liveEnlargedFeed.lng.toFixed(6)}</span>
	                       <span className="mono text-main">ALT: {formatAltitude(liveEnlargedFeed.alt ?? 120)}</span>
	                       <span className="mono text-main">FPS: 29.97</span>
	                    </div>
                    <div className="flex-column" style={{ alignItems: 'flex-end' }}>
                       <span className="display text-orange" style={{ fontSize: '32px' }}>{liveEnlargedFeed.pwr.toFixed(1)}%</span>
                       <span className="mono text-muted">BATTERY_REMAINING</span>
                    </div>
                 </div>
              </div>
	              {!enlargedFeedCanPlay ? (
	                <div
	                  className="drone-vid-bg"
	                  style={{
	                    display: 'flex',
	                    alignItems: 'center',
	                    justifyContent: 'center',
	                    background: 'radial-gradient(circle at center, rgba(18, 28, 40, 0.75), rgba(3, 6, 12, 1))',
	                    color: 'rgba(255,255,255,0.78)',
	                    fontFamily: 'var(--font-mono)',
	                    fontSize: '18px',
	                    letterSpacing: '0.18em'
	                  }}
	                >
	                  {enlargedFeedMissionAssigned ? 'MISSION_LINK_READY' : 'NO ACTIVE FLIGHT MISSION'}
	                </div>
	              ) : (
	                <video 
	                   ref={enlargedVideoRef}
	                   src={liveEnlargedFeed.videoSrc || droneVideoMap[liveEnlargedFeed.id] || droneVideoMap['01']} 
	                   autoPlay
                     loop={false}
	                   muted
	                   playsInline 
	                   onLoadedMetadata={(e) => {
	                     const resumeTime = liveEnlargedFeed.playbackTime ?? 0;
	                     seekFeedToStoredTime(liveEnlargedFeed.id, e.currentTarget, resumeTime);
	                   }}
	                   onTimeUpdate={(e) => syncFeedPlaybackTime(liveEnlargedFeed.id, e.currentTarget)}
	                   onEnded={(e) => freezeFeedAtLastFrame(liveEnlargedFeed.id, e.currentTarget)}
	                   className="drone-vid-bg"
	                   style={{ filter: getVisionMode(liveEnlargedFeed.visionMode).filter }}
	                />
	              )}
              <div className="map-scanlines" style={{ opacity: 0.2 }}></div>
              <div className="theater-hud-main">
                 <div className="artificial-horizon"></div>
              </div>
           </div>
        </div>
      )}
      
      </div>

    </div>
  );
}
