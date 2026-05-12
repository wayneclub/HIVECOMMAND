import { droneTelemetryHistoryTable, isSupabaseConfigured, supabase } from './supabase';

const buildTelemetryRows = (records = []) => (
  (records || []).flatMap((mission) =>
    (mission.tacticalLog || []).flatMap((entry) =>
      ((entry.telemetrySnapshot?.swarms || []).flatMap((swarm) =>
        (swarm.drones || []).map((drone) => ({
          id: `${entry.id}-${drone.id}`,
          history_id: mission.id,
          log_id: entry.id,
          recorded_at: new Date(entry.at || Date.now()).toISOString(),
          unit_id: drone.id,
          group_id: swarm.id,
          payload: {
            missionId: mission.id,
            missionName: mission.name,
            logMessage: entry.message,
            timestamp: entry.timestamp,
            phase: entry.phase,
            type: entry.type,
            coords: entry.coords || null,
            status: swarm.status,
            drone
          }
        }))
      )).concat(
        (entry.telemetrySnapshot?.unassignedDrones || []).map((drone) => ({
          id: `${entry.id}-${drone.id}`,
          history_id: mission.id,
          log_id: entry.id,
          recorded_at: new Date(entry.at || Date.now()).toISOString(),
          unit_id: drone.id,
          group_id: 'INDEPENDENT',
          payload: {
            missionId: mission.id,
            missionName: mission.name,
            logMessage: entry.message,
            timestamp: entry.timestamp,
            phase: entry.phase,
            type: entry.type,
            coords: entry.coords || null,
            status: drone.status,
            drone
          }
        }))
      )
    )
  )
);

export async function syncDroneTelemetryHistory(records) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const rows = buildTelemetryRows(records);
  if (!rows.length) return;

  const { error } = await supabase
    .from(droneTelemetryHistoryTable)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Failed to sync drone telemetry history:', error.message);
  }
}
