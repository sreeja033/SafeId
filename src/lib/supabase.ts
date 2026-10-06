import { createClient } from '@supabase/supabase-js';

function normalizeClientSupabaseUrl(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Strip accidental /rest/v1 or /rest/v1/ suffix so Supabase Auth & Realtime work
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseUrl = normalizeClientSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Validate whether real Supabase credentials have been configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-anon-key')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[SelfID Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not configured yet. Running in offline/mock mode for demo purposes until credentials are provided in your environment.'
  );
}

// Fallback dummy values prevent createClient from throwing an uncaught TypeError on initialization
const validUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface DatabaseProfile {
  id: string;
  role: 'USER' | 'VERIFIER';
  full_name: string | null;
  org_name: string | null;
  verifier_code: string | null;
  created_at: string;
}
