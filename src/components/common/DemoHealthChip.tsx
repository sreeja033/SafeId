import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/apiClient';
import { Modal } from './Modal';

export interface HealthReport {
  status: 'ok' | 'warn' | 'fail';
  firstProblem: string | null;
  demoMode: boolean;
  timestamp: string;
  databaseReachable: {
    status: 'ok' | 'warn' | 'fail';
    message: string;
  };
  tables: Record<
    string,
    {
      status: 'ok' | 'warn' | 'fail';
      logicalName: string;
      dbTableName: string;
      exists: boolean;
      rowCount?: number;
      message?: string;
    }
  >;
  allTablesPresent: {
    status: 'ok' | 'warn' | 'fail';
    message: string;
  };
  chainReachable: {
    status: 'ok' | 'warn' | 'fail';
    message: string;
    chainId?: number;
  };
  contractAddressResponding: {
    status: 'ok' | 'warn' | 'fail';
    address?: string;
    message: string;
  };
  relayerWalletBalance: {
    status: 'ok' | 'warn' | 'fail';
    balance: number;
    symbol: string;
    isLow: boolean;
    message: string;
  };
  encryptionKeyValid: {
    status: 'ok' | 'warn' | 'fail';
    message: string;
  };
  geminiApiKeyPresent: {
    status: 'ok' | 'warn' | 'fail';
    message: string;
  };
}

export const DemoHealthChip: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data } = await apiRequest<HealthReport>('/health');
      if (data) {
        setHealth(data);
      }
    } catch {
      // Ignore network errors in preview
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh periodically
    const timer = setInterval(fetchHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  const getStatusBadge = (status: 'ok' | 'warn' | 'fail') => {
    if (status === 'ok') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-[#00885d]/20 text-[#4edea3] text-[10px] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
          OK
        </span>
      );
    }
    if (status === 'warn') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          WARN
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-[#ffb4ab] text-[10px] font-semibold flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        FAIL
      </span>
    );
  };

  if (loading && !health) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#151b2a] border border-white/5 text-[#908fa0] text-xs ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] animate-ping" />
        <span>Checking systems...</span>
      </div>
    );
  }

  const isAllReady = health?.status === 'ok' && !health?.firstProblem;
  const label = isAllReady ? 'All systems ready' : health?.firstProblem || 'Check system status';

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm transition-all cursor-pointer ${
          isAllReady
            ? 'bg-[#00885d]/15 hover:bg-[#00885d]/25 border border-[#00885d]/30 text-[#4edea3]'
            : 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300'
        } ${className}`}
        title="Live demo system status — Click to view diagnostic report"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isAllReady ? 'bg-[#4edea3] animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span>{label}</span>
      </button>

      {modalOpen && health && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Demo Readiness & System Health"
          subtitle="Real-time verification of database, smart contracts, relayer wallet, and security keys"
          maxWidth="2xl"
        >
          <div className="flex flex-col gap-5 text-xs">
            {/* Top Overview Banner */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                isAllReady
                  ? 'bg-[#00885d]/10 border-[#00885d]/30 text-[#4edea3]'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl">
                  {isAllReady ? 'verified' : 'warning'}
                </span>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-white">{label}</span>
                  <span className="text-[11px] opacity-85">
                    {isAllReady
                      ? 'Every subsystem, contract, and table is reachable and ready for the demo.'
                      : 'Please review the item flagged below before starting the live demonstration.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchHealth}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-lg bg-[#232a39] hover:bg-[#2e3544] text-white text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0"
              >
                <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>Refresh</span>
              </button>
            </div>

            {/* Subsystem Health Table */}
            <div className="bg-[#070e1c] border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
              {/* 1. Database Reachable */}
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-white">Database Reachable</span>
                  <span className="text-[11px] text-[#908fa0] truncate">
                    {health.databaseReachable.message}
                  </span>
                </div>
                {getStatusBadge(health.databaseReachable.status)}
              </div>

              {/* 2. Required Tables Present */}
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-white">Required Tables Present</span>
                    <span className="text-[11px] text-[#908fa0]">
                      {health.allTablesPresent.message}
                    </span>
                  </div>
                  {getStatusBadge(health.allTablesPresent.status)}
                </div>

                {/* Table pill chips */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                  {Object.entries(health.tables || {}).map(([key, tbl]) => (
                    <div
                      key={key}
                      className="p-2 rounded-lg bg-[#151b2a] border border-white/5 flex items-center justify-between gap-1 text-[11px]"
                    >
                      <span className="font-mono text-[#c7c4d7] truncate">{tbl.logicalName}</span>
                      <span
                        className={`material-symbols-outlined text-[14px] ${
                          tbl.status === 'ok' ? 'text-[#4edea3]' : 'text-red-400'
                        }`}
                      >
                        {tbl.status === 'ok' ? 'check' : 'close'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Blockchain Reachable */}
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-white">Blockchain Network Reachable</span>
                  <span className="text-[11px] text-[#908fa0] truncate">
                    {health.chainReachable.message}
                  </span>
                </div>
                {getStatusBadge(health.chainReachable.status)}
              </div>

              {/* 4. Contract Address Responding */}
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-white">Contract Address Responding</span>
                  <span className="text-[11px] font-mono text-[#5de6ff] truncate">
                    {health.contractAddressResponding.address || 'SelfID.sol'}
                  </span>
                  <span className="text-[10px] text-[#908fa0]">
                    {health.contractAddressResponding.message}
                  </span>
                </div>
                {getStatusBadge(health.contractAddressResponding.status)}
              </div>

              {/* 5. Relayer Wallet Balance (Number Only, Never Key) */}
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Relayer Wallet Balance</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#8083ff]/20 text-[#c0c1ff] font-mono text-[10px] font-semibold">
                      {health.relayerWalletBalance.balance.toFixed(4)} {health.relayerWalletBalance.symbol}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#908fa0]">
                    {health.relayerWalletBalance.message}
                  </span>
                </div>
                {getStatusBadge(health.relayerWalletBalance.status)}
              </div>

              {/* 6. Encryption Key Valid */}
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-white">AES-256-GCM Encryption Key</span>
                  <span className="text-[11px] text-[#908fa0]">
                    {health.encryptionKeyValid.message}
                  </span>
                </div>
                {getStatusBadge(health.encryptionKeyValid.status)}
              </div>

              {/* 7. GEMINI_API_KEY Present */}
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-white">GEMINI_API_KEY</span>
                  <span className="text-[11px] text-[#908fa0]">
                    {health.geminiApiKeyPresent.message}
                  </span>
                </div>
                {getStatusBadge(health.geminiApiKeyPresent.status)}
              </div>
            </div>

            {/* Close action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
