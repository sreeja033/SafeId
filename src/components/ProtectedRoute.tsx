import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole, children }) => {
  const { isAuthenticated, role, isLoading, signOut } = useAuth();
  const location = useLocation();

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c1321] flex flex-col items-center justify-center gap-3 text-[#dce2f6] selection:bg-[#8083ff]/30">
        <div className="w-14 h-14 rounded-2xl bg-[#151b2a] border border-white/10 flex items-center justify-center text-[#5de6ff] shadow-2xl relative">
          <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
          <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#4edea3] ring-2 ring-[#0c1321]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">Verifying Security Session...</p>
          <p className="text-xs text-[#908fa0] mt-0.5">Confirming your role and device permissions</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Redirect to /auth
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Role Mismatch: Reject USER in VERIFIER routes and VERIFIER in USER routes
  if (role && role !== allowedRole) {
    const isVerifierInUserRoute = role === 'VERIFIER' && allowedRole === 'USER';

    return (
      <div className="min-h-screen bg-[#0c1321] text-[#dce2f6] flex flex-col items-center justify-center p-6 selection:bg-[#8083ff]/30">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#151b2a] border border-white/10 shadow-2xl flex flex-col items-center text-center gap-5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#ffb4ab] via-[#8083ff] to-[#5de6ff]" />

          <div className="w-16 h-16 rounded-2xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-3xl">shield_locked</span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffb4ab]/10 text-[#ffb4ab] text-xs font-mono font-semibold mb-2">
              <span>Access Restricted</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isVerifierInUserRoute
                ? 'Verifier Account Detected'
                : 'Document Owner Account Detected'}
            </h2>
            <p className="text-xs text-[#c7c4d7] mt-2 leading-relaxed">
              {isVerifierInUserRoute
                ? 'You are currently signed in as an organization verifier. This area is reserved exclusively for personal wallet holders to manage private credentials.'
                : 'You are signed in as a personal document owner. The Verifier Portal is restricted to registered organizations and compliance officers.'}
            </p>
          </div>

          <div className="w-full flex flex-col gap-2.5 pt-2">
            <Link
              to={role === 'VERIFIER' ? '/verifier' : '/app/wallet'}
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">
                {role === 'VERIFIER' ? 'domain' : 'account_balance_wallet'}
              </span>
              <span>
                {role === 'VERIFIER' ? 'Return to Verifier Console' : 'Return to My Document Safe'}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-[#908fa0] hover:text-white hover:bg-[#19202e] border border-white/5 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign out and use a different account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
