import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ScatterplotLayer, PathLayer, LineLayer, TextLayer } from '@deck.gl/layers';
import Map, { ScaleControl, useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import 'maplibre-gl/dist/maplibre-gl.css';

function DeckGLOverlay(props) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
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

  const focusedSwarmId = focusDrone?.swarmId;

  const swarmPoints = telemetry.swarms.map(s => {
    const rgb = hexToRgb(s.color);
    const isFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    // Increase visibility for unselected swarms
    const fillAlpha = hasFocus ? (isFocused ? 40 : 15) : 20;
    const lineAlpha = hasFocus ? (isFocused ? 255 : 120) : 180;
    
    return { 
      position: [s.baseLng, s.baseLat, 240], // Float at command altitude
      color: [...rgb, fillAlpha], 
      lineColor: [...rgb, lineAlpha],
      radius: isFocused ? 120 : 100, // Pulse/Enlarge focused swarm
      id: s.id
    };
  });

  const dronePoints = telemetry.swarms.flatMap(s => s.drones.map(d => {
    const isFocused = focusDrone?.droneId === d.id;
    const isSwarmFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    // Increase visibility for unselected drones
    const alpha = hasFocus ? (isSwarmFocused ? (isFocused ? 255 : 200) : 120) : 255;
    
    // Elevate drones to 250m+ to ensure they clear the terrain
    const droneAlt = 250 + ((d.id.charCodeAt(0) + d.id.charCodeAt(d.id.length-1)) % 40);
    const rgb = hexToRgb(s.color);
    
    return {
      position: [d.lng, d.lat, droneAlt],
      color: [...rgb, alpha], 
      radius: isFocused ? 12 : 6,
      id: d.id,
      swarmId: s.id
    };
  }));

  const droneLines = dronePoints.map(d => ({
    sourcePosition: [d.position[0], d.position[1], d.position[2]],
    targetPosition: [d.position[0], d.position[1], 0], // Drop line to ground
    color: d.color
  }));

  const targetPoints = targetLock?.waypoints?.map(wp => ({
    position: [wp.lng, wp.lat, 240],
    color: [255, 107, 0, 200],
    radius: 30
  })) || [];

  const paths = telemetry.swarms.filter(s => s.waypoints?.length > 0).map(s => {
    const rgb = hexToRgb(s.color);
    const isFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    const alpha = hasFocus ? (isFocused ? 200 : 80) : 150;
    return {
      path: [[s.baseLng, s.baseLat, 240], ...s.waypoints.map(w => [w.lng, w.lat, 240])],
      color: [...rgb, alpha]
    };
  });

  const layers = [
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
      id: 'swarms-radar-outer',
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
        getFillColor: [focusedSwarmId],
        getLineColor: [focusedSwarmId],
        getRadius: [focusedSwarmId]
      }
    }),
    new ScatterplotLayer({
      id: 'swarms-radar-inner',
      data: swarmPoints,
      stroked: true,
      filled: false,
      lineWidthMinPixels: 2,
      getPosition: d => d.position,
      getLineColor: d => d.lineColor,
      getRadius: d => d.radius * 0.4,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getLineColor: [focusedSwarmId]
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
    new TextLayer({
      id: 'targets-geom',
      data: targetPoints,
      getPosition: d => d.position,
      getText: d => '×',
      getColor: d => d.color,
      getSize: 32,
      fontFamily: 'Arial',
      characterSet: ['×'],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      parameters: { depthWriteEnabled: false }
    }),
    new TextLayer({
      id: 'swarm-labels-minimal',
      data: telemetry.swarms.filter(s => s.drones?.length > 0).map(s => {
        const rgb = hexToRgb(s.color);
        // Tighter perspective compensation:
        const pitchRad = (viewState.pitch || 0) * Math.PI / 180;
        const dynamicSouthOffset = 0.0011 + (Math.sin(pitchRad) * 0.0012); 
        
        return {
          position: [s.baseLng - 0.0002, s.baseLat - dynamicSouthOffset, 300],
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
        data: [viewState.pitch]
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
      getText: (d, {index}) => `PRIORITY_TGT_${index+1}`,
      getColor: [0, 0, 0, 255],
      getSize: 10,
      fontFamily: 'Arial',
      fontWeight: 'bold',
      pixelOffset: [0, -30],
      background: true,
      getBackgroundColor: [255, 107, 0, 255],
      getBorderColor: [255, 107, 0, 255],
      getBorderWidth: 1,
      backgroundPadding: [4, 4, 2, 4],
      parameters: { depthWriteEnabled: false }
    })
  ];

  // MapLibre map controller zoom in/out fix
  const mapRef = React.useRef(null);

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
