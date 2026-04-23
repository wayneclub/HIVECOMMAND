import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const MissionContext = createContext();

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

  const [tacticalLogs, setTacticalLogs] = useState([
    { timestamp: new Date().toLocaleTimeString(), message: "SYSTEM_ONLINE // ENCRYPTED_LINK_ESTABLISHED", type: "SYSTEM", coords: null },
    { timestamp: new Date().toLocaleTimeString(), message: "MULTI_POINT_PLANNING_ENGINE_READY", type: "SYSTEM", coords: null }
  ]);

  const addLog = (message, type = "INFO", coords = null) => {
    setTacticalLogs(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      message: message.toUpperCase(),
      type,
      coords
    }, ...prev].slice(0, 50));
  };

  const landmarks = {
    "taipei 101": { lat: 25.03397, lng: 121.56441 },
    "kaohsiung harbor": { lat: 22.6100, lng: 120.2750 },
    "sun moon lake": { lat: 23.8600, lng: 120.9100 },
    "costco hsinchu": { lat: 24.7865, lng: 121.0255 },
    "hsinchu science park": { lat: 24.7783, lng: 121.0163 },
    "hq": { lat: 24.7869, lng: 120.9975 },
    "base": { lat: 24.7869, lng: 120.9975 },
    "station": { lat: 24.7869, lng: 120.9975 }
  };

  // Global telemetry mockup
  const [telemetry, setTelemetry] = useState({
    swarms: [
      // Swarm 1 - Cyan (Friendly)
      { id: '01', status: 'IDLE', pwr: 98.4, role: 'RECON_MODE', color: '#00e5ff', alt: 120, dist: 0, speed: 0, baseLat: 24.7880, baseLng: 120.9990, waypoints: [], drones: [{id: 'ALPHA', pwr: 99, lat: 24.7885, lng: 120.9992, waypoints: []}, {id: 'BETA', pwr: 98, lat: 24.7878, lng: 120.9995, waypoints: []}, {id: 'GAMMA', pwr: 98, lat: 24.7876, lng: 120.9985, waypoints: []}, {id: 'DELTA', pwr: 98, lat: 24.7882, lng: 120.9982, waypoints: []}] },
      // Swarm 2 - Neon Green (Friendly - similar hue)
      { id: '02', status: 'IDLE', pwr: 74.1, role: 'TRANSIT_MODE', color: '#00ff88', alt: 250, dist: 0, speed: 0, baseLat: 24.7840, baseLng: 120.9940, waypoints: [], drones: [{id: 'ECHO', pwr: 75, lat: 24.7842, lng: 120.9945, waypoints: []}, {id: 'FOXTROT', pwr: 74, lat: 24.7838, lng: 120.9942, waypoints: []}, {id: 'GOLF', pwr: 73, lat: 24.7840, lng: 120.9935, waypoints: []}] },
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
      dist: 0,
      speed: 0,
      baseLat: config.lat || 24.7869,
      baseLng: config.lng || 120.9975,
      waypoints: [],
      drones: [
        { id: 'D1', pwr: 100, lat: 24.7869, lng: 120.9975, waypoints: [] },
        { id: 'D2', pwr: 100, lat: 24.7870, lng: 120.9980, waypoints: [] }
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
    setTelemetry(prev => ({
      ...prev,
      swarms: prev.swarms.map(s => {
        if (s.id === swarmId) {
          const formatted = newPoints.map((pt, idx) => ({ ...pt, id: pt.id || Date.now() + Math.random(), label: `WP_${idx+1}` }));
          const newDrones = s.drones.map(d => d.id === droneId ? { ...d, waypoints: [...(d.waypoints || []), ...formatted] } : d);
          return { ...s, drones: newDrones };
        }
        return s;
      })
    }));
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

  useEffect(() => {
    formationRef.current = activeFormation;
  }, [activeFormation]);

  useEffect(() => {
    targetLockRef.current = targetLock;
  }, [targetLock]);

  // Dynamic simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
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
            const dist = Math.sqrt(Math.pow(target.lat - newBaseLat, 2) + Math.pow(target.lng - newBaseLng, 2)) * 111320;
            
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

          const airSpeedScaling = 0.00002;
          let groundSpeedMap = airSpeedScaling;

          if (newWaypoints.length > 0) {
            const target = newWaypoints[0];
            const dLat = target.lat - newBaseLat;
            const dLng = target.lng - newBaseLng;
            const dist = Math.sqrt(dLat*dLat + dLng*dLng);
            
            const headX = dLng / dist;
            const headY = dLat / dist;

            let windX = 0;
            let windY = 0;
            // Simulated wind from review context
            if (lastAIParsedCommand && lastAIParsedCommand.swarmId === s.id && lastAIParsedCommand.missionWeather) {
               const w = lastAIParsedCommand.missionWeather;
               const wSpeed = parseFloat(w.wind) / 100;
               const wDir = w.wind.split(' ')[2];
               if (wDir.includes('N')) windY = -0.707 * wSpeed;
               if (wDir.includes('S')) windY = 0.707 * wSpeed;
               if (wDir.includes('E')) windX = -0.707 * wSpeed;
               if (wDir.includes('W')) windX = 0.707 * wSpeed;
            }

            const vGx = (headX * airSpeedScaling) + (windX * 0.000005); 
            const vGy = (headY * airSpeedScaling) + (windY * 0.000005);
            groundSpeedMap = Math.sqrt(vGx*vGx + vGy*vGy);

            if (dist > groundSpeedMap) {
              newBaseLat += vGy;
              newBaseLng += vGx;
              s.status = 'TRANSIT';
            } else {
              newBaseLat = target.lat;
              newBaseLng = target.lng;
              // Transition handled in the Arrival block above
            }
          }

          const isPrimaryFormation = (sIdx === 0);
          let newDrones = s.drones.map((d, dIdx) => {
             // Handle independent drone flight
             if (d.waypoints && d.waypoints.length > 0) {
                const target = d.waypoints[0];
                const dLat = target.lat - d.lat;
                const dLng = target.lng - d.lng;
                const dist = Math.sqrt(dLat*dLat + dLng*dLng) * 111320;
                
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
                const travelDist = Math.min(dist, airSpeedScaling * 80000); // Drone standalone speed mapping
                const ratio = travelDist / dist;
                return {
                   ...d,
                   lat: d.lat + (dLat * ratio),
                   lng: d.lng + (dLng * ratio),
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
             const ease = 0.05;
             return {
               ...d,
               pwr: Math.max(0, d.pwr - (Math.random() * 0.01)),
               lat: d.lat + (tLat - d.lat) * ease,
               lng: d.lng + (tLng - d.lng) * ease
             };
          });

          const gsKPH = (groundSpeedMap / airSpeedScaling) * 80;

          return {
            ...s,
            baseLat: newBaseLat,
            baseLng: newBaseLng,
            waypoints: newWaypoints,
            pwr: Math.max(0, s.pwr - 0.005), 
            alt: Math.max(20, Math.min(500, s.alt + (Math.random() * 4 - 2))), 
            speed: gsKPH + (Math.random() * 2 - 1),
            drones: newDrones
          };
        })
      }));
    }, 100);
    return () => clearInterval(interval);
  }, [lastAIParsedCommand]);

  const prepareManualReview = (swarmId, waypoints, droneId = null) => {
    const swarm = telemetry.swarms.find(s => s.id === swarmId);
    if (!swarm || waypoints.length === 0) return;

    let startLat = swarm.baseLat;
    let startLng = swarm.baseLng;

    if (droneId) {
      const drone = swarm.drones.find(d => d.id === droneId);
      if (drone) {
        startLat = drone.lat;
        startLng = drone.lng;
      }
    }

    // Simulate weather for this manual route
    const weatherConditions = ["OPTIMAL", "MARGINAL", "STABLE"];
    const missionWeather = {
      condition: weatherConditions[Math.floor(Math.random() * 3)],
      wind: `${Math.floor(Math.random() * 10 + 5)} KTS NE`,
      vis: `10 KM`, temp: `24°C`, humidity: `60%`
    };

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
       return { ...wp, eta: eta.toLocaleTimeString(), label: `WAYPOINT_${idx+1}`, distance: (d/1000).toFixed(2) };
    });

    const assigneeName = droneId ? `UAV_${droneId}` : `SWARM_${swarmId}`;
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
      distance: (totalDist / 1000).toFixed(2),
      durationMin: Math.ceil((totalDist / (airSpeedKPH / 3.6)) / 60),
      eta: wpsWithETA[wpsWithETA.length - 1].eta,
      timestamp: new Date().toLocaleTimeString(),
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
    const missionWeather = {
      condition: weatherConditions[Math.floor(Math.random() * 3)],
      wind: `${Math.floor(Math.random() * 10 + 5)} KTS NE`,
      vis: `10 KM`, temp: `24°C`, humidity: `60%`
    };

    const airSpeedKPH = 80;
    const predictedGS = 75;
    const flightSecsCorrected = distM / (predictedGS / 3.6);
    const eta = new Date(Date.now() + flightSecsCorrected * 1000);

    const parsedData = {
      raw: text, swarmId, destination, destName, intent, missionWeather,
      predictedGS, distance: (distM / 1000).toFixed(2), durationMin: Math.ceil(flightSecsCorrected / 60),
      eta: eta.toLocaleTimeString(), timestamp: new Date().toLocaleTimeString(), confidence: 0.94,
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
    updateSwarmName
  };

  return (
    <MissionContext.Provider value={value}>
      {children}
    </MissionContext.Provider>
  );
}
