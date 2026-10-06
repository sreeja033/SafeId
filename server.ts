import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { runFullDatabaseHealthCheck, printEnvironmentDiagnostics } from './server/envCheck';
import { supabaseAdmin, isSupabaseConfigured } from './server/db';
import { z } from 'zod';

const signupBodySchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

async function startServer() {
  // Print environment variable validation report on startup
  printEnvironmentDiagnostics();

  const app = express();
  const PORT = 3000;

  // Enable CORS for frontend requests
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Parse JSON payloads (up to 15MB for large phone photos and base64 uploads)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Public health & database diagnostics endpoint (never requires authentication)
  app.get('/api/health', async (req, res) => {
    try {
      const report = await runFullDatabaseHealthCheck(req.headers.authorization);
      res.status(200).json(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected health check error';
      console.error('[SelfID Health Error]:', msg);
      res.status(500).json({
        status: 'error',
        error: msg,
      });
    }
  });

  // Public demo mode status endpoint (never requires authentication)
  app.get('/api/demo/status', (_req, res) => {
    const isDemo = Boolean(
      process.env.DEMO_MODE === 'true' ||
        process.env.VITE_DEMO_MODE === 'true' ||
        process.env.DEMO_MODE === '1'
    );
    res.status(200).json({ demoMode: isDemo });
  });

  // Public user signup route using service role admin.createUser({ email_confirm: true })
  // Avoids Supabase free-tier outgoing email rate limits (429 over_email_send_rate_limit)
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const parsed = signupBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid signup details.',
        });
        return;
      }

      const { fullName, email, password } = parsed.data;
      const normalizedEmail = email.trim().toLowerCase();

      if (!isSupabaseConfigured) {
        res.status(200).json({
          userId: '00000000-0000-0000-0000-000000000002',
          email: normalizedEmail,
          fullName: fullName.trim(),
          alreadyExisted: false,
        });
        return;
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
        },
      });

      if (createErr) {
        const msgLower = createErr.message.toLowerCase();
        // If the user already registered this email, sync their password and confirm email so signInWithPassword succeeds
        if (
          msgLower.includes('already been registered') ||
          msgLower.includes('already registered') ||
          msgLower.includes('already exists')
        ) {
          // Find user ID from public.profiles or auth.users to ensure password & confirmation are synced
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 100,
          });
          const existingUser = usersList?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (existingUser) {
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName.trim() },
            });
          }

          res.status(200).json({
            userId: existingUser?.id,
            email: normalizedEmail,
            fullName: fullName.trim(),
            alreadyExisted: true,
          });
          return;
        }

        console.error('[SelfID Auth Signup Error]:', createErr.message);
        res.status(400).json({ error: createErr.message });
        return;
      }

      res.status(200).json({
        userId: created.user?.id,
        email: normalizedEmail,
        fullName: fullName.trim(),
        alreadyExisted: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account';
      console.error('[SelfID Auth Signup Exception]:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // Public verifier lookup: finds account email from profiles.verifier_code
  // Never uses hardcoded passwords or fake logins
  app.post('/api/auth/verifier-lookup', async (req, res) => {
    try {
      const rawInput = String(req.body?.verifierCodeOrEmail || '').trim();
      if (!rawInput) {
        res.status(400).json({ error: "Verifier ID or email is required." });
        return;
      }

      if (!isSupabaseConfigured) {
        // Fallback when Supabase is not configured in local environment
        const code = rawInput.toUpperCase().includes('002') ? 'VER-002' : 'VER-001';
        const org = code === 'VER-002' ? 'ABC Bank Demo' : 'CMRIT Verification Portal';
        res.status(200).json({
          email: `${code.toLowerCase()}@verifiers.selfid.demo`,
          orgName: org,
          verifierCode: code,
        });
        return;
      }

      // 1. If input contains @, verify it is an existing verifier account
      if (rawInput.includes('@')) {
        const emailLower = rawInput.toLowerCase();
        const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) {
          throw listErr;
        }

        const matchedUser = usersList.users.find(
          (u) => u.email?.toLowerCase() === emailLower
        );

        if (!matchedUser) {
          res.status(404).json({ error: "This verifier ID doesn't exist" });
          return;
        }

        const { data: prof, error: profErr } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', matchedUser.id)
          .maybeSingle();

        if (profErr || !prof || prof.role !== 'VERIFIER') {
          res.status(404).json({ error: "This verifier ID doesn't exist" });
          return;
        }

        res.status(200).json({
          email: matchedUser.email,
          orgName: prof.org_name || 'Authorized Verifier',
          verifierCode: prof.verifier_code || 'VER-001',
        });
        return;
      }

      // 2. Lookup by verifier_code (e.g. VER-001 or VER-002)
      const { data: profRow, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('verifier_code', rawInput)
        .eq('role', 'VERIFIER')
        .maybeSingle();

      if (pErr || !profRow) {
        res.status(404).json({ error: "This verifier ID doesn't exist" });
        return;
      }

      // Retrieve the associated email from auth.users using the service role admin client
      const { data: authUserData, error: uErr } = await supabaseAdmin.auth.admin.getUserById(
        profRow.id
      );

      if (uErr || !authUserData?.user?.email) {
        res.status(404).json({ error: "This verifier ID doesn't exist" });
        return;
      }

      res.status(200).json({
        email: authUserData.user.email,
        orgName: profRow.org_name || 'Authorized Verifier',
        verifierCode: profRow.verifier_code,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error looking up verifier';
      res.status(500).json({ error: msg });
    }
  });

  // Mount backend API exclusively on /api so GET / and frontend routes are served by Vite
  app.use('/api', apiRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SelfID Server] Backend + Vite running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SelfID Server] Fatal startup error:', err);
});
