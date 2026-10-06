// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SelfID
 * @notice Sovereign Identity, Document Fingerprint Anchoring & Selective Disclosure Consent Registry.
 * @dev Gasless meta-transaction design: a relayer wallet pays gas and submits transactions,
 *      while every state-changing action carries an EIP-191 signature produced by the user's own key.
 *      No personal data is ever stored on-chain (only cryptographic hashes, IDs, and encrypted vault references).
 *      Compiles in Remix with Solidity 0.8.24 and Optimizer enabled.
 */
contract SelfID {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // =========================================================================
    // Custom Errors
    // =========================================================================
    error InvalidUserAddress();
    error InvalidSignature();
    error DIDAlreadyRegistered(address user);
    error DIDNotRegistered(address user);
    error EmptyPublicKey();
    error InvalidCredentialHash();
    error CredentialAlreadyAnchored(bytes32 credentialHash);
    error NotCredentialOwner(address user, bytes32 credentialHash);
    error InvalidVerifierId();
    error InvalidFieldsHash();
    error InvalidExpirationTime(uint64 expiresAt);
    error ConsentNotFound(bytes32 consentId);
    error NotConsentOwner(address user, bytes32 consentId);
    error ConsentAlreadyRevoked(bytes32 consentId);

    // =========================================================================
    // Action Constants for Signed Message Layouts
    // =========================================================================
    string public constant ACTION_REGISTER_DID = "REGISTER_DID";
    string public constant ACTION_ANCHOR_CREDENTIAL = "ANCHOR_CREDENTIAL";
    string public constant ACTION_GRANT_CONSENT = "GRANT_CONSENT";
    string public constant ACTION_REVOKE_CONSENT = "REVOKE_CONSENT";

    // =========================================================================
    // Structs (No personal data on-chain)
    // =========================================================================
    struct IdentityRecord {
        bytes publicKey;
        uint64 registeredAt;
        bool exists;
    }

    struct CredentialRecord {
        bytes32 credentialHash;
        string storageRef;
        address owner;
        uint64 anchoredAt;
        bool exists;
    }

    struct ConsentRecord {
        bytes32 consentId;
        address user;
        bytes32 verifierId;
        bytes32 credentialHash;
        bytes32 fieldsHash;
        uint64 grantedAt;
        uint64 expiresAt;
        uint64 revokedAt;
        bool revoked;
        bool exists;
    }

    // =========================================================================
    // State Storage
    // =========================================================================
    mapping(address => uint256) public nonces;
    mapping(address => IdentityRecord) private _identities;
    mapping(bytes32 => CredentialRecord) private _credentials;
    mapping(bytes32 => ConsentRecord) private _consents;

    // =========================================================================
    // Events
    // =========================================================================
    event DIDRegistered(address indexed user, bytes publicKey);
    event CredentialAnchored(
        address indexed user,
        bytes32 indexed credentialHash,
        string storageRef
    );
    event ConsentGranted(
        bytes32 indexed consentId,
        address indexed user,
        bytes32 indexed verifierId,
        bytes32 credentialHash,
        bytes32 fieldsHash,
        uint64 expiresAt
    );
    event ConsentRevoked(bytes32 indexed consentId, address indexed user);

    // =========================================================================
    // Internal Signature & Nonce Verification Helper
    // =========================================================================
    /**
     * @dev Verifies an EIP-191 personal_sign signature over `structHash` against `user`,
     *      then increments `nonces[user]` to prevent replay attacks.
     */
    function _useNonceAndVerifySignature(
        address user,
        bytes32 structHash,
        bytes calldata sig
    ) internal {
        if (user == address(0)) revert InvalidUserAddress();
        bytes32 ethSignedHash = structHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(sig);
        if (signer != user) revert InvalidSignature();
        unchecked {
            nonces[user]++;
        }
    }

    // =========================================================================
    // 1. registerDID
    // =========================================================================
    /**
     * @notice Registers a user's public key once.
     * @dev Exact Signed Message Layout:
     *      digest = keccak256(
     *          abi.encode(
     *              "REGISTER_DID",
     *              address(this),
     *              block.chainid,
     *              user,
     *              keccak256(publicKey),
     *              nonces[user]
     *          )
     *      )
     *      sig = EIP-191 personal_sign(digest)
     */
    function registerDID(
        address user,
        bytes calldata publicKey,
        bytes calldata sig
    ) external {
        if (_identities[user].exists) revert DIDAlreadyRegistered(user);
        if (publicKey.length == 0) revert EmptyPublicKey();

        uint256 currentNonce = nonces[user];
        bytes32 structHash = keccak256(
            abi.encode(
                ACTION_REGISTER_DID,
                address(this),
                block.chainid,
                user,
                keccak256(publicKey),
                currentNonce
            )
        );

        _useNonceAndVerifySignature(user, structHash, sig);

        _identities[user] = IdentityRecord({
            publicKey: publicKey,
            registeredAt: uint64(block.timestamp),
            exists: true
        });

        emit DIDRegistered(user, publicKey);
    }

    // =========================================================================
    // 2. anchorCredential
    // =========================================================================
    /**
     * @notice Anchors a document's SHA-256 fingerprint on-chain.
     * @dev Exact Signed Message Layout:
     *      digest = keccak256(
     *          abi.encode(
     *              "ANCHOR_CREDENTIAL",
     *              address(this),
     *              block.chainid,
     *              user,
     *              credentialHash,
     *              keccak256(bytes(storageRef)),
     *              nonces[user]
     *          )
     *      )
     *      sig = EIP-191 personal_sign(digest)
     */
    function anchorCredential(
        address user,
        bytes32 credentialHash,
        string calldata storageRef,
        bytes calldata sig
    ) external {
        if (!_identities[user].exists) revert DIDNotRegistered(user);
        if (credentialHash == bytes32(0)) revert InvalidCredentialHash();
        if (_credentials[credentialHash].exists) {
            revert CredentialAlreadyAnchored(credentialHash);
        }

        uint256 currentNonce = nonces[user];
        bytes32 structHash = keccak256(
            abi.encode(
                ACTION_ANCHOR_CREDENTIAL,
                address(this),
                block.chainid,
                user,
                credentialHash,
                keccak256(bytes(storageRef)),
                currentNonce
            )
        );

        _useNonceAndVerifySignature(user, structHash, sig);

        _credentials[credentialHash] = CredentialRecord({
            credentialHash: credentialHash,
            storageRef: storageRef,
            owner: user,
            anchoredAt: uint64(block.timestamp),
            exists: true
        });

        emit CredentialAnchored(user, credentialHash, storageRef);
    }

    // =========================================================================
    // 3. grantConsent
    // =========================================================================
    /**
     * @notice Grants selective disclosure consent to a verifier for a specific credential and field set.
     * @dev verifierId = keccak256(bytes(verifierCode)) e.g. keccak256("VER-001").
     *      consentId  = keccak256(abi.encode(user, verifierId, credentialHash)).
     *      Exact Signed Message Layout:
     *      digest = keccak256(
     *          abi.encode(
     *              "GRANT_CONSENT",
     *              address(this),
     *              block.chainid,
     *              user,
     *              verifierId,
     *              credentialHash,
     *              fieldsHash,
     *              expiresAt,
     *              nonces[user]
     *          )
     *      )
     *      sig = EIP-191 personal_sign(digest)
     */
    function grantConsent(
        address user,
        bytes32 verifierId,
        bytes32 credentialHash,
        bytes32 fieldsHash,
        uint64 expiresAt,
        bytes calldata sig
    ) external returns (bytes32 consentId) {
        if (!_identities[user].exists) revert DIDNotRegistered(user);
        CredentialRecord storage cred = _credentials[credentialHash];
        if (!cred.exists || cred.owner != user) {
            revert NotCredentialOwner(user, credentialHash);
        }
        if (verifierId == bytes32(0)) revert InvalidVerifierId();
        if (fieldsHash == bytes32(0)) revert InvalidFieldsHash();
        if (expiresAt <= uint64(block.timestamp)) {
            revert InvalidExpirationTime(expiresAt);
        }

        bytes32 structHash = _buildGrantConsentStructHash(
            user,
            verifierId,
            credentialHash,
            fieldsHash,
            expiresAt,
            nonces[user]
        );

        _useNonceAndVerifySignature(user, structHash, sig);

        consentId = computeConsentId(user, verifierId, credentialHash);

        _consents[consentId] = ConsentRecord({
            consentId: consentId,
            user: user,
            verifierId: verifierId,
            credentialHash: credentialHash,
            fieldsHash: fieldsHash,
            grantedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revokedAt: 0,
            revoked: false,
            exists: true
        });

        emit ConsentGranted(
            consentId,
            user,
            verifierId,
            credentialHash,
            fieldsHash,
            expiresAt
        );
    }

    /**
     * @dev Internal helper to avoid stack-too-deep in grantConsent
     */
    function _buildGrantConsentStructHash(
        address user,
        bytes32 verifierId,
        bytes32 credentialHash,
        bytes32 fieldsHash,
        uint64 expiresAt,
        uint256 currentNonce
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ACTION_GRANT_CONSENT,
                    address(this),
                    block.chainid,
                    user,
                    verifierId,
                    credentialHash,
                    fieldsHash,
                    expiresAt,
                    currentNonce
                )
            );
    }

    // =========================================================================
    // 4. revokeConsent
    // =========================================================================
    /**
     * @notice Revokes an existing consent. Only the consent's user may revoke via signature.
     * @dev Exact Signed Message Layout:
     *      digest = keccak256(
     *          abi.encode(
     *              "REVOKE_CONSENT",
     *              address(this),
     *              block.chainid,
     *              user,
     *              consentId,
     *              nonces[user]
     *          )
     *      )
     *      sig = EIP-191 personal_sign(digest)
     */
    function revokeConsent(
        address user,
        bytes32 consentId,
        bytes calldata sig
    ) external {
        ConsentRecord storage consent = _consents[consentId];
        if (!consent.exists) revert ConsentNotFound(consentId);
        if (consent.user != user) revert NotConsentOwner(user, consentId);
        if (consent.revoked) revert ConsentAlreadyRevoked(consentId);

        uint256 currentNonce = nonces[user];
        bytes32 structHash = keccak256(
            abi.encode(
                ACTION_REVOKE_CONSENT,
                address(this),
                block.chainid,
                user,
                consentId,
                currentNonce
            )
        );

        _useNonceAndVerifySignature(user, structHash, sig);

        consent.revoked = true;
        consent.revokedAt = uint64(block.timestamp);

        emit ConsentRevoked(consentId, user);
    }

    // =========================================================================
    // 5. isConsentValid
    // =========================================================================
    /**
     * @notice Returns true only if the consent exists, is not revoked, and block.timestamp < expiresAt.
     */
    function isConsentValid(bytes32 consentId) external view returns (bool) {
        ConsentRecord storage consent = _consents[consentId];
        if (!consent.exists) return false;
        if (consent.revoked) return false;
        if (uint64(block.timestamp) >= consent.expiresAt) return false;
        return true;
    }

    // =========================================================================
    // 6. View Getters
    // =========================================================================
    function computeConsentId(
        address user,
        bytes32 verifierId,
        bytes32 credentialHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(user, verifierId, credentialHash));
    }

    function getIdentity(
        address user
    ) external view returns (IdentityRecord memory) {
        return _identities[user];
    }

    function getCredential(
        bytes32 credentialHash
    ) external view returns (CredentialRecord memory) {
        return _credentials[credentialHash];
    }

    function getConsent(
        bytes32 consentId
    ) external view returns (ConsentRecord memory) {
        return _consents[consentId];
    }
}
