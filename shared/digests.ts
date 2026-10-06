import { ethers } from 'ethers';

/**
 * Shared Ethers v6 Digest & Signature Helpers for the SelfID Smart Contract.
 * Matches the exact `abi.encode(...)` and EIP-191 personal_sign layout in `contracts/SelfID.sol`.
 * Used by both the browser (to sign with the user's private key) and the server/tests (to verify).
 */

export const SELFID_ACTIONS = {
  REGISTER_DID: 'REGISTER_DID',
  ANCHOR_CREDENTIAL: 'ANCHOR_CREDENTIAL',
  GRANT_CONSENT: 'GRANT_CONSENT',
  REVOKE_CONSENT: 'REVOKE_CONSENT',
} as const;

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

/**
 * Normalizes any hex or string into a valid 32-byte hex value (bytes32).
 */
export function toBytes32(value: string): string {
  const trimmed = (value || '').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return ethers.keccak256(ethers.toUtf8Bytes(trimmed));
}

/**
 * Computes `verifierId = keccak256(toUtf8Bytes(verifierCode))` e.g. "VER-001"
 */
export function computeVerifierIdHash(verifierCode: string): string {
  const clean = (verifierCode || 'VER-001').trim().toUpperCase();
  if (/^0x[0-9a-fA-F]{64}$/.test(clean)) {
    return clean.toLowerCase();
  }
  return ethers.keccak256(ethers.toUtf8Bytes(clean));
}

/**
 * Computes deterministic `fieldsHash` over the sorted list of chosen field names.
 * Ensures that both grantConsent and /check compute the exact same bytes32 hash.
 */
export function computeFieldsHash(chosenFieldNames: string[]): string {
  const normalized = [...chosenFieldNames]
    .map((f) => f.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(normalized)));
}

/**
 * Computes deterministic on-chain `consentId = keccak256(abi.encode(user, verifierId, credentialHash))`
 * matching `SelfID.computeConsentId`.
 */
export function computeOnChainConsentId(
  userAddress: string,
  verifierIdBytes32: string,
  credentialHashBytes32: string
): string {
  return ethers.keccak256(
    abiCoder.encode(
      ['address', 'bytes32', 'bytes32'],
      [
        ethers.getAddress(userAddress),
        toBytes32(verifierIdBytes32),
        toBytes32(credentialHashBytes32),
      ]
    )
  );
}

// ============================================================================
// 1. REGISTER_DID Digest & Signer
// Layout: keccak256(abi.encode("REGISTER_DID", contractAddress, chainId, user, keccak256(publicKey), nonce))
// ============================================================================
export function buildRegisterDIDDigest(params: {
  contractAddress: string;
  chainId: bigint | number;
  user: string;
  publicKey: string;
  nonce: bigint | number;
}): string {
  const pubKeyBytes = params.publicKey.startsWith('0x')
    ? params.publicKey
    : ethers.hexlify(ethers.toUtf8Bytes(params.publicKey));
  const pubKeyHash = ethers.keccak256(pubKeyBytes);

  return ethers.keccak256(
    abiCoder.encode(
      ['string', 'address', 'uint256', 'address', 'bytes32', 'uint256'],
      [
        SELFID_ACTIONS.REGISTER_DID,
        ethers.getAddress(params.contractAddress),
        BigInt(params.chainId),
        ethers.getAddress(params.user),
        pubKeyHash,
        BigInt(params.nonce),
      ]
    )
  );
}

export async function signRegisterDID(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  params: {
    contractAddress: string;
    chainId: bigint | number;
    publicKey?: string;
    nonce: bigint | number;
  }
): Promise<{ digest: string; signature: string; publicKey: string; user: string }> {
  const publicKey = params.publicKey || wallet.signingKey.publicKey;
  const digest = buildRegisterDIDDigest({
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    user: wallet.address,
    publicKey,
    nonce: params.nonce,
  });
  const signature = await wallet.signMessage(ethers.getBytes(digest));
  return { digest, signature, publicKey, user: wallet.address };
}

// ============================================================================
// 2. ANCHOR_CREDENTIAL Digest & Signer
// Layout: keccak256(abi.encode("ANCHOR_CREDENTIAL", contractAddress, chainId, user, credentialHash, keccak256(bytes(storageRef)), nonce))
// ============================================================================
export function buildAnchorCredentialDigest(params: {
  contractAddress: string;
  chainId: bigint | number;
  user: string;
  credentialHash: string;
  storageRef: string;
  nonce: bigint | number;
}): string {
  const storageRefHash = ethers.keccak256(ethers.toUtf8Bytes(params.storageRef));
  return ethers.keccak256(
    abiCoder.encode(
      ['string', 'address', 'uint256', 'address', 'bytes32', 'bytes32', 'uint256'],
      [
        SELFID_ACTIONS.ANCHOR_CREDENTIAL,
        ethers.getAddress(params.contractAddress),
        BigInt(params.chainId),
        ethers.getAddress(params.user),
        toBytes32(params.credentialHash),
        storageRefHash,
        BigInt(params.nonce),
      ]
    )
  );
}

export async function signAnchorCredential(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  params: {
    contractAddress: string;
    chainId: bigint | number;
    credentialHash: string;
    storageRef: string;
    nonce: bigint | number;
  }
): Promise<{ digest: string; signature: string; user: string }> {
  const digest = buildAnchorCredentialDigest({
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    user: wallet.address,
    credentialHash: params.credentialHash,
    storageRef: params.storageRef,
    nonce: params.nonce,
  });
  const signature = await wallet.signMessage(ethers.getBytes(digest));
  return { digest, signature, user: wallet.address };
}

// ============================================================================
// 3. GRANT_CONSENT Digest & Signer
// Layout: keccak256(abi.encode("GRANT_CONSENT", contractAddress, chainId, user, verifierId, credentialHash, fieldsHash, expiresAt, nonce))
// ============================================================================
export function buildGrantConsentDigest(params: {
  contractAddress: string;
  chainId: bigint | number;
  user: string;
  verifierId: string;
  credentialHash: string;
  fieldsHash: string;
  expiresAt: bigint | number;
  nonce: bigint | number;
}): string {
  return ethers.keccak256(
    abiCoder.encode(
      [
        'string',
        'address',
        'uint256',
        'address',
        'bytes32',
        'bytes32',
        'bytes32',
        'uint64',
        'uint256',
      ],
      [
        SELFID_ACTIONS.GRANT_CONSENT,
        ethers.getAddress(params.contractAddress),
        BigInt(params.chainId),
        ethers.getAddress(params.user),
        toBytes32(params.verifierId),
        toBytes32(params.credentialHash),
        toBytes32(params.fieldsHash),
        BigInt(params.expiresAt),
        BigInt(params.nonce),
      ]
    )
  );
}

export async function signGrantConsent(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  params: {
    contractAddress: string;
    chainId: bigint | number;
    verifierId: string;
    credentialHash: string;
    fieldsHash: string;
    expiresAt: bigint | number;
    nonce: bigint | number;
  }
): Promise<{ digest: string; signature: string; consentId: string; user: string }> {
  const digest = buildGrantConsentDigest({
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    user: wallet.address,
    verifierId: params.verifierId,
    credentialHash: params.credentialHash,
    fieldsHash: params.fieldsHash,
    expiresAt: params.expiresAt,
    nonce: params.nonce,
  });
  const signature = await wallet.signMessage(ethers.getBytes(digest));
  const consentId = computeOnChainConsentId(
    wallet.address,
    params.verifierId,
    params.credentialHash
  );
  return { digest, signature, consentId, user: wallet.address };
}

// ============================================================================
// 4. REVOKE_CONSENT Digest & Signer
// Layout: keccak256(abi.encode("REVOKE_CONSENT", contractAddress, chainId, user, consentId, nonce))
// ============================================================================
export function buildRevokeConsentDigest(params: {
  contractAddress: string;
  chainId: bigint | number;
  user: string;
  consentId: string;
  nonce: bigint | number;
}): string {
  return ethers.keccak256(
    abiCoder.encode(
      ['string', 'address', 'uint256', 'address', 'bytes32', 'uint256'],
      [
        SELFID_ACTIONS.REVOKE_CONSENT,
        ethers.getAddress(params.contractAddress),
        BigInt(params.chainId),
        ethers.getAddress(params.user),
        toBytes32(params.consentId),
        BigInt(params.nonce),
      ]
    )
  );
}

export async function signRevokeConsent(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  params: {
    contractAddress: string;
    chainId: bigint | number;
    consentId: string;
    nonce: bigint | number;
  }
): Promise<{ digest: string; signature: string; user: string }> {
  const digest = buildRevokeConsentDigest({
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    user: wallet.address,
    consentId: params.consentId,
    nonce: params.nonce,
  });
  const signature = await wallet.signMessage(ethers.getBytes(digest));
  return { digest, signature, user: wallet.address };
}

// ============================================================================
// 5. Shared Info Presentation JSON Hash Signer & Verifier
// Contains ONLY the chosen fields + requestId, verifierId, documentFingerprint, issuedAt, expiresAt
// ============================================================================
export interface SharedInfoPresentation {
  requestId: string;
  verifierId: string;
  documentFingerprint: string;
  issuedAt: string;
  expiresAt: string;
  chosenFields: Array<{ key: string; label: string; value: string }>;
}

/**
 * Canonicalizes the SharedInfoPresentation JSON and returns its keccak256 hash (bytes32).
 */
export function hashSharedInfoPresentation(sharedInfo: SharedInfoPresentation): string {
  const canonical = JSON.stringify({
    requestId: sharedInfo.requestId,
    verifierId: sharedInfo.verifierId,
    documentFingerprint: toBytes32(sharedInfo.documentFingerprint),
    issuedAt: sharedInfo.issuedAt,
    expiresAt: sharedInfo.expiresAt,
    chosenFields: sharedInfo.chosenFields.map((f) => ({
      key: f.key,
      label: f.label,
      value: f.value,
    })),
  });
  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

/**
 * Browser helper: signs the keccak256 JSON hash of `sharedInfo` with the user's private key.
 */
export async function signSharedInfoPresentation(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  sharedInfo: SharedInfoPresentation
): Promise<{ jsonHash: string; signature: string }> {
  const jsonHash = hashSharedInfoPresentation(sharedInfo);
  const signature = await wallet.signMessage(ethers.getBytes(jsonHash));
  return { jsonHash, signature };
}

/**
 * Server helper: recovers the signer public key / address from the signed `sharedInfo` JSON hash
 * and checks that it matches the user's registered public key from the contract.
 */
export function verifySharedInfoSignature(
  sharedInfo: SharedInfoPresentation,
  signature: string,
  registeredPublicKeyOrAddress: string
): boolean {
  try {
    const jsonHash = hashSharedInfoPresentation(sharedInfo);
    const msgHash = ethers.hashMessage(ethers.getBytes(jsonHash));
    const recoveredPubKey = ethers.SigningKey.recoverPublicKey(msgHash, signature);
    const recoveredAddress = ethers.computeAddress(recoveredPubKey).toLowerCase();

    const target = registeredPublicKeyOrAddress.trim();
    if (target.startsWith('did:')) {
      const parts = target.split(':');
      const addr = parts[parts.length - 1].toLowerCase();
      return recoveredAddress === addr;
    }

    if (target.startsWith('0x') && target.length > 42) {
      return (
        recoveredPubKey.toLowerCase() === target.toLowerCase() ||
        recoveredAddress === ethers.computeAddress(target).toLowerCase()
      );
    }

    return recoveredAddress === target.toLowerCase();
  } catch {
    return false;
  }
}
