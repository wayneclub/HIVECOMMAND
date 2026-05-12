import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const missionHistoryTable = import.meta.env.VITE_SUPABASE_MISSION_TABLE || 'mission_history';
export const appSettingsTable = import.meta.env.VITE_SUPABASE_SETTINGS_TABLE || 'app_settings';
export const droneTelemetryHistoryTable = import.meta.env.VITE_SUPABASE_DRONE_HISTORY_TABLE || 'drone_telemetry_history';
export const appUsersTable = import.meta.env.VITE_SUPABASE_USERS_TABLE || 'app_users';
export const userSessionsTable = import.meta.env.VITE_SUPABASE_USER_SESSIONS_TABLE || 'user_sessions';
export const appDebugLogsTable = import.meta.env.VITE_SUPABASE_DEBUG_LOGS_TABLE || 'app_debug_logs';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    })
  : null;
