import sourceData from './worldIntelSource.generated.json';

export const WORLD_LAYER_META = {
  conflicts: { label: 'CONFLICT ZONES', color: '#ff6e5b', icon: '◎' },
  hotspots: { label: 'INTEL HOTSPOTS', color: '#ffb25a', icon: '◉' },
  bases: { label: 'MILITARY ACTIVITY', color: '#48d7ff', icon: '▲' },
  nuclear: { label: 'NUCLEAR SITES', color: '#ffd36e', icon: '⬢' },
  spaceports: { label: 'SPACEPORTS', color: '#d07bff', icon: '✦' },
  economic: { label: 'ECONOMIC CENTERS', color: '#72ff90', icon: '◆' }
};

export const WORLD_SOURCE_INFO = {
  label: 'SOURCE',
  value: 'WORLDMONITOR / OPEN GEOSPATIAL CONFIG'
};

export const WORLD_CONFLICT_COUNTRY_ISO = sourceData.conflictCountryIso || {};

const intensityToSeverity = {
  critical: 5,
  high: 5,
  elevated: 4,
  medium: 3,
  moderate: 3,
  low: 2
};

const statusToSeverity = {
  active: 4,
  controversial: 4,
  contested: 5,
  planned: 2,
  monitoring: 3,
  stable: 2,
  inactive: 2,
  decommissioned: 1
};

const normalizeStatus = (value, fallback = 'ACTIVE') => String(value || fallback).replace(/_/g, ' ').toUpperCase();

const normalizeTag = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const makeDetail = (...values) => values.find((value) => String(value || '').trim()) || 'Source-derived worldmonitor intelligence record.';

const toLatLngPolygon = (coords = []) => (
  Array.isArray(coords)
    ? coords
        .map((point) => Array.isArray(point) && point.length >= 2 ? [Number(point[1]), Number(point[0])] : null)
        .filter(Boolean)
    : []
);

const sourceLabel = (name) => `worldmonitor / ${name}`;

const normalizedHotspots = (sourceData.hotspots || []).map((item) => ({
  id: `hotspot-${item.id}`,
  sourceId: item.id,
  category: 'hotspots',
  label: item.name,
  lat: Number(item.lat),
  lng: Number(item.lon),
  severity: Number(item.escalationScore || statusToSeverity[String(item.status || '').toLowerCase()] || 3),
  detail: makeDetail(item.description, item.whyItMatters, item.location),
  source: sourceLabel('INTEL_HOTSPOTS'),
  status: normalizeStatus(item.status, 'MONITORING'),
  tags: [...(item.keywords || []), ...(item.agencies || [])].map(normalizeTag).filter(Boolean).slice(0, 8),
  location: item.location || ''
}));

const normalizedConflicts = (sourceData.conflicts || []).map((item) => ({
  id: `conflict-${item.id}`,
  sourceId: item.id,
  category: 'conflicts',
  label: item.name,
  lat: Number(item.center?.[1] ?? item.coords?.[0]?.[1] ?? 0),
  lng: Number(item.center?.[0] ?? item.coords?.[0]?.[0] ?? 0),
  severity: Number(intensityToSeverity[String(item.intensity || '').toLowerCase()] || 4),
  detail: makeDetail(item.description, item.location),
  source: sourceLabel('CONFLICT_ZONES'),
  status: normalizeStatus(item.intensity, 'HIGH'),
  tags: [...(item.keywords || []), ...(item.parties || [])].map(normalizeTag).filter(Boolean).slice(0, 10),
  polygon: toLatLngPolygon(item.coords),
  location: item.location || ''
}));

const normalizedBases = (sourceData.bases || []).map((item) => ({
  id: `base-${item.id}`,
  sourceId: item.id,
  category: 'bases',
  label: item.name,
  lat: Number(item.lat),
  lng: Number(item.lon),
  severity: Number(statusToSeverity[String(item.status || '').toLowerCase()] || 3),
  detail: makeDetail(item.description, `${item.arm || 'MILITARY'} // ${item.country || 'UNKNOWN HOST'}`),
  source: sourceLabel('MILITARY_BASES_EXPANDED'),
  status: normalizeStatus(item.status),
  tags: [item.type, item.country, item.arm, item.status].map(normalizeTag).filter(Boolean).slice(0, 8),
  location: item.country || ''
}));

const normalizedNuclear = (sourceData.nuclear || []).map((item) => ({
  id: `nuclear-${item.id}`,
  sourceId: item.id,
  category: 'nuclear',
  label: item.name,
  lat: Number(item.lat),
  lng: Number(item.lon),
  severity: Number(statusToSeverity[String(item.status || '').toLowerCase()] || 4),
  detail: makeDetail(`${String(item.type || 'site').toUpperCase()} nuclear asset operated by ${item.operator || 'UNKNOWN'}.`),
  source: sourceLabel('NUCLEAR_FACILITIES'),
  status: normalizeStatus(item.status),
  tags: [item.type, item.operator, item.status].map(normalizeTag).filter(Boolean).slice(0, 6),
  location: item.operator || ''
}));

const normalizedSpaceports = (sourceData.spaceports || []).map((item) => ({
  id: `spaceport-${item.id}`,
  sourceId: item.id,
  category: 'spaceports',
  label: item.name,
  lat: Number(item.lat),
  lng: Number(item.lon),
  severity: Number(statusToSeverity[String(item.status || '').toLowerCase()] || 3),
  detail: makeDetail(`${item.operator || 'Unknown operator'} // launch tempo ${item.launches || 'unknown'}.`),
  source: sourceLabel('SPACEPORTS'),
  status: normalizeStatus(item.status),
  tags: [item.country, item.operator, item.launches].map(normalizeTag).filter(Boolean).slice(0, 6),
  location: item.country || ''
}));

const normalizedEconomic = (sourceData.economic || []).map((item) => ({
  id: `economic-${item.id}`,
  sourceId: item.id,
  category: 'economic',
  label: item.name,
  lat: Number(item.lat),
  lng: Number(item.lon),
  severity: item.type === 'central-bank' ? 4 : 3,
  detail: makeDetail(item.description, item.country),
  source: sourceLabel('ECONOMIC_CENTERS'),
  status: normalizeStatus(item.type, 'ACTIVE'),
  tags: [item.type, item.country, item.marketHours?.timezone].map(normalizeTag).filter(Boolean).slice(0, 6),
  location: item.country || ''
}));

export const WORLD_INTEL_LAYERS = [
  ...normalizedConflicts,
  ...normalizedHotspots,
  ...normalizedBases,
  ...normalizedNuclear,
  ...normalizedSpaceports,
  ...normalizedEconomic
];
