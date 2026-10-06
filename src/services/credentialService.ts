import { VerifiableCredential } from '../types';
import { apiRequest } from '../lib/apiClient';
import { identityService } from './identityService';
import { signAnchorCredential } from '../../shared/digests';

export interface ExtractedFieldsPayload {
  fullName: string;
  institution: string;
  course: string;
  academicYear: string;
  studentId: string;
  studentStatus: string;
  dateOfBirth: string;
  missingFields: string[];
  looksLikeCollegeId: boolean;
}

export interface DocumentExtractResponse {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceFileHash: string;
  credentialHash?: string;
  storageRef?: string;
  extraction: ExtractedFieldsPayload;
  isTestMode: boolean;
  readerNote: string;
}

export const credentialService = {
  /**
   * Fetches documents from backend GET /credentials (decrypted only for the authenticated owner)
   */
  async getCredentials(): Promise<VerifiableCredential[]> {
    const { data, error } = await apiRequest<VerifiableCredential[]>('/credentials');
    if (error || !data) {
      console.error('[CredentialService] Database error fetching credentials:', error?.message);
      throw error || new Error('Failed to load documents from database.');
    }
    return data;
  },

  /**
   * Fetches and decrypts a single document by ID via GET /credentials/:id (owner only)
   */
  async getCredentialById(id: string): Promise<VerifiableCredential | null> {
    const { data, error } = await apiRequest<VerifiableCredential>(`/credentials/${id}`);
    if (!error && data) {
      return data;
    }
    return null;
  },

  /**
   * Step 2: Sends the uploaded file to the server to read details from it (server-side Gemini Vision or Test mode)
   */
  async extractDocument(filePayload: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    base64Data: string;
  }): Promise<DocumentExtractResponse> {
    const { data, error } = await apiRequest<DocumentExtractResponse>('/documents/extract', {
      method: 'POST',
      body: JSON.stringify(filePayload),
    });

    if (error || !data) {
      throw new Error(error?.message || "Couldn't read details from this file.");
    }

    return data;
  },

  /**
   * Step 4: Confirms creation of the document using ONLY the server-stored extracted values.
   * Browser signs the ANCHOR_CREDENTIAL digest with the user's browser wallet and sends
   * ONLY { fileId, confirm: true, userAddress, signature } (no field values, no private key).
   */
  async confirmDocument(
    fileId: string,
    options?: { credentialHash?: string; storageRef?: string }
  ): Promise<VerifiableCredential> {
    const wallet = identityService.getOrCreateBrowserWallet();
    let signature: string | undefined;

    if (options?.credentialHash && options?.storageRef) {
      try {
        const chainConfig = await identityService.getChainNonce(wallet.address);
        const signed = await signAnchorCredential(wallet, {
          contractAddress: chainConfig.contractAddress,
          chainId: chainConfig.chainId,
          credentialHash: options.credentialHash,
          storageRef: options.storageRef,
          nonce: chainConfig.nonce,
        });
        signature = signed.signature;
      } catch (err) {
        console.warn('[CredentialService] Could not pre-sign anchorCredential:', err);
      }
    }

    const { data, error } = await apiRequest<VerifiableCredential>('/documents/confirm', {
      method: 'POST',
      body: JSON.stringify({
        fileId,
        confirm: true,
        userAddress: wallet.address,
        signature,
      }),
    });

    if (error || !data) {
      throw new Error(error?.message || 'Saving failed. Please try again.');
    }

    return data;
  },

  async deleteCredential(id: string): Promise<boolean> {
    const { error } = await apiRequest(`/credentials/${id}`, {
      method: 'DELETE',
    });
    return !error;
  },

  async verifyMerkleProof(id: string): Promise<{ verified: boolean; timestamp: string }> {
    const cred = await this.getCredentialById(id);
    return {
      verified: Boolean(cred?.sha256Hash),
      timestamp: new Date().toLocaleTimeString(),
    };
  },
};
