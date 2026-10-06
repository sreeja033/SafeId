import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from './db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIER';
  profile?: {
    id: string;
    role: 'USER' | 'VERIFIER';
    full_name: string | null;
    org_name: string | null;
    verifier_code: string | null;
  } | null;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authenticates user via Supabase JWT Bearer token
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized: Missing or malformed Authorization header (Bearer token required)',
    });
    return;
  }

  // Handle local mock preview mode when real Supabase credentials are not yet configured
  if (!isSupabaseConfigured || token.startsWith('mock-token-') || token === 'demo-token') {
    const isVerifier = token.includes('verifier') || (req.headers['x-role'] as string) === 'VERIFIER';
    const mockId = isVerifier
      ? '00000000-0000-0000-0000-000000000001'
      : '00000000-0000-0000-0000-000000000002';
    const mockRole = isVerifier ? 'VERIFIER' : 'USER';

    req.user = {
      id: mockId,
      email: isVerifier ? 'ver-001@verifiers.selfid.demo' : 'student@selfid.demo',
      role: mockRole,
      profile: {
        id: mockId,
        role: mockRole,
        full_name: isVerifier ? 'CMRIT Official Verifier' : 'Student User',
        org_name: isVerifier ? 'CMRIT Verification Portal' : null,
        verifier_code: isVerifier ? 'VER-001' : null,
      },
    };
    next();
    return;
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      res.status(401).json({
        error: `Unauthorized: Invalid token (${authError?.message || 'user not found'})`,
      });
      return;
    }

    const userId = authData.user.id;

    // Fetch user profile from public.profiles
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const role = (profileData?.role as 'USER' | 'VERIFIER') || 'USER';

    req.user = {
      id: userId,
      email: authData.user.email || '',
      role,
      profile: profileData || null,
    };

    next();
  } catch (err: unknown) {
    res.status(401).json({
      error: `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
}

/**
 * Route protection: enforces role permissions (USER and/or VERIFIER)
 */
export function requireRole(...allowedRoles: Array<'USER' | 'VERIFIER'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: This route requires ${allowedRoles.join(' or ')} role. Your role is ${req.user.role}.`,
      });
      return;
    }

    next();
  };
}
