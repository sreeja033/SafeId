import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { requestService } from '../services/requestService';
import { credentialService } from '../services/credentialService';
import { VerificationRequest, VerifiableCredential } from '../types';
import { OnChainActionModal } from '../components/common/OnChainActionModal';
import { RequestHelperBox } from '../components/common/RequestHelperBox';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [selectedCredId, setSelectedCredId] = useState<string>('');
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [validityWindow, setValidityWindow] = useState('1 Day (Rec.)');
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  // On-Chain Action Modal state
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantActionStatus, setGrantActionStatus] = useState<'waiting' | 'failed' | 'confirmed'>('waiting');
  const [grantTxHash, setGrantTxHash] = useState<string | null>(null);
  const [grantErrorMessage, setGrantErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [reqData, credList] = await Promise.all([
          requestService.getRequestById(id || ''),
          credentialService.getCredentials(),
        ]);
        setRequest(reqData);
        setCredentials(credList);
        if (credList.length > 0) {
          setSelectedCredId(credList[0].id);
        }
        if (reqData?.claims) {
          const init: Record<string, boolean> = {};
          reqData.claims.forEach((c) => {
            init[c.label] = true;
          });
          setSelectedClaims(init);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database connection error';
        console.error('[RequestDetailPage] Database error:', msg);
        showToast('Database Error', { type: 'error', description: msg });
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [id]);

  const activeCred =
    credentials.find((c) => c.id === selectedCredId) || credentials[0] || null;

  const getDocumentValueForClaim = (claimLabel: string): string => {
    if (!activeCred) return 'No document saved yet';
    const lower = claimLabel.toLowerCase();

    if (lower.includes('age') && (lower.includes('private') || lower.includes('>='))) {
      const dob = activeCred.attributes.find(
        (a) => a.key === 'dateOfBirth' || a.label.toLowerCase().includes('birth')
      );
      return dob?.value
        ? `Proof: Age >= 18 Confirmed (Birthdate ${dob.value} kept private)`
        : 'Proof: Age >= 18 Confirmed';
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

    return matched?.value || 'Not in document';
  };

  const handleDeny = async () => {
    if (!request) return;
    if (confirm(`Deny request ${request.id} from ${request.verifierName}?`)) {
      await requestService.denyRequest(request.id);
      showToast('Request denied', {
        type: 'info',
        description: 'No details were shared.',
      });
      navigate('/app/requests');
    }
  };

  const handleGrant = async () => {
    if (!request) return;
    if (!activeCred) {
      showToast('Add a document first', {
        type: 'error',
        description: 'Please upload and save a document before sharing details.',
      });
      return;
    }

    const chosenLabels = Object.entries(selectedClaims)
      .filter(([, checked]) => checked)
      .map(([label]) => label);

    if (chosenLabels.length === 0) {
      showToast('Select at least one detail to share', { type: 'warning' });
      return;
    }

    setGrantModalOpen(true);
    setGrantActionStatus('waiting');
    setGrantErrorMessage(null);
    setGrantTxHash(null);
    setIsSigning(true);

    try {
      const claimsMap: Record<string, { disclosed: boolean; zkOnly: boolean }> = {};
      request.claims.forEach((c) => {
        claimsMap[c.label] = {
          disclosed: Boolean(selectedClaims[c.label]),
          zkOnly: Boolean(c.zkEligible),
        };
      });

      const res = await requestService.grantRequest(
        request.id,
        claimsMap,
        validityWindow,
        activeCred.id
      );

      setIsSigning(false);
      setIsSigned(true);
      setGrantTxHash(res.txHash || null);
      setGrantActionStatus('confirmed');

      showToast('Confirm and share', {
        type: 'success',
        description: `Shared ${chosenLabels.length} selected detail(s) with ${request.verifierName}.`,
      });
    } catch (err: unknown) {
      setIsSigning(false);
      setGrantActionStatus('failed');
      const rawMsg = err instanceof Error ? err.message : 'Failed to grant permission';
      const cleanMsg =
        rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
          ? 'The demo wallet needs more test coins'
          : rawMsg;
      setGrantErrorMessage(cleanMsg);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-[#908fa0] flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
        <span>Checking request details...</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <span className="text-lg font-bold text-white">Request not found</span>
        <Link
          to="/app/requests"
          className="px-4 py-2 bg-[#232a39] text-[#5de6ff] rounded-xl text-xs font-semibold"
        >
          Return to Requests
        </Link>
      </div>
    );
  }

  const sharedCount = Object.values(selectedClaims).filter(Boolean).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto flex flex-col gap-6">
      {/* Top Breadcrumb */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <Link
          to="/app/requests"
          className="flex items-center gap-2 group text-[#c7c4d7] hover:text-white transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-[#151b2a] flex items-center justify-center text-[#5de6ff] border border-white/5">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Back to Requests</span>
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[#232a39] text-[#8083ff]">
              {request.id}
            </span>
          </div>
        </Link>
      </div>

      {/* Main Verifier Banner */}
      <div className="w-full bg-[#151b2a] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#8083ff] via-[#5de6ff] to-[#4edea3]" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#070e1c] border border-white/10 flex items-center justify-center text-[#5de6ff] shrink-0">
              <span className="material-symbols-outlined text-[36px]">shield</span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {request.verifierName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#00885d]/20 text-[#4edea3]">
                  Verifier
                </span>
              </div>

              <p className="text-xs text-[#5de6ff] font-medium">
                Choose which details from your saved document this organization can see.
              </p>

              <p className="text-sm text-[#dce2f6] pt-1">
                <span className="text-[#5de6ff] font-semibold">Purpose:</span> {request.purpose}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#070e1c] border border-white/5">
            <span className="material-symbols-outlined text-[#4edea3] text-[20px]">
              lock_reset
            </span>
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase tracking-wider text-[#4edea3] font-semibold">
                Selective Sharing
              </span>
              <span className="text-xs text-[#908fa0]">
                The verifier only receives the fields you choose
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Helper Box: Explains what verifier asks, unnecessary fields, and quick chips */}
      <RequestHelperBox
        requestId={request.id}
        verifierName={request.verifierName}
        purpose={request.purpose}
        requestedFields={request.claims.map((c) => c.label)}
      />

      {/* Warning if user has no saved document yet */}
      {credentials.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#151b2a] border border-amber-500/30 flex flex-col items-center text-center gap-3">
          <span className="material-symbols-outlined text-4xl text-amber-400">upload_file</span>
          <h2 className="text-lg font-bold text-white">
            You need a saved document before you can share details
          </h2>
          <p className="text-xs text-[#c7c4d7] max-w-md">
            Upload a sample college ID document first so we can read and lock the details. Then return here to confirm and share.
          </p>
          <Link
            to="/app/add-document"
            className="mt-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-md"
          >
            + Add a document
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Selective Disclosure Checkboxes */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-6 shadow-xl">
              {credentials.length > 1 && (
                <div className="mb-5 pb-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">
                    Using saved document:
                  </span>
                  <select
                    value={selectedCredId}
                    onChange={(e) => setSelectedCredId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#070e1c] border border-white/10 text-xs text-white font-semibold"
                  >
                    {credentials.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (Created {c.issuedDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-start justify-between pb-4 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#8083ff] text-xl">tune</span>
                    <h2 className="text-lg font-bold text-white">
                      Choose Which Details to Share
                    </h2>
                  </div>
                  <p className="text-xs text-[#908fa0] pt-1">
                    Unchecked fields stay locked and will not be sent to the verifier.
                  </p>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#232a39] text-[#5de6ff] border border-white/5">
                  {sharedCount} of {request.claims.length} selected
                </span>
              </div>

              {/* Dynamic Claims List */}
              <div className="flex flex-col gap-3 mt-4">
                {request.claims.map((claim) => {
                  const isChecked = Boolean(selectedClaims[claim.label]);
                  const docValue = getDocumentValueForClaim(claim.label);

                  return (
                    <label
                      key={claim.key}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-[#070e1c] border-[#5de6ff]/30'
                          : 'bg-[#070e1c]/50 border-white/5 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedClaims((prev) => ({
                              ...prev,
                              [claim.label]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 mt-1 rounded accent-[#6366f1] cursor-pointer"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {claim.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-300">
                              From sample document
                            </span>
                          </div>
                          <div className="font-mono text-xs text-[#5de6ff] font-semibold pt-1">
                            {docValue}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          isChecked ? 'text-[#4edea3]' : 'text-[#908fa0]'
                        }`}
                      >
                        {isChecked ? 'Will share' : 'Kept private'}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Permission Validity Period */}
              <div className="mt-6 pt-4 border-t border-white/5 bg-[#070e1c] p-4 rounded-xl">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-semibold text-white">
                    How long they have access
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {['1 Hour', '1 Day (Rec.)', '7 Days', 'Single Use'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setValidityWindow(opt)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all text-center ${
                        validityWindow === opt
                          ? 'bg-[#8083ff] text-white shadow-sm'
                          : 'bg-[#151b2a] text-[#c7c4d7] hover:bg-[#19202e] hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Actions Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleDeny}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-semibold text-[#ffb4ab] bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  <span>Deny request</span>
                </button>

                <button
                  type="button"
                  onClick={handleGrant}
                  disabled={isSigning || isSigned || sharedCount === 0}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSigning ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Signing &amp; sharing...</span>
                    </>
                  ) : isSigned ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] text-[#4edea3]">
                        check
                      </span>
                      <span>Confirmed &amp; Shared!</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">
                        enhanced_encryption
                      </span>
                      <span>Confirm and share</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Summary */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5de6ff]">verified_user</span>
                <h3 className="text-sm font-bold text-white">What Happens Next</h3>
              </div>
              <p className="text-xs text-[#c7c4d7] leading-relaxed">
                Only the {sharedCount} field(s) you checked above will be included in the signed presentation. You can take back access at any time from your Permission History page.
              </p>
              <div className="p-3.5 rounded-xl bg-[#070e1c] border border-white/5 text-xs text-[#908fa0]">
                SelfID checks that your document details match the file you uploaded. In this demo, files are samples. A real version would check documents with the organization that issued them.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* On-Chain Action Modal for Sharing Details / Granting Consent */}
      <OnChainActionModal
        isOpen={grantModalOpen}
        onClose={() => setGrantModalOpen(false)}
        title="Sharing Details & Anchoring on Public Record"
        status={grantActionStatus}
        txHash={grantTxHash}
        errorMessage={grantErrorMessage}
        onRetry={handleGrant}
        onSuccessContinue={() => navigate(`/verifier/results/${request?.id}`)}
        successButtonLabel="View Verification Results"
      />
    </div>
  );
};
