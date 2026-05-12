import { appUsersTable, isSupabaseConfigured, supabase, userSessionsTable } from './supabase';

const ACTIVE_SESSION_ROW_ID = 'active';
export const hashPassword = (value = '') => {
  let hash = 2166136261;
  for (const ch of String(value)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export async function loadUsers() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(appUsersTable)
    .select('id, name, login_id, password_hash, role, status, payload');

  if (error) {
    console.error('[Supabase] Failed to load app users:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    ...(row.payload || {}),
    name: row.name || row.payload?.name,
    loginId: row.login_id || row.payload?.loginId,
    passwordHash: row.password_hash || row.payload?.passwordHash,
    role: row.role || row.payload?.role,
    status: row.status || row.payload?.status
  }));
}

export async function saveUsers(users) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const payload = (users || []).map((user) => ({
    id: user.id,
    name: user.name,
    login_id: user.loginId,
    password_hash: user.passwordHash,
    role: user.role,
    status: user.status,
    payload: user
  }));

  if (!payload.length) return;

  const { error } = await supabase
    .from(appUsersTable)
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Failed to save app users:', error.message);
  }
}

export async function loadActiveSession() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(userSessionsTable)
    .select('id, user_id, name, role, event_type, is_active, payload')
    .eq('id', ACTIVE_SESSION_ROW_ID)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Failed to load active user session:', error.message);
    return null;
  }

  return data ? {
    ...(data.payload || {}),
    currentUserId: data.payload?.currentUserId || data.user_id || null,
    name: data.name || data.payload?.name || null,
    role: data.role || data.payload?.role || null,
    eventType: data.event_type || data.payload?.eventType || null,
    isActive: data.is_active ?? data.payload?.isActive ?? false
  } : null;
}

export async function saveActiveSession(session) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase
    .from(userSessionsTable)
    .upsert({
      id: ACTIVE_SESSION_ROW_ID,
      user_id: session?.currentUserId || null,
      name: session?.name || null,
      role: session?.role || null,
      event_type: session?.eventType || 'ACTIVE_STATE',
      is_active: Boolean(session?.currentUserId),
      payload: session || { currentUserId: null, loggedInAt: null }
    }, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Failed to save active user session:', error.message);
  }
}

export async function recordUserSessionEvent({ userId, name, role, eventType }) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const occurredAt = Date.now();
  const { error } = await supabase
    .from(userSessionsTable)
    .insert({
      id: `session-${occurredAt}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      name,
      role,
      event_type: eventType,
      is_active: eventType === 'LOGIN',
      payload: {
        userId,
        name,
        role,
        eventType,
        occurredAt
      }
    });

  if (error) {
    console.error('[Supabase] Failed to record user session event:', error.message);
  }
}
