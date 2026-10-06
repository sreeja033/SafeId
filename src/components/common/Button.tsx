import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2.5',
  }[size];

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] text-white shadow-lg hover:shadow-[#22d3ee]/25 hover:brightness-105 border border-white/10',
    secondary:
      'bg-[#19202e] hover:bg-[#232a39] text-[#dce2f6] border border-[#464554]/40 hover:border-[#5de6ff]/50 shadow-sm',
    danger:
      'bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] border border-[#ffb4ab]/30 hover:border-[#ffb4ab]/60',
    ghost:
      'bg-transparent hover:bg-[#232a39] text-[#c7c4d7] hover:text-white',
    outline:
      'bg-transparent hover:bg-[#19202e] text-[#dce2f6] border border-[#464554] hover:border-[#908fa0]',
    subtle:
      'bg-[#232a39] hover:bg-[#2e3544] text-[#dce2f6] hover:text-white',
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="material-symbols-outlined text-[18px] animate-spin">
            progress_activity
          </span>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
