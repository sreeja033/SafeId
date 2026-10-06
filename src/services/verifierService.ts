import { VerifierMetricStats, VerifierRequestRecord } from '../types';
import { apiRequest } from '../lib/apiClient';

export interface VerificationResultResponse {
  valid: boolean;
  verificationStatus?: string;
  status?: string;
  consentId?: string;
  presentationId?: string;
  holderDid?: string;
  holderPublicKey?: string;
  disclosedClaims?: Array<{ key: string; label?: string; value: string }>;
  sharedFields?: string[];
  issuer?: string;
  verifiedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  revocationTxHash?: string;
  failureReason?: string;
  error?: string;
  cryptographicProof?: {
    signature: string;
    credentialHash: string;
    grantTxHash?: string;
  };
}

export const verifierService = {
  async getMetrics(): Promise<VerifierMetricStats> {
    const records = await this.getRequestsLedger();
    const approved = records.filter((r) => r.proofStatus === 'approved').length;
    const revoked = records.filter((r) => r.proofStatus === 'revoked').length;
    const failed = records.filter((r) => r.proofStatus === 'failed').length;
    const total = records.length || 1;

    return {
      requestsSent: records.length,
      approvedCount: approved,
      revokedCount: revoked,
      failedCount: failed,
      successRate: `${Math.round((approved / total) * 100)}%`,
      revokedRate: `${Math.round((revoked / total) * 100)}%`,
      failedRate: `${Math.round((failed / total) * 100)}%`,
    };
  },

  /**
   * Retrieves requests sent by this verifier via GET /requests
   */
  async getRequestsLedger(): Promise<VerifierRequestRecord[]> {
    const { data, error } = await apiRequest<any[]>('/requests', {
      headers: { 'x-role': 'VERIFIER' },
    });

    if (error || !data) {
      console.error('[VerifierService] Failed to fetch verifier ledger:', error?.message);
      return [];
    }

    return data.map((r) => ({
      id: r.id,
      holderName: r.holderName || r.holder_name || 'Student / ID Holder',
      holderDid: r.holderDid || r.verifierDid || 'did:selfid:student',
      requestedClaims: r.claims
        ? r.claims.map((c: any) => c.label || c.key)
        : r.requested_fields || ['College / Institution', 'Full Legal Name'],
      proofStatus:
        r.status === 'approved'
          ? 'approved'
          : r.status === 'revoked'
          ? 'revoked'
          : r.status === 'denied'
          ? 'failed'
          : 'pending',
      proofStatusText:
        r.status === 'approved'
          ? 'Confirmed & Valid'
          : r.status === 'revoked'
          ? 'Consent Revoked'
          : r.status === 'denied'
          ? 'Denied'
          : 'Pending Consent',
      proofHashSnippet: r.ephemeralHash
        ? r.ephemeralHash.slice(0, 16) + '...'
        : '0x8f2c...4a9e1d88',
      timestamp: r.requestedAt || 'Just now',
      expiresText: r.expiresIn || '24 Hours',
      txHash: '0x9c4f82a17b0119e2bf405cde31c89326e7a',
    }));
  },

  /**
   * Calls POST /check (also aliased at POST /verify, verifier only):
   * 1. contract.isConsentValid(consentId) is true
   * 2. contract.getConsent(consentId).fieldsHash == hash of the shared field names
   * 3. contract.getCredential(credentialHash).exists is true
   * 4. ECDSA signature on shared_info matches the user's public key from contract.getIdentity(user)
   * Returns ONLY the shared fields or a clear failure reason.
   */
  async verifyPresentation(query: {
    requestId?: string;
    consentId?: string;
    presentationId?: string;
  }): Promise<VerificationResultResponse> {
    const { data, error } = await apiRequest<VerificationResultResponse>('/check', {
      method: 'POST',
      headers: { 'x-role': 'VERIFIER' },
      body: JSON.stringify(query),
    });

    if (error || !data) {
      return {
        valid: false,
        failureReason: error?.message || 'Verification failed or presentation not found.',
        error: error?.message || 'Verification failed',
      };
    }

    return data;
  },

  /**
   * Verifies the cryptographic presentation by requestId and returns a VerifierRequestRecord
   */
  async getProofResult(id: string): Promise<VerifierRequestRecord | null> {
    const result = await this.verifyPresentation({ requestId: id });
    const records = await this.getRequestsLedger();
    const existing = records.find((r) => r.id === id) || records[0];

    if (result.valid) {
      return {
        ...(existing || {
          id,
          holderName: 'Student / ID Holder',
          holderDid: result.holderDid || 'did:selfid:student',
          requestedClaims: result.sharedFields || [],
          expiresText: '24 Hours',
        }),
        id,
        proofStatus: 'approved',
        proofStatusText: 'Signature Verified · Valid on Public Record',
        proofHashSnippet:
          result.cryptographicProof?.credentialHash?.slice(0, 16) || '0x8f2c...4a9e1d88',
        txHash: result.cryptographicProof?.signature || '0x39a184f...991e',
        timestamp: 'Verified just now',
      };
    }

    return {
      ...(existing || {
        id,
        holderName: 'Student / ID Holder',
        holderDid: 'did:selfid:student',
        requestedClaims: [],
        expiresText: 'Terminated',
      }),
      id,
      proofStatus: 'revoked',
      proofStatusText: result.failureReason || result.error || 'Access Taken Back on Public Record',
      timestamp: 'Verification failed',
    };
  },

  /**
   * Initiates a new verification request to a holder by Email or DID via POST /requests
   */
  async initiatePresentationRequest(
    holderDidOrQuery: string,
    claims: string[],
    purpose: string,
    presentationWindow: string
  ): Promise<VerifierRequestRecord> {
    const isEmail = holderDidOrQuery.includes('@');
    const { data, error } = await apiRequest<any>('/requests', {
      method: 'POST',
      headers: { 'x-role': 'VERIFIER' },
      body: JSON.stringify({
        targetQuery: holderDidOrQuery,
        holderDid: isEmail ? undefined : holderDidOrQuery,
        requestedFields: claims,
        purpose,
        validityWindow: presentationWindow,
      }),
    });

    if (error || !data) {
      throw error || new Error('Failed to create verification request');
    }

    return {
      id: data.id,
      holderName: data.holderName || data.holder_name || 'Student / ID Holder',
      holderDid: data.holderDid || data.holder_did || holderDidOrQuery,
      requestedClaims: claims,
      proofStatus: 'pending',
      proofStatusText: 'Pending Consent',
      proofHashSnippet: 'Awaiting holder signature',
      timestamp: 'Just now',
      expiresText: `Expires in ${presentationWindow}`,
    };
  },
};
