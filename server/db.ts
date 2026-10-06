import dotenv from 'dotenv';
dotenv.config({ override: true });
import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from './envCheck';

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

const serviceRoleKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    serviceRoleKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project') &&
    !serviceRoleKey.includes('your-supabase-service-role') &&
    !serviceRoleKey.includes('your-anon')
);

// Fallback dummy client for offline development when keys are not provided
const validUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = isSupabaseConfigured ? serviceRoleKey : 'placeholder-service-key';

export const supabaseAdmin = createClient(validUrl, validKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Audit log writer: records actor actions into public.audit_log
 */
export async function writeAuditLog(
  actorId: string | null,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    if (!isSupabaseConfigured) {
      console.log(`[Audit Log Mock] Actor: ${actorId || 'system'}, Action: ${action}`);
      return;
    }

    // Only pass UUID actor_id to Postgres UUID column; if demo string ID, store in details
    const isUuid =
      actorId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);

    const { error } = await supabaseAdmin.from('audit_log').insert({
      actor_id: isUuid ? actorId : null,
      action,
      details: isUuid ? details : { ...details, demoActorId: actorId },
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[Audit Log] Failed to insert audit log entry:', error.message);
    }
  } catch (err) {
    console.warn('[Audit Log] Unexpected error recording audit event:', err);
  }
}
