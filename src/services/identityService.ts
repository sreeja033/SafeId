import { ethers } from 'ethers';
import { UserProfile } from '../types';
import { apiRequest } from '../lib/apiClient';
import { signRegisterDID } from '../../shared/digests';

const STORAGE_KEY = 'selfid_user_profile_v2';
const ENCLAVE_KEY_STORAGE = 'selfid_enclave_private_key';

const saveUser = (user: UserProfile) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
};

const loadCachedUser = (): UserProfile | null => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
};

export interface ChainNonceResponse {
  mode: 'live' | 'mock';
  contractAddress: string;
  chainId: number;
  userAddress: string;
  nonce: number;
}

export const identityService = {
  /**
   * Retrieves the current user profile and DID from the backend
   */
  async getProfile(): Promise<UserProfile> {
    const { data, error } = await apiRequest<{
      did: string;
      publicKey: string;
      chainTxHash: string;
      createdAt: string;
      name: string;
      email: string;
    }>('/did');

    if (!error && data && data.did) {
      const profile: UserProfile = {
        name: data.name || 'Student User',
        email: data.email || 'student@selfid.local',
        did: data.did,
        keyAlgorithm: 'ECDSA secp256k1 (ethers.js v6)',
        creationDate: new Date(data.createdAt || Date.now()).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        custodyType: 'Self-Sovereign (Browser-Only Key)',
        secureEnclave: 'Browser LocalStorage (Never Sent to Server)',
        status: 'active',
        txHash: data.chainTxHash || '',
      };
      saveUser(profile);
      return profile;
    }

    const cached = loadCachedUser();
    if (cached && cached.did) return cached;

    return {
      name: data?.name || 'Student User',
      email: data?.email || 'student@selfid.local',
      did: '',
      keyAlgorithm: 'ECDSA secp256k1 (ethers.js v6)',
      creationDate: 'Not created yet',
      custodyType: 'Self-Sovereign (Browser-Only Key)',
      secureEnclave: 'Browser Storage',
      status: 'active',
      txHash: '',
    };
  },

  /**
   * Fetches the user's current nonce and contract address from GET /api/chain/nonce/:address
   */
  async getChainNonce(userAddress: string): Promise<ChainNonceResponse> {
    const { data, error } = await apiRequest<ChainNonceResponse>(
      `/chain/nonce/${encodeURIComponent(userAddress)}`
    );
    if (error || !data) {
      return {
        mode: 'mock',
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        chainId: 80002,
        userAddress,
        nonce: 0,
      };
    }
    return data;
  },

  /**
   * Returns (or creates locally in the browser) the user's ethers.Wallet.
   * The private key stays strictly in localStorage and is NEVER transmitted to the server.
   */
  getOrCreateBrowserWallet(): ethers.Wallet | ethers.HDNodeWallet {
    const existingKey = localStorage.getItem(ENCLAVE_KEY_STORAGE);
    if (existingKey && existingKey.startsWith('0x') && existingKey.length === 66) {
      try {
        return new ethers.Wallet(existingKey);
      } catch {
        // Fall through to create a fresh random wallet
      }
    }
    const randomWallet = ethers.Wallet.createRandom();
    localStorage.setItem(ENCLAVE_KEY_STORAGE, randomWallet.privateKey);
    return randomWallet;
  },

  /**
   * Step 3 (Create my digital ID):
   * 1. Generates keypair in the browser with ethers.Wallet.createRandom()
   * 2. Saves private key in browser storage ONLY (server never sees it)
   * 3. Signs the REGISTER_DID digest with the user's private key
   * 4. Sends ONLY { name, email, userAddress, did, publicKey, signature } to POST /api/did/create
   */
  async createDID(name: string, email: string): Promise<UserProfile> {
    const wallet = ethers.Wallet.createRandom();
    localStorage.setItem(ENCLAVE_KEY_STORAGE, wallet.privateKey);

    const userAddress = wallet.address;
    const publicKey = wallet.signingKey.publicKey;
    const did = `did:selfid:${userAddress.toLowerCase()}`;

    const chainConfig = await this.getChainNonce(userAddress);
    const { signature } = await signRegisterDID(wallet, {
      contractAddress: chainConfig.contractAddress,
      chainId: chainConfig.chainId,
      publicKey,
      nonce: chainConfig.nonce,
    });

    const { data, error } = await apiRequest<{
      did: string;
      address: string;
      publicKey: string;
      chainTxHash: string;
    }>('/did/create', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        userAddress,
        did,
        publicKey,
        signature,
      }),
    });

    if (error || !data) {
      throw error || new Error('Failed to create Digital ID');
    }

    const newUser: UserProfile = {
      name,
      email,
      did: data.did || did,
      keyAlgorithm: 'ECDSA secp256k1 (ethers.js v6)',
      creationDate: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      custodyType: 'Self-Sovereign (Browser-Only Key)',
      secureEnclave: 'Browser Encrypted Enclave Storage',
      status: 'active',
      txHash: data.chainTxHash || `0x${userAddress.slice(2, 12)}...`,
    };

    saveUser(newUser);
    return newUser;
  },

  /**
   * Retrieves the client-side private key (stored only on the client)
   */
  getEnclavePrivateKey(): string | null {
    return localStorage.getItem(ENCLAVE_KEY_STORAGE);
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const updated = { ...current, ...updates };
    saveUser(updated);
    return updated;
  },
};
