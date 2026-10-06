import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'vault' | 'analog' | 'subtle' | 'elevated';
  className?: string;
  accentBar?: boolean;
  accentColor?: 'gradient' | 'emerald' | 'crimson' | 'cyan';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'vault',
  accentBar = false,
  accentColor = 'gradient',
  className = '',
  ...props
}) => {
  const variantClasses = {
    // Dark cryptographic vault styling
    vault:
      'bg-[#151b2a] text-[#dce2f6] border border-white/5 shadow-xl rounded-2xl relative overflow-hidden',
    // High-contrast crisp white analog physical card (used in Stitch for Verifiable Credentials)
    analog:
      'bg-white text-slate-900 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_16px_36px_-6px_rgba(0,0,0,0.4)] relative overflow-hidden',
    // Elevated high-tier card
    elevated:
      'bg-[#070e1c] text-[#dce2f6] border border-[#464554]/30 shadow-2xl rounded-2xl relative overflow-hidden',
    // Subtle container
    subtle:
      'bg-[#19202e] text-[#dce2f6] border border-white/5 rounded-xl relative',
  }[variant];

  const accentBars = {
    gradient: 'bg-gradient-to-r from-[#8083ff] via-[#5de6ff] to-[#4edea3]',
    emerald: 'bg-[#4edea3]',
    crimson: 'bg-[#ffb4ab]',
    cyan: 'bg-[#5de6ff]',
  }[accentColor];

  return (
    <div className={`${variantClasses} ${className}`} {...props}>
      {accentBar && (
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${accentBars}`} />
      )}
      {children}
    </div>
  );
};
