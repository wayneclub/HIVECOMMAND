import { appSettingsTable, isSupabaseConfigured, supabase } from './supabase';

const SETTINGS_ROW_ID = 'global';

export async function loadAppSettings() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(appSettingsTable)
    .select('id, payload')
    .eq('id', SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Failed to load app settings:', error.message);
    return null;
  }

  return data?.payload || null;
}

export async function saveAppSettings(settings) {
  if (!isSupabaseConfigured || !supabase || !settings) {
    return;
  }

  const { error } = await supabase
    .from(appSettingsTable)
    .upsert({
      id: SETTINGS_ROW_ID,
      payload: settings
    }, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Failed to save app settings:', error.message);
  }
}
