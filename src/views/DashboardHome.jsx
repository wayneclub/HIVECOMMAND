import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'globe.gl';
import L from 'leaflet';
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, Polygon, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { useMission } from '../context/MissionContext';
import { WORLD_CONFLICT_COUNTRY_ISO, WORLD_INTEL_LAYERS, WORLD_LAYER_META, WORLD_SOURCE_INFO } from '../data/worldIntelLayers';

const panelStyle = {
  border: '1px solid rgba(138, 216, 255, 0.14)',
  background: 'linear-gradient(180deg, rgba(10, 18, 31, 0.96), rgba(5, 11, 21, 0.94))',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.015) inset, 0 20px 50px rgba(0,0,0,0.24)',
  position: 'relative',
  overflow: 'hidden'
};

const categoryStyle = {
  conflicts: { color: '#ff6e5b', fill: '#ff6e5b', label: 'CONFLICT ZONES' },
  hotspots: { color: '#ffb25a', fill: '#ffb25a', label: 'INTEL HOTSPOTS' },
  bases: { color: '#48d7ff', fill: '#48d7ff', label: 'MILITARY ACTIVITY' },
  nuclear: { color: '#ffd36e', fill: '#ffd36e', label: 'NUCLEAR SITES' },
  spaceports: { color: '#d07bff', fill: '#d07bff', label: 'SPACEPORTS' },
  economic: { color: '#72ff90', fill: '#72ff90', label: 'ECONOMIC CENTERS' },
  drone: { color: '#ffffff', fill: '#00e5ff', label: 'DRONE OPS' },
  station: { color: '#72ff90', fill: '#72ff90', label: 'STATION' }
};

const layerOrder = ['conflicts', 'hotspots', 'bases', 'nuclear', 'spaceports', 'economic'];

const getLayerMeta = (category) => WORLD_LAYER_META[category] || { label: String(category || '').toUpperCase(), color: '#48d7ff', icon: '•' };

const makeIntelIcon = (category, active = false) => {
  const meta = getLayerMeta(category);
  const size = category === 'bases' ? 28 : 24;
  const glow = active ? '0 0 22px rgba(72,215,255,0.45)' : '0 0 14px rgba(0,0,0,0.42)';
  return L.divIcon({
    className: 'intel-div-icon',
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        display:flex;
        align-items:center;
        justify-content:center;
        border:1px solid ${meta.color}88;
        background:rgba(7,14,24,0.82);
        color:${meta.color};
        box-shadow:${glow};
        font-family:var(--font-mono);
        font-size:${category === 'bases' ? '15px' : '13px'};
        font-weight:700;
        backdrop-filter:blur(8px);
        border-radius:${category === 'bases' ? '8px 8px 0 0' : '999px'};
        transform:${category === 'bases' ? 'rotate(0deg)' : 'none'};
      ">${meta.icon}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

const IncidentPopupContent = ({ incident }) => {
  const meta = getLayerMeta(incident.category);
  return (
    <div style={{
      minWidth: '240px',
      background: 'rgba(5, 10, 18, 0.96)',
      color: '#f5fbff',
      fontFamily: 'var(--font-mono)'
    }}>
      <div style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${meta.color}33`,
        background: `linear-gradient(180deg, ${meta.color}14, rgba(5, 10, 18, 0.96))`
      }}>
        <div className="display" style={{ fontSize: '20px', marginBottom: '4px' }}>{incident.label}</div>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: meta.color }}>
          {meta.icon} {meta.label} // {incident.status}
        </div>
      </div>
      <div style={{ padding: '12px 14px', display: 'grid', gap: '10px' }}>
        <div style={{ fontSize: '11px', lineHeight: 1.7, color: '#d8e7f6' }}>{incident.detail}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#7f96ad', marginBottom: '4px' }}>COORDINATE</div>
            <div style={{ fontSize: '10px', color: '#f5fbff' }}>{incident.lat.toFixed(2)}, {incident.lng.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#7f96ad', marginBottom: '4px' }}>SEVERITY</div>
            <div style={{ fontSize: '10px', color: meta.color }}>SEV {incident.severity}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '9px', color: '#7f96ad', marginBottom: '4px' }}>SOURCE</div>
          <div style={{ fontSize: '10px', color: '#f5fbff', lineHeight: 1.6 }}>{incident.source}</div>
        </div>
        {!!incident.tags?.length && (
          <div>
            <div style={{ fontSize: '9px', color: '#7f96ad', marginBottom: '6px' }}>TAG CLUSTER</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {incident.tags.map((tag) => (
                <span
                  key={`${incident.id}-${tag}`}
                  style={{
                    border: `1px solid ${meta.color}33`,
                    color: meta.color,
                    background: 'rgba(255,255,255,0.02)',
                    padding: '4px 7px',
                    fontSize: '9px',
                    letterSpacing: '0.08em'
                  }}
                >
                  {tag.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const toRadians = (degrees) => degrees * (Math.PI / 180);

const routeDistanceMeters = (route = []) => {
  if (!Array.isArray(route) || route.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    const [lat1, lng1] = route[i - 1];
    const [lat2, lng2] = route[i];
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
};

const parseDurationSeconds = (value) => {
  if (!value || typeof value !== 'string') return 0;
  const parts = value.split(':').map(Number);
  if (parts.length !== 3 || parts.some((item) => Number.isNaN(item))) return 0;
  return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
};

const formatClock = (seconds) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const formatStationLabel = (value = '') => String(value)
  .replace(/[()]/g, '')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const buildIncidentQuery = (incident) => {
  if (!incident) return 'global conflict';
  return [incident.label, ...(incident.tags || []).slice(0, 3)].join(' ');
};

const createConflictCountryFeatures = (countriesGeoJson, conflictRecords) => {
  if (!countriesGeoJson?.features?.length) return [];

  const features = [];
  const usedConflictIds = new Set();

  conflictRecords.forEach((incident) => {
    const isoCodes = WORLD_CONFLICT_COUNTRY_ISO[incident.sourceId];
    if (!isoCodes?.length) return;

    countriesGeoJson.features.forEach((feature) => {
      const code = feature?.properties?.['ISO3166-1-Alpha-2'];
      if (!isoCodes.includes(code)) return;
      usedConflictIds.add(incident.id);
      features.push({
        type: 'Feature',
        properties: {
          incidentId: incident.id,
          label: incident.label,
          category: incident.category,
          severity: incident.severity
        },
        geometry: feature.geometry
      });
    });
  });

  return { features, usedConflictIds };
};

const mergeCountryOverrides = (countries, overrides) => {
  if (!countries?.features?.length) return countries;
  if (!overrides?.features?.length) return countries;

  const overrideMap = new Map(
    overrides.features
      .map((feature) => [feature?.properties?.['ISO3166-1-Alpha-2'], feature])
      .filter(([code]) => typeof code === 'string')
  );

  return {
    ...countries,
    features: countries.features.map((feature) => {
      const code = feature?.properties?.['ISO3166-1-Alpha-2'];
      const override = overrideMap.get(code);
      return override ? { ...feature, geometry: override.geometry } : feature;
    })
  };
};

const useScrollReveal = (rootRef, { threshold = 0.16, rootMargin = '0px 0px -8% 0px' } = {}) => {
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

const RevealBlock = ({ children, rootRef, delay = 0, y = 28, scale = 0.985, style = {} }) => {
  const { targetRef, isVisible } = useScrollReveal(rootRef);

  return (
    <div
      ref={targetRef}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate3d(0, 0, 0) scale(1)' : `translate3d(0, ${y}px, 0) scale(${scale})`,
        filter: isVisible ? 'blur(0px)' : 'blur(3px)',
        transition: `opacity 620ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 780ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, filter 620ms ease ${delay}ms`,
        willChange: 'transform, opacity, filter',
        ...style
      }}
    >
      {children}
    </div>
  );
};

const TinyLineChart = ({ values = [], color = '#48d7ff', height = 42 }) => {
  const normalized = values.length ? values : [0, 0, 0];
  const max = Math.max(...normalized, 1);
  const min = Math.min(...normalized, 0);
  const range = Math.max(1, max - min);
  const width = 260;
  const chartLength = 320;
  const points = normalized.map((value, index) => {
    const x = (index / Math.max(normalized.length - 1, 1)) * width;
    const y = height - (((value - min) / range) * (height - 8)) - 4;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.1"
        points={points}
        style={{
          strokeDasharray: chartLength,
          strokeDashoffset: chartLength,
          animation: 'dashboardLineDraw 1.15s cubic-bezier(0.22, 1, 0.36, 1) forwards'
        }}
      />
      {normalized.map((value, index) => {
        const x = (index / Math.max(normalized.length - 1, 1)) * width;
        const y = height - (((value - min) / range) * (height - 8)) - 4;
        return (
          <circle
            key={`${index}-${value}`}
            cx={x}
            cy={y}
            r="2"
            fill={color}
            style={{
              opacity: 0,
              transformOrigin: `${x}px ${y}px`,
              animation: `dashboardPointReveal 280ms ease forwards ${index * 90 + 260}ms`
            }}
          />
        );
      })}
    </svg>
  );
};

const VitalStrip = ({ stats = [] }) => (
  <div style={{
    ...panelStyle,
    padding: '10px 14px',
    display: 'grid',
    gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
    gap: '12px'
  }}>
    {stats.map((stat) => (
      <div key={stat.label} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px', alignItems: 'center' }}>
        <div>
          <div className="mono text-muted" style={{ fontSize: '9px', letterSpacing: '0.14em', marginBottom: '4px' }}>{stat.label}</div>
          <div className="mono" style={{ fontSize: '11px', color: stat.color }}>{stat.value}</div>
        </div>
        <TinyLineChart values={stat.series} color={stat.color} />
      </div>
    ))}
  </div>
);

const MiniBarChart = ({ items = [] }) => {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end', minHeight: '120px' }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{
              width: '100%',
              height: `${Math.max(10, (item.value / max) * 100)}%`,
              background: `linear-gradient(180deg, ${item.color}, ${item.color}20)`,
              boxShadow: `0 0 16px ${item.color}22`,
              borderRadius: '8px 8px 0 0',
              border: `1px solid ${item.color}55`,
              transformOrigin: 'bottom center',
              animation: `dashboardBarRise 720ms cubic-bezier(0.22, 1, 0.36, 1) ${item.value * 2}ms both`
            }} />
          </div>
          <div className="mono text-main" style={{ fontSize: '9px', marginTop: '8px', opacity: 0.8, textAlign: 'center' }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
};

const EventStream = ({ items = [] }) => (
  <div style={{ ...panelStyle, padding: '16px' }}>
    <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '12px' }}>TACTICAL EVENT STREAM</div>
    <div style={{ display: 'grid', gap: '10px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
      {items.map((item, index) => (
        <div key={`${item.timestamp}-${index}`} style={{ borderLeft: `2px solid ${item.color || '#48d7ff'}`, paddingLeft: '10px' }}>
          <div className="mono text-muted" style={{ fontSize: '8px', marginBottom: '4px' }}>{item.timestamp} // {item.type}</div>
          <div className="mono" style={{ fontSize: '10px', lineHeight: 1.6, color: item.color || '#dce8f5' }}>{item.message}</div>
        </div>
      ))}
    </div>
  </div>
);

function IncidentIntelPanel({ incident, intelFeed, intelLoading, intelError }) {
  return (
    <div style={{ ...panelStyle, padding: '16px' }}>
      <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '12px' }}>LIVE INTELLIGENCE</div>
      {!incident ? (
        <div className="mono text-muted" style={{ fontSize: '11px' }}>NO INCIDENT SELECTED.</div>
      ) : intelLoading ? (
        <div className="mono text-main" style={{ fontSize: '11px', lineHeight: 1.8 }}>
          SEARCHING LIVE FEEDS FOR {incident.label.toUpperCase()}...
        </div>
      ) : intelError ? (
        <div className="mono" style={{ fontSize: '11px', lineHeight: 1.8, color: '#ffb07a' }}>
          {intelError}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ border: '1px solid rgba(72,215,255,0.18)', background: 'rgba(72,215,255,0.05)', padding: '12px' }}>
            <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>AI SYNTHESIS</div>
            <div className="mono text-main" style={{ fontSize: '11px', lineHeight: 1.9 }}>
              {intelFeed.summary}
            </div>
          </div>
          {intelFeed.items.map((item, index) => (
            <a
              key={`${item.link}-${index}`}
              href={item.link}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
                padding: '12px',
                color: '#f5fbff'
              }}
            >
              <div className="display" style={{ fontSize: '18px', marginBottom: '8px' }}>{item.title}</div>
              <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>
                {item.source} // {item.pubDate}
              </div>
              <div className="mono text-main" style={{ fontSize: '10px', lineHeight: 1.7 }}>
                {item.snippet}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function WorldSituationMap2D({
  records,
  stationPoint,
  missionOverlays,
  countriesGeoJson,
  selectedIncidentId,
  setSelectedIncidentId
}) {
  const conflictRecords = useMemo(
    () => records.filter((item) => item.category === 'conflicts'),
    [records]
  );

  const { features: countryConflictFeatures, usedConflictIds } = useMemo(
    () => createConflictCountryFeatures(countriesGeoJson, conflictRecords),
    [conflictRecords, countriesGeoJson]
  );

  const fallbackConflictRecords = useMemo(
    () => conflictRecords.filter((incident) => !usedConflictIds?.has(incident.id)),
    [conflictRecords, usedConflictIds]
  );

  return (
    <div style={{ ...panelStyle, minHeight: '760px' }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        zoomControl={false}
        worldCopyJump
        style={{ width: '100%', height: '760px', background: '#050913' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />
        <Pane name="incident-polygons" style={{ zIndex: 410 }} />
        <Pane name="incident-lines" style={{ zIndex: 430 }} />
        <Pane name="incidents" style={{ zIndex: 450 }} />
        <Pane name="stations" style={{ zIndex: 500 }} />

        {!!countryConflictFeatures?.length && (
          <GeoJSON
            data={{ type: 'FeatureCollection', features: countryConflictFeatures }}
            style={(feature) => {
              const incident = conflictRecords.find((item) => item.id === feature?.properties?.incidentId);
              const color = categoryStyle.conflicts.color;
              const active = incident?.id === selectedIncidentId;
              return {
                pane: 'incident-polygons',
                color,
                fillColor: color,
                fillOpacity: active ? 0.18 : 0.1,
                weight: active ? 2.2 : 1.2
              };
            }}
            onEachFeature={(feature, layer) => {
              const incident = conflictRecords.find((item) => item.id === feature?.properties?.incidentId);
              if (!incident) return;
              layer.on('click', () => setSelectedIncidentId(incident.id));
              layer.bindTooltip(
                `<div class="mono" style="font-size:10px;line-height:1.5;"><div style="color:${categoryStyle.conflicts.color};margin-bottom:4px;">◎ ${incident.label.toUpperCase()}</div><div>CONFLICT ZONES // SEV ${incident.severity}</div></div>`,
                { sticky: true, direction: 'top', opacity: 1 }
              );
              layer.bindPopup(L.popup({ maxWidth: 320, className: 'dashboard-intel-popup' }).setContent('<div></div>'));
              layer.on('popupopen', (event) => {
                const container = event.popup.getElement()?.querySelector('.leaflet-popup-content > div');
                if (container) {
                  container.innerHTML = `
                    <div style="min-width:240px;background:rgba(5,10,18,0.96);color:#f5fbff;font-family:var(--font-mono);">
                      <div style="padding:12px 14px;border-bottom:1px solid ${categoryStyle.conflicts.color}33;background:linear-gradient(180deg, ${categoryStyle.conflicts.color}14, rgba(5,10,18,0.96));">
                        <div class="display" style="font-size:20px;margin-bottom:4px;">${incident.label}</div>
                        <div style="font-size:10px;letter-spacing:0.12em;color:${categoryStyle.conflicts.color};">◎ CONFLICT ZONES // ${incident.status}</div>
                      </div>
                      <div style="padding:12px 14px;display:grid;gap:10px;">
                        <div style="font-size:11px;line-height:1.7;color:#d8e7f6;">${incident.detail}</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                          <div><div style="font-size:9px;color:#7f96ad;margin-bottom:4px;">COORDINATE</div><div style="font-size:10px;color:#f5fbff;">${incident.lat.toFixed(2)}, ${incident.lng.toFixed(2)}</div></div>
                          <div><div style="font-size:9px;color:#7f96ad;margin-bottom:4px;">SEVERITY</div><div style="font-size:10px;color:${categoryStyle.conflicts.color};">SEV ${incident.severity}</div></div>
                        </div>
                        <div><div style="font-size:9px;color:#7f96ad;margin-bottom:4px;">SOURCE</div><div style="font-size:10px;color:#f5fbff;line-height:1.6;">${incident.source}</div></div>
                      </div>
                    </div>
                  `;
                }
              });
            }}
          />
        )}

        {fallbackConflictRecords.filter((item) => Array.isArray(item.polygon)).map((incident) => (
          <Polygon
            key={`poly-${incident.id}`}
            positions={incident.polygon}
            pathOptions={{
              pane: 'incident-polygons',
              color: categoryStyle[incident.category].color,
              fillColor: categoryStyle[incident.category].fill,
              fillOpacity: incident.id === selectedIncidentId ? 0.18 : 0.09,
              weight: incident.id === selectedIncidentId ? 2 : 1
            }}
            eventHandlers={{ click: () => setSelectedIncidentId(incident.id) }}
          >
            <Popup maxWidth={320} className="dashboard-intel-popup">
              <IncidentPopupContent incident={incident} />
            </Popup>
          </Polygon>
        ))}

        {stationPoint && records.slice(0, 10).map((incident) => (
          <Polyline
            key={`line-${incident.id}`}
            positions={[[stationPoint.lat, stationPoint.lng], [incident.lat, incident.lng]]}
            pathOptions={{
              pane: 'incident-lines',
              color: incident.id === selectedIncidentId ? '#72ff90' : 'rgba(72, 215, 255, 0.18)',
              weight: incident.id === selectedIncidentId ? 2 : 1,
              dashArray: '6 8'
            }}
          />
        ))}

        {records.map((incident) => {
          const style = categoryStyle[incident.category] || categoryStyle.hotspots;
          const active = incident.id === selectedIncidentId;
          const meta = getLayerMeta(incident.category);
          if (incident.category === 'bases') {
            return (
              <Marker
                key={incident.id}
                position={[incident.lat, incident.lng]}
                icon={makeIntelIcon(incident.category, active)}
                eventHandlers={{ click: () => setSelectedIncidentId(incident.id) }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="mono" style={{ fontSize: '10px', lineHeight: 1.5 }}>
                    <div style={{ color: style.color, marginBottom: '4px' }}>{meta.icon} {incident.label.toUpperCase()}</div>
                    <div>{style.label} // SEV {incident.severity}</div>
                  </div>
                </Tooltip>
                <Popup maxWidth={320} className="dashboard-intel-popup">
                  <IncidentPopupContent incident={incident} />
                </Popup>
              </Marker>
            );
          }
          return (
            <CircleMarker
              key={incident.id}
              center={[incident.lat, incident.lng]}
              radius={active ? 10 : 4 + incident.severity}
              pathOptions={{
                pane: 'incidents',
                color: style.color,
                fillColor: style.fill,
                fillOpacity: active ? 0.86 : 0.58,
                weight: active ? 2.2 : 1.1
              }}
              eventHandlers={{ click: () => setSelectedIncidentId(incident.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div className="mono" style={{ fontSize: '10px', lineHeight: 1.5 }}>
                  <div style={{ color: style.color, marginBottom: '4px' }}>{meta.icon} {incident.label.toUpperCase()}</div>
                  <div>{style.label} // SEV {incident.severity}</div>
                </div>
              </Tooltip>
              <Popup maxWidth={320} className="dashboard-intel-popup">
                <IncidentPopupContent incident={incident} />
              </Popup>
            </CircleMarker>
          );
        })}

        {missionOverlays.map((mission) => (
          <CircleMarker
            key={mission.id}
            center={[mission.lat, mission.lng]}
            radius={7}
            pathOptions={{
              pane: 'stations',
              color: categoryStyle.drone.color,
              fillColor: categoryStyle.drone.fill,
              fillOpacity: 0.9,
              weight: 2
            }}
          >
            <Tooltip direction="right" offset={[8, 0]} opacity={1}>
              <div className="mono" style={{ fontSize: '10px', lineHeight: 1.5 }}>
                <div style={{ color: '#dffcff', marginBottom: '4px' }}>{mission.name.toUpperCase()}</div>
                <div>DRONE OPS // {mission.status}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {stationPoint && (
          <CircleMarker
            center={[stationPoint.lat, stationPoint.lng]}
            radius={10}
            pathOptions={{
              pane: 'stations',
              color: categoryStyle.station.color,
              fillColor: categoryStyle.station.fill,
              fillOpacity: 0.9,
              weight: 2
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div className="mono" style={{ fontSize: '10px' }}>STATION // {stationPoint.label.toUpperCase()}</div>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}

function WorldSituationGlobe({
  records,
  stationPoint,
  missionOverlays,
  selectedIncident,
  setSelectedIncidentId
}) {
  const globeRef = useRef(null);
  const globeInstanceRef = useRef(null);

  useEffect(() => {
    if (!globeRef.current || globeInstanceRef.current) return;

    const globe = Globe()(globeRef.current)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('#050913')
      .showAtmosphere(true)
      .atmosphereColor('#48d7ff')
      .atmosphereAltitude(0.17)
      .pointRadius(0.55)
      .pointAltitude((d) => d.altitude || 0.12)
      .pointColor((d) => d.color)
      .pointLabel((d) => `
        <div style="font-family:var(--font-mono);font-size:11px;line-height:1.5;background:rgba(6,12,20,0.92);border:1px solid rgba(72,215,255,0.26);padding:8px 10px;color:#e7f9ff;">
          <div style="color:${d.color};margin-bottom:4px;">${d.label}</div>
          <div>${d.meta}</div>
        </div>
      `)
      .arcColor((d) => d.color)
      .arcDashLength(0.45)
      .arcDashGap(0.85)
      .arcDashAnimateTime(1600)
      .arcStroke(0.75)
      .ringColor(() => 'rgba(72, 215, 255, 0.55)')
      .ringMaxRadius(4)
      .ringPropagationSpeed(1.4)
      .ringRepeatPeriod(1400);

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.45;
    globe.controls().enablePan = false;
    globe.controls().minDistance = 180;
    globe.controls().maxDistance = 340;
    globeRef.current.style.height = '760px';
    globeRef.current.style.width = '100%';
    globeInstanceRef.current = globe;

    const handleResize = () => {
      if (!globeRef.current || !globeInstanceRef.current) return;
      globeInstanceRef.current.width(globeRef.current.clientWidth);
      globeInstanceRef.current.height(760);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      globe.controls().autoRotate = false;
      globeInstanceRef.current = null;
      if (globeRef.current) globeRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    if (!globeInstanceRef.current) return;

    const points = [
        ...records.map((item) => ({
          id: item.id,
          lat: item.lat,
          lng: item.lng,
          color: categoryStyle[item.category]?.color || '#48d7ff',
          label: `${getLayerMeta(item.category).icon} ${item.label}`,
          altitude: item.category === 'conflicts' ? 0.16 : 0.11 + (item.severity * 0.01),
          meta: `${categoryStyle[item.category]?.label || 'INTEL'} // ${item.status}`
        })),
      ...missionOverlays.map((item) => ({
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        color: categoryStyle.drone.fill,
        label: item.name,
        altitude: 0.08,
        meta: `DRONE OPS // ${item.status}`
      })),
      ...(stationPoint ? [{
        id: 'station-point',
        lat: stationPoint.lat,
        lng: stationPoint.lng,
        color: categoryStyle.station.fill,
        label: stationPoint.label,
        altitude: 0.18,
        meta: 'ACTIVE STATION'
      }] : [])
    ];

    const arcs = stationPoint && selectedIncident ? [{
      startLat: stationPoint.lat,
      startLng: stationPoint.lng,
      endLat: selectedIncident.lat,
      endLng: selectedIncident.lng,
      color: categoryStyle[selectedIncident.category]?.color || '#48d7ff'
    }] : [];

    const rings = stationPoint ? [{ lat: stationPoint.lat, lng: stationPoint.lng }] : [];

    globeInstanceRef.current.pointsData(points);
    globeInstanceRef.current.arcsData(arcs);
    globeInstanceRef.current.ringsData(rings);
    globeInstanceRef.current.onPointClick((point) => {
      if (point.id && typeof point.id === 'string' && point.id !== 'station-point') {
        setSelectedIncidentId(point.id);
      }
    });
  }, [records, missionOverlays, selectedIncident, setSelectedIncidentId, stationPoint]);

  return <div ref={globeRef} style={{ ...panelStyle, minHeight: '760px' }} />;
}

function FleetReadout({ swarms, unassignedDrones, formatAltitude, formatSpeed }) {
  const fleetRows = [
    ...swarms.map((swarm) => ({
      id: swarm.id,
      label: swarm.id.toUpperCase(),
      count: swarm.drones?.length || 0,
      pwr: swarm.pwr ?? 0,
      speed: swarm.speed ?? 0,
      alt: swarm.alt ?? 0
    })),
    ...unassignedDrones.map((drone) => ({
      id: drone.id,
      label: drone.id.toUpperCase(),
      count: 1,
      pwr: drone.pwr ?? 0,
      speed: drone.speed ?? 0,
      alt: drone.alt ?? 0
    }))
  ];

  return (
    <div style={{ ...panelStyle, padding: '16px' }}>
      <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '12px' }}>DRONE READOUT</div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {fleetRows.map((row) => (
          <div key={row.id} style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
              <div className="display" style={{ fontSize: '16px', color: '#f5fbff' }}>{row.label}</div>
              <div className="mono text-main" style={{ fontSize: '10px' }}>{row.count} UNIT{row.count > 1 ? 'S' : ''}</div>
            </div>
            <div className="mono text-main" style={{ fontSize: '10px', lineHeight: 1.7 }}>
              PWR {Math.round(row.pwr)}% // SPD {formatSpeed(row.speed)} // ALT {formatAltitude(row.alt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const scrollRootRef = useRef(null);
  const mission = useMission() || {};
  const {
    currentUser = null,
    users = [],
    telemetry = { swarms: [], unassignedDrones: [] },
    historyMissions = [],
    tacticalLogs = [],
    lastAIParsedCommand = null,
    selectedLocationKey = 'station (USC)',
    LOCATIONS = {},
    formatAltitude = (value) => `${value}M`,
    formatSpeed = (value) => `${value} KPH`,
    formatTemperature = (value) => `${value}°C`,
    formatVisibility = (value) => `${value} KM`,
    formatWind = (value) => value?.condition || 'STABLE'
  } = mission;

  const [mapMode, setMapMode] = useState('2d');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleLayers, setVisibleLayers] = useState({
    conflicts: true,
    hotspots: true,
    bases: true,
    nuclear: true,
    spaceports: false,
    economic: false
  });
  const [selectedIncidentId, setSelectedIncidentId] = useState(WORLD_INTEL_LAYERS[0].id);
  const [intelFeed, setIntelFeed] = useState({ summary: '', items: [] });
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState('');
  const [countriesGeoJson, setCountriesGeoJson] = useState(null);

  const swarms = telemetry?.swarms || [];
  const unassignedDrones = telemetry?.unassignedDrones || [];
  const currentLocation = LOCATIONS?.[selectedLocationKey] || { lat: 34.0206925, lng: -118.2895045 };
  const stationPoint = {
    label: formatStationLabel(selectedLocationKey),
    lat: currentLocation.lat,
    lng: currentLocation.lng
  };

  const missionOverlays = useMemo(() => (
    historyMissions
      .slice(0, 6)
      .map((missionItem) => {
        const route = missionItem.actualRoute?.length ? missionItem.actualRoute : missionItem.route;
        const destination = Array.isArray(route) && route.length ? route[route.length - 1] : null;
        if (!destination) return null;
        return {
          id: missionItem.id,
          name: missionItem.name,
          status: missionItem.status,
          lat: destination[0],
          lng: destination[1]
        };
      })
      .filter(Boolean)
  ), [historyMissions]);

  const historySummary = useMemo(() => {
    const missions = [...historyMissions];
    const recent = missions.slice(0, 8).reverse();
    const totalAssets = swarms.reduce((sum, swarm) => sum + (swarm.drones?.length || 0), 0) + unassignedDrones.length;
    const completed = missions.filter((missionItem) => ['COMPLETED', 'SUCCESS'].includes(missionItem.status)).length;
    const aborted = missions.filter((missionItem) => missionItem.status === 'ABORTED').length;
    const active = missions.filter((missionItem) => ['EXECUTING', 'TRANSIT', 'STRIKE_MONITORING', 'PAUSED', 'PENDING_ABORT'].includes(missionItem.status)).length;
    const avgDurationSec = completed
      ? missions
          .filter((missionItem) => ['COMPLETED', 'SUCCESS'].includes(missionItem.status))
          .reduce((sum, missionItem) => sum + parseDurationSeconds(missionItem.duration), 0) / completed
      : 0;
    const avgDistanceMeters = recent.length
      ? recent.reduce((sum, missionItem) => sum + routeDistanceMeters(missionItem.actualRoute?.length > 1 ? missionItem.actualRoute : missionItem.route), 0) / recent.length
      : 0;
    const activeUsers = users.filter((user) => user.status === 'ACTIVE').length;
    const durationSeries = recent.map((missionItem) => Math.round(parseDurationSeconds(missionItem.duration || '00:00:00') / 60));
    const distanceSeries = recent.map((missionItem) => Math.round(routeDistanceMeters(missionItem.actualRoute?.length > 1 ? missionItem.actualRoute : missionItem.route)));
    const trendBars = recent.map((missionItem, index) => ({
      label: `${index + 1}`,
      value: Math.max(1, Math.round(routeDistanceMeters(missionItem.actualRoute?.length > 1 ? missionItem.actualRoute : missionItem.route))),
      color: missionItem.status === 'ABORTED' ? '#ff7d3b' : '#48d7ff'
    }));
    const eventStream = tacticalLogs.slice(0, 8).map((entry) => ({
      timestamp: entry.timestamp,
      type: entry.type,
      message: entry.message,
      color: entry.type === 'SYSTEM' ? '#72ff90' : entry.type === 'ALERT' ? '#ff7d3b' : '#48d7ff'
    }));
    return {
      totalAssets,
      completed,
      aborted,
      active,
      avgDurationSec,
      avgDistanceMeters,
      activeUsers,
      durationSeries,
      distanceSeries,
      trendBars,
      latestLog: tacticalLogs[0]?.message || 'SYSTEM READY // NO ACTIVE ALERTS',
      eventStream
    };
  }, [historyMissions, swarms, unassignedDrones, users, tacticalLogs]);

  const weatherIntel = lastAIParsedCommand?.missionWeather || {
    condition: 'STABLE',
    windSpeedKts: 6,
    windDirection: 'NE',
    visibilityKm: 10,
    tempC: 24
  };

  const vitalStats = useMemo(() => ([
    { label: 'LATENCY', value: `${18 + (historySummary.active * 3)}ms`, color: '#48d7ff', series: [18, 22, 19, 24, 21, 23, 20] },
    { label: 'CORE LOAD', value: `${Math.min(96, 42 + historySummary.totalAssets * 4)}%`, color: '#ffd36e', series: [34, 40, 43, 47, 52, 48, 54] },
    { label: 'LINK SAT', value: `${Math.min(99, 63 + historySummary.activeUsers * 8)}%`, color: '#72ff90', series: [58, 62, 68, 71, 73, 76, 79] },
    { label: 'WX ALPHA', value: weatherIntel.condition, color: '#ff7d3b', series: [2, 3, 5, 4, 6, 5, 6] }
  ]), [historySummary.active, historySummary.totalAssets, historySummary.activeUsers, weatherIntel.condition]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return WORLD_INTEL_LAYERS.filter((item) => {
      if (!visibleLayers[item.category]) return false;
      if (!query) return true;
      return [
        item.label,
        item.category,
        item.status,
        item.source,
        ...(item.tags || [])
      ].some((value) => String(value).toLowerCase().includes(query));
    });
  }, [searchTerm, visibleLayers]);

  const selectedIncident = filteredRecords.find((item) => item.id === selectedIncidentId)
    || WORLD_INTEL_LAYERS.find((item) => item.id === selectedIncidentId)
    || filteredRecords[0]
    || null;

  useEffect(() => {
    let cancelled = false;

    const loadIntel = async () => {
      if (!selectedIncident) {
        setIntelFeed({ summary: '', items: [] });
        setIntelError('');
        return;
      }

      setIntelLoading(true);
      setIntelError('');

      try {
        const query = buildIncidentQuery(selectedIncident);
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const response = await fetch(endpoint);
        const payload = await response.json();

        if (cancelled) return;

        const items = Array.isArray(payload.items) ? payload.items.slice(0, 4).map((item) => ({
          title: stripHtml(item.title || 'Untitled'),
          link: item.link,
          source: stripHtml(item.author || payload.feed?.title || 'Google News'),
          pubDate: stripHtml(item.pubDate || ''),
          snippet: stripHtml(item.description || item.content || '').slice(0, 220)
        })) : [];

        const summary = items.length
          ? `${selectedIncident.label} is showing ${items.length} live news matches. Recent reporting clusters around ${items.slice(0, 2).map((item) => item.title.split(' - ')[0]).join(' and ')}.`
          : `No fresh public feed items were returned for ${selectedIncident.label}.`;

        setIntelFeed({ summary, items });
      } catch (error) {
        if (cancelled) return;
        setIntelError(`LIVE INTEL FEED UNAVAILABLE // ${error?.message || 'FETCH FAILED'}`);
        setIntelFeed({ summary: '', items: [] });
      } finally {
        if (!cancelled) setIntelLoading(false);
      }
    };

    loadIntel();
    return () => {
      cancelled = true;
    };
  }, [selectedIncident]);

  useEffect(() => {
    let cancelled = false;

    const loadCountryGeometry = async () => {
      try {
        const [countriesRes, overridesRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/countries.geojson`),
          fetch(`${import.meta.env.BASE_URL}data/country-boundary-overrides.geojson`)
        ]);

        const countries = countriesRes.ok ? await countriesRes.json() : null;
        const overrides = overridesRes.ok ? await overridesRes.json() : null;
        if (!cancelled) {
          setCountriesGeoJson(mergeCountryOverrides(countries, overrides));
        }
      } catch {
        if (!cancelled) setCountriesGeoJson(null);
      }
    };

    loadCountryGeometry();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={scrollRootRef} className="dashboard-scroll" style={{
      height: '100%',
      maxHeight: '100%',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(72, 215, 255, 0.55) rgba(255,255,255,0.05)',
      scrollbarGutter: 'stable',
      boxSizing: 'border-box',
      background: `
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
        radial-gradient(circle at 16% 14%, rgba(72, 215, 255, 0.08), transparent 22%),
        radial-gradient(circle at 82% 16%, rgba(255, 125, 59, 0.06), transparent 18%),
        linear-gradient(180deg, #050913 0%, #040812 100%)
      `,
      backgroundSize: '20px 20px, 20px 20px, auto, auto, auto',
      padding: '24px 26px 34px'
    }}>
      <style>{`
        .dashboard-grid-bottom {
          display: grid;
          grid-template-columns: 1.04fr 0.96fr;
          gap: 18px;
        }
        @media (max-width: 1440px) {
          .dashboard-grid-bottom {
            grid-template-columns: 1fr;
          }
        }
        .dashboard-scroll::-webkit-scrollbar { width: 12px; }
        .dashboard-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.04);
          border-left: 1px solid rgba(255,255,255,0.03);
        }
        .dashboard-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(72, 215, 255, 0.75), rgba(72, 215, 255, 0.28));
          border: 2px solid rgba(4, 8, 16, 0.9);
          border-radius: 999px;
          box-shadow: 0 0 18px rgba(72, 215, 255, 0.16);
        }
        @keyframes dashboardLineDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes dashboardPointReveal {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes dashboardBarRise {
          from { opacity: 0; transform: scaleY(0.18); }
          to { opacity: 1; transform: scaleY(1); }
        }
        .dashboard-intel-popup .leaflet-popup-content-wrapper {
          background: transparent;
          box-shadow: none;
          border-radius: 0;
          padding: 0;
        }
        .dashboard-intel-popup .leaflet-popup-content {
          margin: 0;
        }
        .dashboard-intel-popup .leaflet-popup-tip-container {
          margin-top: -1px;
        }
        .dashboard-intel-popup .leaflet-popup-tip {
          background: rgba(5, 10, 18, 0.96);
          box-shadow: none;
        }
        .dashboard-intel-popup .leaflet-popup-close-button {
          color: #9fb8cd;
          padding: 8px 10px 0 0;
        }
        .dashboard-intel-popup .leaflet-popup-close-button:hover {
          color: #ffffff;
          background: transparent;
        }
        .leaflet-tooltip {
          background: rgba(5, 10, 18, 0.96);
          border: 1px solid rgba(138, 216, 255, 0.2);
          box-shadow: 0 14px 30px rgba(0,0,0,0.35);
          color: #f5fbff;
        }
        .leaflet-tooltip-top:before {
          border-top-color: rgba(5, 10, 18, 0.96);
        }
        .leaflet-tooltip-bottom:before {
          border-bottom-color: rgba(5, 10, 18, 0.96);
        }
        .leaflet-tooltip-left:before {
          border-left-color: rgba(5, 10, 18, 0.96);
        }
        .leaflet-tooltip-right:before {
          border-right-color: rgba(5, 10, 18, 0.96);
        }
      `}</style>

      <RevealBlock rootRef={scrollRootRef} delay={20} style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px' }}>
          <div>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.18em', marginBottom: '10px' }}>GLOBAL LIVE THEATER</div>
            <div className="display" style={{ fontSize: '42px', color: '#f5fbff', lineHeight: 1 }}>WORLD MONITOR</div>
          </div>
          <div className="mono text-muted" style={{ fontSize: '9px', letterSpacing: '0.14em', paddingTop: '6px' }}>
            {WORLD_SOURCE_INFO.label} // {WORLD_SOURCE_INFO.value}
          </div>
        </div>
      </RevealBlock>

      <RevealBlock rootRef={scrollRootRef} delay={90} y={36} scale={0.992} style={{ marginBottom: '18px' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '18px', top: '18px', zIndex: 700, width: '274px' }}>
          <div style={{ ...panelStyle, padding: '12px 14px', background: 'rgba(7, 14, 24, 0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em' }}>LAYERS</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['2d', '3d'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setMapMode(mode)}
                    style={{
                      border: `1px solid ${mapMode === mode ? 'rgba(114,255,144,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      background: mapMode === mode ? 'rgba(114,255,144,0.16)' : 'rgba(255,255,255,0.03)',
                      color: mapMode === mode ? '#dffcff' : '#9ab6c8',
                      padding: '7px 10px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase'
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="SEARCH LAYERS..."
              className="mono"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: '10px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: '#f5fbff',
                padding: '10px 12px',
                fontSize: '10px',
                letterSpacing: '0.12em',
                outline: 'none'
              }}
            />
            <div style={{ display: 'grid', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              {layerOrder.map((key) => (
                <button
                  key={key}
                  onClick={() => setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: visibleLayers[key] ? 'rgba(72, 215, 255, 0.08)' : 'rgba(255,255,255,0.02)',
                    color: visibleLayers[key] ? '#dffcff' : '#92a6bb',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase'
                  }}
                >
                  <span>{WORLD_LAYER_META[key].icon} {WORLD_LAYER_META[key].label}</span>
                  <span>{visibleLayers[key] ? 'ON' : 'OFF'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', right: '18px', top: '18px', zIndex: 700, width: '294px' }}>
          <div style={{ ...panelStyle, padding: '12px 14px', background: 'rgba(7, 14, 24, 0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '10px' }}>MAP OVERVIEW</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {layerOrder.map((key) => {
                const count = filteredRecords.filter((item) => item.category === key).length;
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                    <span className="mono" style={{ fontSize: '10px', color: WORLD_LAYER_META[key].color }}>{WORLD_LAYER_META[key].icon} {WORLD_LAYER_META[key].label}</span>
                    <span className="mono text-main" style={{ fontSize: '10px' }}>{visibleLayers[key] ? count : 0}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', paddingTop: '4px' }}>
                <span className="mono text-muted" style={{ fontSize: '10px' }}>MODE</span>
                <span className="mono text-main" style={{ fontSize: '10px' }}>{mapMode.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span className="mono text-muted" style={{ fontSize: '10px' }}>FEED</span>
                <span className="mono text-main" style={{ fontSize: '10px' }}>{filteredRecords.length} TRACKS</span>
              </div>
            </div>
          </div>
        </div>

        {mapMode === '2d' ? (
          <WorldSituationMap2D
            records={filteredRecords}
            stationPoint={stationPoint}
            missionOverlays={missionOverlays}
            countriesGeoJson={countriesGeoJson}
            selectedIncidentId={selectedIncidentId}
            setSelectedIncidentId={setSelectedIncidentId}
          />
        ) : (
          <WorldSituationGlobe
            records={filteredRecords}
            stationPoint={stationPoint}
            missionOverlays={missionOverlays}
            selectedIncident={selectedIncident}
            setSelectedIncidentId={setSelectedIncidentId}
          />
        )}

        <div style={{
          position: 'absolute',
          left: '18px',
          right: '18px',
          bottom: '18px',
          zIndex: 700,
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          {layerOrder.filter((key) => visibleLayers[key]).map((key) => (
            <div
              key={`chip-${key}`}
              style={{
                padding: '8px 10px',
                border: `1px solid ${WORLD_LAYER_META[key].color}44`,
                background: 'rgba(5, 11, 21, 0.82)',
                color: WORLD_LAYER_META[key].color,
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.12em'
              }}
            >
              {WORLD_LAYER_META[key].icon} {WORLD_LAYER_META[key].label} // {filteredRecords.filter((item) => item.category === key).length}
            </div>
          ))}
        </div>
      </div>
      </RevealBlock>

      <RevealBlock rootRef={scrollRootRef} delay={120} y={18} scale={0.996} style={{ marginBottom: '18px' }}>
        <VitalStrip stats={vitalStats} />
      </RevealBlock>

      <div className="dashboard-grid-bottom">
        <div style={{ display: 'grid', gap: '18px' }}>
          <RevealBlock rootRef={scrollRootRef} delay={160}>
          <div style={{ ...panelStyle, padding: '16px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '12px' }}>SELECTED INTELLIGENCE</div>
            {selectedIncident ? (
              <div>
                <div className="display" style={{ fontSize: '28px', color: '#f5fbff', marginBottom: '10px' }}>{selectedIncident.label}</div>
                <div className="mono" style={{ fontSize: '11px', color: categoryStyle[selectedIncident.category].color, marginBottom: '10px' }}>
                  {getLayerMeta(selectedIncident.category).icon} {categoryStyle[selectedIncident.category].label} // {selectedIncident.status}
                </div>
                <div className="mono text-main" style={{ fontSize: '11px', lineHeight: 1.85, marginBottom: '14px' }}>{selectedIncident.detail}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                    <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>COORDINATE</div>
                    <div className="mono text-main" style={{ fontSize: '10px' }}>{selectedIncident.lat.toFixed(2)}, {selectedIncident.lng.toFixed(2)}</div>
                  </div>
                  <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                    <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>SOURCE</div>
                    <div className="mono text-main" style={{ fontSize: '10px' }}>{selectedIncident.source}</div>
                  </div>
                </div>
                <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                  <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>TAG CLUSTER</div>
                  <div className="mono text-main" style={{ fontSize: '10px', lineHeight: 1.7 }}>
                    {(selectedIncident.tags || []).map((tag) => tag.toUpperCase()).join(' // ')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mono text-muted" style={{ fontSize: '11px' }}>NO INCIDENT MATCHES THE CURRENT FILTER.</div>
            )}
          </div>
          </RevealBlock>

          <RevealBlock rootRef={scrollRootRef} delay={220}>
          <IncidentIntelPanel
            incident={selectedIncident}
            intelFeed={intelFeed}
            intelLoading={intelLoading}
            intelError={intelError}
          />
          </RevealBlock>
        </div>

        <div style={{ display: 'grid', gap: '18px' }}>
          <RevealBlock rootRef={scrollRootRef} delay={180}>
          <div style={{ ...panelStyle, padding: '16px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '12px' }}>MISSION INTELLIGENCE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              {[
                ['COMPLETED', historySummary.completed, '#72ff90'],
                ['ACTIVE', historySummary.active, '#48d7ff'],
                ['ABORTED', historySummary.aborted, '#ff7d3b'],
                ['AVG CLOCK', formatClock(historySummary.avgDurationSec), '#ffd36e']
              ].map(([label, value, color]) => (
                <div key={label} style={{ border: `1px solid ${color}33`, background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                  <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>{label}</div>
                  <div className="display" style={{ fontSize: '22px', color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>MISSION DURATION</div>
                <TinyLineChart values={historySummary.durationSeries} color="#48d7ff" />
              </div>
              <div>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>MISSION DISTANCE</div>
                <TinyLineChart values={historySummary.distanceSeries} color="#72ff90" />
              </div>
            </div>
            <div style={{ marginTop: '14px' }}>
              <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>ARCHIVE LOADOUT</div>
              <MiniBarChart items={historySummary.trendBars} />
            </div>
          </div>
          </RevealBlock>

          <RevealBlock rootRef={scrollRootRef} delay={240}>
            <EventStream items={historySummary.eventStream} />
          </RevealBlock>

          <RevealBlock rootRef={scrollRootRef} delay={280}>
          <div style={{ ...panelStyle, padding: '16px' }}>
            <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.16em', marginBottom: '12px' }}>OPERATIONAL CONTEXT</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>LOCAL WX</div>
                <div className="mono text-main" style={{ fontSize: '10px', lineHeight: 1.7 }}>
                  {formatTemperature(weatherIntel.tempC)}<br />
                  {formatVisibility(weatherIntel.visibilityKm)} VIS
                </div>
              </div>
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>WIND VECTOR</div>
                <div className="mono text-main" style={{ fontSize: '10px', lineHeight: 1.7 }}>
                  {formatWind(weatherIntel)}<br />
                  {weatherIntel.condition}
                </div>
              </div>
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px' }}>
                <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>WORLD FEED</div>
                <div className="mono text-main" style={{ fontSize: '10px', lineHeight: 1.7 }}>
                  {filteredRecords.length} VISIBLE<br />
                  {mapMode.toUpperCase()} MODE
                </div>
              </div>
            </div>
            <div style={{ border: '1px solid rgba(255, 127, 80, 0.16)', background: 'rgba(255, 127, 80, 0.05)', padding: '12px' }}>
              <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '6px' }}>LATEST SIGNAL</div>
              <div className="mono" style={{ fontSize: '10px', color: '#ffb07a', lineHeight: 1.8 }}>{historySummary.latestLog}</div>
            </div>
          </div>
          </RevealBlock>

          <RevealBlock rootRef={scrollRootRef} delay={320}>
          <FleetReadout
            swarms={swarms}
            unassignedDrones={unassignedDrones}
            formatAltitude={formatAltitude}
            formatSpeed={formatSpeed}
          />
          </RevealBlock>
        </div>
      </div>
    </div>
  );
}
