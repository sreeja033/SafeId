import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { credentialService } from '../services/credentialService';
import { identityService } from '../services/identityService';
import { VerifiableCredential } from '../types';
import { Modal } from '../components/common/Modal';
import { OnChainActionModal } from '../components/common/OnChainActionModal';
import { getExplorerTxUrl } from '../lib/explorer';

export const WalletPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // On-Chain DID Action State
  const [didModalOpen, setDidModalOpen] = useState(false);
  const [didActionStatus, setDidActionStatus] = useState<'waiting' | 'failed' | 'confirmed'>('waiting');
  const [didTxHash, setDidTxHash] = useState<string | null>(null);
  const [didErrorMessage, setDidErrorMessage] = useState<string | null>(null);

  // Modal States
  const [selectedProof, setSelectedProof] = useState<{
    title: string;
    target: string;
    blob: string;
    txHash?: string;
  } | null>(null);

  const [shareCred, setShareCred] = useState<VerifiableCredential | null>(null);
  const [selectedShareAttributes, setSelectedShareAttributes] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await credentialService.getCredentials();
      setCredentials(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database connection error';
      console.error('[WalletPage] Database error loading documents:', msg);
      showToast('Database Error', {
        type: 'error',
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`, { type: 'success' });
  };

  const handleCreateDID = async () => {
    setDidModalOpen(true);
    setDidActionStatus('waiting');
    setDidErrorMessage(null);

    try {
      const created = await identityService.createDID(
        user?.name || 'Student User',
        user?.email || 'student@selfid.local'
      );
      await refreshUser();
      setDidTxHash(created.txHash || null);
      setDidActionStatus('confirmed');
      showToast('Your Digital ID Created & Saved', { type: 'success' });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to create Digital ID';
      const cleanMsg =
        rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
          ? 'The demo wallet needs more test coins'
          : rawMsg;
      setDidErrorMessage(cleanMsg);
      setDidActionStatus('failed');
      showToast('Transaction Failed', {
        type: 'error',
        description: cleanMsg,
      });
    }
  };

  const openShareModal = (cred: VerifiableCredential) => {
    setShareCred(cred);
    const initial: Record<string, boolean> = {};
    cred.attributes.forEach((attr) => {
      initial[attr.key] = true;
    });
    setSelectedShareAttributes(initial);
  };

  const handleCompleteShare = () => {
    if (!shareCred) return;
    const count = Object.values(selectedShareAttributes).filter(Boolean).length;
    showToast('Confirm and share', {
      type: 'success',
      description: `Prepared ${count} of ${shareCred.attributes.length} details. Private info stays hidden.`,
    });
    setShareCred(null);
  };

  const filteredCredentials = credentials.filter((cred) => {
    const matchesCategory =
      activeCategory === 'all'
        ? true
        : activeCategory === 'academic'
        ? cred.category === 'academic'
        : activeCategory === 'identity'
        ? cred.category === 'identity'
        : activeCategory === 'work'
        ? cred.category === 'work'
        : true;

    const matchesSearch =
      searchQuery.trim() === ''
        ? true
        : cred.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cred.issuerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cred.attributes.some((a) => a.value.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const hasDid = Boolean(user?.did);

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto flex flex-col gap-8">
      {/* Top Greeting Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#8083ff]/10 text-[#8083ff] font-mono text-[11px] uppercase tracking-widest font-semibold">
              Locked on device
            </span>
            <span className="text-[#908fa0] text-xs">•</span>
            <span className="text-[#4edea3] font-mono text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              Ready
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Welcome, {user?.name || 'Student User'}
          </h1>

          <p className="text-sm text-[#5de6ff] font-medium">
            This is your private safe where you can see your documents, create your digital ID, and choose what to share.
          </p>

          <p className="text-xs text-[#c7c4d7] flex items-center gap-2 flex-wrap">
            <span>Your Private Safe</span>
            <span className="text-[#908fa0]">•</span>
            <span className="text-[#8083ff] font-semibold">
              {credentials.length} {credentials.length === 1 ? 'Saved Document' : 'Saved Documents'}
            </span>
            <span className="text-[#908fa0]">•</span>
            <Link to="/app/requests" className="text-[#5de6ff] font-semibold hover:underline">
              Check Incoming Requests
            </Link>
          </p>
        </div>

        {/* Action Controls: Add Document, Notification, Profile */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/app/add-document')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-sm font-semibold shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>+ Add a document</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/requests')}
            className="w-10 h-10 rounded-xl bg-[#151b2a] hover:bg-[#232a39] border border-white/5 text-[#908fa0] hover:text-white flex items-center justify-center transition-colors relative cursor-pointer"
            title="Notifications & Incoming Requests"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#5de6ff]" />
          </button>

          <Link
            to="/app/profile"
            className="w-10 h-10 rounded-xl bg-[#8083ff] hover:brightness-110 flex items-center justify-center text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
            title="My Profile"
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
          </Link>
        </div>
      </div>

        {/* Primary DID Identity Card */}
        <div className="relative overflow-hidden rounded-2xl bg-[#151b2a] border border-white/5 shadow-xl p-6 sm:p-8">
            <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#5de6ff]/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-[#8083ff]/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-6">
              {/* Top Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#232a39] flex items-center justify-center text-[#5de6ff] shadow-inner">
                    <span className="material-symbols-outlined text-2xl">vpn_key</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">Your Digital ID</h2>
                      <span className="px-2 py-0.5 rounded bg-[#2e3544] text-[#5de6ff] font-mono text-xs">
                        Digital ID
                      </span>
                    </div>
                    <span className="text-xs text-[#908fa0]">
                      Your unique personal number that only you control
                    </span>
                  </div>
                </div>

                {hasDid ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00885d]/20 text-[#4edea3] text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
                      <span>Saved on the secure public record</span>
                    </div>
                    {user?.txHash && (
                      <a
                        href={getExplorerTxUrl(user.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#19202e] text-[#5de6ff] hover:underline text-xs font-mono"
                        title="View transaction on explorer"
                      >
                        <span>Record ID: {user.txHash.slice(0, 14)}...</span>
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateDID}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-lg hover:brightness-105 transition-all cursor-pointer"
                  >
                    Create my digital ID
                  </button>
                )}
              </div>

              {/* Monospace DID Strip */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 rounded-xl bg-[#070e1c] border border-white/5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[#5de6ff] text-2xl">
                    shield_person
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold">
                      Your Digital ID Number
                    </span>
                    <span className="font-mono text-sm text-[#5de6ff] tracking-tight truncate">
                      {hasDid
                        ? user?.did
                        : 'No Digital ID created yet — click "Create my digital ID" to generate one'}
                    </span>
                  </div>
                </div>

                {hasDid && (
                  <button
                    type="button"
                    onClick={() => handleCopy(user?.did || '', 'Your Digital ID')}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold transition-all shrink-0 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    <span>Copy Digital ID</span>
                  </button>
                )}
              </div>

              {/* Bottom Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-xl bg-[#19202e] border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-[#908fa0] text-xs">
                    <span className="material-symbols-outlined text-[16px] text-[#8083ff]">
                      code
                    </span>
                    <span>Security Type</span>
                  </div>
                  <span className="text-sm font-semibold text-white font-mono">
                    {user?.keyAlgorithm || 'ECDSA secp256k1'}
                  </span>
                  <span className="text-[11px] text-[#908fa0]">Locked on device</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#19202e] border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-[#908fa0] text-xs">
                    <span className="material-symbols-outlined text-[16px] text-[#8083ff]">
                      calendar_month
                    </span>
                    <span>Date Created</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {hasDid ? user?.creationDate : 'Not created yet'}
                  </span>
                  <span className="text-[11px] text-[#908fa0]">
                    {hasDid ? 'Exact date confirmed' : 'Generate anytime'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#19202e] border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-[#908fa0] text-xs">
                    <span className="material-symbols-outlined text-[16px] text-[#4edea3]">
                      lock_reset
                    </span>
                    <span>Who Controls This</span>
                  </div>
                  <span className="text-sm font-semibold text-[#4edea3]">Only You</span>
                  <span className="text-[11px] text-[#908fa0]">Saved on this device only</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#19202e] border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-[#908fa0] text-xs">
                    <span className="material-symbols-outlined text-[16px] text-[#5de6ff]">
                      security
                    </span>
                    <span>Safe Storage</span>
                  </div>
                  <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasDid ? 'bg-[#4edea3]' : 'bg-amber-400'
                      }`}
                    />
                    {hasDid ? 'Locked and active' : 'Ready to create'}
                  </span>
                  <span className="text-[11px] text-[#908fa0]">
                    Stored safely inside your browser
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Verifiable Credentials Section */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-white tracking-tight">Your Documents</h2>
                <p className="text-xs text-[#908fa0]">
                  Documents created from uploaded files and locked with AES-256-GCM.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center p-1 bg-[#19202e] border border-white/5 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveCategory('all')}
                    className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                      activeCategory === 'all'
                        ? 'bg-[#232a39] text-white shadow-sm'
                        : 'text-[#908fa0] hover:text-white'
                    }`}
                  >
                    All ({credentials.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategory('academic')}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      activeCategory === 'academic'
                        ? 'bg-[#232a39] text-white shadow-sm'
                        : 'text-[#908fa0] hover:text-white'
                    }`}
                  >
                    Academic
                  </button>
                </div>

                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[#908fa0] text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="w-full sm:w-56 pl-9 pr-3 py-1.5 rounded-xl bg-[#151b2a] border border-white/5 text-xs text-white placeholder:text-[#908fa0] focus:outline-none focus:border-[#5de6ff]"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-[#908fa0] flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-xl">
                  progress_activity
                </span>
                <span>Reading locked documents...</span>
              </div>
            ) : filteredCredentials.length === 0 ? (
              <div className="p-12 rounded-2xl bg-[#151b2a] border border-white/5 text-center text-[#908fa0] flex flex-col items-center justify-center gap-3">
                <span className="material-symbols-outlined text-4xl text-[#5de6ff]">
                  upload_file
                </span>
                <span className="text-base font-bold text-white">No Documents Saved Yet</span>
                <span className="text-xs max-w-md">
                  Upload your college ID or credential document so we can read the details from it, lock and save them, and record the fingerprint.
                </span>
                <Link
                  to="/app/add-document"
                  className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-md hover:brightness-105 inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>+ Add a document</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredCredentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="bg-white text-slate-900 rounded-2xl p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_16px_36px_-6px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1 relative"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Top Row: Icon, Title, and Sample Document Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner bg-indigo-50 text-indigo-800">
                            <span className="material-symbols-outlined text-[28px]">school</span>
                          </div>
                          <div className="flex flex-col">
                            <h3 className="text-lg font-bold text-slate-900 leading-tight">
                              {cred.title}
                            </h3>
                            <span className="text-xs text-slate-500">{cred.subtitle}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Locked and saved
                          </span>
                          {cred.isTestMode && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 text-[10px] font-semibold font-mono">
                              Test mode
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        {cred.attributes.slice(0, 4).map((attr) => (
                          <div key={attr.key} className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                              {attr.label}
                            </span>
                            <span className="text-slate-800 font-semibold truncate mt-0.5">
                              {attr.value}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Fingerprint Strip */}
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1 truncate">
                          <span className="text-slate-400 uppercase">Fingerprint:</span>
                          <span className="truncate">
                            {cred.sha256Hash.slice(0, 16)}...{cred.sha256Hash.slice(-4)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(cred.sha256Hash, 'Document Fingerprint')}
                          className="text-slate-400 hover:text-indigo-600 p-1"
                          title="Copy Fingerprint"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            content_copy
                          </span>
                        </button>
                      </div>

                      {/* Created date & Public record status */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Created: {cred.issuedDate}</span>
                        <span className="font-semibold text-indigo-700">
                          Fingerprint saved on the public record
                        </span>
                      </div>
                    </div>

                    {/* Card Bottom Actions */}
                    <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
                      <Link
                        to={`/app/documents/${cred.id}`}
                        className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>View document details</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProof({
                              title: cred.title,
                              target: `${cred.title} (Created: ${cred.issuedDate})`,
                              blob: cred.sha256Hash,
                            })
                          }
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          <span>Fingerprint</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openShareModal(cred)}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">ios_share</span>
                          <span>Confirm and share</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

      {/* Proof Inspector Modal */}
      <Modal
        isOpen={!!selectedProof}
        onClose={() => setSelectedProof(null)}
        title="Document Fingerprint"
        subtitle={selectedProof?.title}
        icon="fingerprint"
        iconColor="text-[#4edea3]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[#908fa0] font-semibold">
              Document
            </span>
            <span className="text-xs font-medium text-white">{selectedProof?.target}</span>
          </div>

          <div className="p-4 rounded-xl bg-[#151b2a] border border-white/5 flex flex-col gap-2 font-mono text-xs">
            <div className="flex justify-between text-[#908fa0]">
              <span>Status:</span>
              <span className="text-[#4edea3] font-semibold">
                Fingerprint saved on the public record
              </span>
            </div>
            <div className="text-[#5de6ff] break-all leading-relaxed">
              {selectedProof?.blob}
            </div>
          </div>
        </div>
      </Modal>

      {/* Selective Disclosure Share Modal */}
      <Modal
        isOpen={!!shareCred}
        onClose={() => setShareCred(null)}
        title="Choose what to share"
        subtitle={shareCred?.title}
        icon="lock_clock"
        iconColor="text-[#8083ff]"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShareCred(null)}
              className="px-4 py-2 rounded-xl bg-[#19202e] text-xs font-semibold text-white hover:bg-[#232a39]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCompleteShare}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-xs font-semibold text-white shadow-md hover:brightness-105"
            >
              Confirm and share
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[#c7c4d7]">
            Select only the details you want to share with the verifier. All other details stay locked.
          </p>

          <div className="flex flex-col gap-2">
            {shareCred?.attributes.map((attr) => (
              <label
                key={attr.key}
                className="flex items-center justify-between p-3 rounded-xl bg-[#151b2a] border border-white/5 cursor-pointer hover:bg-[#19202e] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[#5de6ff]">
                    verified
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">{attr.label}</span>
                    <span className="text-[11px] text-[#908fa0]">{attr.value}</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!selectedShareAttributes[attr.key]}
                  onChange={(e) =>
                    setSelectedShareAttributes((prev) => ({
                      ...prev,
                      [attr.key]: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-[#8083ff] focus:ring-0 bg-[#232a39] cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>
      </Modal>

      {/* On-Chain Action Modal for DID Creation */}
      <OnChainActionModal
        isOpen={didModalOpen}
        onClose={() => setDidModalOpen(false)}
        title="Registering Digital ID"
        status={didActionStatus}
        txHash={didTxHash}
        errorMessage={didErrorMessage}
        onRetry={handleCreateDID}
        onSuccessContinue={() => setDidModalOpen(false)}
        successButtonLabel="Return to My Safe"
      />
    </div>
  );
};
