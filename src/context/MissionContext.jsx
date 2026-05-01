import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const MissionContext = createContext();
const EARTH_RADIUS_M = 6371000;
const FEET_PER_METER = 3.28084;
const MILES_PER_KM = 0.621371;
const MPH_PER_KPH = 0.621371;
const KPH_PER_KNOT = 1.852;
const SWARM_CRUISE_MPS = 16;
const DRONE_CRUISE_MPS = 18;
const FORMATION_FOLLOW_MPS = 7;
const FORMATION_JOIN_MPS = 12;
const SWARM_CLIMB_MPS = 3.5;
const SWARM_DESCENT_MPS = 2.5;
const DRONE_CLIMB_MPS = 4.5;
const DRONE_DESCENT_MPS = 3.2;
const formatSystemTime = (date = new Date()) =>
  date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
const clampAltitude = (alt) => Math.max(0, Math.min(1200, Number.isFinite(alt) ? alt : 120));
const roundTo = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
const parseWindString = (windValue) => {
  if (!windValue || typeof windValue !== 'string') return null;
  const match = windValue.match(/([\d.]+)\s*(KTS|KPH|MPH)\s*([A-Z]+)/i);
  if (!match) return null;
  return {
    speed: Number(match[1]),
    unit: match[2].toUpperCase(),
    direction: match[3].toUpperCase()
  };
};
const makeMissionWeather = ({ speedKts, direction = 'NE', visibilityKm = 10, tempC = 24, humidity = '60%', condition = 'STABLE' }) => ({
  condition,
  windSpeedKts: speedKts,
  windDirection: direction,
  visibilityKm,
  tempC,
  humidity
});
const easeAltitude = (currentAlt, targetAlt, deltaSeconds, climbRateMps = SWARM_CLIMB_MPS, descentRateMps = SWARM_DESCENT_MPS) => {
  const current = Number.isFinite(currentAlt) ? currentAlt : 0;
  const target = clampAltitude(targetAlt);
  const delta = target - current;

  if (Math.abs(delta) < 0.25) {
    return target;
  }

  const maxStep = (delta > 0 ? climbRateMps : descentRateMps) * deltaSeconds;
  const step = Math.min(Math.abs(delta), maxStep);
  return current + Math.sign(delta) * step;
};
const getFormationPosition = (baseLat, baseLng, droneIndex, droneCount) => {
  const count = Math.max(1, droneCount);
  const angle = (Math.PI * 2 / count) * droneIndex;
  const radius = 0.00026;

  return {
    lat: baseLat + Math.cos(angle) * radius,
    lng: baseLng + Math.sin(angle) * radius
  };
};
const toRadians = (degrees) => degrees * (Math.PI / 180);
const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const moveTowardCoordinates = (lat, lng, targetLat, targetLng, maxDistanceMeters) => {
  const distanceMeters = getDistanceMeters(lat, lng, targetLat, targetLng);
  if (distanceMeters === 0 || maxDistanceMeters <= 0) {
    return { lat, lng, movedMeters: 0, remainingMeters: distanceMeters };
  }

  if (distanceMeters <= maxDistanceMeters) {
    return { lat: targetLat, lng: targetLng, movedMeters: distanceMeters, remainingMeters: 0 };
  }

  const ratio = maxDistanceMeters / distanceMeters;
  return {
    lat: lat + (targetLat - lat) * ratio,
    lng: lng + (targetLng - lng) * ratio,
    movedMeters: maxDistanceMeters,
    remainingMeters: distanceMeters - maxDistanceMeters
  };
};

export function useMission() {
  return useContext(MissionContext);
}

export function MissionProvider({ children }) {
  // Screen management: 1 to 9
  const [activeScreen, setActiveScreen] = useState(1);
  
  // Role: OPERATOR or COMMANDER
  const [role, setRole] = useState('OPERATOR');
  
  // Tactical Phase: IDLE, VALIDATING, AWAITING_COMMANDER, STRIKE_MONITORING, COMPLETED
  const [tacticalPhase, setTacticalPhase] = useState('IDLE');
  
  // Formation: CLUSTER, SCATTER, SURROUND, SNAKE
  const [activeFormation, setActiveFormation] = useState('CLUSTER');

  // AI Command State
  const [lastAIParsedCommand, setLastAIParsedCommand] = useState(null);
  const [unitSystem, setUnitSystem] = useState('metric');

  const [tacticalLogs, setTacticalLogs] = useState([
    { timestamp: formatSystemTime(), message: "SYSTEM_ONLINE // ENCRYPTED_LINK_ESTABLISHED", type: "SYSTEM", coords: null },
    { timestamp: formatSystemTime(), message: "MULTI_POINT_PLANNING_ENGINE_READY", type: "SYSTEM", coords: null }
  ]);

  const addLog = (message, type = "INFO", coords = null) => {
    setTacticalLogs(prev => [{
      timestamp: formatSystemTime(),
      message: message.toUpperCase(),
      type,
      coords
    }, ...prev].slice(0, 50));
  };

  const LOCATIONS = {
    "taipei 101": { lat: 25.03397, lng: 121.56441 },
    "kaohsiung harbor": { lat: 22.6100, lng: 120.2750 },
    "sun moon lake": { lat: 23.8600, lng: 120.9100 },
    "costco hsinchu": { lat: 24.7865, lng: 121.0255 },
    "hsinchu science park": { lat: 24.7783, lng: 121.0163 },
    "hq": { lat: 34.0224, lng: -118.2851 },
    "base": { lat: 34.0224, lng: -118.2851 },
    "station (USC)": { lat: 34.0224, lng: -118.2851 }
  };

  const [globalMapCenter, setGlobalMapCenter] = useState([LOCATIONS["station (USC)"].lat, LOCATIONS["station (USC)"].lng]);
  const isImperial = unitSystem === 'imperial';

  const formatAltitude = (meters, { decimals = 0, includeUnit = true } = {}) => {
    const safeMeters = Number.isFinite(Number(meters)) ? Number(meters) : 0;
    const value = isImperial ? safeMeters * FEET_PER_METER : safeMeters;
    const rounded = roundTo(value, decimals);
    return includeUnit ? `${rounded}${isImperial ? 'FT' : 'M'}` : String(rounded);
  };

  const formatDistance = (meters, { decimals = 2, includeUnit = true } = {}) => {
    const safeMeters = Number.isFinite(Number(meters)) ? Number(meters) : 0;
    const value = isImperial ? (safeMeters / 1000) * MILES_PER_KM : safeMeters / 1000;
    const rounded = roundTo(value, decimals);
    return includeUnit ? `${rounded} ${isImperial ? 'MI' : 'KM'}` : String(rounded);
  };

  const formatSpeed = (kph, { decimals = 0, includeUnit = true } = {}) => {
    const safeKph = Number.isFinite(Number(kph)) ? Number(kph) : 0;
    const value = isImperial ? safeKph * MPH_PER_KPH : safeKph;
    const rounded = roundTo(value, decimals);
    return includeUnit ? `${rounded} ${isImperial ? 'MPH' : 'KPH'}` : String(rounded);
  };

  const formatTemperature = (celsius, { decimals = 0, includeUnit = true } = {}) => {
    const safeC = Number.isFinite(Number(celsius)) ? Number(celsius) : 0;
    const value = isImperial ? (safeC * 9) / 5 + 32 : safeC;
    const rounded = roundTo(value, decimals);
    return includeUnit ? `${rounded}°${isImperial ? 'F' : 'C'}` : String(rounded);
  };

  const formatVisibility = (km, { decimals = 1, includeUnit = true } = {}) => {
    const safeKm = Number.isFinite(Number(km)) ? Number(km) : 0;
    const value = isImperial ? safeKm * MILES_PER_KM : safeKm;
    const rounded = roundTo(value, decimals);
    return includeUnit ? `${rounded} ${isImperial ? 'MI' : 'KM'}` : String(rounded);
  };

  const formatWind = (windData) => {
    let speedKts = null;
    let direction = 'NW';

    if (windData && typeof windData === 'object') {
      if (Number.isFinite(Number(windData.windSpeedKts))) {
        speedKts = Number(windData.windSpeedKts);
      } else if (Number.isFinite(Number(windData.speedKts))) {
        speedKts = Number(windData.speedKts);
      }
      direction = windData.windDirection || windData.direction || direction;
    } else {
      const parsed = parseWindString(windData);
      if (parsed) {
        direction = parsed.direction;
        if (parsed.unit === 'KTS') speedKts = parsed.speed;
        if (parsed.unit === 'KPH') speedKts = parsed.speed / KPH_PER_KNOT;
        if (parsed.unit === 'MPH') speedKts = (parsed.speed / MPH_PER_KPH) / KPH_PER_KNOT;
      }
    }

    const finalSpeedKts = Number.isFinite(speedKts) ? speedKts : 12 / KPH_PER_KNOT;
    const speedValue = isImperial ? finalSpeedKts * KPH_PER_KNOT * MPH_PER_KPH : finalSpeedKts * KPH_PER_KNOT;
    return `${roundTo(speedValue, 0)} ${isImperial ? 'MPH' : 'KPH'} ${direction}`;
  };

  const altitudeToDisplayValue = (meters, decimals = 0) => {
    const safeMeters = Number.isFinite(Number(meters)) ? Number(meters) : 0;
    return String(roundTo(isImperial ? safeMeters * FEET_PER_METER : safeMeters, decimals));
  };

  const altitudeInputToMeters = (displayValue) => {
    const parsedValue = Number(displayValue);
    if (!Number.isFinite(parsedValue)) return Number.NaN;
    return isImperial ? parsedValue / FEET_PER_METER : parsedValue;
  };

  const changeGlobalLocation = (locationKey) => {
    const loc = LOCATIONS[locationKey];
    if (loc) {
      setGlobalMapCenter([loc.lat, loc.lng]);
      setTelemetry(prev => {
        const newSwarms = prev.swarms.map((s, idx) => {
           const offsetLat = idx * 0.003;
           const offsetLng = idx * 0.003;
           const newBaseLat = loc.lat + offsetLat;
           const newBaseLng = loc.lng - offsetLng;
           return {
             ...s,
             baseLat: newBaseLat,
             baseLng: newBaseLng,
             drones: s.drones.map((d, dIdx) => ({
                ...d,
                lat: newBaseLat + (dIdx * 0.0005),
                lng: newBaseLng + (dIdx * 0.0005)
             }))
           };
        });
        return { ...prev, swarms: newSwarms };
      });
      addLog(`Global theater anchor shifted to ${locationKey.toUpperCase()}`, "SYSTEM");
    }
  };

  // Global telemetry mockup
  const [telemetry, setTelemetry] = useState({
    swarms: [
      // Swarm 1 - Green (Friendly)
      { id: '01', status: 'IDLE', pwr: 98.4, role: 'RECON_MODE', color: '#39ff14', alt: 120, targetAlt: 120, dist: 0, speed: 0, baseLat: 34.0230, baseLng: -118.2840, waypoints: [], drones: [{id: 'ALPHA', pwr: 99, alt: 120, targetAlt: 120, lat: 34.0235, lng: -118.2838, waypoints: []}, {id: 'BETA', pwr: 98, alt: 120, targetAlt: 120, lat: 34.0228, lng: -118.2845, waypoints: []}, {id: 'GAMMA', pwr: 98, alt: 120, targetAlt: 120, lat: 34.0226, lng: -118.2835, waypoints: []}, {id: 'DELTA', pwr: 98, alt: 120, targetAlt: 120, lat: 34.0232, lng: -118.2832, waypoints: []}] },
      // Swarm 2 - Cyan/Blue (Friendly - alternate)
      { id: '02', status: 'IDLE', pwr: 74.1, role: 'TRANSIT_MODE', color: '#00ccff', alt: 250, targetAlt: 250, dist: 0, speed: 0, baseLat: 34.0200, baseLng: -118.2870, waypoints: [], drones: [{id: 'ECHO', pwr: 75, alt: 250, targetAlt: 250, lat: 34.0202, lng: -118.2865, waypoints: []}, {id: 'FOXTROT', pwr: 74, alt: 250, targetAlt: 250, lat: 34.0198, lng: -118.2872, waypoints: []}, {id: 'GOLF', pwr: 73, alt: 250, targetAlt: 250, lat: 34.0200, lng: -118.2875, waypoints: []}] },
    ],
    unassignedDrones: [
      { id: 'INDY_01', pwr: 92, alt: 150, targetAlt: 150, lat: 34.0250, lng: -118.2810, waypoints: [] },
      { id: 'INDY_02', pwr: 88, alt: 200, targetAlt: 200, lat: 34.0210, lng: -118.2890, waypoints: [] }
    ]
  });

  // Background Logging: 60s GPS Updates
  useEffect(() => {
    const logInterval = setInterval(() => {
      setTelemetry(prev => {
        prev.swarms.forEach(s => {
          if (s.status === 'TRANSIT') {
            addLog(`[HEADING] Swarm_${s.id} position: ${s.baseLat.toFixed(5)}, ${s.baseLng.toFixed(5)}`, "TELEMETRY", { lat: s.baseLat, lng: s.baseLng });
          }
        });
        return prev;
      });
    }, 60000);
    return () => clearInterval(logInterval);
  }, []);

  const addSwarm = (config = {}) => {
    const nextId = (telemetry.swarms.length + 1).toString().padStart(2, '0');
    const newSwarm = {
      id: nextId,
      status: 'IDLE',
      pwr: 100,
      role: 'GENERAL_PURPOSE',
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      alt: 300,
      targetAlt: 300,
      dist: 0,
      speed: 0,
      baseLat: config.lat || 34.0224,
      baseLng: config.lng || -118.2851,
      waypoints: [],
      drones: [
        { id: 'D1', pwr: 100, alt: 300, targetAlt: 300, lat: 34.0224, lng: -118.2851, waypoints: [] },
        { id: 'D2', pwr: 100, alt: 300, targetAlt: 300, lat: 34.0225, lng: -118.2852, waypoints: [] }
      ]
    };
    setTelemetry(prev => ({ ...prev, swarms: [...prev.swarms, newSwarm] }));
    addLog(`New Swarm ${nextId} commissioned`, "SYSTEM");
  };

  const removeSwarm = (id) => {
    setTelemetry(prev => ({ ...prev, swarms: prev.swarms.filter(s => s.id !== id) }));
  };

  const updateSwarmName = (id, newName) => {
    setTelemetry(prev => ({
      ...prev,
      swarms: prev.swarms.map(s => s.id === id ? { ...s, name: newName } : s)
    }));
    addLog(`Swarm ${id} designated as ${newName}`, "SYSTEM");
  };

  const addWaypointToSwarm = (swarmId, latlngs) => {
    const newPoints = Array.isArray(latlngs) ? latlngs : [latlngs];
    setTelemetry(prev => ({
      ...prev,
      swarms: prev.swarms.map(s => {
        if (s.id === swarmId) {
          const formatted = newPoints.map((pt, idx) => ({ ...pt, id: pt.id || Date.now() + Math.random(), label: `WP_${idx+1}` }));
          return { ...s, waypoints: [...s.waypoints, ...formatted] };
        }
        return s;
      })
    }));
    addLog(`Assigned ${newPoints.length} waypoints to Swarm ${swarmId}`, "MISSION");
  };

  const addWaypointToDrone = (swarmId, droneId, latlngs) => {
    const newPoints = Array.isArray(latlngs) ? latlngs : [latlngs];
    setTelemetry(prev => {
      if (swarmId) {
        return {
          ...prev,
          swarms: prev.swarms.map(s => {
            if (s.id === swarmId) {
              const formatted = newPoints.map((pt, idx) => ({ ...pt, id: pt.id || Date.now() + Math.random(), label: `WP_${idx+1}` }));
              const newDrones = s.drones.map(d => d.id === droneId ? { ...d, waypoints: [...(d.waypoints || []), ...formatted] } : d);
              return { ...s, drones: newDrones };
            }
            return s;
          })
        };
      } else {
        // Independent drone
        return {
          ...prev,
          unassignedDrones: (prev.unassignedDrones || []).map(d => {
            if (d.id === droneId) {
              const formatted = newPoints.map((pt, idx) => ({ ...pt, id: pt.id || Date.now() + Math.random(), label: `WP_${idx+1}` }));
              return { ...d, waypoints: [...(d.waypoints || []), ...formatted] };
            }
            return d;
          })
        };
      }
    });
    addLog(`Assigned ${newPoints.length} independent waypoints to UAV_${droneId}`, "MISSION");
  };
  
  // Mission Planning Draft (Target Lock)
  const [targetLock, setTargetLock] = useState({ waypoints: [], assignedSwarm: null });
  const [focusDrone, setFocusDrone] = useState(null); // { swarmId, droneId }
  const [activeVideoFeeds, setActiveVideoFeeds] = useState([]); // Array of { swarmId, droneId }
  const [enlargedFeed, setEnlargedFeed] = useState(null); // { swarmId, droneId } or null
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const [historyMissions, setHistoryMissions] = useState([
    { id: 'OP-771', name: 'GHOST SHORE', date: '2026-04-12', status: 'SUCCESS', duration: '01:42:33', assets: 12, paths: 22 },
    { id: 'OP-772', name: 'IRON RECON', date: '2026-04-14', status: 'SUCCESS', duration: '00:55:12', assets: 8, paths: 15 },
    { id: 'OP-773', name: 'URBAN SWEEP', date: '2026-04-15', status: 'ABORTED', duration: '00:12:05', assets: 15, paths: 4 },
    { id: 'OP-774', name: 'NIGHT OWL', date: '2026-04-18', status: 'SUCCESS', duration: '03:15:00', assets: 24, paths: 56 },
  ]);

  const addMissionToHistory = (mission) => {
    const newRecord = {
      id: `OP-${Math.floor(Math.random() * 900 + 100)}`,
      name: mission.destName || 'UNTITLED_OPS',
      date: new Date().toISOString().split('T')[0],
      status: 'EXECUTING',
      duration: `--:--`,
      assets: 4, 
      paths: mission.waypoints ? mission.waypoints.length : 1
    };
    setHistoryMissions(prev => [newRecord, ...prev]);
  };

  const toggleVideoFeed = (swarmId, droneId) => {
    setActiveVideoFeeds(prev => {
      const isAlreadyActive = prev.find(f => f.swarmId === swarmId && f.droneId === droneId);
      if (isAlreadyActive) {
        return prev.filter(f => !(f.swarmId === swarmId && f.droneId === droneId));
      } else {
        return [...prev, { swarmId, droneId }];
      }
    });
  };

  const [expandedSwarms, setExpandedSwarms] = useState({});
  const toggleSwarmExpand = (id, forceState) => {
    setExpandedSwarms(prev => {
      const isExpanded = prev[id] !== false; // defaults to true
      return { ...prev, [id]: forceState !== undefined ? forceState : !isExpanded };
    });
  };

  const formationRef = useRef(activeFormation);
  const targetLockRef = useRef(targetLock);
  const simLastTickRef = useRef(Date.now());

  useEffect(() => {
    formationRef.current = activeFormation;
  }, [activeFormation]);

  useEffect(() => {
    targetLockRef.current = targetLock;
  }, [targetLock]);

  // Dynamic simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      const tickNow = Date.now();
      const deltaSeconds = Math.min(0.25, Math.max(0.05, (tickNow - simLastTickRef.current) / 1000));
      simLastTickRef.current = tickNow;
      const timeFactor = Date.now() / 1000;
      
      setTelemetry(prev => ({
        ...prev,
        swarms: prev.swarms.map((s, sIdx) => {
          if (s.status === 'MAINTENANCE') return s;
          
          let newBaseLat = s.baseLat;
          let newBaseLng = s.baseLng;
          let newWaypoints = [...(s.waypoints || [])];

          // Check for Arrival and Dwell logic
          if (newWaypoints.length > 0) {
            const target = newWaypoints[0];
            const dist = getDistanceMeters(newBaseLat, newBaseLng, target.lat, target.lng);
            
            if (dist < 10) { // Within 10m
              if (!target.landedAt) {
                 target.landedAt = Date.now();
                 addLog(`[ARRIVAL] Swarm_${s.id} reached ${target.label || 'Target'}`, "TACTICAL", { lat: target.lat, lng: target.lng });
              }
              const dwellSecs = (Date.now() - target.landedAt) / 1000;
              if (dwellSecs > 5) { // 5s dwell for simulation
                 addLog(`[DEPART] Swarm_${s.id} departing from ${target.label || 'Target'}`, "TACTICAL", { lat: target.lat, lng: target.lng });
                 newWaypoints.shift();
              }
              return { ...s, baseLat: target.lat, baseLng: target.lng, waypoints: newWaypoints, status: 'STATIONARY_DWELL' };
            }
          }

          let groundSpeedKph = 0;

          if (newWaypoints.length > 0) {
            const target = newWaypoints[0];
            const windKts = lastAIParsedCommand && lastAIParsedCommand.swarmId === s.id && lastAIParsedCommand.missionWeather
              ? Number(lastAIParsedCommand.missionWeather.windSpeedKts ?? 0)
              : 0;
            const windPenaltyMps = Math.min(3, windKts * 0.257);
            const cruiseMps = Math.max(8, SWARM_CRUISE_MPS - windPenaltyMps);
            const movement = moveTowardCoordinates(
              newBaseLat,
              newBaseLng,
              target.lat,
              target.lng,
              cruiseMps * deltaSeconds
            );

            if (movement.remainingMeters > 0) {
              newBaseLat = movement.lat;
              newBaseLng = movement.lng;
              s.status = 'TRANSIT';
            } else {
              newBaseLat = target.lat;
              newBaseLng = target.lng;
              // Transition handled in the Arrival block above
            }
            groundSpeedKph = (movement.movedMeters / deltaSeconds) * 3.6;
          }

          const nextSwarmAlt = easeAltitude(
            s.alt,
            s.targetAlt ?? s.alt,
            deltaSeconds,
            SWARM_CLIMB_MPS,
            SWARM_DESCENT_MPS
          );
          let newDrones = s.drones.map((d, dIdx) => {
             const droneTargetAlt = d.targetAlt ?? s.targetAlt ?? nextSwarmAlt;
             // Handle independent drone flight
             if (d.waypoints && d.waypoints.length > 0) {
                const target = d.waypoints[0];
                const dist = getDistanceMeters(d.lat, d.lng, target.lat, target.lng);
                
                if (dist < 5) { // Arrival
                   if (!target.landedAt) {
                      target.landedAt = Date.now();
                      addLog(`[ARRIVAL] UAV_${d.id} reached independent target`, "TACTICAL", { lat: target.lat, lng: target.lng });
                   }
                   if ((Date.now() - target.landedAt) > 5000) {
                      return { ...d, waypoints: d.waypoints.slice(1) };
                   }
                   return { ...d, lat: target.lat, lng: target.lng };
                }

                // Move toward target
                const movement = moveTowardCoordinates(
                  d.lat,
                  d.lng,
                  target.lat,
                  target.lng,
                  DRONE_CRUISE_MPS * deltaSeconds
                );
                return {
                   ...d,
                   lat: movement.lat,
                   lng: movement.lng,
                   alt: easeAltitude(
                     d.alt,
                     droneTargetAlt,
                     deltaSeconds,
                     DRONE_CLIMB_MPS,
                     DRONE_DESCENT_MPS
                   ),
                   targetAlt: droneTargetAlt,
                   speed: (movement.movedMeters / deltaSeconds) * 3.6,
                   pwr: Math.max(0, d.pwr - 0.02)
                };
             }

             // Handle swarm orbital flight
             const count = s.drones.length;
             let tLat = newBaseLat;
             let tLng = newBaseLng;
             const angle = (Math.PI * 2 / count) * dIdx + (timeFactor * 0.2);
             const rOffset = 0.0003 + (Math.sin(timeFactor * 2 + dIdx) * 0.0001);
             tLat += Math.cos(angle) * rOffset;
             tLng += Math.sin(angle) * rOffset;
             const formationDist = getDistanceMeters(d.lat, d.lng, tLat, tLng);
             const isJoiningFormation = !!d.joiningFormation;
             const movement = moveTowardCoordinates(
               d.lat,
               d.lng,
               tLat,
               tLng,
               (isJoiningFormation ? FORMATION_JOIN_MPS : FORMATION_FOLLOW_MPS) * deltaSeconds
             );
             return {
               ...d,
               pwr: Math.max(0, d.pwr - (Math.random() * 0.01)),
               alt: easeAltitude(
                 d.alt,
                 droneTargetAlt,
                 deltaSeconds,
                 DRONE_CLIMB_MPS,
                 DRONE_DESCENT_MPS
               ),
               targetAlt: droneTargetAlt,
               joiningFormation: isJoiningFormation && formationDist > 8,
               speed: (movement.movedMeters / deltaSeconds) * 3.6,
               lat: movement.lat,
               lng: movement.lng
             };
          });

          return {
            ...s,
            baseLat: newBaseLat,
            baseLng: newBaseLng,
            waypoints: newWaypoints,
            pwr: Math.max(0, s.pwr - 0.005), 
            alt: nextSwarmAlt,
            targetAlt: s.targetAlt ?? s.alt,
            speed: groundSpeedKph,
            drones: newDrones
          };
        }),
        unassignedDrones: (prev.unassignedDrones || []).map(d => {
          const droneTargetAlt = d.targetAlt ?? d.alt;
          
          if (d.waypoints && d.waypoints.length > 0) {
            const target = d.waypoints[0];
            const dist = getDistanceMeters(d.lat, d.lng, target.lat, target.lng);
            
            if (dist < 5) { // Arrival
               if (!target.landedAt) {
                  target.landedAt = Date.now();
                  addLog(`[ARRIVAL] UAV_${d.id} reached independent target`, "TACTICAL", { lat: target.lat, lng: target.lng });
               }
               if ((Date.now() - target.landedAt) > 5000) {
                  return { ...d, waypoints: d.waypoints.slice(1) };
               }
               return { ...d, lat: target.lat, lng: target.lng };
            }

            // Move toward target
            const movement = moveTowardCoordinates(
              d.lat,
              d.lng,
              target.lat,
              target.lng,
              DRONE_CRUISE_MPS * deltaSeconds
            );
            return {
               ...d,
               lat: movement.lat,
               lng: movement.lng,
               alt: easeAltitude(
                 d.alt,
                 droneTargetAlt,
                 deltaSeconds,
                 DRONE_CLIMB_MPS,
                 DRONE_DESCENT_MPS
               ),
               targetAlt: droneTargetAlt,
               speed: (movement.movedMeters / deltaSeconds) * 3.6,
               pwr: Math.max(0, d.pwr - 0.02)
            };
          }

          return {
            ...d,
            alt: easeAltitude(
              d.alt,
              droneTargetAlt,
              deltaSeconds,
              DRONE_CLIMB_MPS,
              DRONE_DESCENT_MPS
            ),
            targetAlt: droneTargetAlt,
            speed: d.speed ?? 0,
            pwr: Math.max(0, d.pwr - (Math.random() * 0.004))
          };
        })
      }));
    }, 100);
    return () => clearInterval(interval);
  }, [lastAIParsedCommand]);

  const prepareManualReview = (swarmId, waypoints, droneId = null) => {
    if (waypoints.length === 0) return;

    let startLat = 0;
    let startLng = 0;
    let assigneeName = '';

    if (swarmId) {
      const swarm = telemetry.swarms.find(s => s.id === swarmId);
      if (!swarm) return;
      startLat = swarm.baseLat;
      startLng = swarm.baseLng;
      assigneeName = `SWARM_${swarmId}`;

      if (droneId) {
        const drone = swarm.drones.find(d => d.id === droneId);
        if (drone) {
          startLat = drone.lat;
          startLng = drone.lng;
          assigneeName = `UAV_${droneId}`;
        }
      }
    } else if (droneId) {
      const drone = (telemetry.unassignedDrones || []).find(d => d.id === droneId);
      if (!drone) return;
      startLat = drone.lat;
      startLng = drone.lng;
      assigneeName = `UAV_${droneId}`;
    } else {
      return;
    }

    // Simulate weather for this manual route
    const weatherConditions = ["OPTIMAL", "MARGINAL", "STABLE"];
    const missionWeather = makeMissionWeather({
      condition: weatherConditions[Math.floor(Math.random() * 3)],
      speedKts: Math.floor(Math.random() * 10 + 5),
      direction: 'NE',
      visibilityKm: 10,
      tempC: 24,
      humidity: '60%'
    });

    const airSpeedKPH = 80;
    
    // Calculate Path Details
    let totalDist = 0;
    let prev = { lat: startLat, lng: startLng };
    const wpsWithETA = waypoints.map((wp, idx) => {
       const d = Math.sqrt(Math.pow(wp.lat - prev.lat, 2) + Math.pow(wp.lng - prev.lng, 2)) * 111320;
       totalDist += d;
       const travelSecs = d / (airSpeedKPH / 3.6);
       const eta = new Date(Date.now() + (totalDist / (airSpeedKPH / 3.6)) * 1000);
       prev = wp;
       return { ...wp, eta: formatSystemTime(eta), label: `WAYPOINT_${idx+1}`, distanceMeters: d };
    });

    const parsedData = {
      raw: "MANUAL_TACTICAL_PLAN",
      swarmId,
      targetDroneId: droneId,
      destination: waypoints[waypoints.length - 1],
      waypoints: wpsWithETA,
      destName: `MULTIPOINT_ALPHA_${assigneeName}`,
      intent: "MANUAL_PATH",
      missionWeather,
      predictedGS: airSpeedKPH,
      distanceMeters: totalDist,
      durationMin: Math.ceil((totalDist / (airSpeedKPH / 3.6)) / 60),
      eta: wpsWithETA[wpsWithETA.length - 1].eta,
      timestamp: formatSystemTime(),
      confidence: 1.0,
      tasks: wpsWithETA.map(wp => ({ id: wp.id, action: `TRANSIT_TO_${wp.label}`, status: 'PENDING' }))
    };

    setLastAIParsedCommand(parsedData);
    setActiveScreen(3);
    addLog(`Drafted manual path for ${assigneeName} - Review required`, "SYSTEM");
  };

  const processAIVoiceCommand = (text) => {
    // Immediately log exactly what the vocal AI deciphered
    addLog(`[VOICE_RECV]: "${text}"`, "VOICE");

    const input = text.toLowerCase();
    const swarmMatch = input.match(/swarm\s*(\d+)/i) || input.match(/team\s*(\d+)/i);
    const swarmId = swarmMatch ? swarmMatch[1].padStart(2, '0') : '01';
    
    const droneMatch = input.match(/drone\s*([a-z0-9]+)/i) || input.match(/uav\s*([a-z0-9]+)/i);
    const targetDroneId = droneMatch ? droneMatch[1].toUpperCase() : null;
    
    let destination = null;
    let destName = "Unknown";
    let bestScore = 0;
    for (const [key, coords] of Object.entries(landmarks)) {
      let score = 0;
      key.split(/\s+/).forEach(kw => { if (input.includes(kw)) score += 1; });
      if (input.includes(key)) score += 2;
      if (score > bestScore) { bestScore = score; destination = coords; destName = key.toUpperCase(); }
    }
    if (bestScore < 1) { destination = { lat: 25.0, lng: 121.0 }; destName = "COORDINATE_DELTA"; }

    let intent = "TRANSIT";
    if (input.includes("recon")) intent = "RECONNAISSANCE";
    if (input.includes("strike") || input.includes("attack")) intent = "STRIKE";
    if (input.includes("stop") || input.includes("abort")) intent = "ABORT_MOTION";

    const swarm = telemetry.swarms.find(s => s.id === swarmId) || telemetry.swarms[0];
    const distM = Math.sqrt(Math.pow(destination.lat - swarm.baseLat, 2) + Math.pow(destination.lng - swarm.baseLng, 2)) * 111320;
    
    const weatherConditions = ["OPTIMAL", "MARGINAL", "STABLE"];
    const missionWeather = makeMissionWeather({
      condition: weatherConditions[Math.floor(Math.random() * 3)],
      speedKts: Math.floor(Math.random() * 10 + 5),
      direction: 'NE',
      visibilityKm: 10,
      tempC: 24,
      humidity: '60%'
    });

    const airSpeedKPH = 80;
    const predictedGS = 75;
    const flightSecsCorrected = distM / (predictedGS / 3.6);
    const eta = new Date(Date.now() + flightSecsCorrected * 1000);

    const parsedData = {
      raw: text, swarmId, targetDroneId, destination, destName, intent, missionWeather,
      predictedGS, distanceMeters: distM, durationMin: Math.ceil(flightSecsCorrected / 60),
      eta: formatSystemTime(eta), timestamp: formatSystemTime(), confidence: 0.94,
      tasks: [{ id: 1, action: 'DEPARTURE', status: 'PENDING' }, { id: 2, action: 'TRANSIT', status: 'PENDING' }]
    };

    if (intent === 'ABORT_MOTION') {
       setTelemetry(prev => ({ ...prev, swarms: prev.swarms.map(s => s.id === swarmId ? { ...s, waypoints: [], status: 'STATIONARY' } : s) }));
       addLog(`Emergency Stop issued for Swarm ${swarmId}`, "ALERT");
       setActiveScreen(1);
    } else {
       setLastAIParsedCommand(parsedData);
       setActiveScreen(3);
    }
  };

  const updateDraftWaypoint = (id, newLatlng) => {
    setTargetLock(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp => wp.id === id ? { ...wp, ...newLatlng } : wp)
    }));
  };

  const clearSwarmWaypoints = (swarmId) => {
    setTelemetry(prev => ({ ...prev, swarms: prev.swarms.map(s => s.id === swarmId ? { ...s, waypoints: [], status: 'STATIONARY' } : s) }));
  };

  const moveDroneToSwarm = (droneId, sourceSwarmId, targetSwarmId) => {
    setTelemetry(prev => {
      // Find the drone from source swarm or unassigned list
      let drone = null;
      let newSwarms = prev.swarms;
      let newUnassigned = prev.unassignedDrones || [];

      if (sourceSwarmId) {
        const sourceSwarm = prev.swarms.find(s => s.id === sourceSwarmId);
        if (sourceSwarm) {
          drone = sourceSwarm.drones.find(d => d.id === droneId);
          newSwarms = newSwarms.map(s => s.id === sourceSwarmId ? { ...s, drones: s.drones.filter(d => d.id !== droneId) } : s);
        }
      } else {
        drone = newUnassigned.find(d => d.id === droneId);
        newUnassigned = newUnassigned.filter(d => d.id !== droneId);
      }

      if (!drone) return prev;

      // Add to target swarm or unassigned list
      if (targetSwarmId) {
        const targetSwarm = newSwarms.find(s => s.id === targetSwarmId);
        if (!targetSwarm) return prev;

        newSwarms = newSwarms.map(s => s.id === targetSwarmId ? {
          ...s,
          drones: [
            ...s.drones,
            {
              ...drone,
              waypoints: [],
              joiningFormation: true,
              targetAlt: targetSwarm.targetAlt ?? targetSwarm.alt
            }
          ]
        } : s);
      } else {
        newUnassigned = [...newUnassigned, { ...drone, waypoints: [], joiningFormation: false }];
      }

      return { ...prev, swarms: newSwarms, unassignedDrones: newUnassigned };
    });
    const targetLabel = targetSwarmId ? `Swarm ${targetSwarmId}` : `INDEPENDENT UNITS`;
    addLog(`Drone ${droneId} reassigned to ${targetLabel}`, "SYSTEM");
  };

  const updateDroneAlt = (droneId, newAlt) => {
    const clampedAlt = clampAltitude(newAlt);
    setTelemetry(prev => {
      return {
        ...prev,
        swarms: prev.swarms.map(s => ({
          ...s,
          drones: s.drones.map(d => d.id === droneId ? { ...d, targetAlt: clampedAlt } : d)
        })),
        unassignedDrones: (prev.unassignedDrones || []).map(d => d.id === droneId ? { ...d, targetAlt: clampedAlt } : d)
      };
    });
    addLog(`UAV_${droneId} commanding altitude ${clampedAlt}m`, "FLIGHT_CTRL");
  };

  const updateSwarmAlt = (swarmId, newAlt) => {
    const clampedAlt = clampAltitude(newAlt);
    setTelemetry(prev => ({
      ...prev,
      swarms: prev.swarms.map(s => {
        if (s.id === swarmId) {
          return {
            ...s,
            targetAlt: clampedAlt,
            drones: s.drones.map(d => ({ ...d, targetAlt: clampedAlt }))
          };
        }
        return s;
      })
    }));
    addLog(`SWARM_${swarmId} commanding altitude ${clampedAlt}m`, "FLIGHT_CTRL");
  };

  const value = {
    activeScreen, setActiveScreen,
    role, setRole,
    tacticalPhase, setTacticalPhase,
    telemetry, setTelemetry,
    activeFormation, setActiveFormation,
    expandedSwarms, toggleSwarmExpand,
    targetLock, setTargetLock, updateDraftWaypoint,
    focusDrone, setFocusDrone,
    addSwarm, removeSwarm, addWaypointToSwarm, addWaypointToDrone, clearSwarmWaypoints,
    activeVideoFeeds, toggleVideoFeed,
    enlargedFeed, setEnlargedFeed,
    historyMissions, setHistoryMissions, addMissionToHistory,
    selectedHistoryId, setSelectedHistoryId,
    lastAIParsedCommand, setLastAIParsedCommand,
    processAIVoiceCommand,
    tacticalLogs, addLog,
    prepareManualReview,
    updateSwarmName,
    moveDroneToSwarm,
    updateDroneAlt,
    updateSwarmAlt,
    unitSystem,
    setUnitSystem,
    formatAltitude,
    formatDistance,
    formatSpeed,
    formatTemperature,
    formatVisibility,
    formatWind,
    altitudeToDisplayValue,
    altitudeInputToMeters,
    LOCATIONS,
    globalMapCenter,
    changeGlobalLocation
  };

  return (
    <MissionContext.Provider value={value}>
      {children}
    </MissionContext.Provider>
  );
}
