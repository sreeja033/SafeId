import React from 'react';

export interface FieldChipProps {
  label: string;
  isZk?: boolean;
  isProtected?: boolean;
  className?: string;
  onRemove?: () => void;
}

export const FieldChip: React.FC<FieldChipProps> = ({
  label,
  isZk = false,
  isProtected = false,
  className = '',
  onRemove,
}) => {
  const isZkClaim = isZk || label.includes('ZK') || label.includes('ZKP');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
        isZkClaim
          ? 'bg-[#8083ff]/20 text-[#c0c1ff] border border-[#8083ff]/30'
          : isProtected
          ? 'bg-[#93000a]/20 text-[#ffb4ab] border border-[#ffb4ab]/20'
          : 'bg-[#232a39] text-[#dce2f6] border border-white/5'
      } ${className}`}
    >
      {isZkClaim && (
        <span className="material-symbols-outlined text-[13px] text-[#5de6ff]">
          lock
        </span>
      )}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:text-white p-0.5 rounded transition-colors"
        >
          <span className="material-symbols-outlined text-[13px]">close</span>
        </button>
      )}
    </span>
  );
};
