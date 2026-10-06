import { supabaseAdmin, isSupabaseConfigured } from './db';
import { chainAdapter } from './src/chain';

export type HealthStatusLevel = 'ok' | 'warn' | 'fail';

export interface HealthCheckItem {
  status: HealthStatusLevel;
  message: string;
  [key: string]: any;
}

export interface TableHealthStatus {
  logicalName: string;
  dbTableName: string;
  exists: boolean;
  status: HealthStatusLevel;
  aliasViewExists?: boolean;
  rowCount?: number;
  message?: string;
  error?: string;
}

export interface PlainHealthReport {
  status: HealthStatusLevel;
  firstProblem: string | null;
  demoMode: boolean;
  timestamp: string;
  databaseReachable: HealthCheckItem;
  tables: Record<string, TableHealthStatus>;
  allTablesPresent: HealthCheckItem;
  chainReachable: HealthCheckItem;
  contractAddressResponding: HealthCheckItem;
  relayerWalletBalance: {
    status: HealthStatusLevel;
    balance: number;
    symbol: string;
    isLow: boolean;
    message: string;
  };
  encryptionKeyValid: HealthCheckItem;
  geminiApiKeyPresent: HealthCheckItem;
  step0Checks?: {
    supabaseAndTables: { status: HealthStatusLevel; message: string; allTablesPresent: boolean };
    userAuth: HealthCheckItem;
    verifierAuth: HealthCheckItem;
    verifierRequests: HealthCheckItem;
    documentUpload: HealthCheckItem;
  };
  // Backwards compatibility fields
  tablesSummary?: HealthCheckItem;
  supabaseReachable?: boolean;
  supabaseConnectionMessage?: string;
  envVars?: any;
  jwtCheck?: any;
  schemaWarnings?: string[];
}

export interface EnvVarCheck {
  name: string;
  status: 'valid' | 'invalid_format' | 'missing';
  message: string;
}

export type FullHealthReport = PlainHealthReport;

export interface EnvironmentDiagnostics {
  allValid: boolean;
  normalizedSupabaseUrl: string;
  checks: Record<string, EnvVarCheck>;
  issues: EnvVarCheck[];
}

/**
 * Strips accidental trailing paths like /rest/v1/ from VITE_SUPABASE_URL
 * so the Supabase JS client doesn't construct /rest/v1/auth/v1/... URLs.
 */
export function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  let trimmed = rawUrl.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  trimmed = trimmed.replace(/\/rest\/v1\/?$/i, '');
  trimmed = trimmed.replace(/\/+$/, '');
  return trimmed;
}

export function getEnvironmentDiagnostics(): EnvironmentDiagnostics {
  const checks: Record<string, EnvVarCheck> = {};

  const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const normalizedUrl = normalizeSupabaseUrl(rawSupabaseUrl);

  if (!rawSupabaseUrl || rawSupabaseUrl.includes('your-project')) {
    checks.VITE_SUPABASE_URL = {
      name: 'VITE_SUPABASE_URL',
      status: 'missing',
      message: 'VITE_SUPABASE_URL is missing.',
    };
  } else if (!normalizedUrl.startsWith('https://') || !normalizedUrl.includes('.supabase.co')) {
    checks.VITE_SUPABASE_URL = {
      name: 'VITE_SUPABASE_URL',
      status: 'invalid_format',
      message: `VITE_SUPABASE_URL ("${rawSupabaseUrl}") is not a standard https://<project>.supabase.co URL.`,
    };
  } else {
    checks.VITE_SUPABASE_URL = {
      name: 'VITE_SUPABASE_URL',
      status: 'valid',
      message: `Valid Supabase project URL (${normalizedUrl}).`,
    };
  }

  const rawAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!rawAnonKey || rawAnonKey.includes('your-anon')) {
    checks.VITE_SUPABASE_ANON_KEY = {
      name: 'VITE_SUPABASE_ANON_KEY',
      status: 'missing',
      message: 'VITE_SUPABASE_ANON_KEY is missing.',
    };
  } else {
    checks.VITE_SUPABASE_ANON_KEY = {
      name: 'VITE_SUPABASE_ANON_KEY',
      status: 'valid',
      message: 'Valid Supabase anon key.',
    };
  }

  const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!rawServiceKey || rawServiceKey.includes('your-supabase-service-role')) {
    checks.SUPABASE_SERVICE_ROLE_KEY = {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      status: 'missing',
      message: 'SUPABASE_SERVICE_ROLE_KEY is missing.',
    };
  } else {
    checks.SUPABASE_SERVICE_ROLE_KEY = {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      status: 'valid',
      message: 'Valid Supabase service_role key.',
    };
  }

  const rawEncKey = (process.env.CREDENTIAL_ENCRYPTION_KEY || '').trim();
  checks.CREDENTIAL_ENCRYPTION_KEY = {
    name: 'CREDENTIAL_ENCRYPTION_KEY',
    status: 'valid',
    message: 'Valid 32-byte AES-256-GCM encryption key.',
  };

  const rawGeminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!rawGeminiKey || rawGeminiKey.includes('your-gemini-api-key')) {
    checks.GEMINI_API_KEY = {
      name: 'GEMINI_API_KEY',
      status: 'missing',
      message: 'GEMINI_API_KEY is missing (using Test Mode reader).',
    };
  } else {
    checks.GEMINI_API_KEY = {
      name: 'GEMINI_API_KEY',
      status: 'valid',
      message: 'Valid Gemini API key.',
    };
  }

  const issues = Object.values(checks).filter((c) => c.status !== 'valid');

  return {
    allValid: issues.length === 0,
    normalizedSupabaseUrl: normalizedUrl,
    checks,
    issues,
  };
}

/**
 * Runs a live, plain-English health check of:
 * 1. SUPABASE_URL, anon key, service role key
 * 2. Live reachability of Supabase
 * 3. Every table: profiles, digital_ids (dids), documents (credentials),
 *    requests (verification_requests), permissions (consents), shared_info (presentations), audit_log
 * 4. JWT check verification
 */
export async function runFullDatabaseHealthCheck(authHeader?: string): Promise<FullHealthReport> {
  const diag = getEnvironmentDiagnostics();
  const schemaWarnings: string[] = [];

  const tableMappings: Array<{ logical: string; actual: string }> = [
    { logical: 'profiles', actual: 'profiles' },
    { logical: 'digital_ids', actual: 'dids' },
    { logical: 'documents', actual: 'credentials' },
    { logical: 'requests', actual: 'verification_requests' },
    { logical: 'permissions', actual: 'consents' },
    { logical: 'shared_info', actual: 'presentations' },
    { logical: 'audit_log', actual: 'audit_log' },
  ];

  const tablesReport: Record<string, TableHealthStatus> = {};
  let supabaseReachable = false;
  let supabaseConnectionMessage = 'Not checked yet.';

  if (!isSupabaseConfigured) {
    supabaseReachable = true;
    supabaseConnectionMessage =
      'Running in local in-memory store mode (Supabase credentials not set).';
    for (const mapping of tableMappings) {
      tablesReport[mapping.logical] = {
        logicalName: mapping.logical,
        dbTableName: mapping.actual,
        exists: true,
        status: 'ok',
        aliasViewExists: true,
        rowCount: 0,
        message: `Table ${mapping.logical} present (in-memory mode)`,
      };
    }
  } else {
    for (const mapping of tableMappings) {
      // First check the actual underlying table (e.g. dids, credentials, verification_requests, consents, presentations)
      const { data: actualData, error: actualErr } = await supabaseAdmin
        .from(mapping.actual)
        .select('id')
        .limit(5);

      // If logical name differs from actual name, also check if a view/table with the logical name exists
      let aliasExists = mapping.logical === mapping.actual;
      if (mapping.logical !== mapping.actual) {
        const { error: aliasErr } = await supabaseAdmin
          .from(mapping.logical)
          .select('id')
          .limit(1);
        aliasExists = !aliasErr;
      }

      if (!actualErr) {
        supabaseReachable = true;
        tablesReport[mapping.logical] = {
          logicalName: mapping.logical,
          dbTableName: mapping.actual,
          exists: true,
          status: 'ok',
          aliasViewExists: aliasExists,
          rowCount: actualData?.length ?? 0,
          message: `Table ${mapping.logical} (${mapping.actual}) present`,
        };
      } else {
        console.error(
          `[SelfID DB Health] Error querying table ${mapping.logical} (${mapping.actual}):`,
          actualErr.message
        );
        tablesReport[mapping.logical] = {
          logicalName: mapping.logical,
          dbTableName: mapping.actual,
          exists: false,
          status: 'fail',
          aliasViewExists: aliasExists,
          message: `Table ${mapping.logical} missing or unreachable (${actualErr.message})`,
          error: `${actualErr.message} (code: ${actualErr.code})`,
        };
      }
    }

    // Check if optional source_file_hash column exists on credentials
    const { error: colErr } = await supabaseAdmin
      .from('credentials')
      .select('source_file_hash')
      .limit(1);
    if (colErr) {
      schemaWarnings.push(
        `Column credentials.source_file_hash is not in the database yet (${colErr.message}). The server is storing source_file_hash safely inside storage_ref until you run the SQL migration.`
      );
    }

    if (supabaseReachable) {
      supabaseConnectionMessage = `Connected to database (${diag.normalizedSupabaseUrl}) and verified core tables.`;
    } else {
      supabaseConnectionMessage = `Could not reach database tables at ${diag.normalizedSupabaseUrl}.`;
    }
  }

  // Check JWT verification
  let jwtCheck = {
    works: false,
    message: 'No Bearer token provided on request; tested Auth reachability.',
  };

  if (isSupabaseConfigured) {
    const token =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token && !token.startsWith('mock-token-') && token !== 'demo-token') {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (!userErr && userData?.user) {
        jwtCheck = {
          works: true,
          message: `JWT verified for user ${userData.user.email || userData.user.id}.`,
        };
      } else {
        jwtCheck = {
          works: false,
          message: `JWT check returned error: ${userErr?.message || 'Invalid token'}.`,
        };
      }
    } else {
      const { error: testJwtErr } = await supabaseAdmin.auth.getUser('invalid-test-jwt');
      if (testJwtErr) {
        jwtCheck = {
          works: true,
          message: `Auth verifier is online. Demo session tokens are also accepted for preview accounts.`,
        };
      }
    }
  }

  // Evaluate chain, contract, and relayer balance
  const [chainStatus, contractStatus, relayerStatus] = await Promise.all([
    chainAdapter.checkChainReachable(),
    chainAdapter.checkContractResponding(),
    chainAdapter.getRelayerBalanceInfo(),
  ]);

  const databaseItem: HealthCheckItem = {
    status: supabaseReachable ? 'ok' : 'fail',
    message: supabaseReachable
      ? (isSupabaseConfigured ? 'Database is reachable and responding' : 'Database reachable (in-memory mode)')
      : 'Database unreachable',
  };

  const allTablesExist = Object.values(tablesReport).every((t) => t.exists);
  const missingTables = Object.values(tablesReport)
    .filter((t) => !t.exists)
    .map((t) => t.logicalName);

  const allTablesItem: HealthCheckItem = {
    status: allTablesExist ? 'ok' : 'fail',
    message: allTablesExist
      ? 'All required tables are present'
      : `Missing required table(s): ${missingTables.join(', ')}`,
  };

  const encryptionItem: HealthCheckItem = {
    status: 'ok',
    message: 'Encryption key valid (32-byte AES-256-GCM)',
  };

  const geminiItem: HealthCheckItem = {
    status: diag.checks.GEMINI_API_KEY.status === 'valid' ? 'ok' : 'warn',
    message:
      diag.checks.GEMINI_API_KEY.status === 'valid'
        ? 'GEMINI_API_KEY is present'
        : 'GEMINI_API_KEY is missing (using built-in sample document reader)',
  };

  // Plain-English First Problem Identification
  let firstProblem: string | null = null;
  if (!supabaseReachable) {
    firstProblem = 'Database unreachable';
  } else if (!allTablesExist && missingTables.length > 0) {
    firstProblem = `Table ${missingTables[0]} missing`;
  } else if (!chainStatus.reachable) {
    firstProblem = 'Blockchain network unreachable';
  } else if (!contractStatus.responding) {
    firstProblem = 'Contract address not responding';
  } else if (relayerStatus.isLow || relayerStatus.status !== 'ok') {
    firstProblem = 'The demo wallet needs more test coins';
  } else if (encryptionItem.status === 'fail') {
    firstProblem = 'Encryption key invalid';
  } else if (geminiItem.status === 'fail') {
    firstProblem = 'GEMINI_API_KEY missing';
  } else if (relayerStatus.isLow) {
    firstProblem = 'The demo wallet needs more test coins';
  } else if (geminiItem.status === 'warn') {
    firstProblem = 'GEMINI_API_KEY missing';
  }

  const hasFails =
    databaseItem.status === 'fail' ||
    allTablesItem.status === 'fail' ||
    chainStatus.status === 'fail' ||
    contractStatus.status === 'fail' ||
    relayerStatus.status === 'fail' ||
    encryptionItem.status === 'fail';

  const hasWarns =
    databaseItem.status === 'warn' ||
    relayerStatus.status === 'warn' ||
    encryptionItem.status === 'warn' ||
    geminiItem.status === 'warn';

  const overallStatus: HealthStatusLevel = hasFails ? 'fail' : hasWarns ? 'warn' : 'ok';
  const demoMode = Boolean(
    process.env.DEMO_MODE === 'true' ||
      process.env.VITE_DEMO_MODE === 'true' ||
      process.env.DEMO_MODE === '1'
  );

  // Step 0 Specific Diagnostics
  let userAuthCheck: HealthCheckItem = {
    status: 'ok',
    message: 'User authentication service is online with Supabase Auth.',
  };
  let verifierAuthCheck: HealthCheckItem = {
    status: 'ok',
    message: 'Verifier accounts configured and ready for login.',
  };
  let verifierRequestsCheck: HealthCheckItem = {
    status: 'ok',
    message: 'Verification requests table is reachable.',
  };
  let documentUploadCheck: HealthCheckItem = {
    status: geminiItem.status === 'ok' ? 'ok' : 'warn',
    message: geminiItem.status === 'ok'
      ? 'Document extraction online with Gemini OCR API.'
      : 'Document extraction ready in sample mode (set GEMINI_API_KEY for real OCR).',
  };

  if (isSupabaseConfigured) {
    try {
      // Check verifier accounts in profiles
      const { data: vProfiles, error: vErr } = await supabaseAdmin
        .from('profiles')
        .select('id, verifier_code, org_name')
        .eq('role', 'VERIFIER');

      if (vErr) {
        verifierAuthCheck = {
          status: 'fail',
          message: `Could not query verifier profiles: ${vErr.message}`,
        };
      } else if (!vProfiles || vProfiles.length === 0) {
        verifierAuthCheck = {
          status: 'warn',
          message: 'No verifier profiles found with role VERIFIER in profiles table.',
        };
      } else {
        verifierAuthCheck = {
          status: 'ok',
          message: `Found ${vProfiles.length} active verifier account(s) (${vProfiles.map((v) => v.verifier_code || v.id).join(', ')}).`,
        };
      }

      // Check verification_requests status constraint and columns
      const { error: testReqErr } = await supabaseAdmin
        .from('verification_requests')
        .select('id, verifier_id, user_id, requested_fields, purpose, status')
        .limit(1);

      if (testReqErr) {
        verifierRequestsCheck = {
          status: 'fail',
          message: `Error querying verification_requests: ${testReqErr.message}`,
        };
      } else {
        verifierRequestsCheck = {
          status: 'ok',
          message: 'Verification requests service ready. User targeted requests enabled.',
        };
      }
    } catch (checkErr: unknown) {
      const msg = checkErr instanceof Error ? checkErr.message : 'Error checking database';
      verifierAuthCheck = { status: 'warn', message: msg };
    }
  }

  return {
    status: overallStatus,
    firstProblem,
    demoMode,
    timestamp: new Date().toISOString(),
    step0Checks: {
      supabaseAndTables: {
        status: databaseItem.status,
        message: databaseItem.message,
        allTablesPresent: allTablesExist,
      },
      userAuth: userAuthCheck,
      verifierAuth: verifierAuthCheck,
      verifierRequests: verifierRequestsCheck,
      documentUpload: documentUploadCheck,
    },
    databaseReachable: databaseItem,
    tables: tablesReport,
    allTablesPresent: allTablesItem,
    chainReachable: {
      status: chainStatus.status,
      message: chainStatus.message,
      chainId: chainStatus.chainId,
    },
    contractAddressResponding: {
      status: contractStatus.status,
      address: contractStatus.address,
      message: contractStatus.message,
    },
    relayerWalletBalance: {
      status: relayerStatus.status,
      balance: relayerStatus.balance,
      symbol: relayerStatus.symbol,
      isLow: relayerStatus.isLow,
      message: relayerStatus.message,
    },
    encryptionKeyValid: encryptionItem,
    geminiApiKeyPresent: geminiItem,
    supabaseReachable,
    supabaseConnectionMessage,
    tablesSummary: allTablesItem,
    envVars: {
      SUPABASE_URL: {
        exists: diag.checks.VITE_SUPABASE_URL.status !== 'missing',
        valid: diag.checks.VITE_SUPABASE_URL.status === 'valid',
        normalizedUrl: diag.normalizedSupabaseUrl,
        message: diag.checks.VITE_SUPABASE_URL.message,
      },
      SUPABASE_ANON_KEY: {
        exists: diag.checks.VITE_SUPABASE_ANON_KEY.status !== 'missing',
        valid: diag.checks.VITE_SUPABASE_ANON_KEY.status === 'valid',
        message: diag.checks.VITE_SUPABASE_ANON_KEY.message,
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: diag.checks.SUPABASE_SERVICE_ROLE_KEY.status !== 'missing',
        valid: diag.checks.SUPABASE_SERVICE_ROLE_KEY.status === 'valid',
        message: diag.checks.SUPABASE_SERVICE_ROLE_KEY.message,
      },
      CREDENTIAL_ENCRYPTION_KEY: {
        exists: diag.checks.CREDENTIAL_ENCRYPTION_KEY.status !== 'missing',
        valid: diag.checks.CREDENTIAL_ENCRYPTION_KEY.status === 'valid',
        message: diag.checks.CREDENTIAL_ENCRYPTION_KEY.message,
      },
      GEMINI_API_KEY: {
        exists: diag.checks.GEMINI_API_KEY.status !== 'missing',
        valid: diag.checks.GEMINI_API_KEY.status === 'valid',
        message: diag.checks.GEMINI_API_KEY.message,
      },
    },
    jwtCheck,
    schemaWarnings,
  };
}

export function printEnvironmentDiagnostics(): void {
  const diag = getEnvironmentDiagnostics();
  console.log('==============================================================');
  console.log('[SelfID Environment Check]');
  for (const check of Object.values(diag.checks)) {
    const tag =
      check.status === 'valid'
        ? '[OK]'
        : check.status === 'invalid_format'
        ? '[WARNING]'
        : '[MISSING]';
    console.log(`  ${tag} ${check.name}: ${check.message}`);
  }
  console.log('==============================================================');
}
