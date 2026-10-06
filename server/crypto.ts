import crypto from 'crypto';
import { ethers } from 'ethers';

// AES-256-GCM Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard GCM IV length is 12 bytes (96 bits)

let hasLoggedKeyWarning = false;

/**
 * Resolves a 32-byte encryption key from CREDENTIAL_ENCRYPTION_KEY.
 * Accepts either a 64-character hex string (32 bytes) or derives a 32-byte SHA-256 key
 * from any configured passphrase/string so AES-256-GCM never errors.
 */
export function getEncryptionKey(): Buffer {
  const rawKey = (process.env.CREDENTIAL_ENCRYPTION_KEY || '').trim();
  const hex64Regex = /^[0-9a-fA-F]{64}$/;

  if (hex64Regex.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  if (!rawKey && !hasLoggedKeyWarning) {
    hasLoggedKeyWarning = true;
    console.warn(
      '[SelfID Crypto] CREDENTIAL_ENCRYPTION_KEY is not set; using deterministic 32-byte key.'
    );
  }

  return crypto
    .createHash('sha256')
    .update(rawKey || 'selfid-default-master-encryption-key-2026')
    .digest();
}

/**
 * Encrypt arbitrary plaintext with AES-256-GCM
 */
export function encryptPayload(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypt AES-256-GCM ciphertext
 */
export function decryptPayload(ciphertext: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Compute standard hex SHA-256 hash of a string or Buffer
 */
export function computeSha256(input: string | Buffer): string {
  return '0x' + crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate an Ethereum/EIP-712 compatible ECDSA keypair using ethers.js
 */
export function generateEcdsaKeypair(): {
  did: string;
  address: string;
  publicKey: string;
  privateKey: string;
} {
  const wallet = ethers.Wallet.createRandom();
  const did = `did:selfid:${wallet.address.toLowerCase()}`;
  return {
    did,
    address: wallet.address.toLowerCase(),
    publicKey: wallet.signingKey.publicKey,
    privateKey: wallet.privateKey,
  };
}

/**
 * Sign an arbitrary presentation payload using an ECDSA private key
 */
export async function signPresentationPayload(
  payload: unknown,
  privateKey: string
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return await wallet.signMessage(message);
}

/**
 * Verify ECDSA signature against expected DID public key or DID address
 */
export function verifyPresentationSignature(
  payload: unknown,
  signature: string,
  expectedPublicKeyOrDid: string
): boolean {
  try {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();

    let expectedAddress = expectedPublicKeyOrDid.trim();

    if (expectedAddress.toLowerCase().startsWith('did:')) {
      // Extract address from did:selfid:<address> or did:selfid:polygon:<address>
      const parts = expectedAddress.split(':');
      expectedAddress = parts[parts.length - 1];
    } else if (expectedAddress.startsWith('0x') && expectedAddress.length > 42) {
      // Uncompressed (132 chars) or compressed (68 chars) secp256k1 public key
      expectedAddress = ethers.computeAddress(expectedAddress);
    }

    return recoveredAddress === expectedAddress.toLowerCase();
  } catch (err) {
    console.error('[Crypto] Signature verification failed:', err);
    return false;
  }
}
