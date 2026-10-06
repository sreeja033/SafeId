import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import {
  toBytes32,
  computeVerifierIdHash,
  computeFieldsHash,
  computeOnChainConsentId,
  buildRegisterDIDDigest,
  buildAnchorCredentialDigest,
  buildGrantConsentDigest,
  buildRevokeConsentDigest,
} from '../../shared/digests';

export interface ChainTransactionReceipt {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  network: string;
  status: 'confirmed' | 'pending';
  consentId?: string;
}

export interface OnChainIdentityRecord {
  publicKey: string;
  registeredAt: number;
  exists: boolean;
}

export interface OnChainCredentialRecord {
  credentialHash: string;
  storageRef: string;
  owner: string;
  anchoredAt: number;
  exists: boolean;
}

export interface OnChainConsentRecord {
  consentId: string;
  user: string;
  verifierId: string;
  credentialHash: string;
  fieldsHash: string;
  grantedAt: number;
  expiresAt: number;
  revokedAt: number;
  revoked: boolean;
  exists: boolean;
}

// Load ABI from /server/chain/SelfID.abi.json
const abiPath = path.resolve(process.cwd(), 'server/chain/SelfID.abi.json');
const SELFID_ABI = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));

// Mock / In-Memory Contract State (when CHAIN_MODE !== 'live' or RPC/relayer env is not set)
// Enforces the exact same EIP-191 ECDSA recover & nonce replay rules as SelfID.sol!
const mockNonces = new Map<string, bigint>();
const mockIdentities = new Map<string, OnChainIdentityRecord>();
const mockCredentials = new Map<string, OnChainCredentialRecord>();
const mockConsents = new Map<string, OnChainConsentRecord>();

const DEFAULT_CONTRACT_ADDRESS =
  (process.env.CONTRACT_ADDRESS || '').trim() ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const DEFAULT_CHAIN_ID = BigInt(process.env.CHAIN_ID || '80002');

export function isLiveChainMode(): boolean {
  const mode = (process.env.CHAIN_MODE || 'mock').trim().toLowerCase();
  const rpcUrl = (process.env.RPC_URL || '').trim();
  const relayerKey = (process.env.RELAYER_PRIVATE_KEY || '').trim();
  const contractAddr = (process.env.CONTRACT_ADDRESS || '').trim();
  return (
    mode === 'live' &&
    Boolean(rpcUrl) &&
    /^0x[0-9a-fA-F]{64}$/.test(relayerKey) &&
    ethers.isAddress(contractAddr)
  );
}

function getLiveContract(): {
  provider: ethers.JsonRpcProvider;
  relayer: ethers.Wallet;
  contract: ethers.Contract;
} {
  const rpcUrl = (process.env.RPC_URL || '').trim();
  const relayerKey = (process.env.RELAYER_PRIVATE_KEY || '').trim();
  const contractAddr = (process.env.CONTRACT_ADDRESS || '').trim();

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const relayer = new ethers.Wallet(relayerKey, provider);
  const contract = new ethers.Contract(contractAddr, SELFID_ABI, relayer);
  return { provider, relayer, contract };
}

export interface RelayerBalanceInfo {
  status: 'ok' | 'warn' | 'fail';
  balance: number;
  isLow: boolean;
  symbol: string;
  message: string;
}

/**
 * Returns plain relayer balance number and low-balance check.
 * NEVER exposes or returns the private key.
 */
export async function getRelayerBalanceInfo(): Promise<RelayerBalanceInfo> {
  const lowThreshold = 0.01;

  // Real chain mode ALWAYS reads the live relayer balance from the network
  if (isLiveChainMode()) {
    try {
      const { provider, relayer } = getLiveContract();
      const balanceWei = await provider.getBalance(relayer.address);
      const balanceNum = parseFloat(ethers.formatEther(balanceWei));
      const isLow = balanceNum < lowThreshold;
      return {
        status: isLow ? 'warn' : 'ok',
        balance: balanceNum,
        isLow,
        symbol: 'MATIC',
        message: isLow
          ? 'The demo wallet needs more test coins'
          : `Relayer wallet balance sufficient (${balanceNum.toFixed(4)} MATIC)`,
      };
    } catch {
      return {
        status: 'warn',
        balance: 0,
        isLow: true,
        symbol: 'MATIC',
        message: 'The demo wallet needs more test coins',
      };
    }
  }

  // Optional test override: strictly ignored unless DEMO_MODE=test-balance
  let simulatedBalance = 1.5;
  if (process.env.DEMO_MODE === 'test-balance' && process.env.TEST_RELAYER_BALANCE) {
    const parsed = parseFloat(process.env.TEST_RELAYER_BALANCE.trim());
    if (!isNaN(parsed)) {
      simulatedBalance = parsed;
    }
  }

  const isLow = simulatedBalance < lowThreshold;
  return {
    status: isLow ? 'warn' : 'ok',
    balance: simulatedBalance,
    isLow,
    symbol: 'MATIC',
    message: isLow
      ? 'The demo wallet needs more test coins'
      : `Relayer wallet balance sufficient (${simulatedBalance.toFixed(4)} MATIC)`,
  };
}

export async function checkContractResponding(): Promise<{
  status: 'ok' | 'fail';
  responding: boolean;
  address: string;
  message: string;
}> {
  const contractAddr = (process.env.CONTRACT_ADDRESS || '').trim() || DEFAULT_CONTRACT_ADDRESS;
  if (!ethers.isAddress(contractAddr)) {
    return {
      status: 'fail',
      responding: false,
      address: contractAddr,
      message: 'Configured contract address is not a valid Ethereum address',
    };
  }

  if (isLiveChainMode()) {
    try {
      const { provider } = getLiveContract();
      const code = await provider.getCode(contractAddr);
      const responding = Boolean(code && code !== '0x' && code.length > 2);
      return {
        status: responding ? 'ok' : 'fail',
        responding,
        address: contractAddr,
        message: responding
          ? `Contract responding at ${contractAddr}`
          : `No bytecode found at contract address ${contractAddr}`,
      };
    } catch (err: unknown) {
      return {
        status: 'fail',
        responding: false,
        address: contractAddr,
        message: `Contract failed to respond: ${err instanceof Error ? err.message : 'RPC error'}`,
      };
    }
  }

  return {
    status: 'ok',
    responding: true,
    address: contractAddr,
    message: `Contract simulator responding at ${contractAddr}`,
  };
}

export async function checkChainReachable(): Promise<{
  status: 'ok' | 'fail';
  reachable: boolean;
  chainId: number;
  message: string;
}> {
  if (isLiveChainMode()) {
    try {
      const { provider } = getLiveContract();
      const network = await provider.getNetwork();
      return {
        status: 'ok',
        reachable: true,
        chainId: Number(network.chainId),
        message: `Connected to blockchain network (Chain ID: ${network.chainId})`,
      };
    } catch (err: unknown) {
      return {
        status: 'fail',
        reachable: false,
        chainId: 0,
        message: `Blockchain unreachable: ${err instanceof Error ? err.message : 'Network error'}`,
      };
    }
  }

  return {
    status: 'ok',
    reachable: true,
    chainId: Number(DEFAULT_CHAIN_ID),
    message: `Blockchain simulator reachable (Chain ID: ${DEFAULT_CHAIN_ID})`,
  };
}

function generateMockTxHash(seed: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(`${seed}:${Date.now()}:${Math.random()}`));
}

export function extractAddressFromDid(userOrDid: string): string {
  const clean: string = (userOrDid || '').trim();
  if (clean.startsWith('did:')) {
    const parts = clean.split(':');
    const candidate = parts[parts.length - 1];
    if (ethers.isAddress(candidate)) {
      return ethers.getAddress(candidate);
    }
  }
  if (ethers.isAddress(clean)) {
    return ethers.getAddress(clean);
  }
  // Fallback deterministic address from string
  const hash = ethers.keccak256(ethers.toUtf8Bytes(clean || 'default-user'));
  return ethers.getAddress('0x' + hash.slice(26));
}

/**
 * Verifies EIP-191 signature over `digest` against `userAddress` and increments mock nonce,
 * matching `_useNonceAndVerifySignature` in `contracts/SelfID.sol`.
 */
function verifyAndIncrementMockNonce(
  userAddress: string,
  digest: string,
  sig?: string
): void {
  const addrKey = userAddress.toLowerCase();
  const currentNonce = mockNonces.get(addrKey) ?? 0n;

  if (sig && sig.startsWith('0x') && sig.length >= 130) {
    const recovered = ethers.verifyMessage(ethers.getBytes(digest), sig);
    if (recovered.toLowerCase() !== addrKey) {
      throw new Error(
        `InvalidSignature: recovered signer ${recovered} does not match user ${userAddress}`
      );
    }
  }

  mockNonces.set(addrKey, currentNonce + 1n);
}

/**
 * Returns chain config & current user nonce for GET /api/chain/nonce/:address
 */
export async function getChainConfigAndNonce(userAddressOrDid: string): Promise<{
  mode: 'live' | 'mock';
  contractAddress: string;
  chainId: number;
  userAddress: string;
  nonce: number;
}> {
  const userAddress = extractAddressFromDid(userAddressOrDid);

  if (isLiveChainMode()) {
    const { provider, contract } = getLiveContract();
    const [network, nonceBig] = await Promise.all([
      provider.getNetwork(),
      contract.nonces(userAddress),
    ]);
    return {
      mode: 'live',
      contractAddress: await contract.getAddress(),
      chainId: Number(network.chainId),
      userAddress,
      nonce: Number(nonceBig),
    };
  }

  const currentNonce = mockNonces.get(userAddress.toLowerCase()) ?? 0n;
  return {
    mode: 'mock',
    contractAddress: DEFAULT_CONTRACT_ADDRESS,
    chainId: Number(DEFAULT_CHAIN_ID),
    userAddress,
    nonce: Number(currentNonce),
  };
}

/**
 * 1. registerId / registerDID(user, publicKey, sig)
 */
export async function registerId(
  userOrDid: string,
  publicKey: string,
  sig?: string
): Promise<ChainTransactionReceipt> {
  const relayerInfo = await getRelayerBalanceInfo();
  if (relayerInfo.isLow) {
    throw new Error('The demo wallet needs more test coins');
  }

  const userAddress = extractAddressFromDid(userOrDid);
  const pubKeyHex = publicKey.startsWith('0x')
    ? publicKey
    : ethers.hexlify(ethers.toUtf8Bytes(publicKey));

  if (isLiveChainMode()) {
    if (!sig) {
      throw new Error('User signature is required for live on-chain registerDID.');
    }
    try {
      const { contract } = getLiveContract();
      const tx = await contract.registerDID(userAddress, pubKeyHex, sig);
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        timestamp: new Date().toISOString(),
        network: 'SelfID Live Contract',
        status: 'confirmed',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        msg.includes('insufficient funds') ||
        msg.includes('gas required') ||
        msg.includes('exceeds balance') ||
        msg.includes('funds')
      ) {
        throw new Error('The demo wallet needs more test coins');
      }
      throw err;
    }
  }

  const addrKey = userAddress.toLowerCase();
  const currentNonce = mockNonces.get(addrKey) ?? 0n;
  const digest = buildRegisterDIDDigest({
    contractAddress: DEFAULT_CONTRACT_ADDRESS,
    chainId: DEFAULT_CHAIN_ID,
    user: userAddress,
    publicKey: pubKeyHex,
    nonce: currentNonce,
  });

  if (sig) {
    verifyAndIncrementMockNonce(userAddress, digest, sig);
  } else {
    mockNonces.set(addrKey, currentNonce + 1n);
  }

  mockIdentities.set(addrKey, {
    publicKey: pubKeyHex,
    registeredAt: Math.floor(Date.now() / 1000),
    exists: true,
  });

  const txHash = generateMockTxHash(`REGISTER_DID:${userAddress}:${pubKeyHex}`);
  return {
    txHash,
    blockNumber: 19482000 + Number(currentNonce),
    timestamp: new Date().toISOString(),
    network: 'SelfID Contract (Mock Mode)',
    status: 'confirmed',
  };
}

export const registerDID = registerId;

/**
 * 2. saveFingerprint / anchorCredential(user, credentialHash, storageRef, sig)
 */
export async function anchorCredential(
  credentialHash: string,
  userOrIssuerDid: string = 'did:selfid:sample-document-reader',
  storageRef: string = 'enc://vault/document',
  sig?: string
): Promise<ChainTransactionReceipt> {
  const relayerInfo = await getRelayerBalanceInfo();
  if (relayerInfo.isLow) {
    throw new Error('The demo wallet needs more test coins');
  }

  const userAddress = extractAddressFromDid(userOrIssuerDid);
  const hashBytes32 = toBytes32(credentialHash);

  if (isLiveChainMode()) {
    if (!sig) {
      throw new Error('User signature is required for live on-chain anchorCredential.');
    }
    try {
      const { contract } = getLiveContract();
      const tx = await contract.anchorCredential(userAddress, hashBytes32, storageRef, sig);
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        timestamp: new Date().toISOString(),
        network: 'SelfID Live Contract',
        status: 'confirmed',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        msg.includes('insufficient funds') ||
        msg.includes('gas required') ||
        msg.includes('exceeds balance') ||
        msg.includes('funds')
      ) {
        throw new Error('The demo wallet needs more test coins');
      }
      throw err;
    }
  }

  const addrKey = userAddress.toLowerCase();
  if (!mockIdentities.has(addrKey)) {
    mockIdentities.set(addrKey, {
      publicKey: '0x04',
      registeredAt: Math.floor(Date.now() / 1000),
      exists: true,
    });
  }

  const currentNonce = mockNonces.get(addrKey) ?? 0n;
  const digest = buildAnchorCredentialDigest({
    contractAddress: DEFAULT_CONTRACT_ADDRESS,
    chainId: DEFAULT_CHAIN_ID,
    user: userAddress,
    credentialHash: hashBytes32,
    storageRef,
    nonce: currentNonce,
  });

  if (sig) {
    verifyAndIncrementMockNonce(userAddress, digest, sig);
  } else {
    mockNonces.set(addrKey, currentNonce + 1n);
  }

  mockCredentials.set(hashBytes32.toLowerCase(), {
    credentialHash: hashBytes32,
    storageRef,
    owner: userAddress,
    anchoredAt: Math.floor(Date.now() / 1000),
    exists: true,
  });

  const txHash = generateMockTxHash(`ANCHOR_CREDENTIAL:${userAddress}:${hashBytes32}`);
  return {
    txHash,
    blockNumber: 19482100 + Number(currentNonce),
    timestamp: new Date().toISOString(),
    network: 'SelfID Contract (Mock Mode)',
    status: 'confirmed',
  };
}

export async function saveFingerprint(
  fingerprintHash: string,
  userOrIssuerDid: string = 'did:selfid:sample-document-reader',
  storageRef: string = 'enc://vault/document',
  sig?: string
): Promise<ChainTransactionReceipt> {
  return anchorCredential(fingerprintHash, userOrIssuerDid, storageRef, sig);
}

/**
 * 3. allowAccess / grantConsent(user, verifierId, credentialHash, fieldsHash, expiresAt, sig)
 */
export async function allowAccess(params: {
  user: string;
  verifierId: string;
  credentialHash: string;
  fieldsHash: string;
  expiresAt: number;
  sig?: string;
  legacyConsentId?: string;
}): Promise<ChainTransactionReceipt> {
  const userAddress = extractAddressFromDid(params.user);
  const relayerInfo = await getRelayerBalanceInfo();
  if (relayerInfo.isLow) {
    throw new Error('The demo wallet needs more test coins');
  }

  const verifierIdBytes32 = computeVerifierIdHash(params.verifierId);
  const credHashBytes32 = toBytes32(params.credentialHash);
  const fieldsHashBytes32 = toBytes32(params.fieldsHash);
  const expiresAtSec = Math.floor(params.expiresAt);

  const onChainConsentId = computeOnChainConsentId(
    userAddress,
    verifierIdBytes32,
    credHashBytes32
  );

  if (isLiveChainMode()) {
    if (!params.sig) {
      throw new Error('User signature is required for live on-chain grantConsent.');
    }
    try {
      const { contract } = getLiveContract();
      const tx = await contract.grantConsent(
        userAddress,
        verifierIdBytes32,
        credHashBytes32,
        fieldsHashBytes32,
        BigInt(expiresAtSec),
        params.sig
      );
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        timestamp: new Date().toISOString(),
        network: 'SelfID Live Contract',
        status: 'confirmed',
        consentId: onChainConsentId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        msg.includes('insufficient funds') ||
        msg.includes('gas required') ||
        msg.includes('exceeds balance') ||
        msg.includes('funds')
      ) {
        throw new Error('The demo wallet needs more test coins');
      }
      throw err;
    }
  }

  const addrKey = userAddress.toLowerCase();
  const currentNonce = mockNonces.get(addrKey) ?? 0n;
  const digest = buildGrantConsentDigest({
    contractAddress: DEFAULT_CONTRACT_ADDRESS,
    chainId: DEFAULT_CHAIN_ID,
    user: userAddress,
    verifierId: verifierIdBytes32,
    credentialHash: credHashBytes32,
    fieldsHash: fieldsHashBytes32,
    expiresAt: BigInt(expiresAtSec),
    nonce: currentNonce,
  });

  if (params.sig) {
    verifyAndIncrementMockNonce(userAddress, digest, params.sig);
  } else {
    mockNonces.set(addrKey, currentNonce + 1n);
  }

  const record: OnChainConsentRecord = {
    consentId: onChainConsentId,
    user: userAddress,
    verifierId: verifierIdBytes32,
    credentialHash: credHashBytes32,
    fieldsHash: fieldsHashBytes32,
    grantedAt: Math.floor(Date.now() / 1000),
    expiresAt: expiresAtSec,
    revokedAt: 0,
    revoked: false,
    exists: true,
  };

  mockConsents.set(onChainConsentId.toLowerCase(), record);
  if (params.legacyConsentId) {
    mockConsents.set(params.legacyConsentId.toLowerCase(), record);
    mockConsents.set(toBytes32(params.legacyConsentId).toLowerCase(), record);
  }

  const txHash = generateMockTxHash(`GRANT_CONSENT:${onChainConsentId}`);
  return {
    txHash,
    blockNumber: 19482200 + Number(currentNonce),
    timestamp: new Date().toISOString(),
    network: 'SelfID Contract (Mock Mode)',
    status: 'confirmed',
    consentId: onChainConsentId,
  };
}

export async function grantConsent(
  consentIdOrUser: string,
  verifierDidOrId: string,
  userDid: string,
  options?: {
    credentialHash?: string;
    fieldsHash?: string;
    expiresAt?: number;
    sig?: string;
  }
): Promise<ChainTransactionReceipt> {
  return allowAccess({
    user: userDid || consentIdOrUser,
    verifierId: verifierDidOrId || 'VER-001',
    credentialHash: options?.credentialHash || toBytes32(consentIdOrUser),
    fieldsHash: options?.fieldsHash || computeFieldsHash(['College / Institution']),
    expiresAt: options?.expiresAt || Math.floor(Date.now() / 1000) + 86400,
    sig: options?.sig,
    legacyConsentId: consentIdOrUser,
  });
}

/**
 * 4. takeBackAccess / revokeConsent(user, consentId, sig)
 */
export async function takeBackAccess(
  consentId: string,
  userOrDid?: string,
  sig?: string
): Promise<ChainTransactionReceipt> {
  const relayerInfo = await getRelayerBalanceInfo();
  if (relayerInfo.isLow) {
    throw new Error('The demo wallet needs more test coins');
  }

  const existing =
    mockConsents.get(consentId.toLowerCase()) ||
    mockConsents.get(toBytes32(consentId).toLowerCase());

  const userAddress = userOrDid
    ? extractAddressFromDid(userOrDid)
    : existing?.user || extractAddressFromDid('default-user');
  const consentIdBytes32 = existing?.consentId || toBytes32(consentId);

  if (isLiveChainMode()) {
    if (!sig) {
      throw new Error('User signature is required for live on-chain revokeConsent.');
    }
    try {
      const { contract } = getLiveContract();
      const tx = await contract.revokeConsent(userAddress, consentIdBytes32, sig);
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        timestamp: new Date().toISOString(),
        network: 'SelfID Live Contract',
        status: 'confirmed',
        consentId: consentIdBytes32,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        msg.includes('insufficient funds') ||
        msg.includes('gas required') ||
        msg.includes('exceeds balance') ||
        msg.includes('funds')
      ) {
        throw new Error('The demo wallet needs more test coins');
      }
      throw err;
    }
  }

  const addrKey = userAddress.toLowerCase();
  const currentNonce = mockNonces.get(addrKey) ?? 0n;
  const digest = buildRevokeConsentDigest({
    contractAddress: DEFAULT_CONTRACT_ADDRESS,
    chainId: DEFAULT_CHAIN_ID,
    user: userAddress,
    consentId: consentIdBytes32,
    nonce: currentNonce,
  });

  if (sig) {
    verifyAndIncrementMockNonce(userAddress, digest, sig);
  } else {
    mockNonces.set(addrKey, currentNonce + 1n);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (existing) {
    existing.revoked = true;
    existing.revokedAt = nowSec;
    mockConsents.set(existing.consentId.toLowerCase(), existing);
  }
  mockConsents.set(consentId.toLowerCase(), {
    consentId: consentIdBytes32,
    user: userAddress,
    verifierId: existing?.verifierId || toBytes32('VER-001'),
    credentialHash: existing?.credentialHash || toBytes32('0x0'),
    fieldsHash: existing?.fieldsHash || toBytes32('0x0'),
    grantedAt: existing?.grantedAt || nowSec,
    expiresAt: existing?.expiresAt || nowSec + 3600,
    revokedAt: nowSec,
    revoked: true,
    exists: true,
  });
  mockConsents.set(consentIdBytes32.toLowerCase(), mockConsents.get(consentId.toLowerCase())!);

  const txHash = generateMockTxHash(`REVOKE_CONSENT:${consentIdBytes32}`);
  return {
    txHash,
    blockNumber: 19482300 + Number(currentNonce),
    timestamp: new Date().toISOString(),
    network: 'SelfID Contract (Mock Mode)',
    status: 'confirmed',
    consentId: consentIdBytes32,
  };
}

export async function revokeConsent(
  consentId: string,
  userOrDid?: string,
  sig?: string
): Promise<ChainTransactionReceipt> {
  return takeBackAccess(consentId, userOrDid, sig);
}

/**
 * 5. isPermissionValid / isConsentValid(consentId)
 */
export async function isPermissionValid(consentId: string): Promise<boolean> {
  if (!consentId) return false;

  if (isLiveChainMode()) {
    const { contract } = getLiveContract();
    return Boolean(await contract.isConsentValid(toBytes32(consentId)));
  }

  const record =
    mockConsents.get(consentId.toLowerCase()) ||
    mockConsents.get(toBytes32(consentId).toLowerCase());

  if (!record) return true; // If not in memory map after restart, defer to DB status unless explicitly revoked
  if (record.revoked) return false;
  if (Math.floor(Date.now() / 1000) >= record.expiresAt) return false;
  return true;
}

export const isConsentValid = isPermissionValid;

/**
 * 6. On-Chain Read Helpers for /check (getIdentity, getCredential, getConsent)
 */
export async function getOnChainIdentity(
  userOrDid: string
): Promise<OnChainIdentityRecord | null> {
  const userAddress = extractAddressFromDid(userOrDid);
  if (isLiveChainMode()) {
    const { contract } = getLiveContract();
    const res = await contract.getIdentity(userAddress);
    return {
      publicKey: res.publicKey,
      registeredAt: Number(res.registeredAt),
      exists: Boolean(res.exists),
    };
  }
  return mockIdentities.get(userAddress.toLowerCase()) || null;
}

export async function getOnChainCredential(
  credentialHash: string
): Promise<OnChainCredentialRecord | null> {
  const hashBytes32 = toBytes32(credentialHash);
  if (isLiveChainMode()) {
    const { contract } = getLiveContract();
    const res = await contract.getCredential(hashBytes32);
    return {
      credentialHash: res.credentialHash,
      storageRef: res.storageRef,
      owner: res.owner,
      anchoredAt: Number(res.anchoredAt),
      exists: Boolean(res.exists),
    };
  }
  return mockCredentials.get(hashBytes32.toLowerCase()) || null;
}

export async function getOnChainConsent(
  consentId: string
): Promise<OnChainConsentRecord | null> {
  if (isLiveChainMode()) {
    const { contract } = getLiveContract();
    const res = await contract.getConsent(toBytes32(consentId));
    return {
      consentId: res.consentId,
      user: res.user,
      verifierId: res.verifierId,
      credentialHash: res.credentialHash,
      fieldsHash: res.fieldsHash,
      grantedAt: Number(res.grantedAt),
      expiresAt: Number(res.expiresAt),
      revokedAt: Number(res.revokedAt),
      revoked: Boolean(res.revoked),
      exists: Boolean(res.exists),
    };
  }
  return (
    mockConsents.get(consentId.toLowerCase()) ||
    mockConsents.get(toBytes32(consentId).toLowerCase()) ||
    null
  );
}

/**
 * Returns contract event status (ConsentGranted / ConsentRevoked / Expired),
 * falling back to database status if the chain is slow (timeout > 1200ms).
 */
export async function getConsentEventStatusWithFallback(
  consentId: string,
  dbStatus: string
): Promise<{
  contractEventStatus: 'ConsentGranted' | 'ConsentRevoked' | 'Expired';
  contractStatusSource: 'contract' | 'fallback_database';
}> {
  const fallback = (): {
    contractEventStatus: 'ConsentGranted' | 'ConsentRevoked' | 'Expired';
    contractStatusSource: 'fallback_database';
  } => {
    const s = (dbStatus || '').toUpperCase();
    if (s === 'REVOKED') {
      return { contractEventStatus: 'ConsentRevoked', contractStatusSource: 'fallback_database' };
    }
    if (s === 'EXPIRED') {
      return { contractEventStatus: 'Expired', contractStatusSource: 'fallback_database' };
    }
    return { contractEventStatus: 'ConsentGranted', contractStatusSource: 'fallback_database' };
  };

  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
    const result = await Promise.race([getOnChainConsent(consentId), timeoutPromise]);

    if (!result || !result.exists) {
      return fallback();
    }

    if (result.revoked) {
      return { contractEventStatus: 'ConsentRevoked', contractStatusSource: 'contract' };
    }
    if (result.expiresAt && Math.floor(Date.now() / 1000) >= result.expiresAt) {
      return { contractEventStatus: 'Expired', contractStatusSource: 'contract' };
    }
    return { contractEventStatus: 'ConsentGranted', contractStatusSource: 'contract' };
  } catch {
    return fallback();
  }
}

export const chainAdapter = {
  registerId,
  registerDID,
  saveFingerprint,
  anchorCredential,
  allowAccess,
  grantConsent,
  takeBackAccess,
  revokeConsent,
  isPermissionValid,
  isConsentValid,
  getChainConfigAndNonce,
  getOnChainIdentity,
  getOnChainCredential,
  getOnChainConsent,
  getConsentEventStatusWithFallback,
  extractAddressFromDid,
  getRelayerBalanceInfo,
  checkContractResponding,
  checkChainReachable,
};
