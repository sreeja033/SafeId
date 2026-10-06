import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { supabaseAdmin, isSupabaseConfigured, writeAuditLog } from './db';
import {
  generateEcdsaKeypair,
  encryptPayload,
  decryptPayload,
  computeSha256,
  signPresentationPayload,
  verifyPresentationSignature,
} from './crypto';
import { authenticateToken, requireRole } from './middleware';
import { chainAdapter } from './src/chain';
import { extractDocumentFields, ExtractionResult } from './services/extraction';
import { getHelperExplanation } from './services/helperService';
import {
  toBytes32,
  computeVerifierIdHash,
  computeFieldsHash,
  computeOnChainConsentId,
  SharedInfoPresentation,
  hashSharedInfoPresentation,
  verifySharedInfoSignature,
} from '../shared/digests';

export const apiRouter = Router();

// Apply JWT authentication to all API routes
apiRouter.use(authenticateToken);

// ==============================================================================
// Fresh In-Memory Store (Used when external Supabase env is not set)
// Starts completely empty — no fake or pre-seeded data.
// ==============================================================================
interface StoredDid {
  id: string;
  user_id: string;
  did: string;
  public_key: string;
  chain_tx_hash: string;
  created_at: string;
}

interface StoredCredential {
  id: string;
  user_id: string;
  type: string;
  issuer: string;
  encrypted_payload: string;
  iv: string;
  auth_tag: string;
  credential_hash: string;
  source_file_hash: string;
  storage_ref: string;
  chain_tx_hash: string;
  created_at: string;
}

interface StoredRequest {
  id: string;
  verifier_id: string;
  user_id: string | null;
  requested_fields: string[];
  purpose: string;
  status: 'PENDING' | 'GRANTED' | 'DENIED' | 'EXPIRED';
  created_at: string;
  verifier_name?: string;
  verifier_category?: string;
  verifier_did?: string;
  holder_did?: string;
}

interface StoredConsent {
  id: string;
  request_id: string | null;
  user_id: string;
  verifier_id: string;
  credential_id: string;
  shared_fields: string[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  expires_at: string | null;
  granted_at: string;
  revoked_at: string | null;
  grant_tx_hash: string;
  revoke_tx_hash: string | null;
  on_chain_consent_id?: string;
  verifier_name?: string;
  verifier_category?: string;
  verifier_did?: string;
}

interface StoredPresentation {
  id: string;
  consent_id: string;
  payload: Record<string, any>;
  signature: string;
  created_at: string;
}

interface PendingExtractionSession {
  fileId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceFileHash: string;
  extraction: ExtractionResult;
  createdAt: string;
  documentTitle?: string;
  issuedAt?: string;
  finalDetailsPlaintext?: string;
  credentialHash?: string;
  storageRef?: string;
}

const memoryDids: Record<string, StoredDid> = {};
const memoryCredentials: Record<string, StoredCredential> = {};
const memoryRequests: Record<string, StoredRequest> = {};
const memoryConsents: Record<string, StoredConsent> = {};
const memoryPresentations: Record<string, StoredPresentation> = {};
const pendingExtractions: Record<string, PendingExtractionSession> = {};

// Ephemeral fallback signing key only if user hasn't stored one in browser yet
const fallbackSignerWallet = ethers.Wallet.createRandom();

// Helper to format decrypted credential row for the owner's wallet UI
// Never returns the raw encrypted ciphertext blob as unlocked data.
function formatDecryptedCredential(row: StoredCredential) {
  const decryptedJson = JSON.parse(decryptPayload(row.encrypted_payload, row.iv, row.auth_tag));
  const sharedCount = Object.values(memoryConsents).filter(
    (c) => c.credential_id === row.id
  ).length;

  return {
    id: row.id,
    title: row.type || decryptedJson.title || 'College ID Document',
    category: decryptedJson.category || 'academic',
    subtitle: decryptedJson.subtitle || 'Sample document • Read from uploaded file',
    issuerName: row.issuer || decryptedJson.issuer || decryptedJson.institution || 'Document Reader',
    issuerDid: decryptedJson.issuerDid || 'did:selfid:sample-document-reader',
    schema: decryptedJson.schema || 'did:w3c:selfid.college.id.v1',
    issuedDate: new Date(row.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    issuedTime: new Date(row.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    expiryDate: decryptedJson.expiryDate || '4 Years',
    algorithm: 'AES-256-GCM / SHA-256',
    status: 'active' as const,
    attributes: decryptedJson.attributes || [],
    sha256Hash: row.credential_hash,
    sourceFileHash: row.source_file_hash || decryptedJson.sourceFileHash || '',
    isSample: true,
    isTestMode: Boolean(decryptedJson.isTestMode),
    chainTxHash: row.chain_tx_hash,
    storageRef: row.storage_ref,
    onChainState: {
      accumulatorRoot: row.credential_hash,
      ipfsCid: row.storage_ref || `enc://vault/${row.id}`,
      blockHeight: '#19,482,104',
      txHash: row.chain_tx_hash || '0x0',
      timestamp: new Date(row.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      network: decryptedJson.isTestMode
        ? 'Public Record (Test mode)'
        : 'Public Record (Fingerprint Only)',
    },
    clientEnclave: {
      cipherText: '[Locked with AES-256-GCM]',
      iv: row.iv,
      binding: 'Locked and saved on server vault (AES-256-GCM)',
    },
    jsonLd: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:uuid:${row.id}`,
      type: ['VerifiableCredential', 'SampleCollegeIdDocument'],
      sampleDocument: true,
      issuanceDate: row.created_at,
      documentFingerprint: row.credential_hash,
      sourceFileHash: row.source_file_hash || decryptedJson.sourceFileHash || '',
      publicRecordTx: row.chain_tx_hash,
    },
    presentationsCount: sharedCount,
  };
}

// ==============================================================================
// 0. CHAIN NONCE & CONFIG: GET /chain/nonce/:address
// ==============================================================================
apiRouter.get(
  '/chain/nonce/:address',
  requireRole('USER', 'VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const addressParam = String(req.params.address || '');
      const config = await chainAdapter.getChainConfigAndNonce(addressParam);
      res.json(config);
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to fetch chain nonce',
      });
    }
  }
);

// ==============================================================================
// 1. DID CREATION & PROFILE: GET /did & POST /did/create (USER ONLY)
// ==============================================================================
const createDidSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    userAddress: z.string().optional(),
    did: z.string().optional(),
    publicKey: z.string().optional(),
    signature: z.string().optional(),
  })
  .optional();

apiRouter.get(
  '/did',
  requireRole('USER', 'VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      if (isSupabaseConfigured) {
        const { data: didRow } = await supabaseAdmin
          .from('dids')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (didRow) {
          res.json({
            did: didRow.did,
            publicKey: didRow.public_key,
            chainTxHash: didRow.chain_tx_hash,
            createdAt: didRow.created_at,
            name: req.user!.profile?.full_name || 'Student User',
            email: req.user!.email || 'student@selfid.local',
          });
          return;
        }
      }

      const memDid = memoryDids[userId];
      if (!memDid) {
        res.json({
          did: '',
          publicKey: '',
          chainTxHash: '',
          createdAt: '',
          name: req.user!.profile?.full_name || 'Student User',
          email: req.user!.email || 'student@selfid.local',
        });
        return;
      }

      res.json({
        did: memDid.did,
        publicKey: memDid.public_key,
        chainTxHash: memDid.chain_tx_hash,
        createdAt: memDid.created_at,
        name: req.user!.profile?.full_name || 'Student User',
        email: req.user!.email || 'student@selfid.local',
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch DID' });
    }
  }
);

// ==============================================================================
// 1b. PROFILE UPDATE: PUT /profile (Both Roles)
// Strictly allows editing only full_name / org_name; role and verifier_code cannot be changed.
// ==============================================================================
apiRouter.put(
  '/profile',
  requireRole('USER', 'VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const { fullName, orgName } = req.body;

      const updates: Record<string, string> = {};
      if (fullName && typeof fullName === 'string' && fullName.trim()) {
        updates.full_name = fullName.trim();
      }
      if (role === 'VERIFIER' && orgName && typeof orgName === 'string' && orgName.trim()) {
        updates.org_name = orgName.trim();
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid profile updates provided.' });
        return;
      }

      if (isSupabaseConfigured) {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        res.json({ success: true, profile: data });
        return;
      }

      if (req.user!.profile) {
        if (updates.full_name) req.user!.profile.full_name = updates.full_name;
        if (updates.org_name) req.user!.profile.org_name = updates.org_name;
      }
      res.json({ success: true, profile: req.user!.profile });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update profile',
      });
    }
  }
);

apiRouter.post(
  '/did/create',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const body = createDidSchema.parse(req.body);

      // Browser generates keypair locally via ethers.Wallet.createRandom(), signs the registerDID digest,
      // and sends ONLY { userAddress, did, publicKey, signature } — server never sees privateKey!
      let did: string;
      let address: string;
      let publicKey: string;
      let privateKeyOnce: string | undefined;

      if (body?.publicKey && (body.userAddress || body.did)) {
        address = chainAdapter.extractAddressFromDid(body.userAddress || body.did!);
        did = body.did || `did:selfid:${address.toLowerCase()}`;
        publicKey = body.publicKey;
      } else {
        const keypair = generateEcdsaKeypair();
        did = keypair.did;
        address = keypair.address;
        publicKey = keypair.publicKey;
        privateKeyOnce = keypair.privateKey;
      }

      const chainReceipt = await chainAdapter.registerId(
        address,
        publicKey,
        body?.signature
      );

      if (isSupabaseConfigured) {
        const { error: dbErr } = await supabaseAdmin.from('dids').upsert(
          {
            user_id: userId,
            did,
            public_key: publicKey,
            chain_tx_hash: chainReceipt.txHash,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'did' }
        );

        if (dbErr) {
          res.status(500).json({ error: `Database error storing DID: ${dbErr.message}` });
          return;
        }
      } else {
        memoryDids[userId] = {
          id: 'did-' + Date.now(),
          user_id: userId,
          did,
          public_key: publicKey,
          chain_tx_hash: chainReceipt.txHash,
          created_at: new Date().toISOString(),
        };
      }

      await writeAuditLog(userId, 'CREATE_DID', {
        did,
        publicKey,
        txHash: chainReceipt.txHash,
      });

      res.json({
        success: true,
        did,
        address,
        publicKey,
        ...(privateKeyOnce ? { privateKey: privateKeyOnce } : {}),
        chainTxHash: chainReceipt.txHash,
        message: 'Digital ID registered on SelfID contract. Private key remains in your browser only.',
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to create DID';
      const cleanMsg =
        rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
          ? 'The demo wallet needs more test coins'
          : rawMsg;
      res.status(400).json({ error: cleanMsg });
    }
  }
);

// ==============================================================================
// 2. DOCUMENT EXTRACTION & CONFIRMATION FLOW (USER ONLY)
// Step 2: POST /documents/extract -> Reads details from uploaded file on server
// Step 4: POST /documents/confirm -> Creates document ONLY from server-extracted fields
// ==============================================================================
const extractDocumentRequestSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().min(1, 'File type is required'),
  fileSize: z.number().positive('File cannot be empty'),
  base64Data: z.string().min(1, 'File content is required'),
});

const handleExtractDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const parsed = extractDocumentRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Damaged file. We couldn't read the uploaded file. Please try again.",
      });
      return;
    }

    const { fileName, mimeType, fileSize, base64Data } = parsed.data;

    // Strip optional data URL prefix
    const cleanBase64 = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      res.status(400).json({
        error: "Damaged file. We couldn't open this file. Please try another file.",
      });
      return;
    }

    // Compute SHA-256 of the raw uploaded file bytes
    const sourceFileHash = computeSha256(fileBuffer);

    // Extract fields on the server using Gemini Vision (or clearly labelled Test mode fallback)
    const extraction = await extractDocumentFields({
      fileName,
      mimeType,
      fileSize: fileBuffer.length || fileSize,
      buffer: fileBuffer,
    });

    const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const issuedAt = new Date().toISOString();
    const documentTitle = `${extraction.institution || 'College'} — College ID`;
    const storageRef = `enc://vault/${userId}/${fileId}`;

    const attributes = [
      {
        key: 'fullName',
        label: 'Full Name',
        value: extraction.fullName,
        type: 'text',
        isZkEligible: false,
        encrypted: true,
      },
      {
        key: 'institution',
        label: 'College / Institution',
        value: extraction.institution,
        type: 'text',
        isZkEligible: true,
        encrypted: true,
      },
      {
        key: 'course',
        label: 'Course',
        value: extraction.course,
        type: 'text',
        isZkEligible: false,
        encrypted: true,
      },
      {
        key: 'academicYear',
        label: 'Academic Year',
        value: extraction.academicYear,
        type: 'text',
        isZkEligible: false,
        encrypted: true,
      },
      {
        key: 'studentId',
        label: 'Student ID',
        value: extraction.studentId,
        type: 'text',
        isProtected: true,
        isZkEligible: true,
        encrypted: true,
      },
      {
        key: 'studentStatus',
        label: 'Student Enrollment Status',
        value: extraction.studentStatus,
        type: 'text',
        isZkEligible: true,
        encrypted: true,
      },
      {
        key: 'dateOfBirth',
        label: 'Date of Birth',
        value: extraction.dateOfBirth,
        type: 'date',
        isProtected: true,
        isZkEligible: true,
        zkAssertion: 'Age >= 18 Confirmed',
        encrypted: true,
      },
    ];

    const finalDetailsPlaintext = JSON.stringify({
      title: documentTitle,
      category: 'academic',
      subtitle: 'Sample document • Read from uploaded file',
      isSample: true,
      sampleTag: 'Sample document',
      isTestMode: extraction.isTestMode,
      issuer: extraction.institution,
      issuerDid: 'did:selfid:sample-document-reader',
      schema: 'did:w3c:selfid.college.id.v1',
      sourceFileHash,
      sourceFileName: fileName,
      attributes,
      issuedAt,
    });

    const credentialHash = computeSha256(finalDetailsPlaintext);

    pendingExtractions[fileId] = {
      fileId,
      userId,
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      sourceFileHash,
      extraction,
      createdAt: issuedAt,
      documentTitle,
      issuedAt,
      finalDetailsPlaintext,
      credentialHash,
      storageRef,
    };

    await writeAuditLog(userId, 'READ_DOCUMENT_DETAILS', {
      fileId,
      fileName,
      sourceFileHash,
      credentialHash,
      looksLikeCollegeId: extraction.looksLikeCollegeId,
      missingFields: extraction.missingFields,
      isTestMode: extraction.isTestMode,
    });

    res.json({
      fileId,
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      sourceFileHash,
      credentialHash,
      storageRef,
      extraction: {
        fullName: extraction.fullName,
        institution: extraction.institution,
        course: extraction.course,
        academicYear: extraction.academicYear,
        studentId: extraction.studentId,
        studentStatus: extraction.studentStatus,
        dateOfBirth: extraction.dateOfBirth,
        missingFields: extraction.missingFields,
        looksLikeCollegeId: extraction.looksLikeCollegeId,
      },
      isTestMode: extraction.isTestMode,
      readerNote: extraction.readerNote,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Couldn't read details. Try a clearer document.";
    res.status(400).json({ error: message });
  }
};

apiRouter.post('/documents/extract', requireRole('USER'), handleExtractDocument);
apiRouter.post('/credentials/extract', requireRole('USER'), handleExtractDocument);

const confirmDocumentRequestSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  confirm: z.literal(true),
  userAddress: z.string().optional(),
  signature: z.string().optional(),
});

const handleConfirmDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Strictly validate only fileId, confirm: true, and optional user signature; ignore any browser-supplied field values
    const parsed = confirmDocumentRequestSchema.safeParse({
      fileId: req.body?.fileId,
      confirm: req.body?.confirm,
      userAddress: req.body?.userAddress,
      signature: req.body?.signature,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: 'Saving failed. Please upload and review your document first.',
      });
      return;
    }

    const session = pendingExtractions[parsed.data.fileId];
    if (!session || session.userId !== userId) {
      res.status(404).json({
        error: 'Saving failed. Your upload session expired. Please upload the document again.',
      });
      return;
    }

    const ext = session.extraction;
    if (!ext.looksLikeCollegeId || ext.missingFields.length > 0) {
      res.status(400).json({
        error: "Missing details. We couldn't read all the details. Try a clearer document.",
      });
      return;
    }

    const documentTitle = session.documentTitle || `${ext.institution} — College ID`;
    const issuedAt = session.issuedAt || new Date().toISOString();
    const storageRef = session.storageRef || `enc://vault/${userId}/${Date.now()}`;
    const finalDetailsPlaintext =
      session.finalDetailsPlaintext ||
      JSON.stringify({
        title: documentTitle,
        category: 'academic',
        subtitle: 'Sample document • Read from uploaded file',
        isSample: true,
        sampleTag: 'Sample document',
        isTestMode: ext.isTestMode,
        issuer: ext.institution,
        issuerDid: 'did:selfid:sample-document-reader',
        schema: 'did:w3c:selfid.college.id.v1',
        sourceFileHash: session.sourceFileHash,
        sourceFileName: session.fileName,
        issuedAt,
      });

    // 1. Lock with AES-256-GCM using key from env
    const { ciphertext, iv, authTag } = encryptPayload(finalDetailsPlaintext);

    // 2. Compute SHA-256 fingerprint of the final details
    const credentialHash = session.credentialHash || computeSha256(finalDetailsPlaintext);

    // Resolve user's DID/address for on-chain anchorCredential
    let userDidOrAddress = parsed.data.userAddress || memoryDids[userId]?.did || '';
    if (!userDidOrAddress && isSupabaseConfigured) {
      const { data: didRow } = await supabaseAdmin
        .from('dids')
        .select('did')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (didRow?.did) userDidOrAddress = didRow.did;
    }

    // 3. Save ONLY the fingerprint on the public record (relayer submits tx with user's signature)
    const chainReceipt = await chainAdapter.saveFingerprint(
      credentialHash,
      userDidOrAddress || `did:selfid:${userId}`,
      storageRef,
      parsed.data.signature
    );

    const credentialId = `doc-${Date.now()}`;

    // Consume the one-time extraction session
    delete pendingExtractions[parsed.data.fileId];

    if (isSupabaseConfigured) {
      const storageRefWithMeta = `${storageRef}|source_file_hash:${session.sourceFileHash}`;

      let { data: dbData, error: dbErr } = await supabaseAdmin
        .from('credentials')
        .insert({
          user_id: userId,
          type: documentTitle,
          issuer: ext.institution,
          encrypted_payload: ciphertext,
          iv,
          auth_tag: authTag,
          credential_hash: credentialHash,
          source_file_hash: session.sourceFileHash,
          storage_ref: storageRefWithMeta,
          chain_tx_hash: chainReceipt.txHash,
          created_at: issuedAt,
        })
        .select()
        .single();

      // If source_file_hash column hasn't been added yet via SQL migration, retry without that column
      if (dbErr && dbErr.message.includes('source_file_hash')) {
        console.warn(
          '[SelfID Supabase Notice] credentials.source_file_hash column not migrated yet; storing source_file_hash in storage_ref and encrypted payload:',
          dbErr.message
        );
        const retryRes = await supabaseAdmin
          .from('credentials')
          .insert({
            user_id: userId,
            type: documentTitle,
            issuer: ext.institution,
            encrypted_payload: ciphertext,
            iv,
            auth_tag: authTag,
            credential_hash: credentialHash,
            storage_ref: storageRefWithMeta,
            chain_tx_hash: chainReceipt.txHash,
            created_at: issuedAt,
          })
          .select()
          .single();
        dbData = retryRes.data;
        dbErr = retryRes.error;
      }

      if (dbErr || !dbData) {
        console.error('[SelfID Supabase Error] Failed to insert into credentials:', dbErr?.message);
        res.status(500).json({ error: `Saving failed: ${dbErr?.message || 'Unknown database error'}` });
        return;
      }

      await writeAuditLog(userId, 'CREATE_DOCUMENT', {
        credentialId: dbData.id,
        credentialHash,
        sourceFileHash: session.sourceFileHash,
        txHash: chainReceipt.txHash,
        sampleDocument: true,
      });

      res.json(formatDecryptedCredential(dbData as StoredCredential));
      return;
    }

    const stored: StoredCredential = {
      id: credentialId,
      user_id: userId,
      type: documentTitle,
      issuer: ext.institution,
      encrypted_payload: ciphertext,
      iv,
      auth_tag: authTag,
      credential_hash: credentialHash,
      source_file_hash: session.sourceFileHash,
      storage_ref: storageRef,
      chain_tx_hash: chainReceipt.txHash,
      created_at: issuedAt,
    };

    memoryCredentials[credentialId] = stored;

    await writeAuditLog(userId, 'CREATE_DOCUMENT', {
      credentialId,
      credentialHash,
      sourceFileHash: session.sourceFileHash,
      txHash: chainReceipt.txHash,
      sampleDocument: true,
    });

    res.json(formatDecryptedCredential(stored));
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : 'Saving failed. Please try again.';
    const cleanMsg =
      rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
        ? 'The demo wallet needs more test coins'
        : rawMsg;
    res.status(500).json({
      error: cleanMsg,
    });
  }
};

apiRouter.post('/documents/confirm', requireRole('USER'), handleConfirmDocument);
apiRouter.post('/credentials/issue', requireRole('USER'), handleConfirmDocument);

// ==============================================================================
// 3. GET /credentials & DELETE /credentials/:id (Owner Only)
// ==============================================================================
apiRouter.get(
  '/credentials',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      if (isSupabaseConfigured) {
        const { data, error } = await supabaseAdmin
          .from('credentials')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        const decryptedList = (data || [])
          .filter((row) => row.user_id === userId)
          .map((row) => formatDecryptedCredential(row as StoredCredential));

        res.json(decryptedList);
        return;
      }

      const userCreds = Object.values(memoryCredentials)
        .filter((c) => c.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((c) => formatDecryptedCredential(c));

      res.json(userCreds);
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to retrieve documents',
      });
    }
  }
);

// ==============================================================================
// 4. GET /credentials/:id (Owner Decryption Only)
// ==============================================================================
const credentialIdParamSchema = z.object({
  id: z.string().min(1, 'Document ID is required'),
});

apiRouter.get(
  '/credentials/:id',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id: credId } = credentialIdParamSchema.parse(req.params);

      if (isSupabaseConfigured) {
        const { data, error } = await supabaseAdmin
          .from('credentials')
          .select('*')
          .eq('id', credId)
          .maybeSingle();

        if (error || !data) {
          res.status(404).json({ error: 'Document not found' });
          return;
        }

        if (data.user_id !== userId) {
          res.status(403).json({
            error: 'Forbidden: Only the document owner can decrypt and view this document.',
          });
          return;
        }

        res.json(formatDecryptedCredential(data as StoredCredential));
        return;
      }

      const cred = memoryCredentials[credId];
      if (!cred) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      if (cred.user_id !== userId) {
        res.status(403).json({
          error: 'Forbidden: Only the document owner can decrypt and view this document.',
        });
        return;
      }

      res.json(formatDecryptedCredential(cred));
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to fetch document',
      });
    }
  }
);

apiRouter.delete(
  '/credentials/:id',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id: credId } = credentialIdParamSchema.parse(req.params);

      if (isSupabaseConfigured) {
        await supabaseAdmin
          .from('credentials')
          .delete()
          .eq('id', credId)
          .eq('user_id', userId);
      } else if (memoryCredentials[credId]?.user_id === userId) {
        delete memoryCredentials[credId];
      }

      res.json({ success: true });
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to delete document',
      });
    }
  }
);

// ==============================================================================
// 4b. POST /users/lookup (Verifier Only: Find User by Email or Digital ID)
// ==============================================================================
apiRouter.post(
  '/users/lookup',
  requireRole('VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = String(req.body?.query || '').trim();
      if (!query) {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      if (isSupabaseConfigured) {
        // 1. If query contains @, lookup by email in auth.users
        if (query.includes('@')) {
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const target = usersList?.users?.find(
            (u) => u.email?.toLowerCase() === query.toLowerCase()
          );

          if (!target) {
            res.status(404).json({ error: "We couldn't find that user." });
            return;
          }

          const { data: didRow } = await supabaseAdmin
            .from('dids')
            .select('did')
            .eq('user_id', target.id)
            .maybeSingle();

          res.json({
            userId: target.id,
            did: didRow?.did || null,
          });
          return;
        }

        // 2. Lookup by Digital ID in public.dids
        const { data: didRow } = await supabaseAdmin
          .from('dids')
          .select('user_id, did')
          .ilike('did', query)
          .maybeSingle();

        if (didRow) {
          res.json({
            userId: didRow.user_id,
            did: didRow.did,
          });
          return;
        }

        res.status(404).json({ error: "We couldn't find that user." });
        return;
      }

      // In-Memory search
      const foundDid = Object.values(memoryDids).find(
        (d) =>
          d.did.toLowerCase() === query.toLowerCase() ||
          d.did.toLowerCase().includes(query.toLowerCase())
      );
      if (foundDid) {
        res.json({ userId: foundDid.user_id, did: foundDid.did });
        return;
      }

      res.status(404).json({ error: "We couldn't find that user." });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'User search error',
      });
    }
  }
);

// ==============================================================================
// 5. POST /requests (Verifier Only: Create Verification Request)
// ==============================================================================
const createRequestSchema = z.object({
  targetQuery: z.string().optional(),
  holderDid: z.string().optional(),
  userId: z.string().optional(),
  requestedFields: z.array(z.string()).min(1, 'At least one requested field is required'),
  purpose: z.string().min(5, 'Purpose description is required'),
  validityWindow: z.string().optional(),
});

apiRouter.post(
  '/requests',
  requireRole('VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const verifierId = req.user!.id;
      const body = createRequestSchema.parse(req.body);

      const searchInput = (body.targetQuery || body.holderDid || '').trim();
      let targetUserId = body.userId || null;
      let targetHolderDid = body.holderDid || null;

      // Resolve user by Email or Digital ID
      if (!targetUserId && searchInput && isSupabaseConfigured) {
        if (searchInput.includes('@')) {
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const target = usersList?.users?.find(
            (u) => u.email?.toLowerCase() === searchInput.toLowerCase()
          );

          if (!target) {
            res.status(404).json({ error: "We couldn't find that user." });
            return;
          }

          targetUserId = target.id;
          const { data: didRow } = await supabaseAdmin
            .from('dids')
            .select('did')
            .eq('user_id', target.id)
            .maybeSingle();

          if (didRow) {
            targetHolderDid = didRow.did;
          }
        } else {
          // Lookup by DID in public.dids
          const { data: didRow } = await supabaseAdmin
            .from('dids')
            .select('user_id, did')
            .ilike('did', searchInput)
            .maybeSingle();

          if (!didRow) {
            res.status(404).json({ error: "We couldn't find that user." });
            return;
          }

          targetUserId = didRow.user_id;
          targetHolderDid = didRow.did;
        }
      }

      // If still no user found and an explicit search query was given
      if (!targetUserId && searchInput && !isSupabaseConfigured) {
        const foundDid = Object.values(memoryDids).find(
          (d) =>
            d.did.toLowerCase() === searchInput.toLowerCase() ||
            d.did.toLowerCase().includes(searchInput.toLowerCase())
        );
        if (foundDid) {
          targetUserId = foundDid.user_id;
          targetHolderDid = foundDid.did;
        } else if (searchInput.includes('@')) {
          // In memory fallback for test user
          targetUserId = 'demo-local-user';
          targetHolderDid = 'did:selfid:student';
        } else {
          res.status(404).json({ error: "We couldn't find that user." });
          return;
        }
      }

      if (isSupabaseConfigured) {
        // Calculate expires_at (e.g. 24 hours from now)
        const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

        // Attempt insert with WAITING status; fall back to PENDING if database check constraint is not yet updated
        let insertPayload: Record<string, any> = {
          verifier_id: verifierId,
          user_id: targetUserId,
          requested_fields: body.requestedFields,
          purpose: body.purpose,
          status: 'WAITING',
          created_at: new Date().toISOString(),
        };

        let { data: reqData, error: reqErr } = await supabaseAdmin
          .from('verification_requests')
          .insert(insertPayload)
          .select()
          .single();

        if (reqErr && reqErr.message.includes('verification_requests_status_check')) {
          // Fall back to PENDING for backward compatibility with database schema constraint
          insertPayload.status = 'PENDING';
          const retry = await supabaseAdmin
            .from('verification_requests')
            .insert(insertPayload)
            .select()
            .single();
          reqData = retry.data;
          reqErr = retry.error;
        }

        if (reqErr) {
          res.status(500).json({ error: reqErr.message });
          return;
        }

        await writeAuditLog(verifierId, 'CREATE_VERIFICATION_REQUEST', {
          requestId: reqData.id,
          targetUserId,
          holderDid: targetHolderDid,
          requestedFields: body.requestedFields,
        });

        res.json({
          ...reqData,
          status: 'WAITING',
          holderDid: targetHolderDid,
          expiresIn: body.validityWindow || '24 Hours',
        });
        return;
      }

      const requestId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
      const newReq: StoredRequest = {
        id: requestId,
        verifier_id: verifierId,
        user_id: targetUserId,
        requested_fields: body.requestedFields,
        purpose: body.purpose,
        status: 'WAITING' as any,
        created_at: new Date().toISOString(),
        verifier_name: req.user!.profile?.org_name || 'CMRIT Verification Portal',
        verifier_category: 'Academic & Higher Ed',
        verifier_did: `did:selfid:${(req.user!.profile?.verifier_code || 'ver-001').toLowerCase()}`,
        holder_did: targetHolderDid || 'did:selfid:student',
      };
      memoryRequests[requestId] = newReq;

      await writeAuditLog(verifierId, 'CREATE_VERIFICATION_REQUEST', {
        requestId,
        targetUserId: newReq.user_id,
        holderDid: newReq.holder_did,
        requestedFields: body.requestedFields,
      });

      res.json(newReq);
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid verification request payload',
      });
    }
  }
);

// ==============================================================================
// 6. GET /requests (User: Incoming Requests; Verifier: Sent Requests)
// ==============================================================================
const listRequestsQuerySchema = z.object({
  status: z.string().optional(),
});

apiRouter.get(
  '/requests',
  requireRole('USER', 'VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      listRequestsQuerySchema.parse(req.query);
      const userRole = req.user!.role;
      const userId = req.user!.id;

      if (isSupabaseConfigured) {
        let query = supabaseAdmin
          .from('verification_requests')
          .select(`
            id,
            verifier_id,
            user_id,
            requested_fields,
            purpose,
            status,
            created_at,
            verifier:profiles!verifier_id(full_name, org_name, verifier_code)
          `);

        if (userRole === 'USER') {
          query = query.or(`user_id.eq.${userId},user_id.is.null`);
        } else {
          query = query.eq('verifier_id', userId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        const mapped = (data || []).map((row: any) => ({
          id: row.id,
          verifierName:
            row.verifier?.org_name || row.verifier?.full_name || 'CMRIT Verification Portal',
          verifierCategory: 'Official Verifier',
          verifierDid: `did:selfid:${(row.verifier?.verifier_code || 'VER-001').toLowerCase()}`,
          verifierScore: 'Verified Organization',
          purpose: row.purpose,
          legalBasis: 'Explicit user permission',
          status:
            row.status === 'GRANTED'
              ? 'approved'
              : row.status === 'DENIED'
              ? 'denied'
              : 'pending',
          claims: (row.requested_fields || []).map((field: string) => ({
            key: field.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            label: field,
            schema: 'w3c.schema.v1',
            required: false,
            zkEligible:
              field.toLowerCase().includes('age') ||
              field.toLowerCase().includes('birth') ||
              field.toLowerCase().includes('status'),
          })),
          requestedAt: new Date(row.created_at).toLocaleString(),
          expiresIn: '24 Hours',
          retentionPolicy: 'Ephemeral Presentation (0-day retention).',
          ephemeralHash: computeSha256(row.id + row.purpose),
          proverProtocol: 'ECDSA Signature + SHA-256 Fingerprint',
          allowedValidityWindows: ['1 Hour', '1 Day (Rec.)', '7 Days', 'Single Use'],
        }));

        res.json(mapped);
        return;
      }

      const all = Object.values(memoryRequests).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const filtered =
        userRole === 'USER'
          ? all.filter((r) => !r.user_id || r.user_id === userId)
          : all;

      res.json(
        filtered.map((r) => {
          const matchingConsent = Object.values(memoryConsents).find(
            (c) => c.request_id === r.id
          );
          const effectiveStatus =
            matchingConsent?.status === 'REVOKED'
              ? 'revoked'
              : r.status === 'GRANTED'
              ? 'approved'
              : r.status === 'DENIED'
              ? 'denied'
              : 'pending';

          return {
            id: r.id,
            verifierName: r.verifier_name || 'CMRIT Verification Portal',
            verifierCategory: r.verifier_category || 'Academic & Higher Ed',
            verifierDid: r.verifier_did || 'did:selfid:ver-001',
            holderDid: r.holder_did || 'did:selfid:student',
            verifierScore: 'Verified Organization',
            purpose: r.purpose,
            legalBasis: 'Explicit user permission',
            status: effectiveStatus,
            claims: r.requested_fields.map((f: string) => ({
              key: f.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              label: f,
              schema: 'w3c.schema.v1',
              required: false,
              zkEligible:
                f.toLowerCase().includes('age') ||
                f.toLowerCase().includes('birth') ||
                f.toLowerCase().includes('status'),
            })),
            requestedAt: new Date(r.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            expiresIn: '24 Hours',
            retentionPolicy: 'Ephemeral Presentation (0-day retention).',
            ephemeralHash: computeSha256(r.id + r.purpose),
            proverProtocol: 'ECDSA Signature + SHA-256 Fingerprint',
            allowedValidityWindows: ['1 Hour', '1 Day (Rec.)', '7 Days', 'Single Use'],
          };
        })
      );
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to fetch verification requests',
      });
    }
  }
);

// Helper to match selected fields against the decrypted document attributes
function buildSharedClaimsFromDocument(
  selectedFields: string[],
  allAttributes: Array<{ key: string; label: string; value: string }>
): Array<{ key: string; label: string; value: string }> {
  const result: Array<{ key: string; label: string; value: string }> = [];

  const findAttr = (...candidates: string[]) => {
    for (const c of candidates) {
      const found = allAttributes.find(
        (a) =>
          a.key.toLowerCase() === c.toLowerCase() ||
          a.label.toLowerCase() === c.toLowerCase() ||
          a.label.toLowerCase().includes(c.toLowerCase()) ||
          c.toLowerCase().includes(a.key.toLowerCase())
      );
      if (found) return found;
    }
    return undefined;
  };

  for (const field of selectedFields) {
    const lower = field.toLowerCase();

    if (lower.includes('age') && (lower.includes('private') || lower.includes('>='))) {
      const dobAttr = findAttr('dateOfBirth', 'Date of Birth');
      let agePass = 'Confirmed (Age >= 18)';
      if (dobAttr?.value) {
        const yearMatch = dobAttr.value.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          const birthYear = parseInt(yearMatch[0], 10);
          const age = new Date().getFullYear() - birthYear;
          agePass = age >= 18 ? `PASS (Age >= 18 Confirmed)` : `Under 18`;
        }
      }
      result.push({
        key: 'ageZk',
        label: field,
        value: agePass,
      });
      continue;
    }

    if (lower.includes('college') || lower.includes('institution')) {
      const attr = findAttr('institution', 'college', 'College / Institution');
      result.push({
        key: 'institution',
        label: 'College / Institution',
        value: attr?.value || 'Not found in document',
      });
      continue;
    }

    if (lower.includes('status') || lower.includes('enrollment')) {
      const attr = findAttr('studentStatus', 'status', 'Student Enrollment Status');
      result.push({
        key: 'studentStatus',
        label: 'Student Enrollment Status',
        value: attr?.value || 'Not found in document',
      });
      continue;
    }

    if (lower.includes('name')) {
      const attr = findAttr('fullName', 'Full Name', 'Full Legal Name');
      result.push({
        key: 'fullName',
        label: 'Full Name',
        value: attr?.value || 'Not found in document',
      });
      continue;
    }

    if (lower.includes('course') || lower.includes('major')) {
      const attr = findAttr('course', 'major', 'Course');
      result.push({
        key: 'course',
        label: 'Course',
        value: attr?.value || 'Not found in document',
      });
      continue;
    }

    if (lower.includes('year')) {
      const attr = findAttr('academicYear', 'Academic Year');
      result.push({
        key: 'academicYear',
        label: 'Academic Year',
        value: attr?.value || 'Not found in document',
      });
      continue;
    }

    if (lower.includes('student id') || lower.includes('studentid')) {
      const attr = findAttr('studentId', 'Student ID');
      result.push({
        key: 'studentId',
        label: 'Student ID',
        value: attr?.value || 'Not found in document',
      });
      continue;
    }

    if (lower.includes('birth') || lower.includes('dob')) {
      const attr = findAttr('dateOfBirth', 'Date of Birth');
      result.push({
        key: 'dateOfBirth',
        label: 'Date of Birth',
        value: attr?.value || 'Not found in document',
      });
      continue;
    }

    const generic = findAttr(field);
    if (generic) {
      result.push({
        key: generic.key,
        label: generic.label,
        value: generic.value,
      });
    }
  }

  return result;
}

// ==============================================================================
// 7. POST /requests/:id/grant (User Only: Selective Disclosure & Signed Presentation)
// ==============================================================================
const grantRequestSchema = z.object({
  credentialId: z.string().optional(),
  selectedFields: z.array(z.string()).min(1, 'Select at least one field to disclose'),
  validityDurationHours: z.number().positive().optional().default(168),
  userAddress: z.string().optional(),
  publicKey: z.string().optional(),
  grantSignature: z.string().optional(),
  expiresAtUnix: z.number().optional(),
  sharedInfo: z
    .object({
      requestId: z.string(),
      verifierId: z.string(),
      documentFingerprint: z.string(),
      issuedAt: z.string(),
      expiresAt: z.string(),
      chosenFields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          value: z.string(),
        })
      ),
    })
    .optional(),
  sharedInfoSignature: z.string().optional(),
  // Legacy fallback fields
  clientPrivateKey: z.string().optional(),
  clientSignature: z.string().optional(),
});

apiRouter.post(
  '/requests/:id/grant',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const requestId = z.string().min(1).parse(req.params.id);
      const body = grantRequestSchema.parse(req.body);

      // Resolve user's DID & public key without requiring the private key on the server
      let signerAddress = '';
      let signerDid = '';
      let signerPublicKey = '';

      if (body.userAddress) {
        signerAddress = chainAdapter.extractAddressFromDid(body.userAddress);
        signerDid = `did:selfid:${signerAddress.toLowerCase()}`;
        signerPublicKey = body.publicKey || '';
      } else if (body.clientPrivateKey && body.clientPrivateKey.startsWith('0x')) {
        const wallet = new ethers.Wallet(body.clientPrivateKey);
        signerAddress = wallet.address;
        signerDid = `did:selfid:${wallet.address.toLowerCase()}`;
        signerPublicKey = wallet.signingKey.publicKey;
      } else if (memoryDids[userId]?.did) {
        signerDid = memoryDids[userId].did;
        signerAddress = chainAdapter.extractAddressFromDid(signerDid);
        signerPublicKey = memoryDids[userId].public_key;
      } else {
        signerAddress = fallbackSignerWallet.address;
        signerDid = `did:selfid:${fallbackSignerWallet.address.toLowerCase()}`;
        signerPublicKey = fallbackSignerWallet.signingKey.publicKey;
      }

      const expiresAtUnix =
        body.expiresAtUnix ||
        Math.floor(Date.now() / 1000) + Math.floor(body.validityDurationHours * 3600);
      const expiresAtIso =
        body.sharedInfo?.expiresAt || new Date(expiresAtUnix * 1000).toISOString();
      const issuedAtIso = body.sharedInfo?.issuedAt || new Date().toISOString();
      const fieldsHash = computeFieldsHash(body.selectedFields);

      if (isSupabaseConfigured) {
        if (signerPublicKey) {
          await supabaseAdmin.from('dids').upsert(
            {
              user_id: userId,
              did: signerDid,
              public_key: signerPublicKey,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'did' }
          );
        } else {
          const { data: existingDid } = await supabaseAdmin
            .from('dids')
            .select('did, public_key')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existingDid) {
            signerDid = existingDid.did;
            signerAddress = chainAdapter.extractAddressFromDid(existingDid.did);
            signerPublicKey = existingDid.public_key;
          }
        }

        const { data: requestRow, error: reqErr } = await supabaseAdmin
          .from('verification_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (reqErr || !requestRow) {
          res.status(404).json({ error: 'Verification request not found' });
          return;
        }

        const verifierId = requestRow.verifier_id;
        let credentialId = body.credentialId;

        if (!credentialId) {
          const { data: firstCred } = await supabaseAdmin
            .from('credentials')
            .select('id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (firstCred) credentialId = firstCred.id;
        }

        if (!credentialId) {
          res.status(400).json({
            error: 'No saved document found. Please add a document in your wallet first.',
          });
          return;
        }

        const { data: credRow, error: credErr } = await supabaseAdmin
          .from('credentials')
          .select('*')
          .eq('id', credentialId)
          .eq('user_id', userId)
          .single();

        if (credErr || !credRow) {
          res.status(404).json({ error: 'Document not found or not owned by user' });
          return;
        }

        const decryptedCred = JSON.parse(
          decryptPayload(credRow.encrypted_payload, credRow.iv, credRow.auth_tag)
        );
        const allAttributes: Array<{ key: string; label: string; value: string }> =
          decryptedCred.attributes || [];

        const sharedClaims =
          body.sharedInfo?.chosenFields && body.sharedInfo.chosenFields.length > 0
            ? body.sharedInfo.chosenFields
            : buildSharedClaimsFromDocument(body.selectedFields, allAttributes);

        const verifierCode = body.sharedInfo?.verifierId || 'VER-001';
        const sharedInfoObj: SharedInfoPresentation = body.sharedInfo || {
          requestId,
          verifierId: verifierCode,
          documentFingerprint: credRow.credential_hash,
          issuedAt: issuedAtIso,
          expiresAt: expiresAtIso,
          chosenFields: sharedClaims,
        };

        const presentationPayload = {
          requestId,
          verifierId: verifierCode,
          holderDid: signerDid,
          disclosedFields: body.selectedFields,
          sharedClaims,
          sharedInfo: sharedInfoObj,
          fieldsHash,
          issuer: credRow.issuer,
          credentialHash: credRow.credential_hash,
          documentFingerprint: credRow.credential_hash,
          sourceFileHash: credRow.source_file_hash || decryptedCred.sourceFileHash || '',
          sampleDocument: true,
          issuedAt: issuedAtIso,
          expiresAt: expiresAtIso,
          timestamp: issuedAtIso,
        };

        const signature =
          body.sharedInfoSignature ||
          body.clientSignature ||
          (await signPresentationPayload(
            presentationPayload,
            body.clientPrivateKey && body.clientPrivateKey.startsWith('0x')
              ? body.clientPrivateKey
              : fallbackSignerWallet.privateKey
          ));

        const { data: consentRow, error: consentErr } = await supabaseAdmin
          .from('consents')
          .insert({
            request_id: requestId,
            user_id: userId,
            verifier_id: verifierId,
            credential_id: credentialId,
            shared_fields: body.selectedFields,
            status: 'ACTIVE',
            expires_at: expiresAtIso,
          })
          .select()
          .single();

        if (consentErr) {
          res.status(500).json({ error: consentErr.message });
          return;
        }

        const chainReceipt = await chainAdapter.allowAccess({
          user: signerAddress,
          verifierId: verifierCode,
          credentialHash: credRow.credential_hash,
          fieldsHash,
          expiresAt: expiresAtUnix,
          sig: body.grantSignature,
          legacyConsentId: consentRow.id,
        });

        await supabaseAdmin
          .from('consents')
          .update({ grant_tx_hash: chainReceipt.txHash })
          .eq('id', consentRow.id);

        const { data: presRow, error: presErr } = await supabaseAdmin
          .from('presentations')
          .insert({
            consent_id: consentRow.id,
            payload: {
              ...presentationPayload,
              onChainConsentId: chainReceipt.consentId,
            },
            signature,
          })
          .select()
          .single();

        if (presErr) {
          res.status(500).json({ error: presErr.message });
          return;
        }

        await supabaseAdmin
          .from('verification_requests')
          .update({ status: 'GRANTED' })
          .eq('id', requestId);

        await writeAuditLog(userId, 'GRANT_CONSENT', {
          requestId,
          consentId: consentRow.id,
          onChainConsentId: chainReceipt.consentId,
          presentationId: presRow.id,
          txHash: chainReceipt.txHash,
          sharedFields: body.selectedFields,
        });

        res.json({
          success: true,
          consentId: consentRow.id,
          onChainConsentId: chainReceipt.consentId,
          presentationId: presRow.id,
          txHash: chainReceipt.txHash,
          signature,
          expiresAt: expiresAtIso,
        });
        return;
      }

      // In-Memory Execution
      if (signerPublicKey || !memoryDids[userId]) {
        memoryDids[userId] = {
          id: memoryDids[userId]?.id || `did-${Date.now()}`,
          user_id: userId,
          did: signerDid,
          public_key: signerPublicKey || memoryDids[userId]?.public_key || '',
          chain_tx_hash: memoryDids[userId]?.chain_tx_hash || '0x0',
          created_at: new Date().toISOString(),
        };
      }

      const targetRequest = memoryRequests[requestId];
      const verifierId = targetRequest?.verifier_id || 'verifier-local';
      const verifierCode = body.sharedInfo?.verifierId || 'VER-001';

      const userCredList = Object.values(memoryCredentials)
        .filter((c) => c.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const credRow =
        (body.credentialId && memoryCredentials[body.credentialId]) || userCredList[0];

      if (!credRow) {
        res.status(400).json({
          error: 'No saved document found. Please upload and save a document first.',
        });
        return;
      }

      const decryptedCred = JSON.parse(
        decryptPayload(credRow.encrypted_payload, credRow.iv, credRow.auth_tag)
      );
      const allAttributes: Array<{ key: string; label: string; value: string }> =
        decryptedCred.attributes || [];

      const sharedClaims =
        body.sharedInfo?.chosenFields && body.sharedInfo.chosenFields.length > 0
          ? body.sharedInfo.chosenFields
          : buildSharedClaimsFromDocument(body.selectedFields, allAttributes);

      const sharedInfoObj: SharedInfoPresentation = body.sharedInfo || {
        requestId,
        verifierId: verifierCode,
        documentFingerprint: credRow.credential_hash,
        issuedAt: issuedAtIso,
        expiresAt: expiresAtIso,
        chosenFields: sharedClaims,
      };

      const consentId = `consent-${Date.now()}`;
      const presentationId = `pres-${Date.now()}`;

      const chainReceipt = await chainAdapter.allowAccess({
        user: signerAddress,
        verifierId: verifierCode,
        credentialHash: credRow.credential_hash,
        fieldsHash,
        expiresAt: expiresAtUnix,
        sig: body.grantSignature,
        legacyConsentId: consentId,
      });

      const presentationPayload = {
        requestId,
        verifierId: verifierCode,
        holderDid: signerDid,
        disclosedFields: body.selectedFields,
        sharedClaims,
        sharedInfo: sharedInfoObj,
        fieldsHash,
        onChainConsentId: chainReceipt.consentId,
        issuer: credRow.issuer,
        credentialHash: credRow.credential_hash,
        documentFingerprint: credRow.credential_hash,
        sourceFileHash: credRow.source_file_hash || decryptedCred.sourceFileHash || '',
        sampleDocument: true,
        issuedAt: issuedAtIso,
        expiresAt: expiresAtIso,
        timestamp: issuedAtIso,
      };

      const signature =
        body.sharedInfoSignature ||
        body.clientSignature ||
        (await signPresentationPayload(
          presentationPayload,
          body.clientPrivateKey && body.clientPrivateKey.startsWith('0x')
            ? body.clientPrivateKey
            : fallbackSignerWallet.privateKey
        ));

      if (targetRequest) {
        targetRequest.status = 'GRANTED';
        targetRequest.holder_did = signerDid;
      }

      memoryConsents[consentId] = {
        id: consentId,
        request_id: requestId,
        user_id: userId,
        verifier_id: verifierId,
        credential_id: credRow.id,
        shared_fields: body.selectedFields,
        status: 'ACTIVE',
        expires_at: expiresAtIso,
        granted_at: issuedAtIso,
        revoked_at: null,
        grant_tx_hash: chainReceipt.txHash,
        revoke_tx_hash: null,
        on_chain_consent_id: chainReceipt.consentId,
        verifier_name: targetRequest?.verifier_name || 'CMRIT Verification Portal',
        verifier_category: targetRequest?.verifier_category || 'Academic & Higher Ed',
        verifier_did: targetRequest?.verifier_did || 'did:selfid:ver-001',
      };

      memoryPresentations[presentationId] = {
        id: presentationId,
        consent_id: consentId,
        payload: presentationPayload,
        signature,
        created_at: issuedAtIso,
      };

      await writeAuditLog(userId, 'GRANT_CONSENT', {
        requestId,
        consentId,
        onChainConsentId: chainReceipt.consentId,
        presentationId,
        txHash: chainReceipt.txHash,
        sharedFields: body.selectedFields,
      });

      res.json({
        success: true,
        consentId,
        onChainConsentId: chainReceipt.consentId,
        presentationId,
        txHash: chainReceipt.txHash,
        signature,
        expiresAt: expiresAtIso,
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to grant verification request';
      const cleanMsg =
        rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
          ? 'The demo wallet needs more test coins'
          : rawMsg;
      res.status(400).json({
        error: cleanMsg,
      });
    }
  }
);

// ==============================================================================
// 7b. POST /requests/:id/deny (User Only: Deny Verification Request)
// ==============================================================================
apiRouter.post(
  '/requests/:id/deny',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const requestId = z.string().min(1).parse(req.params.id);

      if (isSupabaseConfigured) {
        await supabaseAdmin
          .from('verification_requests')
          .update({ status: 'DENIED' })
          .eq('id', requestId);
      } else if (memoryRequests[requestId]) {
        memoryRequests[requestId].status = 'DENIED';
      }

      await writeAuditLog(userId, 'DENY_REQUEST', { requestId });
      res.json({ success: true, status: 'DENIED' });
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to deny request',
      });
    }
  }
);

// ==============================================================================
// 8. POST /consents/:id/revoke (User Only: Revoke Consent)
// ==============================================================================
const revokeConsentParamSchema = z.object({
  id: z.string().min(1, 'Consent ID is required'),
});

const revokeConsentBodySchema = z
  .object({
    userAddress: z.string().optional(),
    onChainConsentId: z.string().optional(),
    signature: z.string().optional(),
  })
  .optional();

apiRouter.post(
  '/consents/:id/revoke',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id: consentId } = revokeConsentParamSchema.parse(req.params);
      const body = revokeConsentBodySchema.parse(req.body);

      const targetMemConsent = memoryConsents[consentId];
      const onChainIdToRevoke =
        body?.onChainConsentId || targetMemConsent?.on_chain_consent_id || consentId;
      const userOrDid = body?.userAddress || memoryDids[userId]?.did;

      const chainReceipt = await chainAdapter.takeBackAccess(
        onChainIdToRevoke,
        userOrDid,
        body?.signature
      );
      const revokedAt = new Date().toISOString();

      if (isSupabaseConfigured) {
        const { data, error } = await supabaseAdmin
          .from('consents')
          .update({
            status: 'REVOKED',
            revoked_at: revokedAt,
            revoke_tx_hash: chainReceipt.txHash,
          })
          .eq('id', consentId)
          .eq('user_id', userId)
          .select()
          .maybeSingle();

        if (error || !data) {
          res.status(404).json({ error: 'Consent record not found or not owned by user' });
          return;
        }

        await writeAuditLog(userId, 'REVOKE_CONSENT', {
          consentId,
          onChainConsentId: chainReceipt.consentId,
          revokedAt,
          txHash: chainReceipt.txHash,
        });

        res.json({
          success: true,
          status: 'REVOKED',
          revokedAt: data.revoked_at,
          txHash: chainReceipt.txHash,
        });
        return;
      }

      if (!targetMemConsent) {
        res.status(404).json({ error: 'Consent record not found' });
        return;
      }

      targetMemConsent.status = 'REVOKED';
      targetMemConsent.revoked_at = revokedAt;
      targetMemConsent.revoke_tx_hash = chainReceipt.txHash;

      await writeAuditLog(userId, 'REVOKE_CONSENT', {
        consentId,
        onChainConsentId: chainReceipt.consentId,
        revokedAt,
        txHash: chainReceipt.txHash,
      });

      res.json({
        success: true,
        status: 'REVOKED',
        revokedAt,
        txHash: chainReceipt.txHash,
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to revoke consent';
      const cleanMsg =
        rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
          ? 'The demo wallet needs more test coins'
          : rawMsg;
      res.status(400).json({
        error: cleanMsg,
      });
    }
  }
);

// ==============================================================================
// 9. POST /verify & POST /check (Verifier Only: 4-Step On-Chain & Signature Check)
//   (a) contract.isConsentValid(consentId) is true
//   (b) contract.getConsent(consentId).fieldsHash == hash of the shared field names
//   (c) contract.getCredential(credentialHash).exists is true
//   (d) ECDSA signature on shared_info matches the user's public key from contract.getIdentity(user)
// ==============================================================================
const verifyRequestSchema = z.object({
  consentId: z.string().optional(),
  presentationId: z.string().optional(),
  requestId: z.string().optional(),
});

const handleVerifyOrCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const verifierId = req.user!.id;
    const body = verifyRequestSchema.parse(req.body || {});

    if (isSupabaseConfigured) {
      let query = supabaseAdmin
        .from('presentations')
        .select(`
          id,
          payload,
          signature,
          created_at,
          consent:consents!inner(
            id,
            request_id,
            status,
            expires_at,
            revoked_at,
            grant_tx_hash,
            revoke_tx_hash,
            verifier_id,
            shared_fields,
            user_id,
            credential:credentials(credential_hash, issuer)
          )
        `);

      if (body.presentationId) {
        query = query.eq('id', body.presentationId);
      } else if (body.consentId) {
        query = query.eq('consent_id', body.consentId);
      } else if (body.requestId) {
        query = query.eq('consent.request_id', body.requestId);
      }

      const { data: presRow, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !presRow) {
        res.status(200).json({
          valid: false,
          status: 'PENDING_APPROVAL',
          failureReason: 'No shared details found for this request yet. Waiting for document owner to review and share.',
          disclosedClaims: [],
          sharedFields: [],
        });
        return;
      }

      const consent = presRow.consent as any;

      if (consent.verifier_id !== verifierId) {
        res.status(403).json({
          valid: false,
          failureReason: 'Verifier is not authorized for this consent record.',
          error: 'Forbidden: Verifier is not authorized on this consent',
        });
        return;
      }

      const onChainConsentId = presRow.payload?.onChainConsentId || consent.id;
      const isExpired = Boolean(
        consent.expires_at && new Date(consent.expires_at) < new Date()
      );

      // Check (a): contract.isConsentValid(consentId) is true
      const onChainValid = await chainAdapter.isPermissionValid(onChainConsentId);

      if (consent.status !== 'ACTIVE' || isExpired || !onChainValid) {
        const failureReason =
          consent.status === 'REVOKED' || !onChainValid
            ? 'Access has been taken back (REVOKED) by the user on the public record.'
            : 'Permission has EXPIRED and is no longer valid.';

        await writeAuditLog(verifierId, 'VERIFY_FAILED', {
          consentId: consent.id,
          reason: failureReason,
        });

        res.json({
          valid: false,
          status: consent.status,
          failureReason,
          error: failureReason,
          revokedAt: consent.revoked_at,
          revocationTxHash: consent.revoke_tx_hash,
        });
        return;
      }

      // Check (b): contract.getConsent(consentId).fieldsHash == hash of the shared field names
      const onChainConsent = await chainAdapter.getOnChainConsent(onChainConsentId);
      const expectedFieldsHash = computeFieldsHash(
        consent.shared_fields || presRow.payload?.disclosedFields || []
      );
      if (
        onChainConsent?.exists &&
        onChainConsent.fieldsHash.toLowerCase() !== expectedFieldsHash.toLowerCase()
      ) {
        const failureReason =
          'Shared fields hash does not match the fieldsHash recorded on the SelfID contract.';
        await writeAuditLog(verifierId, 'VERIFY_FAILED', {
          consentId: consent.id,
          reason: failureReason,
        });
        res.json({
          valid: false,
          status: 'FIELDS_HASH_MISMATCH',
          failureReason,
          error: failureReason,
        });
        return;
      }

      // Check (c): contract.getCredential(credentialHash).exists is true
      const anchoredHash = consent.credential?.credential_hash;
      const presentedHash = presRow.payload?.credentialHash;
      const onChainCred = anchoredHash
        ? await chainAdapter.getOnChainCredential(anchoredHash)
        : null;
      if (
        !anchoredHash ||
        (presentedHash && anchoredHash !== presentedHash) ||
        (onChainCred && !onChainCred.exists)
      ) {
        const failureReason =
          'Document fingerprint does not match the fingerprint saved on the public record.';
        await writeAuditLog(verifierId, 'VERIFY_FAILED', {
          consentId: consent.id,
          reason: failureReason,
        });

        res.json({
          valid: false,
          status: 'HASH_MISMATCH',
          failureReason,
          error: failureReason,
        });
        return;
      }

      // Check (d): ECDSA signature on shared_info matches the user's public key from contract.getIdentity(user)
      const { data: didRow } = await supabaseAdmin
        .from('dids')
        .select('did, public_key')
        .eq('user_id', consent.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const holderDidOrAddr = didRow?.did || presRow.payload?.holderDid || '';
      const onChainIdentity = holderDidOrAddr
        ? await chainAdapter.getOnChainIdentity(holderDidOrAddr)
        : null;
      const keyOrDidToVerify =
        (onChainIdentity?.exists && onChainIdentity.publicKey) ||
        didRow?.public_key ||
        didRow?.did ||
        presRow.payload?.holderDid ||
        '';

      const isSignatureValid = presRow.payload?.sharedInfo
        ? verifySharedInfoSignature(
            presRow.payload.sharedInfo,
            presRow.signature,
            keyOrDidToVerify
          ) ||
          verifyPresentationSignature(presRow.payload, presRow.signature, keyOrDidToVerify)
        : verifyPresentationSignature(presRow.payload, presRow.signature, keyOrDidToVerify);

      if (!isSignatureValid) {
        const failureReason =
          'Signature check failed against the user Digital ID public key on the SelfID contract.';
        await writeAuditLog(verifierId, 'VERIFY_FAILED', {
          consentId: consent.id,
          reason: failureReason,
        });

        res.json({
          valid: false,
          status: 'INVALID_SIGNATURE',
          failureReason,
          error: failureReason,
        });
        return;
      }

      await writeAuditLog(verifierId, 'VERIFY_SUCCESS', {
        consentId: consent.id,
        presentationId: presRow.id,
      });

      res.json({
        valid: true,
        verificationStatus: 'PASSED',
        consentId: consent.id,
        presentationId: presRow.id,
        holderDid: didRow?.did || presRow.payload?.holderDid,
        holderPublicKey:
          (onChainIdentity?.exists && onChainIdentity.publicKey) || didRow?.public_key,
        disclosedClaims: presRow.payload?.sharedClaims || [],
        sharedFields: consent.shared_fields || [],
        issuer: consent.credential?.issuer || 'Sample Document Reader',
        verifiedAt: new Date().toISOString(),
        expiresAt: consent.expires_at,
        cryptographicProof: {
          signature: presRow.signature,
          credentialHash: anchoredHash,
          grantTxHash: consent.grant_tx_hash,
        },
      });
      return;
    }

    // In-Memory Cryptographic & On-Chain Verification
    const allPresentations = Object.values(memoryPresentations);
    let targetPres: StoredPresentation | undefined;

    if (body.presentationId && memoryPresentations[body.presentationId]) {
      targetPres = memoryPresentations[body.presentationId];
    } else if (body.consentId) {
      targetPres = allPresentations.find((p) => p.consent_id === body.consentId);
    } else if (body.requestId) {
      const matchingConsent = Object.values(memoryConsents).find(
        (c) => c.request_id === body.requestId
      );
      if (matchingConsent) {
        targetPres = allPresentations.find((p) => p.consent_id === matchingConsent.id);
      }
    } else {
      targetPres = allPresentations[allPresentations.length - 1];
    }

    if (!targetPres) {
      res.status(200).json({
        valid: false,
        status: 'PENDING_APPROVAL',
        failureReason: 'No shared details found for this request yet. Waiting for document owner to review and share.',
        disclosedClaims: [],
        sharedFields: [],
      });
      return;
    }

    const consent = memoryConsents[targetPres.consent_id];
    if (!consent) {
      res.status(200).json({
        valid: false,
        status: 'PENDING_APPROVAL',
        failureReason: 'Associated permission record not found.',
        disclosedClaims: [],
        sharedFields: [],
      });
      return;
    }

    const onChainConsentId =
      consent.on_chain_consent_id || targetPres.payload?.onChainConsentId || consent.id;
    const isExpired = Boolean(
      consent.expires_at && new Date(consent.expires_at) < new Date()
    );

    // Check (a): contract.isConsentValid(consentId) is true
    const onChainValid = await chainAdapter.isPermissionValid(onChainConsentId);

    if (consent.status !== 'ACTIVE' || isExpired || !onChainValid) {
      const failureReason =
        consent.status === 'REVOKED' || !onChainValid
          ? 'Access has been taken back (REVOKED) by the user on the public record.'
          : 'Permission has EXPIRED and is no longer valid.';

      await writeAuditLog(verifierId, 'VERIFY_FAILED', {
        consentId: consent.id,
        reason: failureReason,
      });

      res.json({
        valid: false,
        status: consent.status,
        failureReason,
        error: failureReason,
        revokedAt: consent.revoked_at,
        revocationTxHash: consent.revoke_tx_hash,
      });
      return;
    }

    // Check (b): contract.getConsent(consentId).fieldsHash == hash of the shared field names
    const onChainConsent = await chainAdapter.getOnChainConsent(onChainConsentId);
    const expectedFieldsHash = computeFieldsHash(consent.shared_fields || []);
    if (
      onChainConsent?.exists &&
      onChainConsent.fieldsHash.toLowerCase() !== expectedFieldsHash.toLowerCase()
    ) {
      const failureReason =
        'Shared fields hash does not match the fieldsHash recorded on the SelfID contract.';
      await writeAuditLog(verifierId, 'VERIFY_FAILED', {
        consentId: consent.id,
        reason: failureReason,
      });
      res.json({
        valid: false,
        status: 'FIELDS_HASH_MISMATCH',
        failureReason,
        error: failureReason,
      });
      return;
    }

    // Check (c): contract.getCredential(credentialHash).exists is true
    const credRecord = memoryCredentials[consent.credential_id];
    const onChainCred = credRecord
      ? await chainAdapter.getOnChainCredential(credRecord.credential_hash)
      : null;
    if (
      !credRecord ||
      (targetPres.payload.credentialHash &&
        credRecord.credential_hash !== targetPres.payload.credentialHash) ||
      (onChainCred && !onChainCred.exists)
    ) {
      const failureReason =
        'Document fingerprint does not match the fingerprint saved on the public record.';
      await writeAuditLog(verifierId, 'VERIFY_FAILED', {
        consentId: consent.id,
        reason: failureReason,
      });

      res.json({
        valid: false,
        status: 'HASH_MISMATCH',
        failureReason,
        error: failureReason,
      });
      return;
    }

    // Check (d): ECDSA signature on shared_info matches user's public key from contract.getIdentity(user)
    const holderDidRecord = memoryDids[consent.user_id];
    const holderDidOrAddr =
      holderDidRecord?.did || targetPres.payload.holderDid || '';
    const onChainIdentity = holderDidOrAddr
      ? await chainAdapter.getOnChainIdentity(holderDidOrAddr)
      : null;
    const keyOrDidToVerify =
      (onChainIdentity?.exists && onChainIdentity.publicKey) ||
      holderDidRecord?.public_key ||
      holderDidRecord?.did ||
      targetPres.payload.holderDid ||
      '';

    const isSignatureValid = targetPres.payload?.sharedInfo
      ? verifySharedInfoSignature(
          targetPres.payload.sharedInfo,
          targetPres.signature,
          keyOrDidToVerify
        ) ||
        verifyPresentationSignature(
          targetPres.payload,
          targetPres.signature,
          keyOrDidToVerify
        )
      : verifyPresentationSignature(
          targetPres.payload,
          targetPres.signature,
          keyOrDidToVerify
        );

    if (!isSignatureValid) {
      const failureReason =
        'Signature check failed against the user Digital ID public key on the SelfID contract.';
      await writeAuditLog(verifierId, 'VERIFY_FAILED', {
        consentId: consent.id,
        reason: failureReason,
      });

      res.json({
        valid: false,
        status: 'INVALID_SIGNATURE',
        failureReason,
        error: failureReason,
      });
      return;
    }

    await writeAuditLog(verifierId, 'VERIFY_SUCCESS', {
      consentId: consent.id,
      presentationId: targetPres.id,
    });

    res.json({
      valid: true,
      verificationStatus: 'PASSED',
      consentId: consent.id,
      presentationId: targetPres.id,
      holderDid: holderDidRecord?.did || targetPres.payload.holderDid,
      holderPublicKey:
        (onChainIdentity?.exists && onChainIdentity.publicKey) ||
        holderDidRecord?.public_key ||
        '',
      disclosedClaims: targetPres.payload.sharedClaims || [],
      sharedFields: consent.shared_fields,
      issuer: credRecord.issuer,
      verifiedAt: new Date().toISOString(),
      expiresAt: consent.expires_at,
      cryptographicProof: {
        signature: targetPres.signature,
        credentialHash: credRecord.credential_hash,
        grantTxHash: consent.grant_tx_hash,
      },
    });
  } catch (err: unknown) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Verification request failed',
    });
  }
};

apiRouter.post('/verify', requireRole('VERIFIER'), handleVerifyOrCheck);
apiRouter.post('/check', requireRole('VERIFIER'), handleVerifyOrCheck);

// ==============================================================================
// 10. GET /history (User Only: Consent History Audit Trail)
// ==============================================================================
apiRouter.get(
  '/history',
  requireRole('USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      if (isSupabaseConfigured) {
        const { data, error } = await supabaseAdmin
          .from('consents')
          .select(`
            id,
            status,
            shared_fields,
            expires_at,
            granted_at,
            revoked_at,
            grant_tx_hash,
            revoke_tx_hash,
            verifier:profiles!verifier_id(full_name, org_name, verifier_code),
            credential:credentials(type, issuer, credential_hash)
          `)
          .eq('user_id', userId)
          .order('granted_at', { ascending: false });

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        const mapped = await Promise.all(
          (data || []).map(async (row: any) => {
            const eventInfo = await chainAdapter.getConsentEventStatusWithFallback(
              row.id,
              row.status
            );
            return {
              id: row.id,
              verifierName:
                row.verifier?.org_name || row.verifier?.full_name || 'CMRIT Verification Portal',
              verifierCategory: 'Authorized Verifier',
              verifierDid: `did:selfid:${(row.verifier?.verifier_code || 'VER-001').toLowerCase()}`,
              disclosedFields: row.shared_fields || [],
              issuedAt: new Date(row.granted_at).toLocaleString(),
              expiresAt: row.expires_at ? new Date(row.expires_at).toLocaleString() : 'Never',
              expiresInText:
                row.status === 'REVOKED'
                  ? `Taken back on ${new Date(row.revoked_at || Date.now()).toLocaleDateString()}`
                  : 'Active (Valid)',
              status: row.status.toLowerCase(),
              contractEventStatus: eventInfo.contractEventStatus,
              contractStatusSource: eventInfo.contractStatusSource,
              txHash: row.grant_tx_hash || '0x0',
              accumulatorProof: row.credential?.credential_hash?.slice(0, 14) || '0x0',
              revocationTx: row.revoke_tx_hash || undefined,
              revocationTimestamp: row.revoked_at
                ? new Date(row.revoked_at).toLocaleString()
                : undefined,
              isZkPresentation: true,
            };
          })
        );

        res.json(mapped);
        return;
      }

      const list = Object.values(memoryConsents)
        .filter((c) => c.user_id === userId)
        .sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime());

      const mappedMemory = await Promise.all(
        list.map(async (c) => {
          const cred = memoryCredentials[c.credential_id];
          const eventInfo = await chainAdapter.getConsentEventStatusWithFallback(
            c.on_chain_consent_id || c.id,
            c.status
          );
          return {
            id: c.id,
            onChainConsentId: c.on_chain_consent_id,
            verifierName: c.verifier_name || 'CMRIT Verification Portal',
            verifierCategory: c.verifier_category || 'Academic & Higher Ed',
            verifierDid: c.verifier_did || 'did:selfid:ver-001',
            disclosedFields: c.shared_fields,
            issuedAt: new Date(c.granted_at).toLocaleString(),
            expiresAt: c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '7 days',
            expiresInText:
              c.status === 'REVOKED'
                ? 'Access taken back by you'
                : 'Active (Valid)',
            status: c.status.toLowerCase(),
            contractEventStatus: eventInfo.contractEventStatus,
            contractStatusSource: eventInfo.contractStatusSource,
            txHash: c.grant_tx_hash,
            accumulatorProof: cred?.credential_hash?.slice(0, 14) || '0x0',
            revocationTx: c.revoke_tx_hash || undefined,
            revocationTimestamp: c.revoked_at
              ? new Date(c.revoked_at).toLocaleString()
              : undefined,
            isZkPresentation: true,
          };
        })
      );

      res.json(mappedMemory);
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch consent history',
      });
    }
  }
);

// ==============================================================================
// 10b. POST /requests/:id/explain (Privacy Helper with Gemini API & Fallback)
// ==============================================================================
apiRouter.post(
  '/requests/:id/explain',
  requireRole('USER', 'VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { purpose, requestedFields, verifierName, question } = req.body;
      const result = await getHelperExplanation({
        verifierName: verifierName || 'Verifier',
        purpose: purpose || 'Verification',
        requestedFields: Array.isArray(requestedFields) ? requestedFields : [],
        question,
      });
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate explanation',
      });
    }
  }
);

// ==============================================================================
// 11. DEMO RESET & STATUS (DEMO_MODE)
// ==============================================================================
apiRouter.get('/demo/status', (_req: Request, res: Response) => {
  const isDemo = Boolean(
    process.env.DEMO_MODE === 'true' ||
      process.env.VITE_DEMO_MODE === 'true' ||
      process.env.DEMO_MODE === '1'
  );
  res.json({ demoMode: isDemo });
});

apiRouter.post(
  '/demo/reset',
  requireRole('USER', 'VERIFIER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // 1. Supabase deletion if configured
      if (isSupabaseConfigured) {
        // Find user's consents to delete presentations
        const { data: userConsents } = await supabaseAdmin
          .from('consents')
          .select('id')
          .eq('user_id', userId);

        const consentIds = (userConsents || []).map((c: any) => c.id);
        if (consentIds.length > 0) {
          await supabaseAdmin.from('presentations').delete().in('consent_id', consentIds);
        }

        // Delete user's consents
        await supabaseAdmin.from('consents').delete().eq('user_id', userId);

        // Delete user's requests
        if (userRole === 'VERIFIER') {
          await supabaseAdmin.from('verification_requests').delete().eq('verifier_id', userId);
        } else {
          await supabaseAdmin.from('verification_requests').delete().eq('user_id', userId);
        }

        // Delete user's credentials
        await supabaseAdmin.from('credentials').delete().eq('user_id', userId);
      }

      // 2. In-memory store deletion
      for (const [key, cred] of Object.entries(memoryCredentials)) {
        if (cred.user_id === userId) {
          delete memoryCredentials[key];
        }
      }

      for (const [key, consent] of Object.entries(memoryConsents)) {
        if (consent.user_id === userId || (userRole === 'VERIFIER' && consent.verifier_id === userId)) {
          for (const [pKey, pres] of Object.entries(memoryPresentations)) {
            if (pres.consent_id === consent.id) {
              delete memoryPresentations[pKey];
            }
          }
          delete memoryConsents[key];
        }
      }

      for (const [key, reqObj] of Object.entries(memoryRequests)) {
        if (reqObj.user_id === userId || (userRole === 'VERIFIER' && reqObj.verifier_id === userId)) {
          delete memoryRequests[key];
        }
      }

      for (const [key, sess] of Object.entries(pendingExtractions)) {
        if (sess.userId === userId) {
          delete pendingExtractions[key];
        }
      }

      await writeAuditLog(userId, 'RESET_DEMO_DATA', {
        role: userRole,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Demo data cleared: documents, requests, and permissions have been reset.',
      });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to reset demo data',
      });
    }
  }
);
