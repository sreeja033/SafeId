import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Retrieves the active user's access token from Supabase Auth
 */
export async function getAccessToken(): Promise<string> {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        return data.session.access_token;
      }
    } catch (err) {
      console.warn('[API Client] Error getting Supabase session token:', err);
    }
  }

  // Fallback demo token for local preview
  const savedRole = localStorage.getItem('selfid_active_role') || 'USER';
  return savedRole === 'VERIFIER' ? 'mock-token-verifier' : 'mock-token-user';
}

/**
 * Base fetcher that attaches the Supabase Bearer token and JSON headers
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    // Ensure path starts with /api if not already specified
    const url = endpoint.startsWith('http')
      ? endpoint
      : endpoint.startsWith('/api')
      ? endpoint
      : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const serverErrorMessage = json?.error || json?.failureReason || `Request to ${url} failed with HTTP ${res.status}`;
      throw new Error(serverErrorMessage);
    }

    return { data: json, error: null };
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error('Network or unexpected API error');
    console.warn(`[SelfID API ${options.method || 'GET'}] ${endpoint}:`, errorObj.message);
    return {
      data: null,
      error: errorObj,
    };
  }
}
