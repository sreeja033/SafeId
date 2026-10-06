import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconColor = 'text-[#5de6ff]',
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070e1c]/80 backdrop-blur-md transition-all">
      <div
        className={`w-full ${maxWidthClass} rounded-2xl bg-[#070e1c] border border-white/10 shadow-2xl p-6 flex flex-col gap-5 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#8083ff]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#232a39] pb-4">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-[#19202e] flex items-center justify-center shrink-0 shadow-inner">
                <span className={`material-symbols-outlined text-[22px] ${iconColor}`}>
                  {icon}
                </span>
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <h3 className="text-lg font-bold text-[#dce2f6] tracking-tight">{title}</h3>
              {subtitle && (
                <span className="font-mono text-xs text-[#908fa0] truncate mt-0.5">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#19202e] hover:bg-[#232a39] text-[#908fa0] hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-col gap-4 text-sm text-[#dce2f6] max-h-[70vh] overflow-y-auto pr-1">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232a39]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
