import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  verifierService,
  VerificationResultResponse,
} from '../services/verifierService';
import { VerifierRequestRecord } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { getExplorerTxUrl } from '../lib/explorer';

const DEFAULT_PRESETS = [
  'College / Institution',
  'Student Enrollment Status',
  'Full Legal Name',
  'Age >= 21 (Private proof)',
  'Course / Program',
  'Student ID',
  'Department',
  'Graduation Year',
  'Date of Birth',
  'Email Address',
  'CGPA / Grades',
  'Library Card #',
];

export const VerifierConsolePage: React.FC = () => {
  const { verifier, profile } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<VerifierRequestRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick request creator state
  const [targetDid, setTargetDid] = useState('');
  const [purpose, setPurpose] = useState(
    'Academic Enrollment Audit & Selective Disclosure Check'
  );
  const [validityWindow, setValidityWindow] = useState('24 Hours');
  const [availableClaims, setAvailableClaims] = useState<string[]>(DEFAULT_PRESETS);
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>({
    'College / Institution': true,
    'Student Enrollment Status': true,
    'Full Legal Name': true,
    'Age >= 21 (Private proof)': true,
    'Course / Program': false,
    'Student ID': false,
    Department: false,
    'Graduation Year': false,
    'Date of Birth': false,
    'Email Address': false,
    'CGPA / Grades': false,
    'Library Card #': false,
  });
  const [customFieldInput, setCustomFieldInput] = useState('');
  const [isInitiating, setIsInitiating] = useState(false);

  const handleAddCustomField = () => {
    const trimmed = customFieldInput.trim();
    if (!trimmed) return;
    if (!availableClaims.includes(trimmed)) {
      setAvailableClaims((prev) => [...prev, trimmed]);
    }
    setSelectedClaims((prev) => ({ ...prev, [trimmed]: true }));
    setCustomFieldInput('');
    showToast(`Added field: "${trimmed}"`, { type: 'success' });
  };

  const handleRemoveCustomField = (fieldName: string) => {
    setAvailableClaims((prev) => prev.filter((c) => c !== fieldName));
    setSelectedClaims((prev) => {
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  // Instant Verify Presentation State
  const [verifyTargetId, setVerifyTargetId] = useState('');
  const [verifyOutput, setVerifyOutput] = useState<VerificationResultResponse | null>(
    null
  );
  const [isVerifying, setIsVerifying] = useState(false);

  const loadData = async () => {
    const data = await verifierService.getRequestsLedger();
    setRecords(data);
    if (data.length > 0 && !verifyTargetId) {
      setVerifyTargetId(data[0].id);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleInitiateRequest = async () => {
    const claims = Object.entries(selectedClaims)
      .filter(([, checked]) => checked)
      .map(([name]) => name);

    if (claims.length === 0) {
      showToast('Select or add at least one field to request', { type: 'warning' });
      return;
    }

    setIsInitiating(true);
    const holderDidToRequest = targetDid.trim() || 'did:selfid:current-holder';

    const newRecord = await verifierService.initiatePresentationRequest(
      holderDidToRequest,
      claims,
      purpose,
      validityWindow
    );

    const updated = await verifierService.getRequestsLedger();
    setRecords(updated);
    setVerifyTargetId(newRecord.id);
    setIsInitiating(false);

    showToast(`Request ${newRecord.id} sent`, {
      type: 'success',
      description: `Sent to ${holderDidToRequest}. Waiting for the person to review and share.`,
    });
  };

  const handleRunVerify = async (requestIdToCheck?: string) => {
    const id = requestIdToCheck || verifyTargetId;
    if (!id) {
      showToast('Select a request ID first', {
        type: 'warning',
        description: 'Send a request first, then run the check.',
      });
      return;
    }
    setIsVerifying(true);
    setVerifyTargetId(id);
    const res = await verifierService.verifyPresentation({ requestId: id });
    setVerifyOutput(res);
    setIsVerifying(false);

    const updated = await verifierService.getRequestsLedger();
    setRecords(updated);

    if (res.valid) {
      showToast('Information Confirmed', {
        type: 'success',
        description: 'Personal stamp, document fingerprint, and permission are valid.',
      });
    } else {
      showToast('Check Failed: Access Denied or Pending', {
        type: 'error',
        description: res.failureReason || res.error || 'Permission is not active.',
      });
    }
  };

  const filteredRecords = records.filter((rec) => {
    const matchesStatus =
      statusFilter === 'ALL' || rec.proofStatus.toUpperCase() === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      rec.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.holderDid.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const verifiedCount = records.filter((r) => r.proofStatus === 'approved').length;
  const revokedOrPendingCount = records.filter(
    (r) => r.proofStatus !== 'approved'
  ).length;

  const disclosedClaimsList = verifyOutput?.disclosedClaims || [];
  const collegeClaim = disclosedClaimsList.find(
    (c) =>
      c.key === 'institution' ||
      (c.label && c.label.toLowerCase().includes('college'))
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Top Action & Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Verifier Console
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#232a39] text-[#5de6ff] border border-[#5de6ff]/20">
              {verifier.orgName} ({verifier.orgId})
            </span>
          </div>
          <p className="text-sm text-[#5de6ff] font-medium mt-1">
            Ask a person to confirm details from their uploaded document, then check what they shared.
          </p>
          <p className="text-xs text-[#908fa0] mt-0.5">
            You only receive the specific fields the person chooses to share, while their full document stays locked.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Notifications button */}
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-[#151b2a] hover:bg-[#232a39] border border-white/5 text-[#908fa0] hover:text-white flex items-center justify-center transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#5de6ff]" />
          </button>

          {/* CMRIT Verification Portal / VER-001 / domain */}
          <Link
            to="/verifier/profile"
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-[#151b2a] hover:bg-[#1f2637] border border-white/5 transition-all cursor-pointer shadow-sm"
            title="View Verifier Profile"
          >
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-white leading-tight">
                {profile?.org_name || verifier.orgName}
              </span>
              <span className="font-mono text-[10px] text-[#908fa0]">
                {profile?.verifier_code || verifier.orgId}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#8083ff] flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[18px]">domain</span>
            </div>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#908fa0] font-medium">Total Requests Sent</span>
            <span className="material-symbols-outlined text-[#5de6ff] text-[20px]">send</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{records.length}</span>
            <span className="text-[11px] font-semibold text-[#5de6ff]">Live session</span>
          </div>
        </div>

        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#908fa0] font-medium">Confirmed & Active</span>
            <span className="material-symbols-outlined text-[#4edea3] text-[20px]">verified</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{verifiedCount}</span>
            <span className="text-[11px] font-semibold text-[#4edea3]">Valid permission</span>
          </div>
        </div>

        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#908fa0] font-medium">Waiting or Taken Back</span>
            <span className="material-symbols-outlined text-[#ffb4ab] text-[20px]">gpp_bad</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{revokedOrPendingCount}</span>
            <span className="text-[11px] font-semibold text-[#ffb4ab]">Blocked or pending</span>
          </div>
        </div>

        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#908fa0] font-medium">Public Record Connection</span>
            <span className="material-symbols-outlined text-[#8083ff] text-[20px]">hub</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-lg font-bold text-[#4edea3]">Connected</span>
            <span className="text-[11px] font-mono text-[#908fa0]">Ready</span>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Request Builder + Instant Verification Checker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Request Builder */}
        <div className="lg:col-span-5 bg-[#070e1c] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8083ff] to-[#5de6ff]" />

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">1. Ask for Document Details</h2>
              <p className="text-xs text-[#908fa0] mt-0.5">
                Choose which fields you want the person to share from their saved document.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#151b2a] text-[#5de6ff] font-mono text-[10px]">
              Selective Disclosure
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-[#c7c4d7] font-medium mb-1 block">
                Person's Digital ID (leave blank to send to current demo user)
              </label>
              <input
                type="text"
                value={targetDid}
                onChange={(e) => setTargetDid(e.target.value)}
                placeholder="did:selfid:... (or leave empty for current wallet)"
                className="w-full px-3.5 py-2 rounded-xl bg-[#151b2a] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-[#5de6ff]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-[#c7c4d7] font-medium">
                  Fields to Request ({Object.values(selectedClaims).filter(Boolean).length} selected)
                </label>
                <span className="text-[10px] text-[#5de6ff] font-mono">Custom fields supported</span>
              </div>

              {/* Custom field adder input */}
              <div className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  value={customFieldInput}
                  onChange={(e) => setCustomFieldInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomField();
                    }
                  }}
                  placeholder="Type any detail to ask (e.g. Department, Blood Group, GPA)..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#151b2a] border border-white/10 text-white text-xs placeholder:text-[#908fa0] focus:outline-none focus:border-[#5de6ff]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  className="px-3 py-1.5 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-[#5de6ff] text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>Add Field</span>
                </button>
              </div>

              {/* Selectable fields list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {availableClaims.map((claimName) => {
                  const isChecked = Boolean(selectedClaims[claimName]);
                  const isPreset = DEFAULT_PRESETS.includes(claimName);
                  return (
                    <div
                      key={claimName}
                      className={`flex items-center justify-between gap-1.5 p-2 rounded-xl bg-[#151b2a] border transition-colors ${
                        isChecked ? 'border-[#5de6ff]/30 text-white' : 'border-white/5 opacity-70 text-[#c7c4d7]'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedClaims((prev) => ({
                              ...prev,
                              [claimName]: e.target.checked,
                            }))
                          }
                          className="w-3.5 h-3.5 rounded text-[#5de6ff] bg-[#232a39] focus:ring-0 shrink-0 cursor-pointer"
                        />
                        <span className="text-xs font-medium truncate" title={claimName}>
                          {claimName}
                        </span>
                      </label>
                      {!isPreset && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(claimName)}
                          className="text-[#908fa0] hover:text-[#ffb4ab] text-xs p-1 cursor-pointer"
                          title="Remove custom field"
                        >
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#c7c4d7] font-medium mb-1 block">
                  Reason for request
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#151b2a] border border-white/10 text-white text-xs focus:outline-none focus:border-[#5de6ff]"
                />
              </div>
              <div>
                <label className="text-xs text-[#c7c4d7] font-medium mb-1 block">
                  Access duration
                </label>
                <select
                  value={validityWindow}
                  onChange={(e) => setValidityWindow(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#151b2a] border border-white/10 text-white text-xs focus:outline-none"
                >
                  <option value="1 Hour">1 Hour</option>
                  <option value="24 Hours">24 Hours</option>
                  <option value="7 Days">7 Days</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInitiateRequest}
              disabled={isInitiating}
              className="w-full mt-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white font-bold text-xs shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{isInitiating ? 'Sending Request...' : 'Send Request Now'}</span>
            </button>
          </div>
        </div>

        {/* Right: Instant Verification Checker */}
        <div className="lg:col-span-7 bg-[#070e1c] border border-white/10 rounded-2xl p-6 flex flex-col justify-between gap-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5de6ff] to-[#4edea3]" />

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white">
                  2. Check Shared Information (`/api/verify`)
                </h2>
                <p className="text-xs text-[#908fa0] mt-0.5">
                  Checks the person's digital signature, document fingerprint, and active permission.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={verifyTargetId}
                  onChange={(e) => setVerifyTargetId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#151b2a] border border-white/10 text-xs text-white font-mono focus:outline-none"
                >
                  <option value="">-- Select Request ID --</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} ({r.proofStatusText})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRunVerify()}
                  disabled={isVerifying || !verifyTargetId}
                  className="px-4 py-1.5 rounded-xl bg-[#00885d] hover:bg-[#00a572] disabled:opacity-40 text-[#6ffbbe] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                  <span>{isVerifying ? 'Checking...' : 'Check Now'}</span>
                </button>
              </div>
            </div>

            {/* Verification Output Display */}
            {!verifyOutput ? (
              <div className="p-8 rounded-xl bg-[#151b2a]/70 border border-dashed border-white/10 flex flex-col items-center justify-center text-center gap-2">
                <span className="material-symbols-outlined text-3xl text-[#5de6ff]">
                  fact_check
                </span>
                <p className="text-xs font-semibold text-white">
                  Select a request above and click "Check Now"
                </p>
                <p className="text-[11px] text-[#908fa0] max-w-md">
                  Once the person approves your request in their wallet, you can verify their shared fields here. If they take back access, this check will immediately fail.
                </p>
              </div>
            ) : verifyOutput.valid ? (
              <div className="p-5 rounded-xl bg-[#00885d]/10 border border-[#4edea3]/30 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#4edea3] text-2xl">
                      check_circle
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Verification Passed — Shared Details Confirmed
                      </h3>
                      <p className="text-[11px] text-[#6ffbbe]">
                        Signature matches Digital ID • Fingerprint matches public record • Permission is ACTIVE
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/verifier/results/${verifyTargetId}`}
                    className="px-3 py-1.5 rounded-lg bg-[#232a39] hover:bg-[#2e3544] text-xs font-semibold text-[#5de6ff] transition-colors"
                  >
                    Full Report →
                  </Link>
                </div>

                {/* Institution Warning if not CMRIT */}
                {collegeClaim &&
                  !collegeClaim.value.toLowerCase().includes('cmr') && (
                    <div className="p-3 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/40 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[#fbbf24] text-[18px] mt-0.5">
                        warning
                      </span>
                      <div className="text-xs text-[#fde68a]">
                        <span className="font-bold text-white">Different Institution Notice: </span>
                        The uploaded document belongs to{' '}
                        <span className="font-bold underline">{collegeClaim.value}</span>,
                        which does not match CMR Institute of Technology.
                      </div>
                    </div>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {disclosedClaimsList.map((claim, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#070e1c]/90 border border-white/10 flex flex-col gap-0.5"
                    >
                      <span className="text-[10px] text-[#908fa0] uppercase font-semibold">
                        {claim.label || claim.key}
                      </span>
                      <span className="text-xs font-bold text-white">{claim.value}</span>
                    </div>
                  ))}
                </div>

                {verifyOutput.cryptographicProof?.grantTxHash && (
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                    <span className="text-[#908fa0]">On-Chain Public Record:</span>
                    <a
                      href={getExplorerTxUrl(verifyOutput.cryptographicProof.grantTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#5de6ff] hover:underline flex items-center gap-1"
                    >
                      <span>Tx: {verifyOutput.cryptographicProof.grantTxHash.slice(0, 14)}...</span>
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-[#93000a]/20 border border-[#ffb4ab]/40 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#ffb4ab] text-2xl">
                      cancel
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Check Failed — Cannot View Details
                      </h3>
                      <p className="text-xs text-[#ffb4ab] mt-0.5">
                        {verifyOutput.failureReason || verifyOutput.error}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunVerify(verifyTargetId)}
                      disabled={isVerifying}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      <span>Retry Check</span>
                    </button>
                    <Link
                      to={`/verifier/results/${verifyTargetId}`}
                      className="px-3 py-1.5 rounded-lg bg-[#232a39] hover:bg-[#2e3544] text-xs font-semibold text-white transition-colors"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-[#908fa0]">
            <span>Zero raw encrypted payloads exposed to verifiers</span>
            <span className="font-mono text-[#5de6ff]">AES-256-GCM + ECDSA</span>
          </div>
        </div>
      </div>

      {/* Sent Requests Table */}
      <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Sent Verification Requests</h2>
            <p className="text-xs text-[#908fa0]">
              Click "Check Shared Info" on any request to run live verification or see if access was taken back.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search request ID or DID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#070e1c] border border-white/10 text-xs text-white focus:outline-none"
            />
            {(['ALL', 'APPROVED', 'REVOKED', 'PENDING'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#8083ff] text-white'
                    : 'bg-[#070e1c] text-[#908fa0] hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-10 rounded-xl bg-[#070e1c]/60 border border-white/5 text-center flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-[#908fa0]">
              inbox
            </span>
            <p className="text-sm font-semibold text-white">No verification requests yet</p>
            <p className="text-xs text-[#908fa0] max-w-md">
              Use "1. Ask for Document Details" above to send a verification request to the user's wallet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-[#908fa0]">
                  <th className="py-3 px-3">Request ID</th>
                  <th className="py-3 px-3">Person's Digital ID</th>
                  <th className="py-3 px-3">Requested Details</th>
                  <th className="py-3 px-3">Time</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#19202e]/60 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-[#5de6ff]">
                      {rec.id}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[#c7c4d7]">
                      {rec.holderDid.length > 28
                        ? `${rec.holderDid.slice(0, 18)}...${rec.holderDid.slice(-6)}`
                        : rec.holderDid}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {rec.requestedClaims.map((f: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-[#070e1c] text-[#dce2f6] text-[11px] border border-white/5"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-[#908fa0]">{rec.timestamp}</td>
                    <td className="py-3.5 px-3">
                      <StatusBadge status={rec.proofStatus} />
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleRunVerify(rec.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#232a39] hover:bg-[#2e3544] text-[#5de6ff] font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Quick Check
                        </button>
                        <Link
                          to={`/verifier/results/${rec.id}`}
                          className="px-2.5 py-1 rounded-lg bg-[#8083ff]/20 hover:bg-[#8083ff]/30 text-[#c2c1ff] font-semibold text-[11px] transition-colors"
                        >
                          Check Shared Info →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
