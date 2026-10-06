import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  verifierService,
  VerificationResultResponse,
} from '../services/verifierService';

export const VerifierResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [targetId, setTargetId] = useState<string>('');
  const [result, setResult] = useState<VerificationResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const runCheck = async (requestId: string) => {
    setIsLoading(true);
    setTargetId(requestId);
    const data = await verifierService.verifyPresentation({ requestId });
    setResult(data);
    setIsLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      if (id && id !== 'latest') {
        await runCheck(id);
      } else {
        const records = await verifierService.getRequestsLedger();
        if (records.length > 0) {
          await runCheck(records[0].id);
        } else {
          setIsLoading(false);
        }
      }
    };
    init();
  }, [id]);

  const handleRecheck = async () => {
    if (!targetId) return;
    await runCheck(targetId);
    showToast('Verification re-checked against public record', {
      type: 'info',
      description: 'Latest permission and fingerprint status loaded.',
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
        <div className="h-32 rounded-2xl bg-[#151b2a] animate-pulse" />
        <div className="h-80 rounded-2xl bg-[#151b2a] animate-pulse" />
      </div>
    );
  }

  if (!result || !targetId) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#151b2a] flex items-center justify-center text-[#5de6ff]">
          <span className="material-symbols-outlined text-3xl">fact_check</span>
        </div>
        <h1 className="text-xl font-bold text-white">No Verification Request Selected</h1>
        <p className="text-xs text-[#908fa0] max-w-md">
          Send a verification request from the Verifier Console first, approve it in the user's wallet, and then check the shared details here.
        </p>
        <Link
          to="/verifier"
          className="px-4 py-2.5 rounded-xl bg-[#8083ff] text-white text-xs font-bold"
        >
          Back to Verifier Console
        </Link>
      </div>
    );
  }

  const disclosedEntries = result.disclosedClaims || [];
  const institutionClaim = disclosedEntries.find(
    (c) =>
      c.key === 'institution' ||
      (c.label && c.label.toLowerCase().includes('college'))
  );
  const sharedInstitution = institutionClaim?.value;
  const isDifferentCollege =
    sharedInstitution && !sharedInstitution.toLowerCase().includes('cmr');

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Breadcrumb & Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/verifier"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151b2a] hover:bg-[#232a39] text-[#c7c4d7] hover:text-white text-xs border border-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-[#464554]">/</span>
          <span className="font-mono text-xs text-[#5de6ff]">{targetId}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRecheck}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#5de6ff]">
              refresh
            </span>
            <span>Re-run Verification Check</span>
          </button>
        </div>
      </div>

      {/* Main Verification Status Banner */}
      {result.valid ? (
        <div className="bg-gradient-to-r from-[#00885d]/25 via-[#151b2a] to-[#151b2a] border border-[#4edea3]/40 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#00885d]/30 border border-[#4edea3]/40 flex items-center justify-center text-[#4edea3] shrink-0">
              <span className="material-symbols-outlined text-3xl">verified</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#00885d] text-[#6ffbbe]">
                  Confirmed
                </span>
                <span className="text-xs font-mono text-[#908fa0]">
                  Checked at{' '}
                  {result.verifiedAt
                    ? new Date(result.verifiedAt).toLocaleTimeString()
                    : new Date().toLocaleTimeString()}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white mt-1">
                Information Confirmed — Shared Fields Verified
              </h1>
              <p className="text-xs text-[#c7c4d7] mt-1">
                The person's signature matches their Digital ID, the document fingerprint matches the public record, and permission is currently active.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-[#93000a]/30 via-[#151b2a] to-[#151b2a] border border-[#ffb4ab]/40 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#93000a]/40 border border-[#ffb4ab]/40 flex items-center justify-center text-[#ffb4ab] shrink-0">
              <span className="material-symbols-outlined text-3xl">gpp_bad</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#93000a] text-[#ffdad6]">
                  Check Failed
                </span>
                <span className="text-xs font-mono text-[#908fa0]">
                  Checked at {new Date().toLocaleTimeString()}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white mt-1">
                Verification Failed — Shared Details Unavailable
              </h1>
              <p className="text-xs text-[#ffb4ab] mt-1 font-medium">
                {result.failureReason ||
                  result.error ||
                  'Access was taken back by the document owner or has not been granted yet.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wrong-college / Different Institution Alert */}
      {result.valid && isDifferentCollege && (
        <div className="p-4 rounded-2xl bg-[#f59e0b]/15 border border-[#f59e0b]/40 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#fbbf24] text-2xl shrink-0">
            warning
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-bold text-white">
              Institution Mismatch Detected ({sharedInstitution})
            </h3>
            <p className="text-xs text-[#fde68a] leading-relaxed">
              The document details match the file uploaded by the user, and their signature is valid. However, the institution read from their document is{' '}
              <strong className="text-white underline">{sharedInstitution}</strong> instead of{' '}
              <strong className="text-white">CMR Institute of Technology</strong>. Because SelfID reads details directly from the uploaded file instead of letting users type them, the user could not fake their college name.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Disclosed Fields ONLY */}
        <div className="lg:col-span-7 bg-[#070e1c] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-base font-bold text-white">
                Fields Shared by Document Owner
              </h2>
              <p className="text-xs text-[#908fa0] mt-0.5">
                Only the fields the user selected are shown below. Unselected fields were never sent to you.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#151b2a] text-[#5de6ff] font-mono text-xs font-semibold">
              {disclosedEntries.length} shared
            </span>
          </div>

          {!result.valid || disclosedEntries.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#151b2a]/60 border border-white/5 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl text-[#ffb4ab]">
                visibility_off
              </span>
              <p className="text-sm font-semibold text-white">
                No Shared Fields Available
              </p>
              <p className="text-xs text-[#908fa0] max-w-md">
                {result.failureReason ||
                  result.error ||
                  'Because permission is not active, the server blocked access to the shared details.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {disclosedEntries.map((claim, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#151b2a] border border-white/10 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#908fa0]">
                      {claim.label || claim.key}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#00885d]/20 text-[#4edea3] text-[10px] font-semibold">
                      Shared
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white break-words">
                    {claim.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Honest Wording Note */}
          <div className="p-4 rounded-xl bg-[#151b2a]/90 border border-[#5de6ff]/20 flex items-start gap-3 mt-auto">
            <span className="material-symbols-outlined text-[#5de6ff] text-[18px] mt-0.5">
              info
            </span>
            <p className="text-xs text-[#c7c4d7] leading-relaxed">
              SelfID checks that your document details match the file you uploaded. In this demo, files are samples. A real version would check documents with the organization that issued them.
            </p>
          </div>
        </div>

        {/* Right 5 Cols: Security Checks */}
        <div className="lg:col-span-5 bg-[#070e1c] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
          <div>
            <h2 className="text-base font-bold text-white">Verification Checks Run</h2>
            <p className="text-xs text-[#908fa0] mt-0.5">
              Results from checking the signature, permission status, and document fingerprint.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {[
              {
                label: 'Digital ID Signature Check',
                desc: 'Checked personal signature against holder public key',
                passed: result.valid,
              },
              {
                label: 'Document Fingerprint Check',
                desc: 'Checked SHA-256 fingerprint on public record',
                passed: result.valid,
              },
              {
                label: 'Permission Active & Not Taken Back',
                desc: 'Checked that user has not taken back access',
                passed: result.valid && result.status !== 'REVOKED',
              },
              {
                label: 'Access Time Window Valid',
                desc: 'Checked that permission has not expired',
                passed: result.valid && result.status !== 'EXPIRED',
              },
            ].map((chk) => (
              <div
                key={chk.label}
                className="p-3.5 rounded-xl bg-[#151b2a] border border-white/5 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-white">{chk.label}</div>
                  <div className="text-[11px] text-[#908fa0]">{chk.desc}</div>
                </div>
                {chk.passed ? (
                  <span className="px-2.5 py-1 rounded-full bg-[#00885d]/20 text-[#4edea3] text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    Passed
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-[#93000a]/30 text-[#ffb4ab] text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    Failed
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-white/5 flex flex-col gap-2 font-mono text-[11px] text-[#908fa0]">
            <div className="flex justify-between">
              <span>Holder Digital ID:</span>
              <span className="text-[#5de6ff] truncate max-w-[200px]">
                {result.holderDid || 'Not available'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Document Fingerprint:</span>
              <span className="text-white truncate max-w-[200px]">
                {result.cryptographicProof?.credentialHash || 'Not available'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
