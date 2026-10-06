export type UserRole = 'USER' | 'VERIFIER';

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  did: string;
  keyAlgorithm: string;
  creationDate: string;
  custodyType: string;
  secureEnclave: string;
  status: 'active' | 'locked';
  txHash: string;
}

export interface CredentialAttribute {
  key: string;
  label: string;
  value: string;
  type?: 'text' | 'date' | 'boolean' | 'number';
  isZkEligible?: boolean;
  zkAssertion?: string;
  isProtected?: boolean;
  isBlindSignature?: boolean;
  encrypted?: boolean;
}

export interface VerifiableCredential {
  id: string;
  title: string;
  category: 'academic' | 'identity' | 'work' | 'financial';
  subtitle: string;
  issuerName: string;
  issuerDid: string;
  schema: string;
  issuedDate: string;
  issuedTime?: string;
  expiryDate: string;
  algorithm: string;
  status: 'active' | 'revoked' | 'expired';
  attributes: CredentialAttribute[];
  sha256Hash: string;
  sourceFileHash?: string;
  chainTxHash?: string;
  isSample?: boolean;
  isTestMode?: boolean;
  onChainState: {
    accumulatorRoot: string;
    ipfsCid: string;
    blockHeight: string;
    txHash: string;
    timestamp: string;
    network: string;
  };
  clientEnclave: {
    cipherText: string;
    iv: string;
    binding: string;
  };
  jsonLd: Record<string, unknown>;
  presentationsCount: number;
}

export interface VerificationRequestClaim {
  key: string;
  label: string;
  schema: string;
  required: boolean;
  zkEligible: boolean;
  zkDescription?: string;
  currentValue?: string;
  defaultValueDisclose?: boolean;
  defaultZkOnly?: boolean;
  isSensitive?: boolean;
}

export interface VerificationRequest {
  id: string; // e.g. REQ-9842A
  verifierName: string;
  verifierCategory: string;
  verifierDid: string;
  verifierScore: string;
  purpose: string;
  legalBasis?: string;
  requestedAt: string;
  expiresIn: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  claims: VerificationRequestClaim[];
  retentionPolicy: string;
  ephemeralHash: string;
  proverProtocol: string;
  allowedValidityWindows: string[];
}

export interface ConsentHistoryItem {
  id: string;
  onChainConsentId?: string;
  verifierName: string;
  verifierCategory: string;
  verifierDid: string;
  disclosedFields: string[];
  issuedAt: string;
  expiresAt: string;
  expiresInText: string;
  status: 'active' | 'revoked' | 'expired';
  contractEventStatus?: 'ConsentGranted' | 'ConsentRevoked' | 'Expired';
  contractStatusSource?: 'contract' | 'fallback_database';
  txHash: string;
  accumulatorProof: string;
  revocationTx?: string;
  revocationTimestamp?: string;
  revocationReason?: string;
  isZkPresentation?: boolean;
}

export interface VerifierRequestRecord {
  id: string; // e.g. REQ-9041
  holderName: string;
  holderDid: string;
  requestedClaims: string[];
  proofStatus: 'approved' | 'pending' | 'revoked' | 'failed';
  proofStatusText: string;
  proofHashSnippet: string;
  timestamp: string;
  expiresText: string;
  txHash?: string;
  rawProofJson?: string;
}

export interface VerifierMetricStats {
  requestsSent: number;
  approvedCount: number;
  revokedCount: number;
  failedCount: number;
  successRate: string;
  revokedRate: string;
  failedRate: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}
