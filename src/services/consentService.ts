import { ConsentHistoryItem } from '../types';
import { apiRequest } from '../lib/apiClient';
import { identityService } from './identityService';
import { signRevokeConsent } from '../../shared/digests';

export const consentService = {
  /**
   * Fetches the user's consent history from backend GET /history
   */
  async getConsentHistory(): Promise<ConsentHistoryItem[]> {
    const { data, error } = await apiRequest<ConsentHistoryItem[]>('/history');

    if (error || !data) {
      console.error('[ConsentService] Failed to fetch consent history:', error?.message);
      return [];
    }

    return data;
  },

  /**
   * Step 6 (Take back access):
   * User signs the REVOKE_CONSENT digest in the browser with their private key,
   * and relayer calls `contract.revokeConsent` and updates the DB.
   */
  async revokeConsent(
    id: string,
    onChainConsentId?: string
  ): Promise<ConsentHistoryItem | null> {
    const wallet = identityService.getOrCreateBrowserWallet();
    let signature: string | undefined;
    const targetConsentIdForChain = onChainConsentId || id;

    try {
      const chainConfig = await identityService.getChainNonce(wallet.address);
      const signed = await signRevokeConsent(wallet, {
        contractAddress: chainConfig.contractAddress,
        chainId: chainConfig.chainId,
        consentId: targetConsentIdForChain,
        nonce: chainConfig.nonce,
      });
      signature = signed.signature;
    } catch (err) {
      console.warn('[ConsentService] Could not pre-sign revokeConsent:', err);
    }

    const { data, error } = await apiRequest<{
      success: boolean;
      status: string;
      revokedAt: string;
      txHash: string;
    }>(`/consents/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({
        userAddress: wallet.address,
        onChainConsentId: targetConsentIdForChain,
        signature,
      }),
    });

    if (error || !data) {
      throw error || new Error('Failed to revoke consent on public record');
    }

    const updatedHistory = await this.getConsentHistory();
    return (
      updatedHistory.find((item) => item.id === id) || {
        id,
        verifierName: 'CMRIT Verification Portal',
        verifierCategory: 'Authorized Verifier',
        verifierDid: 'did:selfid:ver-001',
        disclosedFields: ['College / Institution'],
        issuedAt: new Date().toLocaleDateString(),
        expiresAt: 'Revoked',
        expiresInText: 'Revoked just now',
        status: 'revoked',
        txHash: data.txHash,
        accumulatorProof: data.txHash,
        revocationTx: data.txHash,
        revocationTimestamp: new Date(data.revokedAt).toLocaleString(),
      }
    );
  },

  async reGrantConsent(id: string): Promise<ConsentHistoryItem | null> {
    const history = await this.getConsentHistory();
    return history.find((i) => i.id === id) || null;
  },

  async recordNewConsent(item: Omit<ConsentHistoryItem, 'id'>): Promise<ConsentHistoryItem> {
    return {
      ...item,
      id: `consent-${Date.now()}`,
    };
  },
};
