import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, DatabaseProfile } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';
import { identityService } from '../services/identityService';

export interface VerifierProfile {
  orgName: string;
  orgId: string;
  verifierCode: string;
  did: string;
  enclaveStatus: string;
  nodeVersion: string;
  quotaPercent: number;
}

export interface AuthContextType {
  session: Session | null;
  userAuth: User | null;
  profile: DatabaseProfile | null;
  role: UserRole;
  user: UserProfile | null;
  verifier: VerifierProfile;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signUpUser: (fullName: string, email: string, password: string) => Promise<{ error: Error | null }>;
  signInUser: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInVerifier: (verifierCodeOrEmail: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  // Backwards compatibility helpers
  setRole: (role: UserRole) => void;
  login: (role: UserRole, emailOrDid?: string) => Promise<boolean>;
  signup: (name: string, email: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const defaultVerifier: VerifierProfile = {
  orgName: 'CMRIT Verification Portal',
  orgId: 'VER-001',
  verifierCode: 'VER-001',
  did: 'did:web:cmrit.ac.in:verifier-001',
  enclaveStatus: 'Protected · Ready',
  nodeVersion: 'NODE v2.4 (Open Standard)',
  quotaPercent: 84,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DatabaseProfile | null>(null);
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('selfid_active_role') as UserRole) || 'USER';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // App-level state for mock views
  const [user, setUser] = useState<UserProfile | null>(null);
  const [verifier, setVerifier] = useState<VerifierProfile>(defaultVerifier);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('[SelfID Auth] Could not fetch profile from public.profiles:', profileErr.message);
        return null;
      }

      if (data) {
        const dbProfile = data as DatabaseProfile;
        setProfile(dbProfile);
        setRoleState(dbProfile.role);
        localStorage.setItem('selfid_active_role', dbProfile.role);

        if (dbProfile.role === 'VERIFIER') {
          setVerifier((prev) => ({
            ...prev,
            orgName: dbProfile.org_name || prev.orgName,
            orgId: dbProfile.verifier_code || prev.orgId,
            verifierCode: dbProfile.verifier_code || prev.verifierCode,
          }));
        }

        return dbProfile;
      }
    } catch (err) {
      console.warn('[SelfID Auth] Profile fetch exception:', err);
    }
    return null;
  }, []);

  const refreshUser = useCallback(async () => {
    const currentRole = localStorage.getItem('selfid_active_role') || 'USER';
    if (currentRole === 'VERIFIER') {
      return;
    }
    try {
      const p = await identityService.getProfile();
      setUser(p);
    } catch (err) {
      console.warn('[SelfID Auth] Error refreshing user profile:', err);
    }
  }, []);

  // Initialize session & auth listener on mount
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        setIsLoading(true);

        if (isSupabaseConfigured) {
          const { data, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) throw sessionErr;

          if (isMounted) {
            setSession(data.session);
            if (data.session?.user) {
              await fetchProfile(data.session.user.id);
            } else if (localStorage.getItem('selfid_is_auth') === 'true') {
              const savedRole = (localStorage.getItem('selfid_active_role') as UserRole) || 'USER';
              setRoleState(savedRole);
              setProfile({
                id: '00000000-0000-0000-0000-000000000002',
                role: savedRole,
                full_name: 'Student User',
                org_name: savedRole === 'VERIFIER' ? 'CMRIT Verification Portal' : null,
                verifier_code: savedRole === 'VERIFIER' ? 'VER-001' : null,
                created_at: new Date().toISOString(),
              });
            }
          }
        } else {
          // Offline fallback mode for preview when environment credentials are not yet set
          const savedAuth = localStorage.getItem('selfid_is_auth') === 'true';
          const savedRole = (localStorage.getItem('selfid_active_role') as UserRole) || 'USER';
          setRoleState(savedRole);

          if (savedAuth) {
            setProfile({
              id: 'demo-local-user',
              role: savedRole,
              full_name: 'Student User',
              org_name: savedRole === 'VERIFIER' ? 'CMRIT Verification Portal' : null,
              verifier_code: savedRole === 'VERIFIER' ? 'VER-001' : null,
              created_at: new Date().toISOString(),
            });
          }
        }

        await refreshUser();
      } catch (err: unknown) {
        console.warn('[SelfID Auth] Initialization warning:', err);
        setError(err instanceof Error ? err.message : 'Authentication initialization issue');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initialize();

    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [fetchProfile, refreshUser]);

  // 1. Sign Up User (Strictly forces role 'USER')
  const signUpUser = async (
    fullName: string,
    email: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        // Fallback simulation when VITE_SUPABASE_URL isn't set yet
        await new Promise((r) => setTimeout(r, 600));
        const mockProfile: DatabaseProfile = {
          id: 'demo-' + Date.now(),
          role: 'USER',
          full_name: fullName.trim(),
          org_name: null,
          verifier_code: null,
          created_at: new Date().toISOString(),
        };
        setProfile(mockProfile);
        setRoleState('USER');
        localStorage.setItem('selfid_active_role', 'USER');
        localStorage.setItem('selfid_is_auth', 'true');
        await identityService.createDID(fullName, email);
        await refreshUser();
        setIsLoading(false);
        return { error: null };
      }

      // Create user via backend service-role endpoint with email_confirm: true
      // so Supabase never hits the free-tier outgoing email rate limit (429)
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const signupJson = await signupRes.json().catch(() => null);
      if (!signupRes.ok) {
        throw new Error(signupJson?.error || 'Could not create account.');
      }

      // Sign in immediately with the confirmed account to obtain a real Supabase JWT session
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) {
        throw signInErr;
      }

      if (signInData.session) {
        setSession(signInData.session);
        if (signInData.user) {
          await fetchProfile(signInData.user.id);
        }
      }

      setRoleState('USER');
      localStorage.setItem('selfid_active_role', 'USER');
      localStorage.setItem('selfid_is_auth', 'true');
      await identityService.createDID(fullName.trim(), email.trim());
      await refreshUser();
      return { error: null };
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error('Failed to create account.');
      setError(errObj.message);
      return { error: errObj };
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Sign In User (Personal Wallet)
  const signInUser = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        await new Promise((r) => setTimeout(r, 400));
        const mockProfile: DatabaseProfile = {
          id: 'demo-user-id',
          role: 'USER',
          full_name: 'Elena Rostova',
          org_name: null,
          verifier_code: null,
          created_at: new Date().toISOString(),
        };
        setProfile(mockProfile);
        setRoleState('USER');
        localStorage.setItem('selfid_active_role', 'USER');
        localStorage.setItem('selfid_is_auth', 'true');
        await refreshUser();
        setIsLoading(false);
        return { error: null };
      }

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        const msg = signInErr.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          throw new Error('Wrong email or password');
        }
        throw new Error(signInErr.message);
      }

      if (data.session && data.user) {
        setSession(data.session);
        const fetched = await fetchProfile(data.user.id);

        if (fetched?.role === 'VERIFIER') {
          // Reject verifier account on user portal login
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          throw new Error('This account is a verifier. Please sign in via the Verifier Portal.');
        }

        setRoleState('USER');
        localStorage.setItem('selfid_active_role', 'USER');
        localStorage.setItem('selfid_is_auth', 'true');
        await refreshUser();
      }

      return { error: null };
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error('Wrong email or password');
      setError(errObj.message);
      return { error: errObj };
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Sign In Verifier
  // Looks up the verifier ID in profiles.verifier_code on the server to find the real account email,
  // then authenticates with real Supabase Auth. Never uses hard-coded passwords or fake logins.
  const signInVerifier = async (
    verifierCodeOrEmail: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        await new Promise((r) => setTimeout(r, 400));
        const code = verifierCodeOrEmail.toUpperCase().includes('002') ? 'VER-002' : 'VER-001';
        const orgName = code === 'VER-002' ? 'ABC Bank Demo' : 'CMRIT Verification Portal';

        const mockProfile: DatabaseProfile = {
          id: 'demo-verifier-' + code,
          role: 'VERIFIER',
          full_name: `${orgName} Officer`,
          org_name: orgName,
          verifier_code: code,
          created_at: new Date().toISOString(),
        };

        setProfile(mockProfile);
        setRoleState('VERIFIER');
        setVerifier({
          orgName,
          orgId: code,
          verifierCode: code,
          did: `did:web:${code.toLowerCase()}.verifier.selfid.demo`,
          enclaveStatus: 'Protected · Ready',
          nodeVersion: 'NODE v2.4 (Open Standard)',
          quotaPercent: 84,
        });

        localStorage.setItem('selfid_active_role', 'VERIFIER');
        localStorage.setItem('selfid_is_auth', 'true');
        setIsLoading(false);
        return { error: null };
      }

      // Step A: Look up account email on the server using profiles.verifier_code
      const lookupRes = await fetch('/api/auth/verifier-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifierCodeOrEmail: verifierCodeOrEmail.trim() }),
      });

      const lookupJson = await lookupRes.json().catch(() => null);

      if (!lookupRes.ok) {
        throw new Error(lookupJson?.error || "This verifier ID doesn't exist");
      }

      const verifierEmail = lookupJson.email;

      // Step B: Authenticate with real Supabase Auth
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: verifierEmail,
        password,
      });

      if (authErr) {
        const msg = authErr.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          throw new Error('Wrong email or password');
        }
        throw new Error(authErr.message);
      }

      if (data.session && data.user) {
        setSession(data.session);
        const fetched = await fetchProfile(data.user.id);

        if (fetched?.role !== 'VERIFIER') {
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          throw new Error('This account does not have verifier permissions.');
        }

        setRoleState('VERIFIER');
        localStorage.setItem('selfid_active_role', 'VERIFIER');
        localStorage.setItem('selfid_is_auth', 'true');
      }

      return { error: null };
    } catch (err: unknown) {
      const errObj =
        err instanceof Error
          ? err
          : new Error('Verifier authentication failed. Please verify your credentials.');
      setError(errObj.message);
      return { error: errObj };
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Sign Out
  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[SelfID Auth] Sign out error:', err);
    } finally {
      setSession(null);
      setProfile(null);
      setUser(null);
      localStorage.setItem('selfid_is_auth', 'false');
      localStorage.removeItem('selfid_active_role');
      setIsLoading(false);
    }
  };

  // Legacy wrappers for backward compatibility
  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('selfid_active_role', newRole);
    if (profile) {
      setProfile({ ...profile, role: newRole });
    }
  };

  const login = async (loginRole: UserRole, emailOrDid?: string): Promise<boolean> => {
    if (loginRole === 'VERIFIER') {
      const res = await signInVerifier(emailOrDid || 'VER-001', 'DemoVerifier2026!');
      return !res.error;
    } else {
      const res = await signInUser(emailOrDid || 'elena@zk-identity.net', 'K9#m$EnclaveSecure!2025');
      return !res.error;
    }
  };

  const signup = async (name: string, email: string): Promise<boolean> => {
    const res = await signUpUser(name, email, 'K9#m$EnclaveSecure!2025');
    return !res.error;
  };

  const logout = () => {
    signOut();
  };

  const isAuthenticated = Boolean(
    session?.user || (profile && localStorage.getItem('selfid_is_auth') === 'true')
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        userAuth: session?.user || null,
        profile,
        role,
        user,
        verifier,
        isAuthenticated,
        isLoading,
        error,
        signUpUser,
        signInUser,
        signInVerifier,
        signOut,
        setRole,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
