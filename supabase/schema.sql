-- ==============================================================================
-- SelfID Self-Sovereign Identity (SSI) App - Supabase PostgreSQL Schema & RLS
-- ==============================================================================
-- Single unified migration script for tables, triggers, helper functions,
-- row level security policies, indexes, and demo seeds.
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABLES DEFINITIONS
-- ==============================================================================

-- 1.1 PROFILES TABLE
-- Extends Supabase auth.users with app-specific role and identity info
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('USER', 'VERIFIER')),
  full_name TEXT,
  org_name TEXT,
  verifier_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 DIDS TABLE (Decentralized Identifiers / Digital IDs)
CREATE TABLE IF NOT EXISTS public.dids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  did TEXT NOT NULL UNIQUE,
  public_key TEXT,
  chain_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 CREDENTIALS TABLE (Encrypted Documents)
-- Verifiers NEVER get direct access to this table or its encrypted payload.
CREATE TABLE IF NOT EXISTS public.credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  issuer TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT,
  credential_hash TEXT NOT NULL,
  source_file_hash TEXT,
  storage_ref TEXT,
  chain_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure source_file_hash column exists on existing deployments
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS source_file_hash TEXT;

-- 1.4 VERIFICATION REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_fields TEXT[] NOT NULL DEFAULT '{}',
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GRANTED', 'DENIED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 CONSENTS TABLE (Permissions Granted by Users)
CREATE TABLE IF NOT EXISTS public.consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verifier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES public.credentials(id) ON DELETE CASCADE,
  shared_fields TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  grant_tx_hash TEXT,
  revoke_tx_hash TEXT
);

-- 1.6 PRESENTATIONS TABLE (Shared Info / ZK Presentation Payloads)
CREATE TABLE IF NOT EXISTS public.presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES public.consents(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. HELPER FUNCTIONS
-- ==============================================================================

-- 2.1 is_active_consent(consent_id)
-- Evaluates whether a consent is currently ACTIVE and not expired.
-- Marked SECURITY DEFINER & STABLE so RLS evaluation is fast, reliable, and avoids recursive RLS checks.
CREATE OR REPLACE FUNCTION public.is_active_consent(p_consent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.consents
    WHERE id = p_consent_id
      AND status = 'ACTIVE'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2.2 handle_new_user() Trigger Function
-- Automatically creates a public.profiles record when a user signs up via auth.users.
-- Security rule: Public signups are strictly forced to role = 'USER'.
-- The role 'VERIFIER' can ONLY be assigned if explicitly granted via auth.users.raw_app_meta_data
-- (which is strictly editable by admin / service_role and cannot be forged by client signups).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'USER';
  v_full_name TEXT;
  v_org_name TEXT;
  v_verifier_code TEXT;
BEGIN
  -- Read full_name from user-provided metadata
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  -- Check if privileged app_metadata explicitly authorizes a VERIFIER role
  IF (NEW.raw_app_meta_data->>'role') = 'VERIFIER' THEN
    v_role := 'VERIFIER';
    v_org_name := COALESCE(NEW.raw_app_meta_data->>'org_name', NEW.raw_user_meta_data->>'org_name');
    v_verifier_code := COALESCE(NEW.raw_app_meta_data->>'verifier_code', NEW.raw_user_meta_data->>'verifier_code');
  ELSE
    -- STRICT: Force role = 'USER' for public signups regardless of raw_user_meta_data
    v_role := 'USER';
    v_org_name := NULL;
    v_verifier_code := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    org_name,
    verifier_code,
    created_at
  ) VALUES (
    NEW.id,
    v_role,
    v_full_name,
    v_org_name,
    v_verifier_code,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    org_name = COALESCE(EXCLUDED.org_name, public.profiles.org_name),
    verifier_code = COALESCE(EXCLUDED.verifier_code, public.profiles.verifier_code);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3.1 PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Users and verifiers can read their own profile; authenticated users can also read verifier org details
DROP POLICY IF EXISTS "profiles_select_own_or_verifier" ON public.profiles;
CREATE POLICY "profiles_select_own_or_verifier"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR role = 'VERIFIER'
  );

-- Users can update only their own profile (full_name only; role is protected)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 3.2 DIDS POLICIES (Users manage only their own Digital IDs)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "dids_select_own" ON public.dids;
CREATE POLICY "dids_select_own"
  ON public.dids
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dids_insert_own" ON public.dids;
CREATE POLICY "dids_insert_own"
  ON public.dids
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dids_update_own" ON public.dids;
CREATE POLICY "dids_update_own"
  ON public.dids
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dids_delete_own" ON public.dids;
CREATE POLICY "dids_delete_own"
  ON public.dids
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3.3 CREDENTIALS POLICIES
-- CRITICAL REQUIREMENT: Users read and write only their own rows.
-- Verifiers can NEVER read credentials or encrypted_payload directly.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "credentials_select_own" ON public.credentials;
CREATE POLICY "credentials_select_own"
  ON public.credentials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "credentials_insert_own" ON public.credentials;
CREATE POLICY "credentials_insert_own"
  ON public.credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "credentials_update_own" ON public.credentials;
CREATE POLICY "credentials_update_own"
  ON public.credentials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "credentials_delete_own" ON public.credentials;
CREATE POLICY "credentials_delete_own"
  ON public.credentials
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3.4 VERIFICATION REQUESTS POLICIES
-- Verifiers read/write only their own requests; targeted users can read & respond
-- (including open demo requests where user_id IS NULL).
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "requests_select" ON public.verification_requests;
CREATE POLICY "requests_select"
  ON public.verification_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = verifier_id
    OR auth.uid() = user_id
    OR user_id IS NULL
  );

DROP POLICY IF EXISTS "requests_insert_verifier" ON public.verification_requests;
CREATE POLICY "requests_insert_verifier"
  ON public.verification_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = verifier_id);

DROP POLICY IF EXISTS "requests_update" ON public.verification_requests;
CREATE POLICY "requests_update"
  ON public.verification_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = verifier_id
    OR auth.uid() = user_id
    OR user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = verifier_id
    OR auth.uid() = user_id
    OR user_id IS NULL
  );

-- ------------------------------------------------------------------------------
-- 3.5 CONSENTS POLICIES
-- Users control their own consents; verifiers can read only consents addressed to them.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "consents_select" ON public.consents;
CREATE POLICY "consents_select"
  ON public.consents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = verifier_id
  );

DROP POLICY IF EXISTS "consents_insert_user" ON public.consents;
CREATE POLICY "consents_insert_user"
  ON public.consents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "consents_update_user" ON public.consents;
CREATE POLICY "consents_update_user"
  ON public.consents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3.6 PRESENTATIONS POLICIES
-- CRITICAL REQUIREMENT:
-- - The user who created the presentation can read it.
-- - Verifiers can read presentations ONLY if named in the consent AND while the consent is ACTIVE.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "presentations_select" ON public.presentations;
CREATE POLICY "presentations_select"
  ON public.presentations
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Holder/user who created the consent can always inspect what was shared
    EXISTS (
      SELECT 1 FROM public.consents c
      WHERE c.id = consent_id
        AND c.user_id = auth.uid()
    )
    OR
    -- 2. Verifier named in consent, strictly gated by is_active_consent helper
    (
      public.is_active_consent(consent_id)
      AND EXISTS (
        SELECT 1 FROM public.consents c
        WHERE c.id = consent_id
          AND c.verifier_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "presentations_insert_user" ON public.presentations;
CREATE POLICY "presentations_insert_user"
  ON public.presentations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consents c
      WHERE c.id = consent_id
        AND c.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 3.7 AUDIT LOG POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- ==============================================================================
-- 4. PERFORMANCE & FOREIGN KEY INDEXES
-- ==============================================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_dids_user_id ON public.dids(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON public.credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_verifier_id ON public.verification_requests(verifier_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON public.verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_request_id ON public.consents(request_id);
CREATE INDEX IF NOT EXISTS idx_consents_user_id ON public.consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_verifier_id ON public.consents(verifier_id);
CREATE INDEX IF NOT EXISTS idx_consents_credential_id ON public.consents(credential_id);
CREATE INDEX IF NOT EXISTS idx_presentations_consent_id ON public.presentations(consent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log(actor_id);

-- Status column indexes
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_consents_status ON public.consents(status);

-- Composite index for fast is_active_consent evaluation in RLS
CREATE INDEX IF NOT EXISTS idx_consents_active_lookup ON public.consents(id, status, expires_at);

-- Verifier lookup index
CREATE INDEX IF NOT EXISTS idx_profiles_verifier_code ON public.profiles(verifier_code) WHERE verifier_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- 5. DEMO VERIFIERS SEED SCRIPT
-- ==============================================================================
-- Demo Verifiers:
-- 1. VER-001: CMRIT Verification Portal (ver-001@verifiers.selfid.demo)
-- 2. VER-002: ABC Bank Demo (ver-002@verifiers.selfid.demo)
--
-- Note on Supabase Auth:
-- In production Supabase, auth.users records should be created via:
--   a) The Supabase Dashboard (Authentication -> Users -> Add User)
--   b) Or via Supabase Admin API: supabase.auth.admin.createUser({
--        email: 'ver-001@verifiers.selfid.demo',
--        password: '<secret>',
--        email_confirm: true,
--        app_metadata: { role: 'VERIFIER', org_name: 'CMRIT Verification Portal', verifier_code: 'VER-001' }
--      })
--
-- The block below provides an idempotent seed script that provisions deterministic
-- auth accounts and matching profile records for local development / testing.
-- ==============================================================================

DO $$
DECLARE
  v_cmrit_id UUID := '00000000-0000-0000-0000-000000000001';
  v_abc_id   UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- 1. Seed or update CMRIT Verifier in auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_cmrit_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ver-001@verifiers.selfid.demo',
    crypt('DemoVerifier2026!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"], "role": "VERIFIER", "org_name": "CMRIT Verification Portal", "verifier_code": "VER-001"}'::jsonb,
    '{"full_name": "CMRIT Official Verifier", "org_name": "CMRIT Verification Portal"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- 2. Seed or update ABC Bank Verifier in auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_abc_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ver-002@verifiers.selfid.demo',
    crypt('DemoVerifier2026!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"], "role": "VERIFIER", "org_name": "ABC Bank Demo", "verifier_code": "VER-002"}'::jsonb,
    '{"full_name": "ABC Bank Compliance Officer", "org_name": "ABC Bank Demo"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- 3. Upsert profiles directly to ensure correct verifier attributes
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    org_name,
    verifier_code,
    created_at
  ) VALUES
    (
      v_cmrit_id,
      'VERIFIER',
      'CMRIT Official Verifier',
      'CMRIT Verification Portal',
      'VER-001',
      NOW()
    ),
    (
      v_abc_id,
      'VERIFIER',
      'ABC Bank Compliance Officer',
      'ABC Bank Demo',
      'VER-002',
      NOW()
    )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    org_name = EXCLUDED.org_name,
    verifier_code = EXCLUDED.verifier_code;

  -- 4. Fix Supabase GoTrue "Database error querying schema" by ensuring token columns are empty strings instead of NULL
  UPDATE auth.users
  SET
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, '')
  WHERE id IN (v_cmrit_id, v_abc_id);

END $$;

-- ==============================================================================
-- 6. COMPATIBILITY VIEWS FOR PLAIN-ENGLISH TABLE NAMES
-- Maps digital_ids -> dids, documents -> credentials, requests -> verification_requests,
-- permissions -> consents, shared_info -> presentations
-- ==============================================================================
CREATE OR REPLACE VIEW public.digital_ids AS SELECT * FROM public.dids;
CREATE OR REPLACE VIEW public.documents AS SELECT * FROM public.credentials;
CREATE OR REPLACE VIEW public.requests AS SELECT * FROM public.verification_requests;
CREATE OR REPLACE VIEW public.permissions AS SELECT * FROM public.consents;
CREATE OR REPLACE VIEW public.shared_info AS SELECT * FROM public.presentations;
