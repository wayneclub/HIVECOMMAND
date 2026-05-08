import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const MissionContext = createContext();
const EARTH_RADIUS_M = 6371000;
const FEET_PER_METER = 3.28084;
const MILES_PER_KM = 0.621371;
const MPH_PER_KPH = 0.621371;
const KPH_PER_KNOT = 1.852;
const SWARM_CRUISE_MPS = 40;
const DRONE_CRUISE_MPS = 40;
const FORMATION_FOLLOW_MPS = 24;
const FORMATION_JOIN_MPS = 32;
const SWARM_CLIMB_MPS = 12;
const SWARM_DESCENT_MPS = 2.5;
const DRONE_CLIMB_MPS = 12;
const DRONE_DESCENT_MPS = 3.2;
const DEFAULT_MISSION_TAKEOFF_ALT = 120;
const MIN_HORIZONTAL_MOTION_ALT = 12;
const HORIZONTAL_MOTION_ALT_RATIO = 0.82;
const DEFAULT_OPERATOR_NAME = 'Operator Indiana 1';
const DEFAULT_COMMANDER_NAME = 'Commander Indiana 6';
const USC_VITERBI_LAT = 34.0206925;
const USC_VITERBI_LNG = -118.2895045;
const LEAVEY_LIBRARY_LAT = 34.0217725;
const LEAVEY_LIBRARY_LNG = -118.2828810;
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
const canMoveAtAltitude = (currentAlt, targetAlt) => clampAltitude(targetAlt ?? currentAlt) > 0;
const canTranslateAtAltitude = (currentAlt, targetAlt) => (
  canMoveAtAltitude(currentAlt, targetAlt) && (() => {
    const current = Number(currentAlt ?? 0);
    const target = clampAltitude(targetAlt ?? currentAlt);
    const requiredAltitude = Math.max(MIN_HORIZONTAL_MOTION_ALT, target * HORIZONTAL_MOTION_ALT_RATIO);
    return current >= requiredAltitude;
  })()
);
const resolveMissionTakeoffAltitude = (currentTargetAlt, fallbackAlt = DEFAULT_MISSION_TAKEOFF_ALT) => {
  const clampedCurrent = clampAltitude(currentTargetAlt);
  return clampedCurrent > 0 ? clampedCurrent : fallbackAlt;
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
const formatElapsedDuration = (elapsedSeconds) => {
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};
const getSwarmTrackPoint = (swarm) => {
  if (!swarm) return null;
  if (swarm.drones?.length) {
    return {
      lat: swarm.drones.reduce((sum, drone) => sum + drone.lat, 0) / swarm.drones.length,
      lng: swarm.drones.reduce((sum, drone) => sum + drone.lng, 0) / swarm.drones.length,
      alt: swarm.alt ?? 0,
      speed: swarm.speed ?? 0
    };
  }
  return { lat: swarm.baseLat, lng: swarm.baseLng, alt: swarm.alt ?? 0, speed: swarm.speed ?? 0 };
};
const getMissionTrackPoint = (mission, telemetry) => {
  if (!mission) return null;
  if (mission.targetDroneId) {
    const ownerSwarm = telemetry.swarms.find((swarm) => swarm.drones?.some((drone) => drone.id === mission.targetDroneId));
    const swarmDrone = ownerSwarm?.drones?.find((drone) => drone.id === mission.targetDroneId);
    const independentDrone = telemetry.unassignedDrones?.find((drone) => drone.id === mission.targetDroneId);
    const drone = swarmDrone || independentDrone;
    return drone ? { lat: drone.lat, lng: drone.lng, alt: drone.alt ?? 0, speed: drone.speed ?? 0 } : null;
  }
  const swarm = telemetry.swarms.find((item) => item.id === mission.swarmId);
  return getSwarmTrackPoint(swarm);
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
    "usc command": { lat: USC_VITERBI_LAT, lng: USC_VITERBI_LNG },
    "downtown los angeles": { lat: 34.0522, lng: -118.2437 },
    "lax": { lat: 33.9416, lng: -118.4085 },
    "long beach harbor": { lat: 33.7542, lng: -118.2167 },
    "san diego bay": { lat: 32.6907, lng: -117.1780 },
    "las vegas strip": { lat: 36.1147, lng: -115.1728 },
    "hq": { lat: USC_VITERBI_LAT, lng: USC_VITERBI_LNG },
    "base": { lat: USC_VITERBI_LAT, lng: USC_VITERBI_LNG },
    "station (USC)": { lat: USC_VITERBI_LAT, lng: USC_VITERBI_LNG }
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
             homeBaseLat: newBaseLat,
             homeBaseLng: newBaseLng,
             drones: s.drones.map((d, dIdx) => ({
                ...d,
                lat: newBaseLat + (dIdx * 0.0005),
                lng: newBaseLng + (dIdx * 0.0005),
                homeLat: newBaseLat + (dIdx * 0.0005),
                homeLng: newBaseLng + (dIdx * 0.0005)
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
      {
        id: '01',
        status: 'IDLE',
        pwr: 96.8,
        role: 'RECON_MODE',
        color: '#39ff14',
        alt: 0,
        targetAlt: 0,
        dist: 0,
        speed: 0,
        baseLat: USC_VITERBI_LAT,
        baseLng: USC_VITERBI_LNG,
        homeBaseLat: USC_VITERBI_LAT,
        homeBaseLng: USC_VITERBI_LNG,
        waypoints: [],
        drones: [
          { id: '01', pwr: 99, alt: 0, targetAlt: 0, lat: 34.0210925, lng: -118.2893045, homeLat: 34.0210925, homeLng: -118.2893045, waypoints: [] },
          { id: '02', pwr: 98, alt: 0, targetAlt: 0, lat: 34.0204925, lng: -118.2899045, homeLat: 34.0204925, homeLng: -118.2899045, waypoints: [] },
          { id: '03', pwr: 97, alt: 0, targetAlt: 0, lat: 34.0202925, lng: -118.2890045, homeLat: 34.0202925, homeLng: -118.2890045, waypoints: [] },
          { id: '04', pwr: 96, alt: 0, targetAlt: 0, lat: 34.0208925, lng: -118.2888045, homeLat: 34.0208925, homeLng: -118.2888045, waypoints: [] }
        ]
      },
    ],
    unassignedDrones: [
      { id: '05', pwr: 92, alt: 150, targetAlt: 150, lat: 34.0215925, lng: -118.2883045, homeLat: 34.0215925, homeLng: -118.2883045, waypoints: [] }
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
      baseLat: config.lat || USC_VITERBI_LAT,
      baseLng: config.lng || USC_VITERBI_LNG,
      homeBaseLat: config.lat || USC_VITERBI_LAT,
      homeBaseLng: config.lng || USC_VITERBI_LNG,
      waypoints: [],
      drones: [
        { id: 'D1', pwr: 100, alt: 300, targetAlt: 300, lat: USC_VITERBI_LAT, lng: USC_VITERBI_LNG, homeLat: USC_VITERBI_LAT, homeLng: USC_VITERBI_LNG, waypoints: [] },
        { id: 'D2', pwr: 100, alt: 300, targetAlt: 300, lat: USC_VITERBI_LAT + 0.0001, lng: USC_VITERBI_LNG - 0.0001, homeLat: USC_VITERBI_LAT + 0.0001, homeLng: USC_VITERBI_LNG - 0.0001, waypoints: [] }
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
          const missionTakeoffAlt = resolveMissionTakeoffAltitude(s.targetAlt ?? s.alt);
          return {
            ...s,
            targetAlt: missionTakeoffAlt,
            waypoints: [...s.waypoints, ...formatted],
            drones: s.drones.map(d => ({
              ...d,
              targetAlt: resolveMissionTakeoffAltitude(d.targetAlt ?? d.alt, missionTakeoffAlt)
            }))
          };
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
              const missionTakeoffAlt = resolveMissionTakeoffAltitude(s.targetAlt ?? s.alt);
              const newDrones = s.drones.map(d => d.id === droneId ? {
                ...d,
                targetAlt: resolveMissionTakeoffAltitude(d.targetAlt ?? d.alt, missionTakeoffAlt),
                waypoints: [...(d.waypoints || []), ...formatted]
              } : d);
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
              return {
                ...d,
                targetAlt: resolveMissionTakeoffAltitude(d.targetAlt ?? d.alt),
                waypoints: [...(d.waypoints || []), ...formatted]
              };
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
  const [currentMissionHistoryId, setCurrentMissionHistoryId] = useState(null);
  const [historyMissions, setHistoryMissions] = useState([]);
  const currentMissionHistoryIdRef = useRef(null);
  const historyTrackSampleRef = useRef({ historyId: null, sampledAt: 0 });

  useEffect(() => {
    currentMissionHistoryIdRef.current = currentMissionHistoryId;
  }, [currentMissionHistoryId]);

  const addMissionHistoryEvent = (historyId, label, detail, occurredAt = Date.now()) => {
    if (!historyId) return;
    setHistoryMissions(prev => prev.map(mission => {
      if (mission.id !== historyId) return mission;
      const startedAt = mission.startedAt || occurredAt;
      const elapsedSeconds = Math.max(0, Math.round((occurredAt - startedAt) / 1000));
      const nextEvent = {
        id: `${historyId}-${occurredAt}-${label}`,
        t: `T+${formatElapsedDuration(elapsedSeconds)}`,
        label,
        d: detail,
        at: occurredAt
      };
      return { ...mission, timeline: [...(mission.timeline || []), nextEvent] };
    }));
  };

  const addMissionToHistory = (mission) => {
    const historyId = `OP-${Math.floor(Math.random() * 900 + 100)}`;
    const startedAt = Date.now();
    const routePoints = mission.waypoints || (mission.destination ? [mission.destination] : []);
    const originPoint = mission.targetDroneId
      ? (() => {
          const ownerSwarm = telemetry.swarms.find((swarm) => swarm.drones?.some((drone) => drone.id === mission.targetDroneId));
          const swarmDrone = ownerSwarm?.drones?.find((drone) => drone.id === mission.targetDroneId);
          const independentDrone = telemetry.unassignedDrones?.find((drone) => drone.id === mission.targetDroneId);
          const drone = swarmDrone || independentDrone;
          return drone ? [drone.lat, drone.lng] : [USC_VITERBI_LAT, USC_VITERBI_LNG];
        })()
      : (() => {
          const swarm = telemetry.swarms.find((item) => item.id === mission.swarmId) || telemetry.swarms[0];
          const point = getSwarmTrackPoint(swarm);
          return point ? [point.lat, point.lng] : [USC_VITERBI_LAT, USC_VITERBI_LNG];
        })();
    const focusPoint = routePoints[routePoints.length - 1] || mission.destination || { lat: USC_VITERBI_LAT, lng: USC_VITERBI_LNG };
    const newRecord = {
      id: historyId,
      name: mission.destName || 'UNTITLED_OPS',
      date: new Date().toISOString().split('T')[0],
      status: 'EXECUTING',
      duration: '--:--',
      assets: mission.targetDroneId ? 1 : 4,
      paths: routePoints.length || 1,
      operatorName: DEFAULT_OPERATOR_NAME,
      commanderName: DEFAULT_COMMANDER_NAME,
      centerLat: focusPoint.lat,
      centerLng: focusPoint.lng,
      swarmId: mission.swarmId || null,
      targetDroneId: mission.targetDroneId || null,
      plannedRoute: routePoints.map((wp) => [wp.lat, wp.lng]),
      route: [originPoint, ...routePoints.map((wp) => [wp.lat, wp.lng])],
      actualRoute: [originPoint],
      startedAt,
      endedAt: null,
      timeline: [
        {
          id: `${historyId}-${startedAt}-deploy`,
          t: 'T+00:00:00',
          label: 'DEPLOYMENT',
          d: `Mission launched toward ${(mission.destName || 'assigned target').replace(/_/g, ' ').toUpperCase()}.`,
          at: startedAt
        }
      ]
    };
    setCurrentMissionHistoryId(historyId);
    currentMissionHistoryIdRef.current = historyId;
    historyTrackSampleRef.current = { historyId, sampledAt: startedAt };
    setHistoryMissions(prev => [newRecord, ...prev]);
    return historyId;
  };

  const updateMissionHistoryStatus = (status, overrides = {}, historyId = currentMissionHistoryId) => {
    if (!historyId) return;
    setHistoryMissions(prev => prev.map(mission => {
      if (mission.id !== historyId) return mission;

      const startedAt = mission.startedAt || Date.now();
      const endedAt = overrides.endedAt || Date.now();
      const elapsedSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));

      return {
        ...mission,
        status,
        duration: overrides.duration || formatElapsedDuration(elapsedSeconds),
        operatorName: overrides.operatorName || mission.operatorName || DEFAULT_OPERATOR_NAME,
        commanderName: overrides.commanderName || mission.commanderName || DEFAULT_COMMANDER_NAME,
        endedAt: status === 'SUCCESS' || status === 'ABORTED' ? endedAt : mission.endedAt,
        ...overrides
      };
    }));
    if (status === 'SUCCESS') addMissionHistoryEvent(historyId, 'MISSION_COMPLETE', 'Mission reached final objective and completed successfully.');
    if (status === 'ABORTED') addMissionHistoryEvent(historyId, 'MISSION_ABORTED', 'Mission execution halted before completion.');
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

  useEffect(() => {
    const historyId = currentMissionHistoryIdRef.current;
    if (!historyId) return;

    const mission = historyMissions.find((item) => item.id === historyId);
    if (!mission || mission.status === 'SUCCESS' || mission.status === 'ABORTED') return;

    const point = getMissionTrackPoint(mission, telemetry);
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;

    const now = Date.now();
    if (historyTrackSampleRef.current.historyId !== historyId) {
      historyTrackSampleRef.current = { historyId, sampledAt: 0 };
    }
    if (now - historyTrackSampleRef.current.sampledAt < 1000) return;
    historyTrackSampleRef.current.sampledAt = now;

    setHistoryMissions(prev => prev.map((record) => {
      if (record.id !== historyId) return record;
      const actualRoute = Array.isArray(record.actualRoute) ? [...record.actualRoute] : [];
      const lastPoint = actualRoute[actualRoute.length - 1];
      if (!lastPoint || getDistanceMeters(lastPoint[0], lastPoint[1], point.lat, point.lng) > 3) {
        actualRoute.push([point.lat, point.lng]);
      }
      const elapsedSeconds = Math.max(0, Math.round((now - (record.startedAt || now)) / 1000));
      return {
        ...record,
        actualRoute,
        duration: formatElapsedDuration(elapsedSeconds),
        centerLat: point.lat,
        centerLng: point.lng,
        lastKnownAlt: point.alt ?? record.lastKnownAlt ?? 0,
        lastKnownSpeed: point.speed ?? record.lastKnownSpeed ?? 0
      };
    }));
  }, [telemetry, historyMissions]);

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
          const swarmCanMove = canTranslateAtAltitude(s.alt, s.targetAlt);
          const swarmCenterPoint = getSwarmTrackPoint(s) || { lat: newBaseLat, lng: newBaseLng };

          // Check for Arrival and Dwell logic
          if (swarmCanMove && newWaypoints.length > 0) {
            const target = newWaypoints[0];
            const dist = getDistanceMeters(swarmCenterPoint.lat, swarmCenterPoint.lng, target.lat, target.lng);
            
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

          if (swarmCanMove && newWaypoints.length > 0) {
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
              s.status = 'TRANSIT';
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
             const droneCanMove = canTranslateAtAltitude(d.alt, droneTargetAlt);
             // Handle independent drone flight
             if (droneCanMove && d.waypoints && d.waypoints.length > 0) {
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

             if (!droneCanMove) {
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
                 speed: 0
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
          const droneCanMove = canTranslateAtAltitude(d.alt, droneTargetAlt);
          
          if (droneCanMove && d.waypoints && d.waypoints.length > 0) {
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

          if (!droneCanMove) {
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
              speed: 0
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

    // Temporary voice stub: bypass parsing/API and always dispatch Swarm 01 to Leavey Library.
    // Keep the original parsing flow commented for quick restore later.
    /*
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
    if (bestScore < 1) { destination = { lat: 34.0522, lng: -118.2437 }; destName = "DOWNTOWN_LOS_ANGELES"; }

    let intent = "TRANSIT";
    if (input.includes("recon")) intent = "RECONNAISSANCE";
    if (input.includes("strike") || input.includes("attack")) intent = "STRIKE";
    if (input.includes("stop") || input.includes("abort")) intent = "ABORT_MOTION";
    */
    const swarmId = '01';
    const targetDroneId = null;
    const destination = { lat: LEAVEY_LIBRARY_LAT, lng: LEAVEY_LIBRARY_LNG };
    const destName = 'LEAVEY_LIBRARY';
    const intent = 'TRANSIT';

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

  const controlMissionFlight = ({ action, swarmId = null, droneId = null }) => {
    const historyId = currentMissionHistoryIdRef.current;
    setTelemetry(prev => {
      const nextSwarms = prev.swarms.map((swarm) => {
        if (swarmId && swarm.id !== swarmId) return swarm;
        if (!swarmId && droneId && !swarm.drones.some((drone) => drone.id === droneId)) return swarm;

        if (droneId) {
          return {
            ...swarm,
            drones: swarm.drones.map((drone) => {
              if (drone.id !== droneId) return drone;

              if (action === 'pause') {
                return {
                  ...drone,
                  paused: true,
                  savedWaypoints: [...(drone.waypoints || [])],
                  waypoints: [],
                  speed: 0
                };
              }

              if (action === 'resume') {
                return {
                  ...drone,
                  paused: false,
                  waypoints: [...(drone.savedWaypoints || [])],
                  savedWaypoints: [],
                  speed: 0
                };
              }

              if (action === 'abort') {
                return {
                  ...drone,
                  paused: false,
                  savedWaypoints: [],
                  returningHome: true,
                  targetAlt: resolveMissionTakeoffAltitude(drone.targetAlt ?? drone.alt),
                  waypoints: [{ id: `rtb-${drone.id}`, lat: drone.homeLat ?? drone.lat, lng: drone.homeLng ?? drone.lng, label: 'RTB_HOME' }],
                  speed: 0
                };
              }

              return drone;
            })
          };
        }

        if (action === 'pause') {
          return {
            ...swarm,
            status: 'PAUSED',
            paused: true,
            savedWaypoints: [...(swarm.waypoints || [])],
            waypoints: [],
            speed: 0
          };
        }

        if (action === 'resume') {
          return {
            ...swarm,
            status: 'TRANSIT',
            paused: false,
            waypoints: [...(swarm.savedWaypoints || [])],
            savedWaypoints: [],
            speed: 0
          };
        }

        if (action === 'abort') {
          return {
            ...swarm,
            status: 'RETURN_TO_HOME',
            paused: false,
            savedWaypoints: [],
            returningHome: true,
            targetAlt: resolveMissionTakeoffAltitude(swarm.targetAlt ?? swarm.alt),
            waypoints: [{ id: `rtb-${swarm.id}`, lat: swarm.homeBaseLat ?? swarm.baseLat, lng: swarm.homeBaseLng ?? swarm.baseLng, label: 'RTB_HOME' }],
            drones: swarm.drones.map((drone) => ({
              ...drone,
              paused: false,
              savedWaypoints: [],
              returningHome: true,
              targetAlt: resolveMissionTakeoffAltitude(drone.targetAlt ?? drone.alt, resolveMissionTakeoffAltitude(swarm.targetAlt ?? swarm.alt)),
              waypoints: []
            })),
            speed: 0
          };
        }

        return swarm;
      });

      const nextIndependent = (prev.unassignedDrones || []).map((drone) => {
        if (drone.id !== droneId) return drone;

        if (action === 'pause') {
          return {
            ...drone,
            paused: true,
            savedWaypoints: [...(drone.waypoints || [])],
            waypoints: [],
            speed: 0
          };
        }

        if (action === 'resume') {
          return {
            ...drone,
            paused: false,
            waypoints: [...(drone.savedWaypoints || [])],
            savedWaypoints: [],
            speed: 0
          };
        }

        if (action === 'abort') {
          return {
            ...drone,
            paused: false,
            savedWaypoints: [],
            returningHome: true,
            targetAlt: resolveMissionTakeoffAltitude(drone.targetAlt ?? drone.alt),
            waypoints: [{ id: `rtb-${drone.id}`, lat: drone.homeLat ?? drone.lat, lng: drone.homeLng ?? drone.lng, label: 'RTB_HOME' }],
            speed: 0
          };
        }

        return drone;
      });

      return { ...prev, swarms: nextSwarms, unassignedDrones: nextIndependent };
    });

    if (action === 'abort') {
      updateMissionHistoryStatus('ABORTED');
      addLog(`Mission abort issued for ${droneId ? `UAV_${droneId}` : `SWARM_${swarmId}`}`, 'ALERT');
      return;
    }

    if (action === 'pause') {
      addMissionHistoryEvent(historyId, 'MISSION_PAUSED', `Holding ${droneId ? `UAV_${droneId}` : `SWARM_${swarmId}`} in current airspace.`);
    }

    if (action === 'resume') {
      addMissionHistoryEvent(historyId, 'MISSION_RESUMED', `Resumed route for ${droneId ? `UAV_${droneId}` : `SWARM_${swarmId}`}.`);
    }

    addLog(`${action === 'pause' ? 'Pause' : 'Resume'} issued for ${droneId ? `UAV_${droneId}` : `SWARM_${swarmId}`}`, 'SYSTEM');
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
    updateMissionHistoryStatus,
    selectedHistoryId, setSelectedHistoryId,
    lastAIParsedCommand, setLastAIParsedCommand,
    processAIVoiceCommand,
    tacticalLogs, addLog,
    prepareManualReview,
    updateSwarmName,
    moveDroneToSwarm,
    controlMissionFlight,
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
    changeGlobalLocation,
    operatorName: DEFAULT_OPERATOR_NAME,
    commanderName: DEFAULT_COMMANDER_NAME
  };

  return (
    <MissionContext.Provider value={value}>
      {children}
    </MissionContext.Provider>
  );
}
