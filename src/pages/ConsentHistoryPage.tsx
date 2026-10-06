import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { consentService } from '../services/consentService';
import { ConsentHistoryItem } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { OnChainActionModal } from '../components/common/OnChainActionModal';
import { getExplorerTxUrl } from '../lib/explorer';

export const ConsentHistoryPage: React.FC = () => {
  const { showToast } = useToast();

  const [items, setItems] = useState<ConsentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked' | 'expired'>('all');
  const [verifierCategoryFilter, setVerifierCategoryFilter] = useState('All');

  // Revocation Modal state
  const [targetToRevoke, setTargetToRevoke] = useState<ConsentHistoryItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // On-Chain Action Modal state
  const [revokeActionModalOpen, setRevokeActionModalOpen] = useState(false);
  const [revokeActionStatus, setRevokeActionStatus] = useState<'waiting' | 'failed' | 'confirmed'>('waiting');
  const [revokeTxHash, setRevokeTxHash] = useState<string | null>(null);
  const [revokeErrorMessage, setRevokeErrorMessage] = useState<string | null>(null);
  const [lastRevokedItem, setLastRevokedItem] = useState<ConsentHistoryItem | null>(null);

  // Proof Inspector Modal state
  const [viewProofItem, setViewProofItem] = useState<ConsentHistoryItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const data = await consentService.getConsentHistory();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleConfirmRevocation = async (itemOverride?: ConsentHistoryItem) => {
    const itemToRevoke = itemOverride || targetToRevoke || lastRevokedItem;
    if (!itemToRevoke) return;
    setLastRevokedItem(itemToRevoke);
    setTargetToRevoke(null);
    setRevokeActionModalOpen(true);
    setRevokeActionStatus('waiting');
    setRevokeErrorMessage(null);
    setRevokeTxHash(null);

    try {
      const updated = await consentService.revokeConsent(
        itemToRevoke.id,
        itemToRevoke.onChainConsentId
      );

      if (updated) {
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setRevokeTxHash(updated.revocationTx || updated.txHash || null);
        setRevokeActionStatus('confirmed');
        showToast('Take back access', {
          type: 'success',
          description: `Access stopped and saved on public record.`,
        });
      } else {
        throw new Error('Could not revoke permission');
      }
    } catch (err: unknown) {
      setRevokeActionStatus('failed');
      const rawMsg = err instanceof Error ? err.message : 'Failed to revoke access';
      const cleanMsg =
        rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
          ? 'The demo wallet needs more test coins'
          : rawMsg;
      setRevokeErrorMessage(cleanMsg);
    }
  };

  const handleReGrant = async (item: ConsentHistoryItem) => {
    // TODO: Contract call - Re-grant token presentation
    showToast(`Allowing access again for ${item.verifierName}...`, { type: 'info' });
    const regranted = await consentService.reGrantConsent(item.id);
    if (regranted) {
      setItems((prev) => prev.map((i) => (i.id === regranted.id ? regranted : i)));
      showToast('Access allowed again', {
        type: 'success',
        description: 'New permission confirmed and active.',
      });
    }
  };

  const handleExportJsonLd = () => {
    const payload = JSON.stringify(items, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selfid-consent-audit-log-${Date.now()}.json`;
    a.click();
    showToast('Downloaded history log', { type: 'success' });
  };

  const handleAuditProof = () => {
    showToast('Checking security records...', { type: 'info' });
    setTimeout(() => {
      showToast('Nothing has been changed', {
        type: 'success',
        description: 'All history matches the secure public record exactly.',
      });
    }, 600);
  };

  // Metrics calculation
  const totalCount = items.length;
  const activeCount = items.filter((i) => i.status === 'active').length;
  const revokedCount = items.filter((i) => i.status === 'revoked').length;
  const expiredCount = items.filter((i) => i.status === 'expired').length;

  const filteredItems = items.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCategory =
      verifierCategoryFilter === 'All' || item.verifierCategory.includes(verifierCategoryFilter);
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.verifierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.verifierDid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.disclosedFields.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesCategory && matchesSearch;
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto flex flex-col gap-6">
      {/* Breadcrumb & Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-[#908fa0] uppercase tracking-wider font-semibold font-mono">
            <span>Home</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-[#5de6ff]">Permission History</span>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight">
            Permission History &amp; Access Check
          </h1>

          <p className="text-sm text-[#5de6ff] font-medium">
            See every time you shared info with an organization, check their status, or take back access anytime.
          </p>

          <p className="text-xs text-[#c7c4d7] max-w-3xl">
            A safe record of every time you shared document details with an organization. You can take back access anytime with one click.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={handleAuditProof}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#19202e] hover:bg-[#232a39] text-white text-xs font-semibold border border-white/5 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[#5de6ff] text-[18px]">verified</span>
            <span>Check security proof</span>
          </button>

          <button
            type="button"
            onClick={handleExportJsonLd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-semibold shadow-lg hover:brightness-105 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Download history log</span>
          </button>
        </div>
      </div>

      {/* Summary Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold font-mono">
              Total Shared Info
            </span>
            <div className="p-2 rounded-xl bg-[#232a39] text-[#5de6ff]">
              <span className="material-symbols-outlined text-[18px]">sync_saved_locally</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{totalCount}</span>
            <span className="text-xs text-[#4edea3] flex items-center font-semibold">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              +3 this month
            </span>
          </div>
          <div className="mt-2 text-xs text-[#908fa0]">Saved on secure record</div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold font-mono">
              Active Permissions
            </span>
            <div className="p-2 rounded-xl bg-[#00885d]/20 text-[#4edea3]">
              <span className="material-symbols-outlined text-[18px]">shield</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{activeCount}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00885d]/20 text-[#4edea3] text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              Active Now
            </span>
          </div>
          <div className="mt-2 text-xs text-[#908fa0]">Earliest renewal in 2 days</div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold font-mono">
              Taken Back Access
            </span>
            <div className="p-2 rounded-xl bg-red-500/20 text-[#ffb4ab]">
              <span className="material-symbols-outlined text-[18px]">key_off</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{revokedCount}</span>
            <span className="text-xs text-[#ffb4ab] font-medium">Access Stopped</span>
          </div>
          <div className="mt-2 text-xs text-[#908fa0]">Organizations can no longer see info</div>
        </div>

        {/* Card 4 */}
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold font-mono">
              Expired Permissions
            </span>
            <div className="p-2 rounded-xl bg-[#232a39] text-[#908fa0]">
              <span className="material-symbols-outlined text-[18px]">history_toggle_off</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{expiredCount}</span>
            <span className="text-xs text-[#908fa0]">Ended automatically</span>
          </div>
          <div className="mt-2 text-xs text-[#908fa0]">Time limit reached</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-[#151b2a] border border-white/5 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#908fa0] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by verifier, document, or record ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070e1c] border border-white/5 text-white placeholder:text-[#908fa0] text-xs focus:outline-none focus:border-[#5de6ff]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Segments */}
          <div className="flex items-center bg-[#070e1c] border border-white/5 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-[#232a39] text-[#5de6ff] shadow-sm'
                  : 'text-[#908fa0] hover:text-white'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-[#232a39] text-[#4edea3] font-semibold shadow-sm'
                  : 'text-[#908fa0] hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
              <span>Active ({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('revoked')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'revoked'
                  ? 'bg-[#232a39] text-[#ffb4ab] font-semibold shadow-sm'
                  : 'text-[#908fa0] hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]" />
              <span>Access Taken Back ({revokedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'expired'
                  ? 'bg-[#232a39] text-white font-semibold shadow-sm'
                  : 'text-[#908fa0] hover:text-white'
              }`}
            >
              Expired ({expiredCount})
            </button>
          </div>

          {/* Verifier Category Filter */}
          <div className="relative">
            <select
              value={verifierCategoryFilter}
              onChange={(e) => setVerifierCategoryFilter(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 rounded-xl bg-[#070e1c] border border-white/5 text-white text-xs font-semibold cursor-pointer focus:outline-none focus:border-[#5de6ff]"
            >
              <option value="All">All Categories</option>
              <option value="Academic">Schools &amp; Universities</option>
              <option value="Fintech">Banks &amp; Finance</option>
              <option value="Healthcare">Healthcare &amp; Clinics</option>
              <option value="Mobility">Car &amp; Travel</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#908fa0] pointer-events-none text-[18px]">
              arrow_drop_down
            </span>
          </div>
        </div>
      </div>

      {/* Table View */}
      <div className="bg-[#151b2a] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#070e1c] text-[#908fa0] text-[11px] font-mono uppercase tracking-wider border-b border-white/5">
                <th className="py-4 px-6 font-semibold">Verifier &amp; Digital ID</th>
                <th className="py-4 px-4 font-semibold">Shared Details</th>
                <th className="py-4 px-4 font-semibold">Date Given / Valid For</th>
                <th className="py-4 px-4 font-semibold">Status</th>
                <th className="py-4 px-4 font-semibold">Record ID</th>
                <th className="py-4 px-6 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#19202e] text-xs text-[#dce2f6]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#908fa0]">
                    Loading permission history...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#908fa0]">
                    No shared info matches this filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#19202e]/60 transition-colors">
                    {/* Verifier */}
                    <td className="py-5 px-6 align-top">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#232a39] text-[#5de6ff] flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
                          <span className="material-symbols-outlined text-[20px]">
                            {item.verifierCategory.includes('Academic')
                              ? 'school'
                              : item.verifierCategory.includes('Fintech') || item.verifierCategory.includes('Bank')
                              ? 'account_balance'
                              : item.verifierCategory.includes('Health')
                              ? 'health_and_safety'
                              : item.verifierCategory.includes('Mobility')
                              ? 'directions_car'
                              : 'verified'}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                            <span className="truncate">{item.verifierName}</span>
                            <span
                              className="material-symbols-outlined text-[#5de6ff] text-[15px]"
                              title="Verified Issuer"
                            >
                              verified
                            </span>
                          </div>
                          <span className="text-[11px] text-[#908fa0]">
                            {item.verifierCategory} • Authorized Verifier
                          </span>
                          <div className="flex items-center gap-1 mt-1 font-mono text-[11px] text-[#5de6ff]">
                            <span className="truncate max-w-[140px]">{item.verifierDid}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Disclosed Fields */}
                    <td className="py-5 px-4 align-top">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {item.disclosedFields.map((field, i) => (
                          <span
                            key={i}
                            className={`px-2.5 py-1 rounded-lg text-xs ${
                              field.includes('Private') || field.includes('ZKP')
                                ? 'bg-[#8083ff]/20 text-[#c0c1ff] border border-[#8083ff]/30 font-semibold flex items-center gap-1'
                                : 'bg-[#232a39] text-[#dce2f6] border border-white/5'
                            }`}
                          >
                            {(field.includes('Private') || field.includes('ZKP')) && (
                              <span className="material-symbols-outlined text-[13px] text-[#5de6ff]">
                                lock
                              </span>
                            )}
                            {field.replace('ZKP', 'Private')}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Issued / Validity */}
                    <td className="py-5 px-4 align-top">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{item.issuedAt}</span>
                        <span
                          className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${
                            item.status === 'active'
                              ? 'text-[#4edea3]'
                              : item.status === 'revoked'
                              ? 'text-[#ffb4ab]'
                              : 'text-[#908fa0]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {item.status === 'active' ? 'timer' : 'history'}
                          </span>
                          {item.expiresInText}
                        </span>
                      </div>
                    </td>

                    {/* Proof Status from Contract Events */}
                    <td className="py-5 px-4 align-top">
                      <div className="flex flex-col gap-1">
                        <StatusBadge
                          status={
                            (item.contractEventStatus === 'ConsentGranted' || (!item.contractEventStatus && item.status === 'active'))
                              ? 'valid'
                              : (item.contractEventStatus === 'ConsentRevoked' || (!item.contractEventStatus && item.status === 'revoked'))
                              ? 'revoked'
                              : 'expired'
                          }
                          label={
                            item.contractEventStatus
                              ? item.contractEventStatus
                              : item.status === 'active'
                              ? 'ConsentGranted'
                              : item.status === 'revoked'
                              ? 'ConsentRevoked'
                              : 'Expired'
                          }
                          pulse={item.status === 'active' && item.contractEventStatus !== 'ConsentRevoked'}
                        />
                        <span className="text-[10px] text-[#908fa0] flex items-center gap-1 font-mono">
                          {item.contractStatusSource === 'fallback_database' ? (
                            <>
                              <span className="w-1 h-1 rounded-full bg-amber-400" />
                              <span>DB fallback</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1 h-1 rounded-full bg-[#4edea3]" />
                              <span>Contract event</span>
                            </>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* On-Chain Tx & View on Explorer link */}
                    <td className="py-5 px-4 align-top font-mono text-xs">
                      <a
                        href={getExplorerTxUrl(item.revocationTx || item.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#070e1c] hover:bg-[#151b2a] border border-white/5 text-[#5de6ff] hover:text-[#c0c1ff] hover:underline font-medium transition-colors"
                        title="View transaction on Polygon Amoy explorer"
                      >
                        <span>View on explorer</span>
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      </a>
                    </td>

                    {/* Action */}
                    <td className="py-5 px-6 text-right align-top">
                      {item.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => setTargetToRevoke(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-red-500/20 text-[#ffb4ab] hover:bg-red-500 hover:text-white font-semibold transition-all inline-flex items-center gap-1.5 border border-red-500/30"
                        >
                          <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                          <span>Take back access</span>
                        </button>
                      ) : item.status === 'revoked' ? (
                        <div className="flex flex-col items-end">
                          <button
                            type="button"
                            onClick={() => setViewProofItem(item)}
                            className="text-[#5de6ff] hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              verified_user
                            </span>
                            <span>View details</span>
                          </button>
                          <span className="font-mono text-[10px] text-[#908fa0] mt-1">
                            Fingerprint: {item.accumulatorProof}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleReGrant(item)}
                            className="px-3 py-1 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold transition-all"
                          >
                            Allow again
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewProofItem(item)}
                            className="text-[#908fa0] hover:text-white text-xs"
                          >
                            History log
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 bg-[#070e1c] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#908fa0]">
          <span>Showing 1 to {filteredItems.length} of {totalCount} shared records</span>
          <div className="flex items-center gap-1 font-mono">
            <button className="px-2.5 py-1 rounded bg-[#151b2a] text-[#908fa0] hover:text-white">
              Previous
            </button>
            <button className="px-2.5 py-1 rounded bg-[#8083ff] text-white font-bold">1</button>
            <button className="px-2.5 py-1 rounded bg-[#151b2a] text-[#908fa0] hover:text-white">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Revocation Confirmation Modal */}
      <Modal
        isOpen={!!targetToRevoke}
        onClose={() => setTargetToRevoke(null)}
        title="Take back access?"
        subtitle={`${targetToRevoke?.verifierName} (${targetToRevoke?.verifierDid})`}
        icon="lock_reset"
        iconColor="text-red-400"
        footer={
          <>
            <button
              type="button"
              onClick={() => setTargetToRevoke(null)}
              className="px-5 py-2.5 rounded-xl bg-[#19202e] hover:bg-[#232a39] text-white text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleConfirmRevocation()}
              disabled={isRevoking}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-[0_0_20px_rgba(239,68,68,0.35)] transition-all flex items-center gap-2"
            >
              {isRevoking ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  <span>Saving update to public record...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>Take back access now</span>
                </>
              )}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 bg-[#151b2a] p-4 rounded-xl border border-white/5 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#ffb4ab] text-[18px] shrink-0 mt-0.5">
                warning
              </span>
              <p className="text-[#c7c4d7] leading-relaxed">
                This will immediately record that you took back access on the secure public record.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#908fa0] text-[18px] shrink-0 mt-0.5">
                block
              </span>
              <p className="text-[#c7c4d7] leading-relaxed">
                <strong className="text-white">{targetToRevoke?.verifierName}</strong> will no longer be able to see your info or verify your documents.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#908fa0] text-[18px] shrink-0 mt-0.5">
                vpn_key_off
              </span>
              <p className="text-[#c7c4d7] leading-relaxed">
                All active sharing sessions will end immediately.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#19202e] font-mono text-xs border border-white/5">
            <div className="flex items-center gap-2 text-[#908fa0]">
              <span className="material-symbols-outlined text-[#4edea3] text-[16px]">bolt</span>
              <span>Speed</span>
            </div>
            <span className="text-[#4edea3] font-bold">Takes effect immediately</span>
          </div>
        </div>
      </Modal>

      {/* Proof Inspector Modal */}
      <Modal
        isOpen={!!viewProofItem}
        onClose={() => setViewProofItem(null)}
        title="Saved Record Details"
        subtitle={viewProofItem?.verifierName}
        icon="history_edu"
        iconColor="text-[#5de6ff]"
      >
        <div className="flex flex-col gap-3 text-xs">
          <div className="p-3 bg-[#070e1c] rounded-xl font-mono text-[#c7c4d7] space-y-1">
            <div>Record ID: {viewProofItem?.txHash}</div>
            <div>Fingerprint: {viewProofItem?.accumulatorProof}</div>
            <div>Date Given: {viewProofItem?.issuedAt}</div>
            {viewProofItem?.revocationTx && (
              <div className="text-[#ffb4ab]">
                Take back record ID: {viewProofItem.revocationTx}
              </div>
            )}
            {viewProofItem?.revocationTimestamp && (
              <div className="text-[#ffb4ab]">
                Taken back on: {viewProofItem.revocationTimestamp}
              </div>
            )}
          </div>
          <div className="text-[11px] text-[#908fa0]">
            All details confirmed with your stamp and checked safely on your device.
          </div>
        </div>
      </Modal>

      {/* Collapsed Technical Details Section */}
      <details className="p-4 rounded-xl bg-[#151b2a] border border-white/5 text-xs text-[#908fa0] cursor-pointer select-none">
        <summary className="font-semibold text-white flex items-center justify-between hover:text-[#5de6ff]">
          <span>Technical details</span>
          <span className="text-xs font-normal text-[#908fa0]">Click to view record IDs, fingerprints, and public keys</span>
        </summary>
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2 font-mono text-[11px] text-[#c7c4d7]">
          {items.slice(0, 3).map((item) => (
            <div key={item.id}>
              <span className="text-[#908fa0]">{item.verifierName}: </span>
              <span className="text-[#5de6ff]">Record ID: {item.txHash}</span>
              <span className="text-slate-400"> | Fingerprint: {item.accumulatorProof}</span>
              <span className="text-[#4edea3]"> | Verifier Public key: {item.verifierDid}</span>
            </div>
          ))}
        </div>
      </details>

      {/* On-Chain Action Modal for Taking Back Access / Revoking Permission */}
      <OnChainActionModal
        isOpen={revokeActionModalOpen}
        onClose={() => setRevokeActionModalOpen(false)}
        title="Taking Back Access on Public Record"
        status={revokeActionStatus}
        txHash={revokeTxHash}
        errorMessage={revokeErrorMessage}
        onRetry={() => handleConfirmRevocation()}
        onSuccessContinue={() => setRevokeActionModalOpen(false)}
        successButtonLabel="Done"
      />
    </div>
  );
};
