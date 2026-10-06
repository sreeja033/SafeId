import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { credentialService } from '../services/credentialService';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/apiClient';

export const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, session, signOut, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || user?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  const [documentCount, setDocumentCount] = useState<number>(0);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);

  // Change Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    } else if (user?.name) {
      setFullName(user.name);
    }
  }, [profile?.full_name, user?.name]);

  useEffect(() => {
    let active = true;
    const loadDocs = async () => {
      try {
        const creds = await credentialService.getCredentials();
        if (active) {
          setDocumentCount(creds.length);
        }
      } catch (err) {
        console.warn('Error loading credentials for profile:', err);
      } finally {
        if (active) setIsLoadingDocs(false);
      }
    };
    loadDocs();
    return () => {
      active = false;
    };
  }, []);

  const handleCopyDid = () => {
    const didToCopy = user?.did || 'did:selfid:student';
    navigator.clipboard.writeText(didToCopy);
    showToast('Digital ID copied to clipboard', { type: 'success' });
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Name cannot be empty', { type: 'error' });
      return;
    }

    setIsSavingName(true);
    try {
      const { data, error } = await apiRequest('/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName: fullName.trim() }),
      });

      if (error) {
        throw error;
      }

      await refreshUser();
      setIsEditingName(false);
      showToast('Name updated successfully', { type: 'success' });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update name', {
        type: 'error',
      });
    } finally {
      setIsSavingName(false);
    }
  };

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

  const emailDisplay = session?.user?.email || user?.email || 'student@selfid.demo';
  const didDisplay = user?.did || 'did:selfid:student';

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5de6ff] uppercase tracking-wider font-semibold font-mono">
              Account & Security
            </span>
            <span className="text-[#908fa0] text-xs">•</span>
            <span className="text-[#4edea3] text-xs font-mono">
              Protected Profile
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            My Digital ID Profile
          </h1>
          <p className="text-sm text-[#908fa0] mt-1">
            Manage your personal wallet profile, security settings, and Digital ID credentials.
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
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#6366f1] via-[#22d3ee] to-[#4edea3]" />

        {/* Identity Overview */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{fullName || 'Document Owner'}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#232a39] text-[#5de6ff] border border-[#5de6ff]/20 text-[11px] font-semibold font-mono">
                  USER
                </span>
              </div>
              <p className="text-xs text-[#908fa0] mt-0.5">{emailDisplay}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4edea3]/10 text-[#4edea3] text-xs font-mono border border-[#4edea3]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              Document Owner
            </span>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Editable Name */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
                Full Name
              </span>
              {!isEditingName && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="text-xs text-[#5de6ff] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex flex-col gap-2 mt-1">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#151b2a] border border-[#5de6ff]/50 text-white text-sm focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSavingName}
                    className="px-3 py-1 rounded-lg bg-[#5de6ff] text-[#070e1c] font-semibold text-xs hover:bg-[#5de6ff]/90 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(profile?.full_name || user?.name || '');
                      setIsEditingName(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs hover:bg-[#2e3544] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-white text-sm font-medium">{fullName || 'Not set'}</p>
            )}
          </div>

          {/* Email (Read-only) */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
                Email Address
              </span>
              <span className="text-[10px] text-[#908fa0] font-mono">Read-only</span>
            </div>
            <p className="text-white text-sm font-medium font-mono">{emailDisplay}</p>
          </div>

          {/* Digital ID & Public Record Status */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
                Digital ID
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#4edea3]/10 text-[#4edea3] text-[11px] font-medium border border-[#4edea3]/20">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Saved on the secure public record
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#151b2a] border border-white/5 font-mono text-xs text-[#5de6ff]">
              <span className="truncate mr-3">{didDisplay}</span>
              <button
                type="button"
                onClick={handleCopyDid}
                className="px-2.5 py-1 rounded bg-[#232a39] hover:bg-[#2e3544] text-[#dce2f6] hover:text-white transition-colors shrink-0 flex items-center gap-1 cursor-pointer text-xs"
                title="Copy Digital ID"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>Copy</span>
              </button>
            </div>
          </div>

          {/* Documents Count */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold">
              Saved Documents
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {isLoadingDocs ? '...' : documentCount}
              </span>
              <span className="text-xs text-[#908fa0]">
                {documentCount === 1 ? 'document in wallet' : 'documents in wallet'}
              </span>
            </div>
          </div>

          {/* Security Action: Change Password */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#908fa0] font-semibold block mb-1">
                Password & Security
              </span>
              <p className="text-xs text-[#908fa0]">
                Update your account password to keep your wallet safe.
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
