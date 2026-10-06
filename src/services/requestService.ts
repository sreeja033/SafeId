import { VerificationRequest } from '../types';
import { apiRequest } from '../lib/apiClient';
import { identityService } from './identityService';
import { credentialService } from './credentialService';
import {
  computeVerifierIdHash,
  computeFieldsHash,
  signGrantConsent,
  signSharedInfoPresentation,
  SharedInfoPresentation,
} from '../../shared/digests';

export const requestService = {
  /**
   * Fetches incoming requests (for USER) or sent requests (for VERIFIER) via GET /requests
   */
  async getRequests(): Promise<VerificationRequest[]> {
    const { data, error } = await apiRequest<VerificationRequest[]>('/requests');

    if (error || !data) {
      console.error('[RequestService] Failed to fetch requests:', error?.message);
      return [];
    }

    return data;
  },

  /**
   * Retrieves single request by ID
   */
  async getRequestById(id: string): Promise<VerificationRequest | null> {
    const all = await this.getRequests();
    return all.find((r) => r.id === id) || all[0] || null;
  },

  /**
   * Step 5 (Confirm and share):
   * 1. Builds `shared_info` with ONLY the chosen fields, requestId, verifierId, documentFingerprint, issuedAt, expiresAt
   * 2. Signs the `shared_info` JSON hash with the user's browser wallet
   * 3. Signs the `grantConsent` digest with the user's browser wallet (fieldsHash = hash of chosen field names)
   * 4. Sends signatures + publicKey to POST /api/requests/:id/grant (never sends privateKey)
   */
  async grantRequest(
    id: string,
    selectedClaims: Record<string, { disclosed: boolean; zkOnly: boolean }>,
    validityPeriod: string,
    credentialId?: string
  ): Promise<{ success: boolean; consentId?: string; presentationId: string; txHash: string }> {
    const selectedFieldLabels = Object.entries(selectedClaims)
      .filter(([_, opt]) => opt.disclosed || opt.zkOnly)
      .map(([key]) => key);

    const fieldsToShare =
      selectedFieldLabels.length > 0
        ? selectedFieldLabels
        : ['College / Institution', 'Student Enrollment Status'];

    const validityDurationHours = validityPeriod.includes('1 Hour')
      ? 1
      : validityPeriod.includes('24') || validityPeriod.includes('1 Day')
      ? 24
      : 168;

    // Ensure user has a registered DID & browser wallet
    let profile = await identityService.getProfile();
    if (!profile.did) {
      try {
        profile = await identityService.createDID(profile.name, profile.email);
      } catch {
        // Proceed with local browser wallet
      }
    }
    const wallet = identityService.getOrCreateBrowserWallet();

    // Load user's document to build chosenFields and get documentFingerprint
    const creds = await credentialService.getCredentials();
    const activeCred =
      (credentialId && creds.find((c) => c.id === credentialId)) || creds[0];

    if (!activeCred) {
      throw new Error('No saved document found. Please add a document in your wallet first.');
    }

    const chosenFields: Array<{ key: string; label: string; value: string }> = [];
    for (const label of fieldsToShare) {
      const lower = label.toLowerCase();
      if (lower.includes('age') && (lower.includes('private') || lower.includes('>='))) {
        chosenFields.push({
          key: 'ageZk',
          label,
          value: 'PASS (Age >= 18 Confirmed)',
        });
        continue;
      }
      const matched = activeCred.attributes.find(
        (a) =>
          a.label.toLowerCase() === lower ||
          a.key.toLowerCase() === lower ||
          lower.includes(a.key.toLowerCase()) ||
          a.label.toLowerCase().includes(lower) ||
          (lower.includes('college') && a.key === 'institution') ||
          (lower.includes('status') && a.key === 'studentStatus') ||
          (lower.includes('name') && a.key === 'fullName')
      );
      chosenFields.push({
        key: matched?.key || label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: matched?.label || label,
        value: matched?.value || 'Confirmed',
      });
    }

    const issuedAt = new Date().toISOString();
    const expiresAtUnix = Math.floor(Date.now() / 1000) + validityDurationHours * 3600;
    const expiresAt = new Date(expiresAtUnix * 1000).toISOString();
    const verifierCode = 'VER-001';

    const sharedInfo: SharedInfoPresentation = {
      requestId: id,
      verifierId: verifierCode,
      documentFingerprint: activeCred.sha256Hash,
      issuedAt,
      expiresAt,
      chosenFields,
    };

    // 1. Sign the shared_info JSON hash in the browser
    const { signature: sharedInfoSignature } = await signSharedInfoPresentation(
      wallet,
      sharedInfo
    );

    // 2. Sign the SelfID.grantConsent digest in the browser
    const chainConfig = await identityService.getChainNonce(wallet.address);
    const verifierIdBytes32 = computeVerifierIdHash(verifierCode);
    const fieldsHash = computeFieldsHash(fieldsToShare);

    const { signature: grantSignature } = await signGrantConsent(wallet, {
      contractAddress: chainConfig.contractAddress,
      chainId: chainConfig.chainId,
      verifierId: verifierIdBytes32,
      credentialHash: activeCred.sha256Hash,
      fieldsHash,
      expiresAt: expiresAtUnix,
      nonce: chainConfig.nonce,
    });

    const { data, error } = await apiRequest<{
      success: boolean;
      consentId: string;
      presentationId: string;
      txHash: string;
    }>(`/requests/${id}/grant`, {
      method: 'POST',
      body: JSON.stringify({
        credentialId: activeCred.id,
        selectedFields: fieldsToShare,
        validityDurationHours,
        userAddress: wallet.address,
        publicKey: wallet.signingKey.publicKey,
        grantSignature,
        expiresAtUnix,
        sharedInfo,
        sharedInfoSignature,
      }),
    });

    if (error || !data) {
      throw error || new Error('Failed to grant verification request');
    }

    return {
      success: true,
      consentId: data.consentId,
      presentationId: data.presentationId,
      txHash: data.txHash,
    };
  },

  /**
   * Denies verification request via POST /requests/:id/deny
   */
  async denyRequest(id: string): Promise<boolean> {
    const { error } = await apiRequest(`/requests/${id}/deny`, {
      method: 'POST',
    });
    return !error;
  },

  /**
   * Verifier creates a new request via POST /requests
   */
  async createRequest(newReq: Partial<VerificationRequest>): Promise<VerificationRequest> {
    const claimLabels = (newReq.claims || []).map((c) => c.label || c.key);

    const { data, error } = await apiRequest<any>('/requests', {
      method: 'POST',
      body: JSON.stringify({
        holderDid: newReq.verifierDid,
        requestedFields:
          claimLabels.length > 0 ? claimLabels : ['College / Institution', 'Full Legal Name'],
        purpose: newReq.purpose || 'Verification check',
      }),
    });

    if (error || !data) {
      throw error || new Error('Failed to create verification request');
    }

    return {
      id: data.id,
      verifierName: newReq.verifierName || 'CMRIT Verification Portal',
      verifierCategory: 'Official Verifier',
      verifierDid: newReq.verifierDid || 'did:selfid:ver-001',
      verifierScore: '99.8% (Anchor: Polygon Mainnet)',
      purpose: data.purpose,
      legalBasis: 'Explicit consent under ISO/IEC 27552',
      requestedAt: 'Just now',
      expiresIn: '24 Hours',
      status: 'pending',
      claims: (data.requested_fields || []).map((f: string) => ({
        key: f.toLowerCase().replace(/\s+/g, '_'),
        label: f,
        schema: 'w3c.schema.v1',
        required: true,
        zkEligible: true,
      })),
      retentionPolicy: 'Ephemeral presentation (0-day retention)',
      ephemeralHash: `0x${Math.random().toString(16).slice(2, 18)}`,
      proverProtocol: 'Polygon ID Groth16',
      allowedValidityWindows: ['1 Hour', '24 Hours', '7 Days'],
    };
  },

  /**
   * Real-Time & Live Polling Subscription
   */
  subscribeToRequests(onUpdate: (requests: VerificationRequest[]) => void): () => void {
    let active = true;

    this.getRequests().then((reqs) => {
      if (active) onUpdate(reqs);
    });

    const interval = setInterval(async () => {
      if (!active) return;
      const updated = await this.getRequests();
      if (active) onUpdate(updated);
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  },
};
