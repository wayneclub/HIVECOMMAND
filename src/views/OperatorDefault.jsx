import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, CircleMarker, Polygon, Popup, useMapEvents, useMap, Tooltip, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import { useMission } from '../context/MissionContext';
import VoiceControlFAB from '../components/VoiceControlFAB';
import DeckGLMap from '../components/DeckGLMap';

const WeatherHUD = () => null; // Deprecated, moved to Top Bar

const TacticalHUDOverlay = () => null; // Deprecated, moved to Top Bar

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

function DroneMarker({ drone, swarmColor, isFocused, onFocus, forcePopupTime, isIndependent }) {
  const markerRef = React.useRef(null);
  const map = useMap();
  const [zoom, setZoom] = React.useState(map.getZoom());

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => { map.off('zoomend', handleZoom); };
  }, [map]);

  useEffect(() => {
    if (forcePopupTime && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [forcePopupTime]);

  // Dynamically calculate size based on zoom level (e.g., zoom 15 = 12px, zoom 18 = 24px)
  const baseSize = Math.max(6, (zoom - 12) * 4);
  const finalSize = isFocused ? baseSize * 1.5 : baseSize;
  const iconHtml = `
    <svg width="${finalSize}" height="${finalSize}" viewBox="0 0 24 24" fill="none" stroke="${swarmColor}" stroke-width="${isFocused ? '2.5' : '1.5'}" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 ${isFocused ? '4px' : '1px'} ${swarmColor}); transition: all 0.2s;">
      <circle cx="12" cy="12" r="3" fill="${isFocused ? '#ffffff' : swarmColor}" />
      <path d="M12 2v6" />
      <path d="M12 16v6" />
      <path d="M2 12h6" />
      <path d="M16 12h6" />
    </svg>
  `;
  const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [finalSize, finalSize], iconAnchor: [finalSize / 2, finalSize / 2] });

  return (
    <Marker 
      ref={markerRef}
      position={[drone.lat, drone.lng]} 
      icon={icon}
      eventHandlers={{
        click: () => {
          if (onFocus) onFocus();
          if (markerRef.current) markerRef.current.openPopup();
        },
        dblclick: (e) => {
           e.target.openPopup();
        }
      }}
    >
      <Popup className="tech-popup" autoPan={false}>
        <div style={{ background: 'rgba(8, 12, 20, 0.95)', border: `1px solid ${swarmColor}`, padding: '12px', minWidth: '140px', backdropFilter: 'blur(4px)' }}>
          <div style={{ borderBottom: `1px solid ${swarmColor}`, paddingBottom: '4px', marginBottom: '8px' }}>
            <span className="mono" style={{ fontSize: '12px', fontWeight: 'bold', color: swarmColor }}>UAV_{drone.id}</span>
          </div>
          <div className="flex-column" style={{ gap: '4px' }}>
            <span className="mono text-main" style={{ fontSize: '10px' }}>PWR: {drone.pwr.toFixed(1)}%</span>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>LAT: {drone.lat.toFixed(5)}</span>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>LNG: {drone.lng.toFixed(5)}</span>
          </div>
        </div>
      </Popup>

      {/* Persistent HUD Label for focused drone using a high-visibility Marker */}
      {(isFocused || isIndependent) && (
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
    </Marker>
  );
}

function MapEventsListener({ setAutoTrack, isTargeting, onMapClick }) {
  useMapEvents({
    dragstart: () => setAutoTrack(false),
    click: (e) => {
      if (isTargeting) {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

function MapTracker({ isTargeting, autoTrack }) {
  const map = useMap();
  const { telemetry, targetLock, focusDrone, lastAIParsedCommand } = useMission();
  
  useEffect(() => {
    if (isTargeting || !autoTrack) return;
    
    let target = null;
    if (focusDrone) {
      const swarm = telemetry.swarms.find(s => s.id === focusDrone.swarmId);
      target = swarm?.drones.find(d => d.id === focusDrone.droneId);
    } else if (lastAIParsedCommand) {
      target = telemetry.swarms.find(s => s.id === lastAIParsedCommand.swarmId);
    } else if (targetLock && targetLock.assignedSwarm) {
      target = telemetry.swarms.find(s => s.id === targetLock.assignedSwarm);
    }

    if (target) {
      let targetZoom = map.getZoom();
      // Auto-zoom in significantly if focusing on a precise drone and currently zoomed out
      if (focusDrone && targetZoom < 17) {
        targetZoom = 17;
      }
      map.setView([target.lat || target.baseLat, target.lng || target.baseLng], targetZoom, { animate: true });
    }
  }, [map, telemetry, focusDrone, targetLock, lastAIParsedCommand, isTargeting, autoTrack]);

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

  const activeSwarm = focusDrone?.swarmId ? telemetry.swarms?.find(s => s.id === focusDrone.swarmId) : telemetry.swarms?.[0];
  const activeDrone = focusDrone ? 
    (focusDrone.swarmId ? activeSwarm?.drones?.find(d => d.id === focusDrone.droneId) : telemetry.unassignedDrones?.find(d => d.id === focusDrone.droneId)) 
    : null;
  const displayUnit = activeDrone ? {
    ...activeDrone,
    speed: activeDrone.speed ?? activeSwarm?.speed ?? 0,
    alt: activeDrone.alt ?? activeSwarm?.alt ?? 0,
    heading: activeDrone.waypoints?.length > 0 ? "LOCK" : (activeSwarm?.heading || 300)
  } : activeSwarm;

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
        <div style={{ 
          display: 'flex', 
          gap: '24px', 
          alignItems: 'center', 
          border: '1px solid rgba(0, 229, 255, 0.4)', 
          padding: '8px 24px', 
          background: 'rgba(4, 8, 16, 0.85)', 
          borderRadius: '4px', 
          boxShadow: '0 0 20px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(0, 229, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'auto'
        }}>
          {/* Selected Unit Section */}
          <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: displayUnit?.color || 'var(--cyan-primary)', boxShadow: `0 0 10px ${displayUnit?.color || 'var(--cyan-primary)'}` }}></div>
             <span className="mono" style={{ fontSize: '13px', color: 'var(--cyan-primary)', letterSpacing: '1px', fontWeight: 'bold' }}>
                UAV: <span style={{ color: '#fff' }}>{displayUnit?.id ? `ALPHA_${displayUnit.id}` : (displayUnit?.name || '---')}</span>
             </span>
          </div>

          {/* Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2"><path d="m12 14 4-4-4-4M3 3.4c3 3 5.6 3 8.5 3.1M3 20.6c3-3 5.6-3 8.5-3.1"/><path d="M16 10h5M21 10l-2 2M21 10l-2-2"/></svg>
            <span className="mono" style={{ fontSize: '18px', color: '#fff' }}>{Math.round(displayUnit?.speed || 0)}<small style={{ fontSize: '11px', opacity: 0.5, marginLeft: '2px' }}>KPH</small></span>
          </div>
          
          {/* Altitude */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2"><path d="M21 10c-3-3-5-4.5-9-4.5s-6 1.5-9 4.5M21 16c-3-3-5-4.5-9-4.5s-6 1.5-9 4.5"/><path d="M12 11v10M9 18l3 3 3-3"/></svg>
            <span className="mono" style={{ fontSize: '18px', color: '#fff' }}>{Math.round(displayUnit?.alt || 0)}<small style={{ fontSize: '11px', opacity: 0.5, marginLeft: '2px' }}>M</small></span>
          </div>
          
          {/* Heading */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2 2-4.2 4.2-2 2 2-2 4.2-4.2 2-2z"/><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>
            <span className="mono" style={{ fontSize: '18px', color: '#fff' }}>{displayUnit?.heading || 300}°</span>
          </div>
          
          {/* Wind */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="2"><path d="M17.7 7.7A7.1 7.1 0 1 1 5 8"/><path d="M7 21l3-3-3-3M21 21l-3-3 3-3"/><path d="M3 13h18"/><path d="M12 8V3l3 3M9 6l3-3"/></svg>
            <span className="mono" style={{ fontSize: '18px', color: '#fff' }}>{lastAIParsedCommand?.missionWeather?.wind || '12 KPH NW'}</span>
          </div>
        </div>
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
                        if (!isExpanded) toggleSwarmExpand(s.id, true);
                      }}
                      className="flex-column" 
                      style={{ gap: '8px', padding: '12px', border: '1px solid var(--border-color)', background: focusDrone?.swarmId === s.id ? 'rgba(0,229,255,0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
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
                            value={altitudeDrafts[`swarm-${s.id}`] ?? String(Math.round(s.targetAlt ?? s.alt))}
                            type="number" 
                            onChange={(e) => setAltitudeDraft(`swarm-${s.id}`, e.target.value)}
                            onBlur={(e) => commitAltitudeDraft(`swarm-${s.id}`, e.target.value, s.targetAlt ?? s.alt, (value) => updateSwarmAlt(s.id, value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                commitAltitudeDraft(`swarm-${s.id}`, e.currentTarget.value, s.targetAlt ?? s.alt, (value) => updateSwarmAlt(s.id, value));
                                e.target.blur();
                              } else if (e.key === 'Escape') {
                                clearAltitudeDraft(`swarm-${s.id}`);
                                e.target.blur();
                              }
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '40px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--cyan-primary)', fontSize: '10px', padding: '1px 2px', fontFamily: 'monospace', outline: 'none', textAlign: 'center' }}
                         />
                         <span className="mono text-main" style={{ fontSize: '10px' }}>m | SPD: {s.speed.toFixed(0)}kph</span>
                      </div>
                    </div>
                   
                   {isExpanded && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0 0 0', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                        {s.drones.map(d => (
                             <div  
                                key={d.id}
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
                                  border: `1px solid ${focusDrone?.droneId === d.id ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.1)'}`, 
                                  background: focusDrone?.droneId === d.id ? 'rgba(0,229,255,0.1)' : 'transparent', 
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
                                      value={altitudeDrafts[`drone-${d.id}`] ?? String(Math.round(d.targetAlt ?? d.alt ?? s.targetAlt ?? s.alt))}
                                      type="number" 
                                      onChange={(e) => setAltitudeDraft(`drone-${d.id}`, e.target.value)}
                                      onBlur={(e) => commitAltitudeDraft(`drone-${d.id}`, e.target.value, d.targetAlt ?? d.alt ?? s.targetAlt ?? s.alt, (value) => updateDroneAlt(d.id, value))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          commitAltitudeDraft(`drone-${d.id}`, e.currentTarget.value, d.targetAlt ?? d.alt ?? s.targetAlt ?? s.alt, (value) => updateDroneAlt(d.id, value));
                                          e.target.blur();
                                        } else if (e.key === 'Escape') {
                                          clearAltitudeDraft(`drone-${d.id}`);
                                          e.target.blur();
                                        }
                                      }}
                                      style={{ width: '35px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--orange-primary)', fontSize: '9px', padding: '1px 2px', fontFamily: 'monospace', outline: 'none', textAlign: 'center' }}
                                    />
                                    <span className="mono text-muted" style={{ fontSize: '9px' }}>m</span>
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
                <div className="flex-column" style={{ gap: '8px', padding: '12px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                   <div className="flex-between" style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                     <span className="mono" style={{ fontSize: '12px', color: '#fff' }}>INDEPENDENT UNITS</span>
                     <span className="mono text-muted" style={{ fontSize: '10px' }}>{telemetry.unassignedDrones.length} ACTIVE</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {telemetry.unassignedDrones.map(d => (
                         <div  
                            key={d.id}
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
                              border: `1px solid ${focusDrone?.droneId === d.id ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.1)'}`, 
                              background: focusDrone?.droneId === d.id ? 'rgba(0,229,255,0.1)' : 'transparent', 
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
                                  value={altitudeDrafts[`drone-${d.id}`] ?? String(Math.round(d.targetAlt ?? d.alt ?? 120))}
                                  type="number" 
                                  onChange={(e) => setAltitudeDraft(`drone-${d.id}`, e.target.value)}
                                  onBlur={(e) => commitAltitudeDraft(`drone-${d.id}`, e.target.value, d.targetAlt ?? d.alt ?? 120, (value) => updateDroneAlt(d.id, value))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      commitAltitudeDraft(`drone-${d.id}`, e.currentTarget.value, d.targetAlt ?? d.alt ?? 120, (value) => updateDroneAlt(d.id, value));
                                      e.target.blur();
                                    } else if (e.key === 'Escape') {
                                      clearAltitudeDraft(`drone-${d.id}`);
                                      e.target.blur();
                                    }
                                  }}
                                  style={{ width: '35px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--orange-primary)', fontSize: '9px', padding: '1px 2px', fontFamily: 'monospace', outline: 'none', textAlign: 'center' }}
                                />
                                <span className="mono text-muted" style={{ fontSize: '9px' }}>m</span>
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
                onClick={() => setIsTargeting(!isTargeting)}
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
                    {focusDrone ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                         <button 
                            onClick={() => prepareManualReview(focusDrone.swarmId, targetLock.waypoints)}
                            className="btn-primary" 
                            style={{ flex: '1', padding: '6px', fontSize: '10px', border: '1px solid var(--cyan-primary)', background: 'rgba(0,229,255,0.1)', color: 'var(--cyan-primary)', cursor: 'pointer' }}
                         >
                           REVIEW_S{focusDrone.swarmId}
                         </button>
                         <button 
                            onClick={() => prepareManualReview(focusDrone.swarmId, targetLock.waypoints, focusDrone.droneId)}
                            className="btn-primary" 
                            style={{ flex: '1', padding: '6px', fontSize: '10px', border: '1px solid var(--orange-primary)', background: 'rgba(255,107,0,0.1)', color: 'var(--orange-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                         >
                           REVIEW_D{focusDrone.droneId}
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
              <MapEventsListener setAutoTrack={setAutoTrack} isTargeting={isTargeting} onMapClick={handleMapClick} />
              <MapTracker isTargeting={isTargeting} autoTrack={autoTrack} />
              <ScaleControl position="bottomleft" imperial={false} />
              
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
                      eventHandlers={{ 
                        dblclick: () => toggleSwarmExpand(swarm.id),
                        click: () => {
                           setFocusDrone({ swarmId: swarm.id, droneId: swarm.drones[0]?.id });
                           if (!isExpanded) toggleSwarmExpand(swarm.id, true);
                           setAutoTrack(true);
                        }
                      }}
                    />
                    <Marker
                      position={[labelLat, swarm.baseLng]}
                      icon={labelIcon}
                      interactive={false}
                      zIndexOffset={1000}
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
                    isFocused={focusDrone?.droneId === drone.id} 
                    forcePopupTime={focusDrone?.droneId === drone.id ? focusDrone?.forcePopup : null}
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
                    isIndependent={true}
                    isFocused={focusDrone?.droneId === drone.id} 
                    forcePopupTime={focusDrone?.droneId === drone.id ? focusDrone?.forcePopup : null}
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
                const isFocusedFeed = focusDrone?.droneId === d.id;

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
                       <span className="mono text-main">ALT: {enlargedFeed.alt?.toFixed(0) || 120}m</span>
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
