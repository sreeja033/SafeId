import React from 'react';
import { Modal } from './Modal';
import { getExplorerTxUrl, formatTxHashShort } from '../../lib/explorer';
import { useToast } from '../../context/ToastContext';

export interface OnChainActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  status: 'waiting' | 'failed' | 'confirmed';
  txHash?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  onSuccessContinue?: () => void;
  successButtonLabel?: string;
}

export const OnChainActionModal: React.FC<OnChainActionModalProps> = ({
  isOpen,
  onClose,
  title,
  status,
  txHash,
  errorMessage,
  onRetry,
  onSuccessContinue,
  successButtonLabel = 'Done',
}) => {
  const { showToast } = useToast();

  if (!isOpen) return null;

  const copyHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      showToast('Transaction hash copied', { type: 'success' });
    }
  };

  const cleanErrorMessage =
    errorMessage &&
    (errorMessage.toLowerCase().includes('needs more test coins') ||
      errorMessage.toLowerCase().includes('insufficient funds'))
      ? 'The demo wallet needs more test coins'
      : errorMessage || 'Transaction could not be confirmed.';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => (status === 'waiting' ? null : onClose())}
      title={title}
      subtitle="Public record & blockchain state synchronization"
      maxWidth="md"
    >
      <div className="flex flex-col gap-6 text-xs py-2">
        {/* 1. WAITING FOR CONFIRMATION STATE */}
        {status === 'waiting' && (
          <div className="flex flex-col items-center justify-center text-center gap-4 py-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-[#8083ff]/10 border border-[#8083ff]/30 text-[#8083ff] flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-3xl animate-spin">
                  progress_activity
                </span>
              </div>
              <span className="w-3 h-3 rounded-full bg-[#4edea3] absolute -bottom-1 -right-1 ring-2 ring-[#0c1321] animate-ping" />
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold text-white tracking-tight">
                Waiting for On-Chain Confirmation
              </h3>
              <p className="text-xs text-[#908fa0] leading-relaxed max-w-xs">
                Submitting transaction to the blockchain network and awaiting block receipt...
              </p>
            </div>

            <div className="w-full bg-[#070e1c] p-3 rounded-xl border border-white/5 flex items-center justify-between text-[11px] font-mono text-[#c7c4d7]">
              <span>Status</span>
              <span className="text-[#5de6ff] flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] animate-pulse" />
                Mining Block
              </span>
            </div>
          </div>
        )}

        {/* 2. FAILURE STATE WITH RETRY BUTTON */}
        {status === 'failed' && (
          <div className="flex flex-col items-center justify-center text-center gap-4 py-3">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-[#ffb4ab] flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-3xl">error</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold text-white tracking-tight">
                Transaction Could Not Complete
              </h3>
              <p className="text-xs text-[#ffb4ab] leading-relaxed font-medium bg-red-500/10 p-3 rounded-xl border border-red-500/20 max-w-xs">
                {cleanErrorMessage}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 w-full pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>

              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Retry Transaction</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. CONFIRMED STATE WITH TRANSACTION LINK */}
        {status === 'confirmed' && (
          <div className="flex flex-col items-center justify-center text-center gap-4 py-3">
            <div className="w-16 h-16 rounded-2xl bg-[#00885d]/10 border border-[#00885d]/30 text-[#4edea3] flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-white tracking-tight">
                Transaction Confirmed on Public Record
              </h3>
              <p className="text-xs text-[#908fa0]">
                State has been successfully anchored and cryptographically verified.
              </p>
            </div>

            {txHash && (
              <div className="w-full p-3.5 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-2 text-left">
                <div className="flex items-center justify-between text-[11px] text-[#908fa0]">
                  <span>Transaction Hash</span>
                  <button
                    type="button"
                    onClick={copyHash}
                    className="hover:text-white flex items-center gap-1"
                    title="Copy Hash"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>Copy</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-[#5de6ff] break-all">
                  {formatTxHashShort(txHash)}
                </div>

                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8083ff] hover:text-[#c0c1ff] hover:underline pt-1"
                >
                  <span>View on Polygon Explorer</span>
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                </a>
              </div>
            )}

            <div className="w-full pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onSuccessContinue) {
                    onSuccessContinue();
                  } else {
                    onClose();
                  }
                }}
                className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-md hover:brightness-105 transition-all"
              >
                {successButtonLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
