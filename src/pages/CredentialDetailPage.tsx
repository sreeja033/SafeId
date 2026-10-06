import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { credentialService } from '../services/credentialService';
import { VerifiableCredential } from '../types';
import { Modal } from '../components/common/Modal';

export const CredentialDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [credential, setCredential] = useState<VerifiableCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sandboxSelection, setSandboxSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchCred = async () => {
      setLoading(true);
      if (id) {
        const data = await credentialService.getCredentialById(id);
        setCredential(data);
        if (data?.attributes) {
          const init: Record<string, boolean> = {};
          data.attributes.forEach((a) => {
            init[a.key] = true;
          });
          setSandboxSelection(init);
        }
      }
      setLoading(false);
    };
    fetchCred();
  }, [id]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`, { type: 'success' });
  };

  const handleDelete = async () => {
    if (!credential) return;
    if (confirm(`Are you sure you want to delete ${credential.title}?`)) {
      await credentialService.deleteCredential(credential.id);
      showToast('Document removed', { type: 'info' });
      navigate('/app/wallet');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-[#908fa0] flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
        <span>Loading document details...</span>
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <span className="text-lg font-bold text-white">Document not found</span>
        <Link
          to="/app/wallet"
          className="px-4 py-2 bg-[#232a39] text-[#5de6ff] rounded-xl text-xs font-semibold"
        >
          Return to Wallet
        </Link>
      </div>
    );
  }

  const disclosedCount = Object.values(sandboxSelection).filter(Boolean).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto flex flex-col gap-6">
      {/* Navigation Breadcrumb & Status Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/app/wallet"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151b2a] hover:bg-[#232a39] transition-all text-xs text-[#c7c4d7] hover:text-white border border-white/5"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Documents</span>
          </Link>
          <span className="text-[#464554]">•</span>
          <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 font-semibold text-xs border border-amber-500/30">
            Sample document
          </span>
          {credential.isTestMode && (
            <span className="px-3 py-1 rounded-full bg-[#5de6ff]/15 text-[#5de6ff] font-mono text-xs font-semibold border border-[#5de6ff]/30">
              Test mode
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00885d]/20 text-[#4edea3] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
            <span>Locked and saved</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8083ff]/20 text-[#c0c1ff] text-xs font-semibold">
            <span className="material-symbols-outlined text-[14px]">hub</span>
            <span>
              {credential.isTestMode
                ? 'Fingerprint saved on the public record (Test mode)'
                : 'Fingerprint saved on the public record'}
            </span>
          </div>
        </div>
      </div>

      {/* Honest Wording Banner */}
      <div className="p-4 rounded-2xl bg-[#151b2a] border border-white/10 flex items-start gap-3">
        <span className="material-symbols-outlined text-[#5de6ff] text-xl shrink-0 mt-0.5">
          info
        </span>
        <p className="text-xs sm:text-sm text-[#c7c4d7] leading-relaxed">
          SelfID checks that your document details match the file you uploaded. In this demo, files are samples. A real version would check documents with the organization that issued them.
        </p>
      </div>

      {/* Credential Header Hero Card */}
      <div className="relative bg-[#151b2a] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          <div className="lg:col-span-8 flex flex-col sm:flex-row gap-4 items-start">
            <div className="relative w-16 h-16 rounded-2xl bg-[#070e1c] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-3xl text-[#5de6ff]">school</span>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
                  Sample document
                </span>
                <span className="text-[#464554]">•</span>
                <span className="text-[#908fa0] text-xs font-mono">
                  Created {credential.issuedDate}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {credential.title}
              </h1>

              <p className="text-xs text-[#5de6ff]">
                Details read from your uploaded document. Only the fingerprint is saved on the public record.
              </p>
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 gap-3 bg-[#070e1c] border border-white/5 p-4 rounded-xl text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#908fa0] uppercase tracking-wider">
                Created Date
              </span>
              <span className="font-semibold text-white mt-0.5">{credential.issuedDate}</span>
              <span className="text-[11px] text-[#908fa0]">{credential.issuedTime}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-[#908fa0] uppercase tracking-wider">Status</span>
              <span className="font-semibold text-[#4edea3] mt-0.5">Locked and saved</span>
              <span className="text-[11px] text-[#908fa0]">Sample document</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: All Fields */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#8083ff] text-2xl">
                badge
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Document Details</h2>
                <p className="text-xs text-[#908fa0]">
                  All fields read from your uploaded file (read-only).
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">
              Sample document
            </span>
          </div>

          {/* Dynamic Attributes List */}
          <div className="flex flex-col gap-2.5 bg-[#151b2a] border border-white/5 p-4 rounded-2xl shadow-md">
            {credential.attributes.map((attr) => (
              <div
                key={attr.key}
                className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#19202e] flex items-center justify-center text-[#5de6ff]">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold">
                      {attr.label}
                    </span>
                    <div className="text-sm font-semibold text-white mt-0.5">{attr.value}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="px-2.5 py-1 rounded-full bg-[#19202e] text-[#4edea3] font-mono text-[10px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    Locked and saved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Fingerprint & Public Record Status (Never shows locked data) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#8083ff] text-xl">
                  fingerprint
                </span>
                <span className="text-sm font-bold text-white">
                  Fingerprint &amp; Public Record Status
                </span>
              </div>
              {credential.isTestMode && (
                <span className="px-2 py-0.5 rounded bg-[#5de6ff]/15 text-[#5de6ff] font-mono text-[10px] font-semibold">
                  Test mode
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-[#00885d]/20 border border-[#4edea3]/30 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                  check_circle
                </span>
                <span>
                  {credential.isTestMode
                    ? 'Fingerprint saved on the public record (Test mode)'
                    : 'Fingerprint saved on the public record'}
                </span>
              </div>
              <p className="text-xs text-[#c7c4d7]">
                Only the SHA-256 fingerprint is saved on the public record. No names, dates of birth, IDs, or colleges are placed on the public record.
              </p>
            </div>

            {/* Document Fingerprint */}
            <div className="bg-[#070e1c] border border-white/5 p-3.5 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[#908fa0] text-[10px] font-mono uppercase">
                <span>Document Fingerprint (SHA-256)</span>
                <span className="text-[#4edea3]">Saved</span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-[#5de6ff] gap-2">
                <span className="break-all">{credential.sha256Hash}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(credential.sha256Hash, 'Document Fingerprint')}
                  className="text-[#908fa0] hover:text-white p-1 shrink-0"
                  title="Copy Fingerprint"
                >
                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                </button>
              </div>
            </div>

            {/* Uploaded Source File Hash */}
            {credential.sourceFileHash && (
              <div className="bg-[#070e1c] border border-white/5 p-3.5 rounded-xl flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[#908fa0] text-[10px] font-mono uppercase">
                  <span>Uploaded File Fingerprint (source_file_hash)</span>
                  <span>SHA-256</span>
                </div>
                <div className="flex items-center justify-between font-mono text-xs text-[#c7c4d7] gap-2">
                  <span className="break-all">{credential.sourceFileHash}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(credential.sourceFileHash || '', 'Uploaded File Fingerprint')
                    }
                    className="text-[#908fa0] hover:text-white p-1 shrink-0"
                    title="Copy File Fingerprint"
                  >
                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  </button>
                </div>
              </div>
            )}

            {/* Public Record TX */}
            <div className="bg-[#070e1c] border border-white/5 p-3.5 rounded-xl flex flex-col gap-1">
              <span className="text-[10px] text-[#908fa0] font-mono uppercase">
                Public Record Transaction ID
              </span>
              <span className="font-mono text-xs text-white break-all">
                {credential.onChainState.txHash}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 shadow-md flex items-center justify-between gap-3">
            <Link
              to="/app/requests"
              className="px-4 py-2 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">sync_alt</span>
              <span>View Requests</span>
            </Link>

            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-[#ffb4ab] text-xs font-semibold transition-colors flex items-center gap-1.5 border border-red-500/30"
            >
              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
              <span>Delete Document</span>
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Choose what to share"
        subtitle={credential.title}
        icon="share_reviews"
        iconColor="text-[#5de6ff]"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#232a39] text-xs font-semibold text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                showToast(`Prepared ${disclosedCount} fields for sharing`, { type: 'success' });
                setShareModalOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-xs font-semibold text-white shadow-md"
            >
              Confirm and share
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[#c7c4d7]">
            Select only the details you want to reveal to the verifier. Unselected details stay locked.
          </p>
          {credential.attributes.map((attr) => (
            <label
              key={attr.key}
              className="flex items-center justify-between p-3 rounded-xl bg-[#151b2a] border border-white/5 cursor-pointer hover:bg-[#19202e]"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">{attr.label}</span>
                <span className="text-[11px] text-[#908fa0]">{attr.value}</span>
              </div>
              <input
                type="checkbox"
                checked={!!sandboxSelection[attr.key]}
                onChange={(e) =>
                  setSandboxSelection((prev) => ({
                    ...prev,
                    [attr.key]: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded text-[#8083ff] focus:ring-0 bg-[#232a39] cursor-pointer"
              />
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
};
