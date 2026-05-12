import { appDebugLogsTable, isSupabaseConfigured, supabase } from './supabase';

export async function writeDebugLog(entry) {
  if (!isSupabaseConfigured || !supabase || !entry) {
    return;
  }

  const row = {
    id: entry.id,
    level: entry.level || 'INFO',
    category: entry.category || 'APP',
    message: entry.message || '',
    user_id: entry.userId || null,
    role: entry.role || null,
    payload: entry
  };

  const { error } = await supabase
    .from(appDebugLogsTable)
    .insert(row);

  if (error) {
    console.error('[Supabase] Failed to write debug log:', error.message);
  }
}
