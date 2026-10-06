import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastMessage } from '../types';

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (title: string, options?: { description?: string; type?: ToastMessage['type']; duration?: number }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      title: string,
      options?: { description?: string; type?: ToastMessage['type']; duration?: number }
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastMessage = {
        id,
        title,
        description: options?.description,
        type: options?.type || 'info',
        duration: options?.duration || 4000,
      };

      setToasts((prev) => [...prev, newToast]);

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast Render Floating Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-full px-4">
        {toasts.map((toast) => {
          const typeClasses = {
            success: 'bg-[#151b2a] border-emerald-500/30 text-emerald-400',
            error: 'bg-[#151b2a] border-red-500/30 text-red-400',
            warning: 'bg-[#151b2a] border-amber-500/30 text-amber-400',
            info: 'bg-[#151b2a] border-[#8083ff]/30 text-[#5de6ff]',
          }[toast.type];

          const icon = {
            success: 'check_circle',
            error: 'cancel',
            warning: 'warning',
            info: 'verified_user',
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${typeClasses}`}
            >
              <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5">
                {icon}
              </span>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold text-white leading-tight">
                  {toast.title}
                </span>
                {toast.description && (
                  <span className="text-xs text-[#c7c4d7] mt-1 leading-relaxed">
                    {toast.description}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[#908fa0] hover:text-white p-1 transition-colors"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
