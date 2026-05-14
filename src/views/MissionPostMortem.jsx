import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMission } from '../context/MissionContext';
import { MapContainer, TileLayer, Circle, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

const formatDateTime = (timestamp) => {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};
const getRouteDistanceMeters = (route = []) => {
  if (!Array.isArray(route) || route.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    const [prevLat, prevLng] = route[i - 1];
    const [nextLat, nextLng] = route[i];
    const dx = (nextLat - prevLat) * 111320;
    const dy = (nextLng - prevLng) * 111320;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
};
const getPointDistanceMeters = (pointA, pointB) => {
  if (!pointA || !pointB) return 0;
  const dx = (pointB[0] - pointA[0]) * 111320;
  const dy = (pointB[1] - pointA[1]) * 111320;
  return Math.sqrt(dx * dx + dy * dy);
};
const getMissionScopedSnapshot = (mission, snapshot) => {
  if (!snapshot) return [];

  if (mission?.targetDroneId) {
    const swarmMatch = (snapshot.swarms || []).flatMap((swarm) =>
      (swarm.drones || [])
        .filter((drone) => drone.id === mission.targetDroneId)
        .map((drone) => ({
          unitId: `UAV_${drone.id}`,
          groupId: `SWARM_${swarm.id}`,
          status: swarm.status,
          alt: drone.alt,
          speed: drone.speed,
          pwr: drone.pwr,
          lat: drone.lat,
          lng: drone.lng
        }))
    );
    if (swarmMatch.length) return swarmMatch;

    return (snapshot.unassignedDrones || [])
      .filter((drone) => drone.id === mission.targetDroneId)
      .map((drone) => ({
        unitId: `UAV_${drone.id}`,
        groupId: 'INDEPENDENT',
        status: drone.status,
        alt: drone.alt,
        speed: drone.speed,
        pwr: drone.pwr,
        lat: drone.lat,
        lng: drone.lng
      }));
  }

  if (mission?.swarmId) {
    const swarm = (snapshot.swarms || []).find((item) => item.id === mission.swarmId);
    if (!swarm) return [];
    return (swarm.drones || []).map((drone) => ({
      unitId: `UAV_${drone.id}`,
      groupId: `SWARM_${swarm.id}`,
      status: swarm.status,
      alt: drone.alt,
      speed: drone.speed,
      pwr: drone.pwr,
      lat: drone.lat,
      lng: drone.lng
    }));
  }

  return [];
};
const routeMarkerIcon = (label, color) => new L.DivIcon({
  className: '',
  html: `<div style="display:flex;align-items:center;justify-content:center;min-width:74px;height:28px;padding:0 10px;border:1px solid ${color};background:#080c14;color:${color};font-family:monospace;font-size:10px;font-weight:bold;letter-spacing:0.08em;">${label}</div>`,
  iconSize: [74, 28],
  iconAnchor: [37, 14]
});
const getMissionDurationSeconds = (mission) => {
  const parsed = String(mission?.duration || '')
    .split(':')
    .map(Number);
  if (parsed.length === 3 && parsed.every((value) => Number.isFinite(value))) {
    return (parsed[0] * 3600) + (parsed[1] * 60) + parsed[2];
  }
  if (mission?.startedAt && mission?.endedAt) {
    return Math.max(0, Math.round((mission.endedAt - mission.startedAt) / 1000));
  }
  return 0;
};
const formatClock = (seconds) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};
const statusAccent = (status) => {
  switch (status) {
    case 'COMPLETED':
    case 'SUCCESS':
      return '#72ff90';
    case 'ABORTED':
      return '#ff7d3b';
    case 'TRANSIT':
    case 'STRIKE_MONITORING':
    case 'EXECUTING':
      return '#00e5ff';
    case 'PAUSED':
    case 'PENDING_ABORT':
      return '#ffd36e';
    default:
      return '#8ea2bc';
  }
};
const TinyTrendChart = ({ values = [], color = '#00e5ff', height = 68 }) => {
  const series = values.length ? values : [0, 0, 0];
  const width = 320;
  const chartLength = 420;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = Math.max(1, max - min);
  const points = series.map((value, index) => {
    const x = (index / Math.max(series.length - 1, 1)) * width;
    const y = height - (((value - min) / range) * (height - 10)) - 5;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`history-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M0,${height} ${points.split(' ').map((point) => `L${point}`).join(' ')} L${width},${height} Z`}
        fill={`url(#history-${color.replace('#', '')})`}
        style={{
          opacity: 0,
          animation: 'historyAreaReveal 760ms ease forwards'
        }}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        style={{
          strokeDasharray: chartLength,
          strokeDashoffset: chartLength,
          animation: 'historyLineDraw 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards'
        }}
      />
      {series.map((value, index) => {
        const x = (index / Math.max(series.length - 1, 1)) * width;
        const y = height - (((value - min) / range) * (height - 10)) - 5;
        return (
          <circle
            key={`${index}-${value}`}
            cx={x}
            cy={y}
            r="2.5"
            fill={color}
            style={{
              opacity: 0,
              transformOrigin: `${x}px ${y}px`,
              animation: `historyPointReveal 280ms ease forwards ${index * 90 + 240}ms`
            }}
          />
        );
      })}
    </svg>
  );
};
const MiniStatusBars = ({ items = [] }) => {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end', minHeight: '126px' }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{
              width: '100%',
              height: `${Math.max(10, (item.value / max) * 100)}%`,
              background: `linear-gradient(180deg, ${item.color}, ${item.color}1a)`,
              border: `1px solid ${item.color}66`,
              borderRadius: '8px 8px 0 0',
              boxShadow: `0 0 18px ${item.color}22`,
              transformOrigin: 'bottom center',
              animation: `historyBarRise 720ms cubic-bezier(0.22, 1, 0.36, 1) ${item.value * 18}ms both`
            }} />
          </div>
          <div className="mono text-muted" style={{ fontSize: '9px', marginTop: '8px', textAlign: 'center' }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
};

const useScrollReveal = (rootRef, { threshold = 0.16, rootMargin = '0px 0px -10% 0px' } = {}) => {
  const targetRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!targetRef.current || isVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        root: rootRef?.current || null,
        threshold,
        rootMargin
      }
    );

    observer.observe(targetRef.current);
    return () => observer.disconnect();
  }, [isVisible, rootMargin, rootRef, threshold]);

  return { targetRef, isVisible };
};

const RevealBlock = ({ children, rootRef, delay = 0, y = 24, scale = 0.99, style = {} }) => {
  const { targetRef, isVisible } = useScrollReveal(rootRef);

  return (
    <div
      ref={targetRef}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate3d(0,0,0) scale(1)' : `translate3d(0, ${y}px, 0) scale(${scale})`,
        filter: isVisible ? 'blur(0px)' : 'blur(2px)',
        transition: `opacity 560ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 760ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, filter 560ms ease ${delay}ms`,
        willChange: 'transform, opacity, filter',
        ...style
      }}
    >
      {children}
    </div>
  );
};

function FitHistoryRoute({ route, routeDistanceMeters }) {
  const map = useMap();

  useEffect(() => {
    const validRoute = (route || []).filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (validRoute.length === 0) return;

    if (validRoute.length === 1) {
      map.setView(validRoute[0], 18, { animate: false });
      return;
    }

    const bounds = L.latLngBounds(validRoute.map(([lat, lng]) => [lat, lng]));
    const isShortRoute = routeDistanceMeters < 450;
    map.fitBounds(bounds, {
      padding: isShortRoute ? [90, 90] : [140, 140],
      maxZoom: isShortRoute ? 18 : 16,
      animate: false
    });
  }, [map, route, routeDistanceMeters]);

  return null;
}

export default function MissionPostMortem() {
  const scrollRootRef = useRef(null);
  const { historyMissions, selectedHistoryId, setSelectedHistoryId, telemetry } = useMission();
  const assetBase = import.meta.env.BASE_URL;
  const droneVideoMap = useMemo(() => ({
    '01': `${assetBase}videos/drone-1.mp4`,
    '02': `${assetBase}videos/drone-2.mp4`,
    '03': `${assetBase}videos/drone-3.mp4`,
    '04': `${assetBase}videos/drone-4.mp4`,
    '05': `${assetBase}videos/drone-5.mp4`
  }), [assetBase]);

  const selectedMission = historyMissions.find(m => m.id === selectedHistoryId);
  const replayDroneIds = useMemo(() => {
    if (!selectedMission) return [];
    if (selectedMission.targetDroneId) return [selectedMission.targetDroneId];

    if (selectedMission.swarmId) {
      const liveSwarm = telemetry.swarms.find((swarm) => swarm.id === selectedMission.swarmId);
      const liveIds = liveSwarm?.drones?.map((drone) => drone.id) || [];
      if (liveIds.length) return liveIds;
    }

    return selectedMission.assets === 1 ? ['05'] : ['01', '02', '03', '04'];
  }, [selectedMission, telemetry.swarms]);
  const [selectedReplayDroneId, setSelectedReplayDroneId] = useState(null);

  useEffect(() => {
    if (!replayDroneIds.length) {
      setSelectedReplayDroneId(null);
      return;
    }
    if (!selectedReplayDroneId || !replayDroneIds.includes(selectedReplayDroneId)) {
      setSelectedReplayDroneId(replayDroneIds[0]);
    }
  }, [replayDroneIds, selectedReplayDroneId]);

  const plottedRoute = selectedMission?.actualRoute?.length ? selectedMission.actualRoute : (selectedMission?.route?.length ? selectedMission.route : [[34.0189, -118.2912], [34.0206925, -118.2895045]]);
  const timeline = selectedMission?.timeline?.length ? selectedMission.timeline : [
    { id: 'fallback-start', t: 'T+00:00:00', label: 'DEPLOYMENT', d: 'Mission record imported without event stream.' }
  ];
  const originPoint = plottedRoute[0];
  const destinationPoint = plottedRoute[plottedRoute.length - 1];
  const flightDistanceMeters = getRouteDistanceMeters(plottedRoute);
  const terminalDistanceMeters = getPointDistanceMeters(originPoint, destinationPoint);
  const tagOverlapRisk = terminalDistanceMeters < 170;
  const originTooltipDirection = tagOverlapRisk ? 'left' : 'top';
  const destinationTooltipDirection = tagOverlapRisk ? 'right' : 'top';
  const originTooltipOffset = tagOverlapRisk ? [-28, -4] : [0, -12];
  const destinationTooltipOffset = tagOverlapRisk ? [28, -4] : [0, -12];
  const replayVideoSrc = selectedReplayDroneId ? (droneVideoMap[selectedReplayDroneId] || droneVideoMap['01']) : null;
  const mapCenter = destinationPoint
    || originPoint
    || [selectedMission?.centerLat || 34.0206925, selectedMission?.centerLng || -118.2895045];
  const tacticalHistory = selectedMission?.tacticalLog || [];
  const archiveAnalytics = useMemo(() => {
    const missions = [...historyMissions];
    const total = missions.length;
    const totalDistance = missions.reduce((sum, mission) => sum + getRouteDistanceMeters(mission.actualRoute?.length ? mission.actualRoute : mission.route), 0);
    const avgDurationSeconds = total
      ? missions.reduce((sum, mission) => sum + getMissionDurationSeconds(mission), 0) / total
      : 0;
    const completed = missions.filter((mission) => ['COMPLETED', 'SUCCESS'].includes(mission.status)).length;
    const aborted = missions.filter((mission) => mission.status === 'ABORTED').length;
    const active = missions.filter((mission) => ['EXECUTING', 'TRANSIT', 'STRIKE_MONITORING', 'PAUSED', 'PENDING_ABORT'].includes(mission.status)).length;
    const recent = missions.slice(0, 8).reverse();
    const durationSeries = recent.map((mission) => Math.max(1, Math.round(getMissionDurationSeconds(mission) / 60)));
    const distanceSeries = recent.map((mission) => Math.max(1, Math.round(getRouteDistanceMeters(mission.actualRoute?.length ? mission.actualRoute : mission.route))));
    const logSeries = recent.map((mission) => Math.max(1, (mission.tacticalLog || []).length));
    const statusBars = [
      { label: 'DONE', value: completed, color: '#72ff90' },
      { label: 'LIVE', value: active, color: '#00e5ff' },
      { label: 'ABRT', value: aborted, color: '#ff7d3b' }
    ];
    const operatorCounts = Object.entries(
      missions.reduce((acc, mission) => {
        const key = mission.operatorName || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const avgAssetCount = total ? missions.reduce((sum, mission) => sum + Number(mission.assets || 0), 0) / total : 0;
    return {
      total,
      totalDistance,
      avgDurationSeconds,
      completed,
      aborted,
      active,
      durationSeries,
      distanceSeries,
      logSeries,
      statusBars,
      operatorCounts,
      avgAssetCount
    };
  }, [historyMissions]);

  // If no mission is selected, show the Archive List
  if (!selectedHistoryId || !selectedMission) {
    return (
      <div ref={scrollRootRef} style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '30px 30px 40px',
        background: `
          radial-gradient(circle at 14% 12%, rgba(72,215,255,0.08), transparent 22%),
          radial-gradient(circle at 84% 10%, rgba(255,125,59,0.06), transparent 18%),
          linear-gradient(180deg, rgba(5,10,18,0.98), rgba(4,8,15,1))
        `,
        overflowY: 'auto'
      }}>
        <style>{`
          @keyframes historyLineDraw {
            to { stroke-dashoffset: 0; }
          }
          @keyframes historyAreaReveal {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes historyPointReveal {
            from { opacity: 0; transform: scale(0.4); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes historyBarRise {
            from { opacity: 0; transform: scaleY(0.16); }
            to { opacity: 1; transform: scaleY(1); }
          }
        `}</style>
        <RevealBlock rootRef={scrollRootRef} delay={20} style={{ marginBottom: '24px' }}>
        <div>
           <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '10px' }}>MISSION_HISTORY</div>
           <div className="display text-main" style={{ margin: 0, fontSize: '40px', lineHeight: 1 }}>Archive Overview</div>
        </div>
        </RevealBlock>

        <RevealBlock rootRef={scrollRootRef} delay={80} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
          {[
            ['TOTAL MISSIONS', archiveAnalytics.total, '#00e5ff'],
            ['COMPLETED', archiveAnalytics.completed, '#72ff90'],
            ['ABORTED', archiveAnalytics.aborted, '#ff7d3b'],
            ['AVG ASSETS', archiveAnalytics.avgAssetCount.toFixed(1), '#ffd36e']
          ].map(([label, value, color]) => (
            <div key={label} className="glass-panel" style={{ padding: '22px', borderLeft: `4px solid ${color}` }}>
              <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '12px' }}>{label}</div>
              <div className="display" style={{ fontSize: '28px', color }}>{value}</div>
            </div>
          ))}
        </div>
        </RevealBlock>

        <RevealBlock rootRef={scrollRootRef} delay={130} style={{ marginBottom: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 0.9fr', gap: '18px' }}>
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.14em', marginBottom: '12px' }}>MISSION STATUS DISTRIBUTION</div>
            <MiniStatusBars items={archiveAnalytics.statusBars} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginTop: '14px' }}>
              {archiveAnalytics.statusBars.map((item) => (
                <div key={item.label} style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '10px 12px' }}>
                  <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>{item.label}</div>
                  <div className="mono" style={{ fontSize: '14px', color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '22px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.14em', marginBottom: '12px' }}>MISSION TREND</div>
            <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>DURATION // LAST 8 MISSIONS</div>
            <TinyTrendChart values={archiveAnalytics.durationSeries} color="#00e5ff" />
            <div className="mono text-muted" style={{ fontSize: '9px', margin: '12px 0 6px' }}>FLIGHT DISTANCE // LAST 8 MISSIONS</div>
            <TinyTrendChart values={archiveAnalytics.distanceSeries} color="#72ff90" />
            <div className="mono text-muted" style={{ fontSize: '9px', margin: '12px 0 6px' }}>TACTICAL LOG VOLUME // LAST 8 MISSIONS</div>
            <TinyTrendChart values={archiveAnalytics.logSeries} color="#ffd36e" />
          </div>

          <div className="glass-panel" style={{ padding: '22px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.14em', marginBottom: '12px' }}>ARCHIVE STATISTICS</div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>TOTAL FLIGHT DISTANCE</div>
                <div className="display text-main" style={{ fontSize: '22px' }}>{(archiveAnalytics.totalDistance / 1000).toFixed(1)} KM</div>
              </div>
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>AVERAGE MISSION CLOCK</div>
                <div className="display text-main" style={{ fontSize: '22px' }}>{formatClock(archiveAnalytics.avgDurationSeconds)}</div>
              </div>
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>TOP OPERATORS</div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {archiveAnalytics.operatorCounts.length ? archiveAnalytics.operatorCounts.map(([name, count]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <span className="mono text-main" style={{ fontSize: '10px' }}>{String(name).toUpperCase()}</span>
                      <span className="mono text-cyan" style={{ fontSize: '10px' }}>{count}</span>
                    </div>
                  )) : (
                    <span className="mono text-muted" style={{ fontSize: '10px' }}>NO_OPERATOR_DATA</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </RevealBlock>

        <div className="flex-column" style={{ gap: '16px' }}>
          {historyMissions.map((mission, idx) => (
            <RevealBlock key={mission.id} rootRef={scrollRootRef} delay={Math.min(260, idx * 28)} y={18} scale={0.995}>
            <div 
              key={mission.id} 
              onClick={() => setSelectedHistoryId(mission.id)}
              className="glass-panel" 
              style={{
                padding: '24px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                transition: 'transform 0.2s, border-color 0.2s',
                borderLeft: `4px solid ${statusAccent(mission.status)}`
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cyan-primary)'; e.currentTarget.style.transform = 'translateX(8px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <span className="mono text-muted" style={{ fontSize: '12px' }}>#{idx.toString().padStart(3, '0')}</span>
                <div className="flex-column">
                   <span className="mono text-main" style={{ fontSize: '16px', fontWeight: 'bold' }}>{mission.name}</span>
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>ID: {mission.id} // DATE: {mission.date}</span>
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>OPERATOR: {mission.operatorName} // COMMANDER: {mission.commanderName}</span>
                   <span className="mono text-muted" style={{ fontSize: '10px', marginTop: '4px' }}>
                     DIST: {(getRouteDistanceMeters(mission.actualRoute?.length ? mission.actualRoute : mission.route) / 1000).toFixed(2)} KM
                     {' // '}
                     LOGS: {(mission.tacticalLog || []).length}
                   </span>
                   {mission.notes && (
                     <span className="mono text-muted" style={{ fontSize: '10px', marginTop: '6px', maxWidth: '620px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       NOTES: {mission.notes}
                     </span>
                   )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '48px', alignItems: 'center' }}>
                <div className="flex-column" style={{ alignItems: 'center' }}>
                   <span className="mono text-muted" style={{ fontSize: '8px' }}>DURATION</span>
                   <span className="mono text-main" style={{ fontSize: '14px' }}>{mission.duration}</span>
                </div>
                <div className="flex-column" style={{ alignItems: 'center' }}>
                   <span className="mono text-muted" style={{ fontSize: '8px' }}>STATUS</span>
                   <span className="mono" style={{ fontSize: '12px', color: statusAccent(mission.status) }}>{mission.status}</span>
                </div>
                <span className="text-cyan">➔</span>
              </div>
            </div>
            </RevealBlock>
          ))}
        </div>
      </div>
    );
  }

  // If a mission is selected, show the Post-Mortem Detail View
  return (
    <div ref={scrollRootRef} className="print-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '32px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
      <style>{`
        @keyframes historyLineDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes historyAreaReveal {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes historyPointReveal {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes historyBarRise {
          from { opacity: 0; transform: scaleY(0.16); }
          to { opacity: 1; transform: scaleY(1); }
        }
      `}</style>
      
      {/* Detail Header */}
      <RevealBlock rootRef={scrollRootRef} delay={20} style={{ marginBottom: '24px' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button 
            onClick={() => setSelectedHistoryId(null)} 
            className="btn" 
            style={{ padding: '8px 12px', fontSize: '10px', height: 'fit-content' }}
          >
            BACK
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 className="display text-main" style={{ margin: 0, fontSize: '28px', letterSpacing: '1px' }}>REPORT: {selectedMission.name}</h2>
              <span className="mono" style={{ background: 'rgba(0, 229, 255, 0.1)', color: 'var(--cyan-primary)', border: '1px solid var(--border-cyan)', padding: '4px 12px', fontSize: '12px' }}>{selectedMission.status}</span>
            </div>
            <p className="mono text-muted" style={{ margin: '8px 0 0 0', fontSize: '10px' }}>SECURITY CLEARANCE: LEVEL 5 // LOG_ID: {selectedMission.id}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }} className="no-print">
          <button className="btn btn-primary" style={{ fontSize: '12px', padding: '12px 24px' }} onClick={() => window.print()}>EXPORT_PDF</button>
        </div>
      </div>
      </RevealBlock>

      {/* Report Content (Simplified original style) */}
      <RevealBlock rootRef={scrollRootRef} delay={80} style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', gap: '24px' }}>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--cyan-primary)', padding: '24px' }}>
          <span className="mono text-muted" style={{ fontSize: '10px' }}>ASSETS_TOTAL</span>
          <h3 className="display text-cyan" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{selectedMission.assets} UAVs</h3>
        </div>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--border-color)', padding: '24px' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>MISSION_CLOCK</span>
           <h3 className="display text-main" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{selectedMission.duration}</h3>
        </div>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--border-color)', padding: '24px' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>PATH_NODES</span>
           <h3 className="display text-main" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{plottedRoute.length}</h3>
        </div>
        <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--border-color)', padding: '24px' }}>
           <span className="mono text-muted" style={{ fontSize: '10px' }}>FLIGHT_DISTANCE</span>
           <h3 className="display text-main" style={{ margin: '16px 0 0 0', fontSize: '24px' }}>{(flightDistanceMeters / 1000).toFixed(2)} KM</h3>
        </div>
      </div>
      </RevealBlock>

      <RevealBlock rootRef={scrollRootRef} delay={120} style={{ marginBottom: '24px' }}>
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>OPERATOR</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{selectedMission.operatorName}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>COMMANDER</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{selectedMission.commanderName}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>STARTED_AT</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{formatDateTime(selectedMission.startedAt)}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>ENDED_AT</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{formatDateTime(selectedMission.endedAt)}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>LAST_KNOWN_ALT</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{Math.round(selectedMission.lastKnownAlt || 0)} M</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>LAST_KNOWN_SPEED</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{Math.round(selectedMission.lastKnownSpeed || 0)} KPH</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>ORIGIN_COORD</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{originPoint ? `${originPoint[0].toFixed(6)}, ${originPoint[1].toFixed(6)}` : '--'}</div>
        </div>
        <div>
          <div className="mono text-muted" style={{ fontSize: '10px' }}>DESTINATION_COORD</div>
          <div className="mono text-main" style={{ fontSize: '14px', marginTop: '6px' }}>{destinationPoint ? `${destinationPoint[0].toFixed(6)}, ${destinationPoint[1].toFixed(6)}` : '--'}</div>
        </div>
      </div>
      </RevealBlock>

      {selectedMission.notes && (
        <RevealBlock rootRef={scrollRootRef} delay={150} style={{ marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px 24px' }}>
          <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '10px' }}>MISSION_NOTES</div>
          <div className="mono text-main" style={{ fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {selectedMission.notes}
          </div>
        </div>
        </RevealBlock>
      )}

      <RevealBlock rootRef={scrollRootRef} delay={190}>
      <div style={{ display: 'flex', gap: '32px', flex: 1 }}>
        <div style={{ width: '430px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
           <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', marginBottom: '16px' }}>DECISION_TIMELINE</h4>
           <div className="glass-panel" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {timeline.map((ev, i) => (
                <div key={i} style={{ marginBottom: '24px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-5px', top: '0', width: '9px', height: '9px', background: /COMPLETE|SUCCESS/.test(ev.label) ? 'var(--cyan-primary)' : /ABORT/.test(ev.label) ? 'var(--orange-alert)' : 'var(--text-muted)', borderRadius: '50%' }}></div>
                  <span className="mono text-muted" style={{ fontSize: '10px' }}>{ev.t}</span><br/>
                  <span className="mono text-main" style={{ fontSize: '12px', fontWeight: 'bold' }}>{ev.label}</span><br/>
                  <span className="mono text-muted" style={{ fontSize: '10px' }}>{ev.d}</span>
                </div>
              ))}
           </div>
          </div>

          <div>
            <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', marginBottom: '16px' }}>TACTICAL_LOG_ARCHIVE</h4>
            <div className="glass-panel" style={{ padding: '20px', maxHeight: '760px', overflowY: 'auto' }}>
              {tacticalHistory.length ? tacticalHistory.map((entry) => {
                const scopedUnits = getMissionScopedSnapshot(selectedMission, entry.telemetrySnapshot);
                return (
                  <div key={entry.id || `${entry.at}-${entry.message}`} style={{ marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="mono text-muted" style={{ fontSize: '10px' }}>[{entry.timestamp}] {entry.type}</span>
                      <span className="mono text-muted" style={{ fontSize: '10px' }}>{entry.phase || 'UNKNOWN_PHASE'}</span>
                    </div>
                    <div className="mono" style={{ fontSize: '12px', color: '#ff7d3b', lineHeight: 1.5 }}>
                      {entry.message}
                    </div>
                    {entry.coords && (
                      <div className="mono text-muted" style={{ fontSize: '10px', marginTop: '6px' }}>
                        COORD: {Number(entry.coords.lat || 0).toFixed(5)}, {Number(entry.coords.lng || 0).toFixed(5)}
                      </div>
                    )}
                    {scopedUnits.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                        {scopedUnits.map((unit) => (
                          <div key={`${entry.id}-${unit.unitId}`} style={{ border: '1px solid rgba(0,229,255,0.12)', background: 'rgba(255,255,255,0.02)', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                              <span className="mono text-main" style={{ fontSize: '11px' }}>{unit.unitId}</span>
                              <span className="mono text-muted" style={{ fontSize: '9px' }}>{unit.groupId}</span>
                            </div>
                            <div className="mono text-muted" style={{ fontSize: '9px', lineHeight: 1.6 }}>
                              ALT {Math.round(unit.alt || 0)}M | SPD {Math.round(unit.speed || 0)}KPH | PWR {Math.round(unit.pwr || 0)}%
                            </div>
                            <div className="mono text-muted" style={{ fontSize: '9px', lineHeight: 1.6 }}>
                              LAT {Number(unit.lat || 0).toFixed(4)} | LNG {Number(unit.lng || 0).toFixed(4)}
                            </div>
                            <div className="mono text-muted" style={{ fontSize: '9px', lineHeight: 1.6 }}>
                              STATUS {unit.status || 'UNKNOWN'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="mono text-muted" style={{ fontSize: '11px' }}>NO_TACTICAL_LOG_ARCHIVE_AVAILABLE</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px' }}>FLIGHT_DATA_VISUALIZATION</h4>
           <div className="glass-panel" style={{ flex: 1, minHeight: '300px', background: '#000' }}>
              <MapContainer center={mapCenter} zoom={16} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en" />
                <FitHistoryRoute route={plottedRoute} routeDistanceMeters={flightDistanceMeters} />
                <Circle center={[selectedMission.centerLat || 34.0206925, selectedMission.centerLng || -118.2895045]} radius={300} pathOptions={{ color: 'var(--cyan-primary)', dashArray: '10, 10' }} />
                <Polyline positions={plottedRoute} pathOptions={{ color: 'var(--orange-primary)', weight: 3 }} />
                {originPoint && (
                  <Marker position={originPoint} icon={routeMarkerIcon('ORIGIN', 'var(--cyan-primary)')}>
                    <Tooltip direction={originTooltipDirection} offset={originTooltipOffset} opacity={1}>
                      <span className="mono" style={{ fontSize: '10px' }}>{originPoint[0].toFixed(6)}, {originPoint[1].toFixed(6)}</span>
                    </Tooltip>
                  </Marker>
                )}
                {destinationPoint && (
                  <Marker position={destinationPoint} icon={routeMarkerIcon('DESTINATION', 'var(--orange-primary)')}>
                    <Tooltip direction={destinationTooltipDirection} offset={destinationTooltipOffset} opacity={1}>
                      <span className="mono" style={{ fontSize: '10px' }}>{destinationPoint[0].toFixed(6)}, {destinationPoint[1].toFixed(6)}</span>
                    </Tooltip>
                  </Marker>
                )}
              </MapContainer>
           </div>

           <div className="glass-panel" style={{ padding: '24px', background: 'rgba(4, 8, 16, 0.94)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <h4 className="mono text-cyan" style={{ fontSize: '12px', letterSpacing: '1px', margin: 0 }}>MISSION_FEED_REPLAY</h4>
                  <div className="mono text-muted" style={{ fontSize: '10px', marginTop: '6px' }}>
                    Select a drone feed and replay the archived mission visual context.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {replayDroneIds.map((droneId) => (
                    <button
                      key={droneId}
                      type="button"
                      onClick={() => setSelectedReplayDroneId(droneId)}
                      style={{
                        border: selectedReplayDroneId === droneId ? '1px solid var(--cyan-primary)' : '1px solid rgba(255,255,255,0.14)',
                        background: selectedReplayDroneId === droneId ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.03)',
                        color: selectedReplayDroneId === droneId ? 'var(--cyan-primary)' : '#d8e6f5',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        padding: '8px 12px',
                        cursor: 'pointer'
                      }}
                    >
                      UAV_{droneId}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative', minHeight: '300px', border: '1px solid rgba(92, 222, 255, 0.16)', background: '#02060c' }}>
                {replayVideoSrc ? (
                  <>
                    <video
                      key={`${selectedMission.id}-${selectedReplayDroneId}`}
                      src={replayVideoSrc}
                      controls
                      playsInline
                      style={{ width: '100%', height: '100%', minHeight: '300px', objectFit: 'cover', display: 'block', background: '#000' }}
                    />
                    <div style={{ position: 'absolute', top: '12px', left: '12px', padding: '3px 8px', background: 'rgba(5, 10, 16, 0.88)', border: '1px solid rgba(0,229,255,0.38)', color: 'var(--cyan-primary)', fontFamily: 'var(--font-mono)', fontSize: '10px', pointerEvents: 'none' }}>
                      REPLAY // UAV_{selectedReplayDroneId}
                    </div>
                  </>
                ) : (
                  <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.72)', fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.12em' }}>
                    NO_FEED_REPLAY_AVAILABLE
                  </div>
                )}
              </div>
           </div>
           
           <div className="glass-panel" style={{ padding: '24px' }}>
              <h4 className="mono text-muted" style={{ fontSize: '10px', marginBottom: '12px' }}>OFFICIAL_STAMP</h4>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                 <div style={{ width: '60px', height: '60px', border: '2px solid var(--text-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                    <span className="mono" style={{ fontSize: '8px' }}>AEGIS_SEC</span>
                 </div>
                 <div className="flex-column">
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>CERTIFIED BY: AEGIS CENTRAL COMMAND</span>
                   <span className="mono text-muted" style={{ fontSize: '10px' }}>TIMESTAMP: {new Date().toISOString()}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
      </RevealBlock>
    </div>
  );
}
