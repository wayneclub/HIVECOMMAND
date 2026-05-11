import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
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

const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDynamicSwarmMetrics = (swarm) => {
  if (!swarm.drones || swarm.drones.length === 0) {
    return { centerLng: swarm.baseLng, centerLat: swarm.baseLat, radius: 100 };
  }
  
  const centerLng = swarm.drones.reduce((sum, d) => sum + d.lng, 0) / swarm.drones.length;
  const centerLat = swarm.drones.reduce((sum, d) => sum + d.lat, 0) / swarm.drones.length;
  
  let maxDist = 0;
  swarm.drones.forEach(d => {
    const dist = getDistanceMeters(centerLat, centerLng, d.lat, d.lng);
    if (dist > maxDist) maxDist = dist;
  });
  
  // Base radius 100m, expand if drones are scattered further
  const radius = Math.max(100, maxDist + 40); 
  return { centerLng, centerLat, radius };
};
const getSwarmTrackPoint = (swarm) => {
  if (!swarm) return null;
  if (swarm.drones?.length) {
    const metrics = getDynamicSwarmMetrics(swarm);
    return {
      lat: metrics.centerLat,
      lng: metrics.centerLng,
      alt: swarm.alt ?? 0,
      speed: swarm.speed ?? 0
    };
  }
  return {
    lat: swarm.baseLat,
    lng: swarm.baseLng,
    alt: swarm.alt ?? 0,
    speed: swarm.speed ?? 0
  };
};

// Calculate camera target offset to visually center an elevated object in 3D
const getVisualCenter = (lng, lat, alt, pitch, bearing) => {
  if (!pitch || pitch < 5) return { lng, lat }; // No offset needed for 2D/top-down
  
  const pitchRad = pitch * Math.PI / 180;
  const bearingRad = bearing * Math.PI / 180;
  
  // Parallax displacement: d = h * tan(pitch)
  // To visually center the object, we move the camera target in the direction of the bearing
  const dMeters = (alt ?? 120) * Math.tan(pitchRad);
  
  const dLatMeters = dMeters * Math.cos(bearingRad);
  const dLngMeters = dMeters * Math.sin(bearingRad);
  
  const latOffset = dLatMeters / 111320;
  const lngOffset = dLngMeters / (111320 * Math.cos(lat * Math.PI / 180));
  
  return { lng: lng + lngOffset, lat: lat + latOffset };
};

const getTrackingAltitude = (drone) => {
  if (!drone) return 120;

  const currentAlt = Number(drone.alt ?? 0);
  const targetAlt = Number(drone.targetAlt ?? currentAlt);
  const speed = Number(drone.speed ?? 0);
  const isAscendingIntoMission = targetAlt > currentAlt && speed < 0.5;

  return isAscendingIntoMission ? targetAlt : currentAlt;
};
const getDisplayAltitude = (altitude, minimumMeters = 18) => {
  const numericAltitude = Number(altitude ?? 0);
  if (!Number.isFinite(numericAltitude)) return minimumMeters;
  return Math.max(minimumMeters, numericAltitude);
};
const TARGET_ORANGE = [255, 107, 0];
const getMissionMarkerAltitude = (altitude) => {
  const numericAltitude = Number(altitude ?? 0);
  if (!Number.isFinite(numericAltitude) || numericAltitude <= 0) return 0;
  return Math.max(12, numericAltitude);
};

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

const DeckGLMap = forwardRef(({ telemetry, targetLock, mapCenter, mapZoom, onZoomChange, setTargetLock, isTargeting, setFocusDrone, focusDrone, setAutoTrack, autoTrack, unitSystem, onSelectionInteraction, activeMissionPlan, tacticalPhase }, ref) => {
  const mapRef = React.useRef(null);
  const lastLayerClickRef = React.useRef(0);
  const isFlyingRef = React.useRef(false);
  const releaseFlightRef = React.useRef(null);
  const focusTargetRef = React.useRef(null);
  const lastTrackedCenterRef = React.useRef(null);
  const lastFollowAtRef = React.useRef(0);
  const [viewState, setViewState] = useState({
    longitude: mapCenter[1],
    latitude: mapCenter[0],
    zoom: mapZoom ?? 16.3,
    pitch: 60,
    bearing: 30
  });
  const viewStateRef = React.useRef(viewState);

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => () => {
    if (releaseFlightRef.current) {
      window.clearTimeout(releaseFlightRef.current);
    }
  }, []);

  useEffect(() => {
    if (isTargeting && setAutoTrack) {
      setAutoTrack(false);
    }
  }, [isTargeting, setAutoTrack]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => setViewState(v => ({ ...v, zoom: v.zoom + 1, transitionDuration: 300 })),
    zoomOut: () => setViewState(v => ({ ...v, zoom: v.zoom - 1, transitionDuration: 300 })),
    resetNorth: () => setViewState(v => ({ ...v, bearing: 0, transitionDuration: 500 }))
  }));

  useEffect(() => {
    setViewState(prev => ({ ...prev, longitude: mapCenter[1], latitude: mapCenter[0] }));
  }, [mapCenter]);
  useEffect(() => {
    if (!Number.isFinite(mapZoom)) return;
    setViewState(prev => Math.abs((prev.zoom ?? 0) - mapZoom) < 0.001 ? prev : { ...prev, zoom: mapZoom });
  }, [mapZoom]);
  
  // Tactical Auto-Tracking: Center on focused drone
  // 1. Initial focus: Smoothly fly to target
  const resolvedFocusSwarm = focusDrone
    ? (
        (focusDrone.swarmId != null && focusDrone.swarmId !== '')
          ? telemetry.swarms?.find(s => s.id === focusDrone.swarmId)
          : telemetry.swarms?.find(s => s.drones?.some(d => d.id === focusDrone.droneId))
      )
    : null;
  const resolvedFocusDrone = focusDrone
    ? (
        resolvedFocusSwarm?.drones?.find(d => d.id === focusDrone.droneId) ||
        telemetry.unassignedDrones?.find(d => d.id === focusDrone.droneId)
      )
    : null;
  const normalizedFocusDrone = focusDrone && resolvedFocusDrone
    ? { ...focusDrone, swarmId: resolvedFocusSwarm?.id ?? null }
    : focusDrone;

  useEffect(() => {
    if (!(autoTrack && normalizedFocusDrone && telemetry)) {
      focusTargetRef.current = null;
      return;
    }

    const drone = resolvedFocusDrone;
    if (!drone) return;

    const currentView = viewStateRef.current;
    const targetIdentifier = `${normalizedFocusDrone.swarmId ?? 'solo'}-${normalizedFocusDrone.droneId}`;
    const targetPitch = currentView.pitch > 10 ? currentView.pitch : 60;
    const visualCenter = getVisualCenter(drone.lng, drone.lat, getTrackingAltitude(drone), targetPitch, currentView.bearing || 30);

    if (focusTargetRef.current !== targetIdentifier) {
      focusTargetRef.current = targetIdentifier;
      lastTrackedCenterRef.current = `${visualCenter.lat.toFixed(6)}:${visualCenter.lng.toFixed(6)}`;
      isFlyingRef.current = true;

      if (releaseFlightRef.current) {
        window.clearTimeout(releaseFlightRef.current);
      }

      setViewState(prev => ({
        ...prev,
        longitude: visualCenter.lng,
        latitude: visualCenter.lat,
        zoom: prev.zoom,
        pitch: prev.pitch > 10 ? prev.pitch : 60,
        transitionDuration: 1100
      }));

      releaseFlightRef.current = window.setTimeout(() => {
        isFlyingRef.current = false;
      }, 1150);
    }
  }, [normalizedFocusDrone, resolvedFocusDrone, autoTrack, telemetry]);

  // 2. Continuous tracking: Keep centered during flight
  useEffect(() => {
    if (!(autoTrack && normalizedFocusDrone && telemetry) || isFlyingRef.current) {
      return;
    }

    const drone = resolvedFocusDrone;
    if (!drone) return;

    const currentView = viewStateRef.current;
    const visualCenter = getVisualCenter(drone.lng, drone.lat, getTrackingAltitude(drone), currentView.pitch, currentView.bearing);
    const nextCenterKey = `${visualCenter.lat.toFixed(6)}:${visualCenter.lng.toFixed(6)}`;
    if (lastTrackedCenterRef.current === nextCenterKey) {
      return;
    }

    const now = Date.now();
    if (now - lastFollowAtRef.current < 260) {
      return;
    }

    const latDelta = Math.abs((currentView.latitude ?? 0) - visualCenter.lat);
    const lngDelta = Math.abs((currentView.longitude ?? 0) - visualCenter.lng);
    if (latDelta < 0.000015 && lngDelta < 0.000015) {
      lastTrackedCenterRef.current = nextCenterKey;
      return;
    }

    lastTrackedCenterRef.current = nextCenterKey;
    lastFollowAtRef.current = now;
    setViewState(prev => ({
      ...prev,
      longitude: visualCenter.lng,
      latitude: visualCenter.lat,
      transitionDuration: 260
    }));
  }, [telemetry, autoTrack, normalizedFocusDrone, resolvedFocusDrone]);

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

  const focusedSwarmId = normalizedFocusDrone?.swarmId;
  const shouldShowActiveMissionPlan = Boolean(
    activeMissionPlan &&
    (tacticalPhase === 'TRANSIT' || tacticalPhase === 'STRIKE_MONITORING' || tacticalPhase === 'COMPLETED')
  );
  const activeMissionLiveTrack = useMemo(() => {
    if (!activeMissionPlan) return null;
    if (activeMissionPlan.targetDroneId) {
      const ownerSwarm = telemetry.swarms.find((swarm) => swarm.drones?.some((drone) => drone.id === activeMissionPlan.targetDroneId));
      const swarmDrone = ownerSwarm?.drones?.find((drone) => drone.id === activeMissionPlan.targetDroneId);
      const independentDrone = telemetry.unassignedDrones?.find((drone) => drone.id === activeMissionPlan.targetDroneId);
      const drone = swarmDrone || independentDrone;
      return drone ? { lat: drone.lat, lng: drone.lng, alt: drone.alt ?? 0 } : null;
    }
    const swarm = telemetry.swarms.find((item) => item.id === activeMissionPlan.swarmId);
    return getSwarmTrackPoint(swarm);
  }, [activeMissionPlan, telemetry]);
  const activeMissionRemainingWaypoints = useMemo(() => {
    if (!activeMissionPlan) return [];

    if (activeMissionPlan.targetDroneId) {
      const ownerSwarm = telemetry.swarms.find((swarm) => swarm.drones?.some((drone) => drone.id === activeMissionPlan.targetDroneId));
      const swarmDrone = ownerSwarm?.drones?.find((drone) => drone.id === activeMissionPlan.targetDroneId);
      const independentDrone = telemetry.unassignedDrones?.find((drone) => drone.id === activeMissionPlan.targetDroneId);
      const drone = swarmDrone || independentDrone;
      if (drone?.waypoints?.length) return drone.waypoints;
    } else {
      const swarm = telemetry.swarms.find((item) => item.id === activeMissionPlan.swarmId);
      if (swarm?.waypoints?.length) return swarm.waypoints;
    }

    if (tacticalPhase === 'COMPLETED') {
      const allWaypoints = activeMissionPlan.waypoints?.length
        ? activeMissionPlan.waypoints
        : (activeMissionPlan.destination ? [activeMissionPlan.destination] : []);
      const finalWaypoint = allWaypoints[allWaypoints.length - 1];
      return finalWaypoint ? [finalWaypoint] : [];
    }

    return [];
  }, [activeMissionPlan, telemetry, tacticalPhase]);

  const swarmPoints = telemetry.swarms.map(s => {
    const metrics = getDynamicSwarmMetrics(s);
    const rgb = hexToRgb(s.color);
    const isFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    // Increase visibility for unselected swarms
    const fillAlpha = hasFocus ? (isFocused ? 40 : 15) : 20;
    const lineAlpha = hasFocus ? (isFocused ? 255 : 120) : 180;
    
    return { 
      position: toAglPosition(metrics.centerLng, metrics.centerLat, s.alt ?? 120, 2),
      color: [...rgb, fillAlpha], 
      lineColor: [...rgb, lineAlpha],
      radius: isFocused ? 18 : 14,
      id: s.id
    };
  });

  const swarmZones = telemetry.swarms.map(s => {
    const metrics = getDynamicSwarmMetrics(s);
    const rgb = hexToRgb(s.color);
    const isFocused = focusedSwarmId === s.id;
    const hasFocus = !!focusedSwarmId;
    const altitude = getDisplayAltitude(s.alt ?? s.targetAlt ?? 0, 18);
    
    // Dynamic radius based on actual drone spread
    const baseRadius = isFocused ? Math.max(120, metrics.radius) : metrics.radius;
    const outerRadius = baseRadius;
    const innerRadius = outerRadius * 0.4;
    
    const fillAlpha = hasFocus ? (isFocused ? 36 : 12) : 20;
    const lineAlpha = hasFocus ? (isFocused ? 255 : 120) : 180;
    const renderAltitude = getTerrainElevation(metrics.centerLng, metrics.centerLat) + altitude + 1;

    return {
      id: s.id,
      position: [metrics.centerLng, metrics.centerLat, renderAltitude],
      outerRadius,
      innerRadius,
      fillColor: [...rgb, fillAlpha],
      lineColor: [...rgb, lineAlpha]
    };
  });

  const dronePoints = [
    ...telemetry.swarms.flatMap(s => s.drones.map(d => {
      const isFocused = normalizedFocusDrone?.droneId === d.id;
      const isSwarmFocused = focusedSwarmId === s.id;
      const hasFocus = !!focusedSwarmId;
      // Increase visibility for unselected drones
      const alpha = hasFocus ? (isSwarmFocused ? (isFocused ? 255 : 200) : 120) : 255;
      
      // Elevate drones to 250m+ to ensure they clear the terrain
      const droneAlt = getDisplayAltitude(d.alt ?? d.targetAlt ?? 0, 12);
      const rgb = hexToRgb(s.color);
      
      return {
        position: toAglPosition(d.lng, d.lat, droneAlt, 2),
        color: [...rgb, alpha], 
        radius: isFocused ? 12 : 6,
        id: d.id,
        swarmId: s.id,
        isFocused,
        hasFocus,
        isSwarmFocused
      };
    })),
    ...(telemetry.unassignedDrones || []).map(d => {
      const isFocused = normalizedFocusDrone?.droneId === d.id;
      const hasFocus = !!normalizedFocusDrone;
      const alpha = hasFocus ? (isFocused ? 255 : 120) : 255;
      
      const droneAlt = getDisplayAltitude(d.alt ?? d.targetAlt ?? 0, 12);
      return {
        position: toAglPosition(d.lng, d.lat, droneAlt, 2),
        color: [255, 204, 0, alpha], // Amber/Yellow for unassigned
        radius: isFocused ? 12 : 6,
        id: d.id,
        swarmId: null,
        isFocused,
        hasFocus,
        isSwarmFocused: isFocused
      };
    })
  ];

  const droneLines = dronePoints.map(d => ({
    sourcePosition: [d.position[0], d.position[1], d.position[2]],
    targetPosition: toAglPosition(d.position[0], d.position[1], 0, 0), // Drop line to local terrain
    color: d.color,
    isFocused: d.isFocused,
    hasFocus: d.hasFocus,
    isSwarmFocused: d.isSwarmFocused
  }));

  const liveMissionPathData = [
    ...telemetry.swarms
      .filter(s => s.waypoints?.length > 0)
      .map(s => {
        const metrics = getDynamicSwarmMetrics(s);
        const rgb = hexToRgb(s.color);
        const isFocused = focusedSwarmId === s.id;
        const hasFocus = !!focusedSwarmId;
        const alpha = hasFocus ? (isFocused ? 200 : 80) : 150;
        const altitude = getDisplayAltitude(s.alt ?? s.targetAlt ?? 0, 18);
        const routeOriginLng = Number.isFinite(s.routeOriginLng) ? s.routeOriginLng : metrics.centerLng;
        const routeOriginLat = Number.isFinite(s.routeOriginLat) ? s.routeOriginLat : metrics.centerLat;
        return {
          id: `swarm-${s.id}`,
          ownerLabel: s.name || `SWARM_${s.id}`,
          color: [...TARGET_ORANGE, alpha],
          labelColor: TARGET_ORANGE,
          path: [
            toAglPosition(routeOriginLng, routeOriginLat, 0, 1.2),
            ...s.waypoints.map(w => toAglPosition(w.lng, w.lat, 0, 1.2))
          ],
          waypoints: s.waypoints.map((w, index) => ({
            id: w.id || `swarm-${s.id}-wp-${index}`,
            label: w.label || `WAYPOINT_${index + 1}`,
            shortLabel: `${index + 1}`,
            position: toAglPosition(w.lng, w.lat, 0, 3),
            color: TARGET_ORANGE
          }))
        };
      }),
    ...(telemetry.unassignedDrones || [])
      .filter(d => d.waypoints?.length > 0)
      .map(d => {
        const isFocused = normalizedFocusDrone?.droneId === d.id;
        const hasFocus = !!normalizedFocusDrone;
        const alpha = hasFocus ? (isFocused ? 220 : 90) : 180;
        const altitude = getDisplayAltitude(d.alt ?? d.targetAlt ?? 0, 12);
        const color = [255, 204, 0];
        const routeOriginLng = Number.isFinite(d.routeOriginLng) ? d.routeOriginLng : d.lng;
        const routeOriginLat = Number.isFinite(d.routeOriginLat) ? d.routeOriginLat : d.lat;
        return {
          id: `drone-${d.id}`,
          ownerLabel: `UAV_${d.id}`,
          color: [...TARGET_ORANGE, alpha],
          labelColor: TARGET_ORANGE,
          path: [
            toAglPosition(routeOriginLng, routeOriginLat, 0, 1.2),
            ...d.waypoints.map(w => toAglPosition(w.lng, w.lat, 0, 1.2))
          ],
          waypoints: d.waypoints.map((w, index) => ({
            id: w.id || `drone-${d.id}-wp-${index}`,
            label: w.label || `WAYPOINT_${index + 1}`,
            shortLabel: `${index + 1}`,
            position: toAglPosition(w.lng, w.lat, 0, 3),
            color: TARGET_ORANGE
          }))
        };
      })
  ];
  const activeMissionPathData = useMemo(() => {
    if (!shouldShowActiveMissionPlan) return [];

    const missionWaypoints = activeMissionRemainingWaypoints.length
      ? activeMissionRemainingWaypoints
      : (
          tacticalPhase === 'COMPLETED'
            ? activeMissionRemainingWaypoints
            : (activeMissionPlan.destination ? [activeMissionPlan.destination] : [])
        );

    if (!missionWaypoints.length) return [];

    const ownerLabel = activeMissionPlan.targetDroneId
      ? `UAV_${activeMissionPlan.targetDroneId}`
      : `SWARM_${activeMissionPlan.swarmId}`;
    const ownerColor = activeMissionPlan.targetDroneId ? [255, 204, 0] : hexToRgb(
      telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.color || '#39ff14'
    );
    const fallbackOriginLat = activeMissionPlan.targetDroneId
      ? (
          telemetry.swarms.find((swarm) => swarm.drones?.some((drone) => drone.id === activeMissionPlan.targetDroneId))
            ?.drones?.find((drone) => drone.id === activeMissionPlan.targetDroneId)?.lat
          ?? telemetry.unassignedDrones?.find((drone) => drone.id === activeMissionPlan.targetDroneId)?.lat
          ?? missionWaypoints[0]?.lat
        )
      : (
          telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.homeBaseLat
          ?? telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.baseLat
          ?? missionWaypoints[0]?.lat
        );
    const fallbackOriginLng = activeMissionPlan.targetDroneId
      ? (
          telemetry.swarms.find((swarm) => swarm.drones?.some((drone) => drone.id === activeMissionPlan.targetDroneId))
            ?.drones?.find((drone) => drone.id === activeMissionPlan.targetDroneId)?.lng
          ?? telemetry.unassignedDrones?.find((drone) => drone.id === activeMissionPlan.targetDroneId)?.lng
          ?? missionWaypoints[0]?.lng
        )
      : (
          telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.homeBaseLng
          ?? telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.baseLng
          ?? missionWaypoints[0]?.lng
        );
    const routeOriginLat = Number.isFinite(Number(activeMissionPlan.routeOriginLat))
      ? Number(activeMissionPlan.routeOriginLat)
      : fallbackOriginLat;
    const routeOriginLng = Number.isFinite(Number(activeMissionPlan.routeOriginLng))
      ? Number(activeMissionPlan.routeOriginLng)
      : fallbackOriginLng;
    const renderAltitude = getDisplayAltitude(
      activeMissionPlan.routeAltitudeM
      ?? (
        activeMissionPlan.targetDroneId
          ? telemetry.swarms.find((swarm) => swarm.drones?.some((drone) => drone.id === activeMissionPlan.targetDroneId))
              ?.drones?.find((drone) => drone.id === activeMissionPlan.targetDroneId)?.targetAlt
            ?? telemetry.unassignedDrones?.find((drone) => drone.id === activeMissionPlan.targetDroneId)?.targetAlt
            ?? telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.targetAlt
          : telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.targetAlt
            ?? telemetry.swarms.find((swarm) => swarm.id === activeMissionPlan.swarmId)?.alt
      )
      ?? 120,
      activeMissionPlan.targetDroneId ? 12 : 18
    );
    const markerAltitude = getMissionMarkerAltitude(activeMissionPlan.routeAltitudeM ?? renderAltitude);
    const liveTrackLat = Number.isFinite(Number(activeMissionLiveTrack?.lat))
      ? Number(activeMissionLiveTrack.lat)
      : routeOriginLat;
    const liveTrackLng = Number.isFinite(Number(activeMissionLiveTrack?.lng))
      ? Number(activeMissionLiveTrack.lng)
      : routeOriginLng;
    const liveTrackAltitude = getMissionMarkerAltitude(activeMissionLiveTrack?.alt ?? activeMissionPlan.routeAltitudeM ?? 0);

    return [{
      id: `active-plan-${activeMissionPlan.swarmId || activeMissionPlan.targetDroneId || 'mission'}`,
      ownerLabel,
      color: [...TARGET_ORANGE, 210],
      labelColor: TARGET_ORANGE,
      path: [
        toAglPosition(liveTrackLng, liveTrackLat, liveTrackAltitude, 1.2),
        ...missionWaypoints.map((waypoint) => toAglPosition(waypoint.lng, waypoint.lat, markerAltitude, 1.2))
      ],
      waypoints: missionWaypoints.map((waypoint, index) => ({
        id: waypoint.id || `active-plan-wp-${index}`,
        label: waypoint.label || `WAYPOINT_${index + 1}`,
        shortLabel: `${index + 1}`,
        position: toAglPosition(waypoint.lng, waypoint.lat, markerAltitude, 3),
        color: TARGET_ORANGE
      }))
    }];
  }, [shouldShowActiveMissionPlan, activeMissionPlan, telemetry, activeMissionLiveTrack, activeMissionRemainingWaypoints, tacticalPhase]);
  const missionPathData = shouldShowActiveMissionPlan ? activeMissionPathData : liveMissionPathData;
  const missionWaypointMarkers = missionPathData.flatMap((entry) =>
    entry.waypoints.map((waypoint, index) => ({
      ...waypoint,
      ownerLabel: entry.ownerLabel,
      color: entry.labelColor,
      fullLabel: `${entry.ownerLabel} // ${waypoint.label || `WAYPOINT_${index + 1}`}`,
      coordLabel: `${waypoint.label || `WP_${index + 1}`}: ${Number(waypoint.position?.[1] ?? 0).toFixed(4)}, ${Number(waypoint.position?.[0] ?? 0).toFixed(4)}`,
      shortLabel: waypoint.shortLabel || `${index + 1}`
    }))
  );
  const missionWaypointDropLines = missionWaypointMarkers
    .filter((waypoint) => Number(waypoint.position?.[2] ?? 0) > getTerrainElevation(waypoint.position[0], waypoint.position[1]) + 3)
    .map((waypoint) => ({
      sourcePosition: waypoint.position,
      targetPosition: toAglPosition(waypoint.position[0], waypoint.position[1], 0, 0),
      color: [...TARGET_ORANGE, 120]
    }));

  const layers = [
    new ScatterplotLayer({
      id: 'swarm-zones-outer',
      data: swarmZones,
      pickable: false,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      getPosition: d => d.position,
      getFillColor: d => d.fillColor,
      getLineColor: d => d.lineColor,
      getRadius: d => d.outerRadius,
      radiusUnits: 'meters',
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getPosition: [telemetry.swarms],
        getFillColor: [focusedSwarmId],
        getLineColor: [focusedSwarmId],
        getRadius: [focusedSwarmId]
      }
    }),
    new ScatterplotLayer({
      id: 'swarm-zones-inner',
      data: swarmZones,
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthMinPixels: 2,
      getPosition: d => d.position,
      getFillColor: [0, 0, 0, 0],
      getLineColor: d => d.lineColor,
      getRadius: d => d.innerRadius,
      radiusUnits: 'meters',
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getPosition: [telemetry.swarms],
        getLineColor: [focusedSwarmId],
        getRadius: [focusedSwarmId]
      }
    }),
    new PathLayer({
      id: 'swarm-paths-glow',
      data: missionPathData,
      getPath: d => d.path,
      getColor: [12, 18, 28, 220],
      getWidth: 8,
      widthMinPixels: 8,
      parameters: { depthWriteEnabled: false }
    }),
    new PathLayer({
      id: 'swarm-paths',
      data: missionPathData,
      getPath: d => d.path,
      getColor: [255, 107, 0, 255],
      getWidth: 4,
      widthMinPixels: 4,
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
      getColor: d => [
        d.color[0], 
        d.color[1], 
        d.color[2], 
        d.isFocused ? 150 : (d.hasFocus && !d.isSwarmFocused ? 15 : 45)
      ],
      getWidth: d => d.isFocused ? 2 : 1,
      widthMinPixels: 1,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getColor: [focusedSwarmId, normalizedFocusDrone],
        getWidth: [normalizedFocusDrone]
      }
    }),
    new ScatterplotLayer({
      id: 'drone-shadows',
      data: droneLines,
      getPosition: d => d.targetPosition,
      getFillColor: [0, 0, 0, 0],
      getLineColor: d => [
        d.color[0], 
        d.color[1], 
        d.color[2], 
        d.isFocused ? 220 : (d.hasFocus && !d.isSwarmFocused ? 40 : 120)
      ],
      getRadius: d => d.isFocused ? 6 : 3,
      radiusUnits: 'meters',
      stroked: true,
      lineWidthMinPixels: 1.5,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getLineColor: [focusedSwarmId, normalizedFocusDrone],
        getRadius: [normalizedFocusDrone]
      }
    }),
    new ScatterplotLayer({
      id: 'drones-points',
      data: dronePoints,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 255],
      getPosition: d => d.position,
      getFillColor: d => d.color,
      getLineColor: [255, 255, 255, 255],
      getLineWidth: d => d.isFocused ? 2 : 1.5,
      lineWidthMinPixels: 1.5,
      stroked: true,
      billboard: true, // Always faces the camera as a perfect circle
      radiusUnits: 'meters', // Scales naturally with buildings/terrain
      radiusMinPixels: 4, // Prevents disappearing when zoomed far out
      radiusMaxPixels: 24, // Caps size when zoomed extremely close
      getRadius: d => d.isFocused ? 12 : 7, // 7-12 meters size in 3D space
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        getFillColor: [focusedSwarmId, normalizedFocusDrone],
        getRadius: [normalizedFocusDrone],
        getLineWidth: [normalizedFocusDrone]
      },
      onClick: (info) => {
        lastLayerClickRef.current = Date.now();
        info?.srcEvent?.preventDefault?.();
        info?.srcEvent?.stopPropagation?.();
        if (onSelectionInteraction) onSelectionInteraction();
        if (info.object && setFocusDrone) {
          setFocusDrone({ swarmId: info.object.swarmId, droneId: info.object.id });
          if (setAutoTrack) setAutoTrack(true);
        }
      }
    }),
    new ScatterplotLayer({
      id: 'mission-waypoint-points',
      data: missionWaypointMarkers,
      pickable: false,
      stroked: true,
      filled: true,
      getPosition: d => d.position,
      getFillColor: [255, 107, 0, 120],
      getLineColor: [255, 107, 0, 255],
      getLineWidth: 2,
      lineWidthMinPixels: 2,
      radiusUnits: 'meters',
      getRadius: 11,
      radiusMinPixels: 8,
      radiusMaxPixels: 22,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        data: [telemetry.swarms, telemetry.unassignedDrones]
      }
    }),
    new LineLayer({
      id: 'mission-waypoint-drop-lines',
      data: missionWaypointDropLines,
      getSourcePosition: d => d.sourcePosition,
      getTargetPosition: d => d.targetPosition,
      getColor: d => d.color,
      getWidth: 1,
      widthMinPixels: 1,
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        data: [missionWaypointDropLines]
      }
    }),
    new TextLayer({
      id: 'mission-waypoint-labels',
      data: missionWaypointMarkers,
      getPosition: d => [d.position[0], d.position[1], d.position[2] + 4],
      getText: d => d.coordLabel,
      getColor: [255, 107, 0, 255],
      getSize: 10,
      fontWeight: 'bold',
      fontFamily: 'monospace',
      getTextAnchor: 'start',
      getAlignmentBaseline: 'bottom',
      pixelOffset: [18, -4],
      background: true,
      getBackgroundColor: [8, 12, 20, 235],
      getBorderColor: [255, 107, 0, 255],
      getBorderWidth: 1,
      backgroundPadding: [4, 8],
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        data: [telemetry.swarms, telemetry.unassignedDrones]
      }
    }),
    // Target layers removed in favor of HTML Marker rendering
    new TextLayer({
      id: 'swarm-labels-minimal',
      data: telemetry.swarms.filter(s => s.drones?.length > 0).map(s => {
        const metrics = getDynamicSwarmMetrics(s);
        const rgb = hexToRgb(s.color);
        const isFocused = focusedSwarmId === s.id;
        const outerRadius = isFocused ? Math.max(120, metrics.radius) : metrics.radius;
        
        // Place label at the South-East edge of the zone circle (45 degrees)
        // distance = radius. We use sin/cos(45deg) = 0.707 to get X and Y components
        const offsetMeters = outerRadius; 
        const latMeters = -offsetMeters * 0.707; // South
        const lngMeters = offsetMeters * 0.707; // East
        
        const latOffset = latMeters / 111320; 
        const lngOffset = lngMeters / (111320 * Math.cos(metrics.centerLat * Math.PI / 180)); 
        
        const renderAltitude = getTerrainElevation(metrics.centerLng, metrics.centerLat) + getDisplayAltitude(s.alt ?? s.targetAlt ?? 0, 18);

        return {
          position: [metrics.centerLng + lngOffset, metrics.centerLat + latOffset, renderAltitude],
          text: s.name || 'SWARM_' + s.id,
          color: rgb
        };
      }),
      getPosition: d => d.position,
      getText: d => d.text,
      getColor: d => d.color,
      getSize: 10,
      fontFamily: 'Arial',
      pixelOffset: [4, 4], // slight pixel nudge away from the exact line
      getTextAnchor: 'start', // Align left edge of text
      getAlignmentBaseline: 'top', // Align top edge of text
      background: true,
      getBackgroundColor: [8, 12, 20, 220],
      getBorderColor: d => [d.color[0], d.color[1], d.color[2], 255],
      getBorderWidth: 1,
      backgroundPadding: [4, 8],
      parameters: { depthWriteEnabled: false },
      updateTriggers: {
        data: [telemetry.swarms, focusedSwarmId]
      }
    }),
    new TextLayer({
      id: 'focused-drone-label-v3',
      data: dronePoints.filter(d => normalizedFocusDrone?.droneId === d.id),
      getPosition: d => [d.position[0], d.position[1] + 0.0004, d.position[2] + 20],
      getText: d => `UAV_${d.id}`,
      getColor: [255, 255, 255, 255],
      getSize: 11,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      pixelOffset: [0, 0],
      background: true,
      getBackgroundColor: [8, 12, 20, 220],
      getBorderColor: [0, 229, 255, 255],
      getBorderWidth: 1,
      backgroundPadding: [4, 8],
      parameters: { depthWriteEnabled: false },
      updateTriggers: { data: [normalizedFocusDrone] }
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
          if (onZoomChange && Number.isFinite(e.viewState?.zoom)) {
            onZoomChange(e.viewState.zoom);
          }
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
          } else if (!isTargeting && setFocusDrone) {
             setTimeout(() => {
                if (Date.now() - lastLayerClickRef.current > 300) {
                   setFocusDrone(null);
                }
             }, 50);
          }
        }}
      >
        <DeckGLOverlay layers={layers} interleaved={true} />
        
        {/* Draggable planning markers only while actively targeting */}
        {isTargeting && targetLock?.waypoints?.map((wp, idx) => (
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
                 background: '#ff6b00',
                 color: '#000',
                 padding: '2px 6px',
                 fontWeight: 'bold',
                 fontSize: '11px',
                 fontFamily: 'Arial',
                 whiteSpace: 'nowrap',
                 marginBottom: '2px',
                 boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                 border: '1px solid #ff6b00'
               }}>
                 PRIORITY_TGT_{idx+1}
               </div>
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
          unit={unitSystem === 'imperial' ? 'imperial' : 'metric'} 
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
