import { isSupabaseConfigured, missionHistoryTable, supabase } from './supabase';

const normalizeMissionRecord = (record) => ({
  ...record,
  plannedRoute: Array.isArray(record?.plannedRoute) ? record.plannedRoute : [],
  route: Array.isArray(record?.route) ? record.route : [],
  actualRoute: Array.isArray(record?.actualRoute) ? record.actualRoute : [],
  timeline: Array.isArray(record?.timeline) ? record.timeline : []
});

export async function loadMissionHistory() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(missionHistoryTable)
    .select('id, payload');

  if (error) {
    console.error('[Supabase] Failed to load mission history:', error.message);
    return [];
  }

  return (data || [])
    .map((row) => normalizeMissionRecord({ id: row.id, ...(row.payload || {}) }))
    .sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0));
}

export async function saveMissionHistory(records) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const payload = (records || []).map((record) => ({
    id: record.id,
    payload: normalizeMissionRecord(record)
  }));

  if (payload.length === 0) return;

  const { error } = await supabase
    .from(missionHistoryTable)
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Failed to save mission history:', error.message);
  }
}
