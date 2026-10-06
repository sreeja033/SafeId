import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  signRegisterDID,
  signAnchorCredential,
  signGrantConsent,
  signRevokeConsent,
  computeVerifierIdHash,
  computeFieldsHash,
  toBytes32,
} from '../shared/digests';

describe('SelfID Smart Contract (Meta-Transaction Relayer Flow)', function () {
  async function deploySelfIDFixture() {
    const [relayer, otherAccount] = await ethers.getSigners();
    // Create a standalone user wallet (holds private key off-chain; zero ETH needed)
    const userWallet = ethers.Wallet.createRandom();

    const SelfIDFactory = await ethers.getContractFactory('SelfID', relayer);
    const selfId = await SelfIDFactory.deploy();
    await selfId.waitForDeployment();

    const contractAddress = await selfId.getAddress();
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    return { selfId, relayer, otherAccount, userWallet, contractAddress, chainId };
  }

  it('1. registers a DID using the user signature relayed by the relayer', async function () {
    const { selfId, userWallet, contractAddress, chainId } = await deploySelfIDFixture();

    const nonce = await selfId.nonces(userWallet.address);
    const { signature, publicKey } = await signRegisterDID(userWallet, {
      contractAddress,
      chainId,
      nonce,
    });

    await expect(selfId.registerDID(userWallet.address, publicKey, signature))
      .to.emit(selfId, 'DIDRegistered')
      .withArgs(userWallet.address, publicKey);

    const identity = await selfId.getIdentity(userWallet.address);
    expect(identity.exists).to.equal(true);
    expect(identity.publicKey).to.equal(publicKey);
    expect(await selfId.nonces(userWallet.address)).to.equal(1n);
  });

  it('2. anchors a credential fingerprint after DID registration and rejects duplicates', async function () {
    const { selfId, userWallet, contractAddress, chainId } = await deploySelfIDFixture();

    // Register DID (nonce 0)
    const regSig = await signRegisterDID(userWallet, {
      contractAddress,
      chainId,
      nonce: await selfId.nonces(userWallet.address),
    });
    await selfId.registerDID(userWallet.address, regSig.publicKey, regSig.signature);

    // Anchor Credential (nonce 1)
    const credentialHash = toBytes32('sample-college-id-fingerprint');
    const storageRef = 'enc://vault/user-1/doc-1';
    const anchorSig = await signAnchorCredential(userWallet, {
      contractAddress,
      chainId,
      credentialHash,
      storageRef,
      nonce: await selfId.nonces(userWallet.address),
    });

    await expect(
      selfId.anchorCredential(
        userWallet.address,
        credentialHash,
        storageRef,
        anchorSig.signature
      )
    )
      .to.emit(selfId, 'CredentialAnchored')
      .withArgs(userWallet.address, credentialHash, storageRef);

    const cred = await selfId.getCredential(credentialHash);
    expect(cred.exists).to.equal(true);
    expect(cred.owner).to.equal(userWallet.address);
    expect(cred.storageRef).to.equal(storageRef);
  });

  it('3. grants consent, verifies isConsentValid is true, revokes consent, and verifies revoked consent is invalid', async function () {
    const { selfId, userWallet, contractAddress, chainId } = await deploySelfIDFixture();

    // 1. Register DID
    const regSig = await signRegisterDID(userWallet, {
      contractAddress,
      chainId,
      nonce: await selfId.nonces(userWallet.address),
    });
    await selfId.registerDID(userWallet.address, regSig.publicKey, regSig.signature);

    // 2. Anchor Credential
    const credentialHash = toBytes32('cmrit-college-id-hash');
    const storageRef = 'enc://vault/user-1/cmrit';
    const anchorSig = await signAnchorCredential(userWallet, {
      contractAddress,
      chainId,
      credentialHash,
      storageRef,
      nonce: await selfId.nonces(userWallet.address),
    });
    await selfId.anchorCredential(
      userWallet.address,
      credentialHash,
      storageRef,
      anchorSig.signature
    );

    // 3. Grant Consent
    const verifierId = computeVerifierIdHash('VER-001');
    const fieldsHash = computeFieldsHash(['College / Institution', 'Full Legal Name']);
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 86400);

    const grantSig = await signGrantConsent(userWallet, {
      contractAddress,
      chainId,
      verifierId,
      credentialHash,
      fieldsHash,
      expiresAt,
      nonce: await selfId.nonces(userWallet.address),
    });

    await expect(
      selfId.grantConsent(
        userWallet.address,
        verifierId,
        credentialHash,
        fieldsHash,
        expiresAt,
        grantSig.signature
      )
    )
      .to.emit(selfId, 'ConsentGranted')
      .withArgs(
        grantSig.consentId,
        userWallet.address,
        verifierId,
        credentialHash,
        fieldsHash,
        expiresAt
      );

    expect(await selfId.isConsentValid(grantSig.consentId)).to.equal(true);

    // 4. Revoke Consent
    const revokeSig = await signRevokeConsent(userWallet, {
      contractAddress,
      chainId,
      consentId: grantSig.consentId,
      nonce: await selfId.nonces(userWallet.address),
    });

    await expect(
      selfId.revokeConsent(userWallet.address, grantSig.consentId, revokeSig.signature)
    )
      .to.emit(selfId, 'ConsentRevoked')
      .withArgs(grantSig.consentId, userWallet.address);

    // 5. Verify revoked consent is invalid
    expect(await selfId.isConsentValid(grantSig.consentId)).to.equal(false);
    const consentRecord = await selfId.getConsent(grantSig.consentId);
    expect(consentRecord.revoked).to.equal(true);
  });
});
