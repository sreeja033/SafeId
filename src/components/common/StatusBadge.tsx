import React from 'react';

export type BadgeStatus = 'valid' | 'approved' | 'active' | 'revoked' | 'failed' | 'pending' | 'expired';

export interface StatusBadgeProps {
  status: BadgeStatus | string;
  label?: string;
  pulse?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  pulse = false,
  className = '',
  size = 'md',
}) => {
  const norm = status.toLowerCase();

  let styles = 'bg-[#4edea3]/15 text-[#4edea3]';
  let dotColor = 'bg-[#4edea3]';
  let defaultLabel = 'Real & Valid';
  let icon: string | null = null;

  if (norm.includes('valid') || norm.includes('approved') || norm.includes('active')) {
    styles = 'bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/20';
    dotColor = 'bg-[#4edea3]';
    defaultLabel = norm.includes('valid') ? 'Approved & Valid' : 'Active';
  } else if (norm.includes('revoke') || norm.includes('denied')) {
    styles = 'bg-[#ffb4ab]/15 text-[#ffb4ab] border border-[#ffb4ab]/20';
    dotColor = 'bg-[#ffb4ab]';
    defaultLabel = 'Access Taken Back';
    icon = 'block';
  } else if (norm.includes('pending') || norm.includes('awaiting')) {
    styles = 'bg-[#5de6ff]/15 text-[#5de6ff] border border-[#5de6ff]/20';
    dotColor = 'bg-[#5de6ff]';
    defaultLabel = 'Awaiting Permission';
    pulse = true;
  } else if (norm.includes('expire') || norm.includes('failed')) {
    styles = 'bg-[#2e3544] text-[#908fa0] border border-[#464554]/40';
    dotColor = 'bg-[#908fa0]';
    defaultLabel = 'Expired';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full font-['Inter'] uppercase tracking-wider ${padding} ${styles} ${className}`}
    >
      {icon ? (
        <span className="material-symbols-outlined text-[13px]">{icon}</span>
      ) : (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      <span>{label || defaultLabel}</span>
    </span>
  );
};
