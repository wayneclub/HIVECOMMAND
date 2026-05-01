import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, CircleMarker, Polygon, Popup, useMapEvents, useMap, Tooltip, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import { useMission } from '../context/MissionContext';
import VoiceControlFAB from '../components/VoiceControlFAB';
import DeckGLMap from '../components/DeckGLMap';

const WeatherHUD = () => null; // Deprecated, moved to Top Bar

const TacticalHUDOverlay = () => null; // Deprecated, moved to Top Bar

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
    let targetZoom = null;
    
    if (normalizedFocusDrone) {
      targetIdentifier = `drone-${normalizedFocusDrone.droneId}`;
      if (normalizedFocusDrone.swarmId) {
        const swarm = telemetry.swarms.find(s => s.id === normalizedFocusDrone.swarmId);
        target = swarm?.drones.find(d => d.id === normalizedFocusDrone.droneId);
        targetZoom = 18; // auto-zoom in significantly on the drone
      } else {
        target = telemetry.unassignedDrones?.find(d => d.id === normalizedFocusDrone.droneId);
        targetZoom = 18;
      }
    } else if (lastAIParsedCommand) {
      targetIdentifier = `swarm-${lastAIParsedCommand.swarmId}`;
      target = telemetry.swarms.find(s => s.id === lastAIParsedCommand.swarmId);
      targetZoom = 16;
    } else if (targetLock && targetLock.assignedSwarm) {
      targetIdentifier = `swarm-${targetLock.assignedSwarm}`;
      target = telemetry.swarms.find(s => s.id === targetLock.assignedSwarm);
      targetZoom = 16;
    }

    if (target) {
      const lat = target.lat || target.baseLat;
      const lng = target.lng || target.baseLng;
      const nextPositionKey = `${lat.toFixed(6)}:${lng.toFixed(6)}`;
      
      // If we selected a NEW target, initiate a smooth cinematic flyTo
      if (targetIdRef.current !== targetIdentifier) {
        targetIdRef.current = targetIdentifier;
        lastTrackedPositionRef.current = nextPositionKey;
        isFlyingRef.current = true; // Synchronously block panTo
        if (releaseFlightRef.current) {
          window.clearTimeout(releaseFlightRef.current);
        }
        const currentZoom = map.getZoom();
        const zoom = Math.max(currentZoom, targetZoom || 16);
        map.flyTo([lat, lng], zoom, { duration: 1.2, easeLinearity: 0.18, animate: true });
        releaseFlightRef.current = window.setTimeout(() => {
          isFlyingRef.current = false;
        }, 1250);
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
    updateDroneAlt,
    updateSwarmAlt,
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
  const [editingSwarmId, setEditingSwarmId] = useState(null);
  const [altitudeDrafts, setAltitudeDrafts] = useState({});
  const [maximizedFeed, setMaximizedFeed] = useState(null);
  const mapCenter = useMemo(() => globalMapCenter, [globalMapCenter]);
  const droneCardRefs = React.useRef({});
  const selectionInteractionRef = React.useRef(0);

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
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: '#040810', position: 'relative' }}>
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
                            value={altitudeDrafts[`swarm-${s.id}`] ?? altitudeToDisplayValue(s.targetAlt ?? s.alt)}
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
                         <span className="mono text-main" style={{ fontSize: '10px' }}>{unitSystem === 'imperial' ? 'ft' : 'm'} | SPD: {formatSpeed(s.speed, { includeUnit: false })}{unitSystem === 'imperial' ? 'mph' : 'kph'}</span>
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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                                    <span className="mono text-muted" style={{ fontSize: '9px' }}>ALT:</span>
                                    <input 
                                      value={altitudeDrafts[`drone-${d.id}`] ?? altitudeToDisplayValue(d.targetAlt ?? d.alt ?? s.targetAlt ?? s.alt)}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                                <span className="mono text-muted" style={{ fontSize: '9px' }}>ALT:</span>
                                <input 
                                  value={altitudeDrafts[`drone-${d.id}`] ?? altitudeToDisplayValue(d.targetAlt ?? d.alt ?? 120)}
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
                              style={{ flex: '1', padding: '6px', fontSize: '10px', border: '1px solid var(--cyan-primary)', background: 'rgba(0,229,255,0.1)', color: 'var(--cyan-primary)', cursor: 'pointer' }}
                           >
                             DEPLOY SWARM {normalizedFocusDrone.swarmId}
                           </button>
                         )}
                         <button 
                            onClick={() => prepareManualReview(normalizedFocusDrone.swarmId, targetLock.waypoints, normalizedFocusDrone.droneId)}
                            className="btn-primary" 
                            style={{ flex: '1', padding: '6px', fontSize: '10px', border: '1px solid var(--orange-primary)', background: 'rgba(255,107,0,0.1)', color: 'var(--orange-primary)', cursor: 'pointer', fontWeight: 'bold' }}
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
                           style={{ flex: '1 0 45%', padding: '6px', fontSize: '10px', border: '1px solid var(--cyan-primary)', background: 'rgba(0,229,255,0.1)', color: 'var(--cyan-primary)', cursor: 'pointer' }}
                        >
                          REVIEW_S{s.id}
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
              setTargetLock={setTargetLock} 
              isTargeting={isTargeting} 
              setFocusDrone={setFocusDrone}
              focusDrone={focusDrone}
              setAutoTrack={setAutoTrack}
              autoTrack={autoTrack}
              unitSystem={unitSystem}
              onSelectionInteraction={registerSelectionInteraction}
            />
          ) : (
            <MapContainer center={mapCenter} zoom={15} zoomControl={false} style={{ width: '100%', height: '100%' }}>
              <TileLayer 
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" 
                maxZoom={22} 
                maxNativeZoom={20} 
                detectRetina={true} 
              />
              <MapInstanceHook />
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
                const radiusDeg = (isExpanded ? 100 : 50) / 111000;
                const labelLat = swarm.baseLat - radiusDeg - 0.00008;
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
                      center={[swarm.baseLat, swarm.baseLng]} 
                      radius={isExpanded ? 100 : 50} 
                      pathOptions={{ color: swarm.color, fillColor: swarm.color, fillOpacity: 0.2 }}
                      interactive={false}
                    />
                    <Marker
                      position={[labelLat, swarm.baseLng]}
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
                        positions={[[swarm.baseLat, swarm.baseLng], ...swarm.waypoints.map(w => [w.lat, w.lng])]}
                        pathOptions={{ color: swarm.color, weight: 1, dashArray: '5 5', opacity: 0.5 }}
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
               {telemetry.swarms.flatMap(s => s.drones).concat(telemetry.unassignedDrones || []).slice(0, 6).map((d, idx) => {
                 // Stream highly stable real aerial satellite footage (No Cloudflare/CORS blocking)
                 // The CSS filters applied below will create distinct optical illusions (EO, IR, NV)
                 const videoUrls = [
                   "https://labs.mapbox.com/bites/00188/patricia_nasa.mp4",
                   "https://labs.mapbox.com/bites/00188/patricia_nasa.mp4",
                   "https://labs.mapbox.com/bites/00188/patricia_nasa.mp4"
                 ];
                 const videoSrc = videoUrls[idx % videoUrls.length];
                 
                 // Apply tactical filters based on drone ID
                 let filter = "none";
                 let modeLabel = "EO_RECON";
               if (idx % 3 === 1) {
                  filter = "grayscale(1) invert(1) contrast(1.5)";
                  modeLabel = "IR_THERMAL";
                } else if (idx % 3 === 2) {
                  filter = "sepia(1) hue-rotate(90deg) brightness(1.2) contrast(1.2)";
                  modeLabel = "NV_NIGHT";
                }
                const isFocusedFeed = normalizedFocusDrone?.droneId === d.id;

                 return (
                   <div 
                      key={d.id} 
                      className="video-feed-card" 
                      onClick={() => {
                        const ownerSwarm = telemetry.swarms.find(s => s.drones.some(dr => dr.id === d.id));
                        setFocusDrone({ swarmId: ownerSwarm?.id || null, droneId: d.id, forcePopup: null });
                        setAutoTrack(true);
                      }}
                      onDoubleClick={() => setEnlargedFeed({...d, videoSrc, filter})}
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
                      <video 
                        src={videoSrc} 
                        autoPlay loop muted playsInline
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover', 
                          filter: filter,
                          position: 'relative',
                          zIndex: 1
                        }}
                      />
                      <div className="video-noise" style={{ zIndex: 2 }}></div>
                      <div className="video-hud-overlay" style={{ zIndex: 10 }}>
                         <div className="flex-between">
                            <span className="mono" style={{ fontSize: '9px', color: 'var(--cyan-primary)', background: 'rgba(0,0,0,0.7)', padding: '1px 4px' }}>UAV_{d.id}</span>
                            <span className="mono" style={{ fontSize: '8px', color: '#fff', background: 'rgba(255,0,0,0.6)', padding: '1px 3px' }}>{modeLabel}</span>
                         </div>
                         <div className="flex-between" style={{ alignItems: 'flex-end' }}>
                            <div className="flex-column" style={{ gap: '2px' }}>
                               <span className="mono" style={{ fontSize: '7px', color: '#fff', textShadow: '1px 1px 2px #000' }}>LAT: {d.lat.toFixed(4)}</span>
                               <span className="mono" style={{ fontSize: '7px', color: '#fff', textShadow: '1px 1px 2px #000' }}>LNG: {d.lng.toFixed(4)}</span>
                            </div>
                            <span className="mono" style={{ fontSize: '8px', color: 'var(--cyan-primary)', textShadow: '1px 1px 2px #000' }}>HDG: {Math.floor(Math.random()*360)}°</span>
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>
         </div>
         
         {/* System Logs Section */}
         <div style={{ height: '300px', padding: '20px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)' }}>
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
      </div>
      
      {/* Theater Mode Overlay */}
      {enlargedFeed && (
        <div className="theater-mode-overlay" onClick={() => setEnlargedFeed(null)}>
           <div className="theater-window" onClick={e => e.stopPropagation()}>
              <div className="video-hud-overlay" style={{ padding: '20px', zIndex: 10 }}>
                 <div className="flex-between">
                    <div className="flex-column">
                       <span className="display text-cyan" style={{ fontSize: '24px' }}>UAV_{enlargedFeed.id}</span>
                       <span className="mono text-muted">TACTICAL_RECON_FEED // ACTIVE_LINK</span>
                    </div>
                    <button className="btn btn-alert" onClick={() => setEnlargedFeed(null)} style={{ padding: '8px 16px', pointerEvents: 'auto' }}>CLOSE_FEED [X]</button>
                 </div>
                 <div className="flex-between" style={{ marginTop: 'auto' }}>
                    <div className="flex-column" style={{ background: 'rgba(0,0,0,0.6)', padding: '10px', borderLeft: '3px solid var(--cyan-primary)' }}>
                       <span className="mono text-main">LAT: {enlargedFeed.lat.toFixed(6)}</span>
                       <span className="mono text-main">LNG: {enlargedFeed.lng.toFixed(6)}</span>
                       <span className="mono text-main">ALT: {formatAltitude(enlargedFeed.alt ?? 120)}</span>
                    </div>
                    <div className="flex-column" style={{ alignItems: 'flex-end' }}>
                       <span className="display text-orange" style={{ fontSize: '32px' }}>{enlargedFeed.pwr.toFixed(1)}%</span>
                       <span className="mono text-muted">BATTERY_REMAINING</span>
                    </div>
                 </div>
              </div>
              <video 
                 src={enlargedFeed.videoSrc || "https://labs.mapbox.com/bites/00188/patricia_nasa.mp4"} 
                 autoPlay loop muted playsInline 
                 className="drone-vid-bg"
                 style={{ filter: enlargedFeed.filter || "none" }}
              />
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
