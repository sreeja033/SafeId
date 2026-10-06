import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

export const VerifierProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, verifier, session, signOut } = useAuth();
  const { showToast } = useToast();

  // Change Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully', { type: 'success' });
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    showToast('Logged out safely', { type: 'info' });
    navigate('/auth');
  };

  const verifierCode = profile?.verifier_code || verifier.verifierCode || 'VER-001';
  const orgName = profile?.org_name || verifier.orgName || 'Authorized Verifier';
  const officerName = profile?.full_name || `${orgName} Compliance Officer`;
  const emailDisplay = session?.user?.email || `${verifierCode.toLowerCase()}@verifiers.selfid.demo`;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5de6ff] uppercase tracking-wider font-semibold font-mono">
              Organization Console
            </span>
            <span className="text-[#908fa0] text-xs">•</span>
            <span className="text-[#4edea3] text-xs font-mono">
              Authorized Verifier
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Verifier Profile
          </h1>
          <p className="text-sm text-[#908fa0] mt-1">
            Organization credentials and verification authority details.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2.5 rounded-xl bg-[#232a39] hover:bg-[#ffb4ab]/20 hover:text-[#ffb4ab] border border-white/5 text-xs text-[#dce2f6] font-semibold flex items-center gap-2 transition-colors self-start md:self-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Log out</span>
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="bg-[#151b2a] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#8083ff] via-[#5de6ff] to-[#4edea3]" />

        {/* Verifier Identity Overview */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#070e1c] border border-white/10 flex items-center justify-center text-[#5de6ff] text-2xl font-bold shadow-lg">
              <span className="material-symbols-outlined text-3xl">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{orgName}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#5de6ff]/20 text-[#5de6ff] border border-[#5de6ff]/30 text-[11px] font-semibold font-mono">
                  {verifierCode}
                </span>
              </div>
              <p className="text-xs text-[#908fa0] mt-0.5">{officerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4edea3]/10 text-[#4edea3] text-xs font-mono border border-[#4edea3]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              Role: VERIFIER
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Officer / Account Name */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
              Officer / Account Name
            </span>
            <p className="text-white text-sm font-medium">{officerName}</p>
          </div>

          {/* Verifier Code */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
              Verifier Code (Public ID)
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[#5de6ff] font-bold">{verifierCode}</span>
              <span className="text-[10px] text-[#908fa0]">(Used for fast verifier login)</span>
            </div>
          </div>

          {/* Organization Name */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
              Organization Name
            </span>
            <p className="text-white text-sm font-medium">{orgName}</p>
          </div>

          {/* Account Email */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
              Email Address
            </span>
            <p className="text-white text-sm font-medium font-mono">{emailDisplay}</p>
          </div>

          {/* Role Tag & Verification Policy */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
              Assigned System Role
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#232a39] text-[#4edea3] font-mono text-xs font-semibold">
                VERIFIER
              </span>
              <span className="text-xs text-[#908fa0]">Authorized to request & verify credentials</span>
            </div>
          </div>

          {/* Security Action: Change Password */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold block mb-1">
                Password & Security
              </span>
              <p className="text-xs text-[#908fa0]">
                Update your verifier account password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer self-start"
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>Change password</span>
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#151b2a] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5de6ff]">lock_reset</span>
                <h3 className="text-base font-bold text-white">Change Password</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError(null);
                }}
                className="text-[#908fa0] hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#c7c4d7]">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="px-3.5 py-2 rounded-xl bg-[#070e1c] border border-white/10 text-white text-xs focus:outline-none focus:border-[#5de6ff]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#c7c4d7]">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="px-3.5 py-2 rounded-xl bg-[#070e1c] border border-white/10 text-white text-xs focus:outline-none focus:border-[#5de6ff]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#232a39] text-[#dce2f6] text-xs font-semibold hover:bg-[#2e3544] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-xl bg-[#5de6ff] text-[#070e1c] text-xs font-bold hover:bg-[#5de6ff]/90 disabled:opacity-50 cursor-pointer"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
