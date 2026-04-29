import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ScatterplotLayer, PathLayer, LineLayer, TextLayer, PolygonLayer } from '@deck.gl/layers';
import Map, { ScaleControl, useControl, Marker } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import 'maplibre-gl/dist/maplibre-gl.css';

function DeckGLOverlay(props) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

function circlePolygon([lng, lat], radiusMeters, altitudeMeters, points = 48) {
  const earthRadius = 6378137;
  const latRad = (lat * Math.PI) / 180;
  const coordinates = [];

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const dx = Math.cos(angle) * radiusMeters;
    const dy = Math.sin(angle) * radiusMeters;
    const dLat = (dy / earthRadius) * (180 / Math.PI);
    const dLng = (dx / (earthRadius * Math.cos(latRad))) * (180 / Math.PI);
    coordinates.push([lng + dLng, lat + dLat, altitudeMeters]);
  }

  return coordinates;
}

const MAP_STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=en'],
      tileSize: 256,
      maxzoom: 20
    },
    terrain: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      maxzoom: 14
    }
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      paint: {}
    }
  ],
  terrain: {
    source: 'terrain',
    exaggeration: 1.5
  }
};

const DeckGLMap = forwardRef(({ telemetry, targetLock, mapCenter, setTargetLock, isTargeting, setFocusDrone, focusDrone, setAutoTrack, autoTrack }, ref) => {
  const mapRef = React.useRef(null);
  const [viewState, setViewState] = useState({
    longitude: mapCenter[1],
    latitude: mapCenter[0],
    zoom: 15,
    pitch: 60,
    bearing: 30
  });

  useImperativeHandle(ref, () => ({
    zoomIn: () => setViewState(v => ({ ...v, zoom: v.zoom + 1, transitionDuration: 300 })),
    zoomOut: () => setViewState(v => ({ ...v, zoom: v.zoom - 1, transitionDuration: 300 })),
    resetNorth: () => setViewState(v => ({ ...v, bearing: 0, transitionDuration: 500 }))
  }));

  useEffect(() => {
    setViewState(prev => ({ ...prev, longitude: mapCenter[1], latitude: mapCenter[0] }));
  }, [mapCenter]);
  
  // Tactical Auto-Tracking: Center on focused drone
  // 1. Initial focus: Smoothly fly to target
  useEffect(() => {
    if (autoTrack && focusDrone && telemetry.swarms) {
      const swarm = telemetry.swarms.find(s => s.id === focusDrone.swarmId);
      const drone = swarm?.drones.find(d => d.id === focusDrone.droneId);
      if (drone) {
        setViewState(prev => ({
          ...prev,
          longitude: drone.lng,
          latitude: drone.lat,
          transitionDuration: 500
        }));
      }
    }
  }, [focusDrone]); // ONLY trigger on focus change

  // 2. Continuous tracking: Keep centered during flight
  useEffect(() => {
    if (autoTrack && focusDrone && telemetry.swarms) {
      const swarm = telemetry.swarms.find(s => s.id === focusDrone.swarmId);
      const drone = swarm?.drones.find(d => d.id === focusDrone.droneId);
      if (drone) {
        setViewState(prev => ({
          ...prev,
          longitude: drone.lng,
          latitude: drone.lat,
          transitionDuration: 0 // No duration for continuous updates to prevent "locking"
        }));
      }
    }
  }, [telemetry, autoTrack]); // Follow telemetry only if autoTrack is active

  // Helper to convert hex color to RGB array
  const hexToRgb = (hex) => {
    if (!hex) return [0, 229, 255];
    const c = hex.replace('#', '');
    return [parseInt(c.substr(0,2), 16) || 0, parseInt(c.substr(2,2), 16) || 229, parseInt(c.substr(4,2), 16) || 255];
  };

  const getTerrainElevation = (lng, lat) => {
    const terrainMap = mapRef.current?.getMap?.() || mapRef.current;
    if (!terrainMap?.queryTerrainElevation) return 0;

    const sampledElevation = terrainMap.queryTerrainElevation({ lng, lat }, { exaggerated: true });
    return Number.isFinite(sampledElevation) ? sampledElevation : 0;
  };

  const toAglPosition = (lng, lat, altitude = 0, clearance = 0) => {
    const terrainAltitude = getTerrainElevation(lng, lat);
    return [lng, lat, terrainAltitude + altitude + clearance];
  };

  const focusedSwarmId = focusDrone?.swarmId;

  const swarmPoints = telemetry.swarms.map(s => {
    const rgb = hexToRgb(s.color);
    const isFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    // Increase visibility for unselected swarms
    const fillAlpha = hasFocus ? (isFocused ? 40 : 15) : 20;
    const lineAlpha = hasFocus ? (isFocused ? 255 : 120) : 180;
    
    return { 
      position: toAglPosition(s.baseLng, s.baseLat, s.alt || 120, 2),
      color: [...rgb, fillAlpha], 
      lineColor: [...rgb, lineAlpha],
      radius: isFocused ? 18 : 14,
      id: s.id
    };
  });

  const swarmZones = telemetry.swarms.map(s => {
    const rgb = hexToRgb(s.color);
    const isFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    const altitude = s.alt || 120;
    const outerRadius = isFocused ? 120 : 100;
    const innerRadius = outerRadius * 0.4;
    const fillAlpha = hasFocus ? (isFocused ? 36 : 12) : 20;
    const lineAlpha = hasFocus ? (isFocused ? 255 : 120) : 180;
    const renderAltitude = getTerrainElevation(s.baseLng, s.baseLat) + altitude + 1;

    return {
      id: s.id,
      altitude,
      fillColor: [...rgb, fillAlpha],
      lineColor: [...rgb, lineAlpha],
      outerPolygon: circlePolygon([s.baseLng, s.baseLat], outerRadius, renderAltitude),
      innerPolygon: circlePolygon([s.baseLng, s.baseLat], innerRadius, renderAltitude)
    };
  });

  const dronePoints = [
    ...telemetry.swarms.flatMap(s => s.drones.map(d => {
      const isFocused = focusDrone?.droneId === d.id;
      const isSwarmFocused = focusedSwarmId === s.id;
      const hasFocus = !!focusedSwarmId;
      // Increase visibility for unselected drones
      const alpha = hasFocus ? (isSwarmFocused ? (isFocused ? 255 : 200) : 120) : 255;
      
      // Elevate drones to 250m+ to ensure they clear the terrain
      const droneAlt = d.alt || 250;
      const rgb = hexToRgb(s.color);
      
      return {
        position: toAglPosition(d.lng, d.lat, droneAlt, 2),
        color: [...rgb, alpha], 
        radius: isFocused ? 12 : 6,
        id: d.id,
        swarmId: s.id
      };
    })),
    ...(telemetry.unassignedDrones || []).map(d => {
      const isFocused = focusDrone?.droneId === d.id;
      const hasFocus = !!focusDrone;
      const alpha = hasFocus ? (isFocused ? 255 : 120) : 255;
      
      const droneAlt = d.alt || 250;
      return {
        position: toAglPosition(d.lng, d.lat, droneAlt, 2),
        color: [255, 204, 0, alpha], // Amber/Yellow for unassigned
        radius: isFocused ? 12 : 6,
        id: d.id,
        swarmId: null
      };
    })
  ];

  const droneLines = dronePoints.map(d => ({
    sourcePosition: [d.position[0], d.position[1], d.position[2]],
    targetPosition: toAglPosition(d.position[0], d.position[1], 0, 0), // Drop line to local terrain
    color: d.color
  }));

  const targetPoints = targetLock?.waypoints?.map((wp, index) => ({
    position: toAglPosition(wp.lng, wp.lat, 240, 0), // Hover altitude for the pin head
    groundPosition: toAglPosition(wp.lng, wp.lat, 0, 0), // Ground level
    color: [255, 107, 0, 255],
    fillColor: [255, 107, 0, 150],
    radius: 30,
    index: index + 1
  })) || [];

  const paths = telemetry.swarms.filter(s => s.waypoints?.length > 0).map(s => {
    const rgb = hexToRgb(s.color);
    const isFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    const alpha = hasFocus ? (isFocused ? 200 : 80) : 150;
    const altitude = s.alt || 120;
    return {
      path: [
        toAglPosition(s.baseLng, s.baseLat, altitude, 1),
        ...s.waypoints.map(w => toAglPosition(w.lng, w.lat, altitude, 1))
      ],
      color: [...rgb, alpha]
    };
  });

  const layers = [
    new PolygonLayer({
      id: 'swarm-zones-fill',
      data: swarmZones,
      pickable: false,
      stroked: false,
      filled: true,
      extruded: false,
      getPolygon: d => d.outerPolygon,
      getFillColor: d => d.fillColor,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getPolygon: [telemetry.swarms],
        getFillColor: [focusedSwarmId]
      }
    }),
    new PathLayer({
      id: 'swarm-zones-outer-ring',
      data: swarmZones,
      getPath: d => d.outerPolygon,
      getColor: d => d.lineColor,
      getWidth: 2,
      widthMinPixels: 2,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getPath: [telemetry.swarms],
        getColor: [focusedSwarmId]
      }
    }),
    new PathLayer({
      id: 'swarm-zones-inner-ring',
      data: swarmZones,
      getPath: d => d.innerPolygon,
      getColor: d => d.lineColor,
      getWidth: 2,
      widthMinPixels: 2,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getPath: [telemetry.swarms],
        getColor: [focusedSwarmId]
      }
    }),
    new PathLayer({
      id: 'swarm-paths',
      data: paths,
      getPath: d => d.path,
      getColor: d => d.color,
      getWidth: 2,
      widthMinPixels: 2,
      parameters: { depthWriteEnabled: false }
    }),
    new ScatterplotLayer({
      id: 'swarm-centers',
      data: swarmPoints,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 1,
      getPosition: d => d.position,
      getFillColor: d => d.color,
      getLineColor: d => d.lineColor,
      getRadius: d => d.radius,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getPosition: [telemetry.swarms],
        getFillColor: [focusedSwarmId],
        getLineColor: [focusedSwarmId],
        getRadius: [focusedSwarmId]
      }
    }),
    new LineLayer({
      id: 'drone-lines',
      data: droneLines,
      getSourcePosition: d => d.sourcePosition,
      getTargetPosition: d => d.targetPosition,
      getColor: d => [d.color[0], d.color[1], d.color[2], d.color[3] * 0.5],
      getWidth: 2,
      widthMinPixels: 1,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getColor: [focusedSwarmId, focusDrone]
      }
    }),
    new TextLayer({
      id: 'drones-geom',
      data: dronePoints,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 255],
      getPosition: d => d.position,
      getText: d => '■', // NATO standard for friendly unit is a rectangle/square
      getColor: d => d.color,
      getSize: d => d.radius * 3.5, // Scale text size based on focus radius
      fontFamily: 'Arial',
      characterSet: ['■', '◆', '▲'], // Pre-load geometry characters
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getColor: [focusedSwarmId, focusDrone],
        getSize: [focusDrone]
      },
      onClick: (info) => {
        if (info.object && setFocusDrone) {
          setFocusDrone({ swarmId: info.object.swarmId, droneId: info.object.id });
          if (setAutoTrack) setAutoTrack(true);
        }
      }
    }),
    new TextLayer({
      id: 'drones-geom-outline',
      data: dronePoints,
      getPosition: d => d.position,
      getText: d => '□', // Empty square for outline effect
      getColor: d => [255, 255, 255, d.color[3] > 100 ? 255 : 0], // White outline when visible
      getSize: d => d.radius * 3.5,
      fontFamily: 'Arial',
      characterSet: ['□', '◇', '△'],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getColor: [focusedSwarmId, focusDrone],
        getSize: [focusDrone]
      }
    }),
    // Target layers removed in favor of HTML Marker rendering
    new TextLayer({
      id: 'swarm-labels-minimal',
      data: telemetry.swarms.filter(s => s.drones?.length > 0).map(s => {
        const rgb = hexToRgb(s.color);
        // Tighter perspective compensation:
        const pitchRad = (viewState.pitch || 0) * Math.PI / 180;
        const dynamicSouthOffset = 0.0011 + (Math.sin(pitchRad) * 0.0012); 
        
        return {
          position: toAglPosition(s.baseLng - 0.0002, s.baseLat - dynamicSouthOffset, (s.alt || 120) + 30, 0),
          text: s.name || 'SWARM_' + s.id,
          color: rgb
        };
      }),
      getPosition: d => d.position,
      getText: d => d.text,
      getColor: d => d.color,
      getSize: 10,
      fontFamily: 'Arial',
      pixelOffset: [0, 0],
      getTextAnchor: 'end',
      getAlignmentBaseline: 'top',
      background: true,
      getBackgroundColor: [8, 12, 20, 255],
      getBorderColor: d => [d.color[0], d.color[1], d.color[2], 255],
      getBorderWidth: 1,
      backgroundPadding: [4, 8],
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        data: [viewState.pitch, telemetry.swarms]
      }
    }),
    new TextLayer({
      id: 'focused-drone-label-shadow-v3',
      data: dronePoints.filter(d => focusDrone?.droneId === d.id),
      getPosition: d => [d.position[0], d.position[1] + 0.0004, d.position[2] + 20],
      getText: d => `UAV_${d.id}`,
      getColor: [0, 0, 0, 255],
      getSize: 11,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      pixelOffset: [2, 2],
      background: false,
      parameters: { depthWriteEnabled: false },
      updateTriggers: { data: [focusDrone] }
    }),
    new TextLayer({
      id: 'focused-drone-label-v3',
      data: dronePoints.filter(d => focusDrone?.droneId === d.id),
      getPosition: d => [d.position[0], d.position[1] + 0.0004, d.position[2] + 20],
      getText: d => `UAV_${d.id}`,
      getColor: [255, 255, 255, 255],
      getSize: 11,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      pixelOffset: [0, 0],
      background: false,
      parameters: { depthWriteEnabled: false },
      updateTriggers: { data: [focusDrone] }
    }),
    new TextLayer({
      id: 'targets-labels-minimal',
      data: targetPoints,
      getPosition: d => d.position,
      getText: d => `PRIORITY_TGT_${d.index}`,
      getColor: [0, 0, 0, 255],
      getSize: 10,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      pixelOffset: [0, -35], // Shift slightly above the pin head
      background: true,
      getBackgroundColor: [255, 107, 0, 255],
      getBorderColor: [255, 107, 0, 255],
      getBorderWidth: 1,
      backgroundPadding: [4, 4, 2, 4],
      parameters: { depthWriteEnabled: false }
    })
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Map 
        ref={mapRef}
        style={{ width: '100%', height: '100%' }} 
        mapStyle={MAP_STYLE}
        {...viewState}
        onMove={e => {
          setViewState(e.viewState);
          if (e.originalEvent && setAutoTrack) {
            setAutoTrack(false);
          }
        }}
        onMoveStart={e => {
          if (e.originalEvent && setAutoTrack) {
            setAutoTrack(false);
          }
        }}
        onDragStart={() => { if (setAutoTrack) setAutoTrack(false); }}
        attributionControl={false}
        onClick={(e) => {
          if (isTargeting && e.lngLat) {
            setTargetLock(prev => ({
               ...prev,
               waypoints: [...(prev?.waypoints || []), { lat: e.lngLat.lat, lng: e.lngLat.lng, id: Date.now() }]
            }));
          }
        }}
      >
        <DeckGLOverlay layers={layers} interleaved={true} />
        
        {/* Draggable HTML Labels and Icons for Targets */}
        {targetLock?.waypoints?.map((wp, idx) => (
          <Marker
            key={wp.id}
            longitude={wp.lng}
            latitude={wp.lat}
            draggable={true}
            anchor="center"
            onDragStart={() => { if (setAutoTrack) setAutoTrack(false); }}
            onDrag={(e) => {
              if (setTargetLock) {
                setTargetLock(prev => ({
                   ...prev,
                   waypoints: prev.waypoints.map(w => w.id === wp.id ? { ...w, lat: e.lngLat.lat, lng: e.lngLat.lng } : w)
                }));
              }
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'grab', pointerEvents: 'auto' }}>
               <div style={{
                 background: 'rgba(8, 12, 20, 0.85)',
                 border: '1px solid var(--orange-primary)',
                 color: 'var(--orange-primary)',
                 padding: '4px 8px',
                 borderRadius: '4px',
                 fontFamily: 'monospace',
                 fontSize: '10px',
                 fontWeight: 'bold',
                 userSelect: 'none',
                 whiteSpace: 'nowrap',
                 boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
                 marginBottom: '6px'
               }}>
                 WP_{idx+1}: {Number(wp.lat || 0).toFixed(4)}, {Number(wp.lng || 0).toFixed(4)}
               </div>
               {/* Simple Target Icon */}
               <div style={{
                 width: '24px', height: '24px',
                 border: '2px solid var(--orange-primary)',
                 background: 'rgba(255, 107, 0, 0.6)',
                 borderRadius: '50%',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 boxShadow: '0 0 15px var(--orange-primary)'
               }}>
                  <span style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>{idx + 1}</span>
               </div>
            </div>
          </Marker>
        ))}
        
        {/* Scale indicator at bottom left */}
        <ScaleControl 
          position="bottom-left" 
          unit="metric" 
          style={{ 
            background: 'rgba(8,12,20,0.85)', 
            border: '1px solid var(--cyan-primary)', 
            color: 'var(--cyan-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            marginBottom: '20px',
            marginLeft: '20px'
          }} 
        />
        
        <style>{`
          .tactical-popup .maplibregl-popup-content {
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          .tactical-popup .maplibregl-popup-tip {
            display: none !important;
          }
          
          .tactical-hud-box {
            background: rgba(8, 12, 20, 0.85);
            border: 1px solid var(--cyan-primary);
            border-left: 3px solid var(--cyan-primary);
            padding: 8px 12px;
            font-family: var(--font-mono);
            backdrop-filter: blur(4px);
            position: relative;
            transform: translateY(-20px); /* Just shift it up slightly */
          }
          .tactical-hud-box::after {
            content: '';
            position: absolute;
            bottom: -20px;
            left: 50%;
            width: 1px;
            height: 20px;
            background: var(--pointer-color, var(--cyan-primary));
          }
          
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
          }
          .custom-map-btn:hover {
            background: rgba(0, 229, 255, 0.2);
          }
        `}</style>

        <div style={{ position: 'absolute', bottom: '150px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="custom-map-btn" onClick={(e) => { e.stopPropagation(); mapRef.current?.zoomTo(viewState.zoom + 1, {duration: 300}); }} title="Zoom In">+</button>
          <button className="custom-map-btn" onClick={(e) => { e.stopPropagation(); mapRef.current?.zoomTo(viewState.zoom - 1, {duration: 300}); }} title="Zoom Out">-</button>
          <button 
            className="custom-map-btn" 
            onClick={(e) => { 
              e.stopPropagation(); 
              const is3D = viewState.pitch > 10;
              mapRef.current?.easeTo({
                bearing: is3D ? 0 : 30, 
                pitch: is3D ? 0 : 60, 
                duration: 800
              }); 
            }} 
            title="Toggle 2D/3D View" 
            style={{ fontSize: '12px', fontWeight: 'bold' }}
          >
            {viewState.pitch > 10 ? '2D' : '3D'}
          </button>
        </div>
        
      </Map>
    </div>
  );
});

export default DeckGLMap;
