import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { requestService } from '../../services/requestService';

export const UserLayout: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const handleLogout = async () => {
    await signOut();
    showToast('Logged out successfully', { type: 'info' });
    navigate('/auth');
  };

  useEffect(() => {
    const unsubscribe = requestService.subscribeToRequests((requests) => {
      const pending = requests.filter(
        (r) => r.status === 'pending' || (r as any).status === 'WAITING'
      );
      setPendingCount(pending.length);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const copyDid = () => {
    if (user?.did) {
      navigator.clipboard.writeText(user.did);
      showToast('Your Digital ID copied to clipboard', { type: 'success' });
    }
  };

  const navItems = [
    {
      to: '/app/wallet',
      label: 'My Wallet',
      icon: 'account_balance_wallet',
      badge: 'Private',
      badgeColor: 'text-[#8083ff]',
    },
    {
      to: '/app/add-document',
      label: 'Add a document',
      icon: 'upload_file',
    },
    {
      to: '/app/requests',
      label: 'Requests',
      icon: 'sync_alt',
      badge: pendingCount > 0 ? String(pendingCount) : undefined,
      badgeColor: 'bg-[#5de6ff] text-[#070e1c] font-bold px-2 py-0.5 rounded-full shadow-sm',
    },
    {
      to: '/app/history',
      label: 'Permission History',
      icon: 'verified_user',
    },
    {
      to: '/app/profile',
      label: 'Profile',
      icon: 'person',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0c1321] text-[#dce2f6] flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[#151b2a] z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.4)] border-r border-white/5">
        <div className="flex flex-col">
          {/* Brand */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-white/5">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white tracking-tight leading-none">
                  SelfID
                </span>
                <span className="font-mono text-[10px] text-[#5de6ff] uppercase tracking-wider mt-1 font-semibold">
                  Private Safe
                </span>
              </div>
            </Link>
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#232a39] text-[#5de6ff]"
              title="Locked and protected"
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
            </div>
          </div>

          {/* Quick Identity Core Info */}
          <div className="p-4">
            <div className="p-3 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#4edea3] text-[16px]">
                    shield
                  </span>
                  <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold">
                    Your Digital ID
                  </span>
                </div>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-[#5de6ff]">
                <span className="truncate max-w-[170px]">
                  {user?.did ? `${user.did.slice(0, 16)}...${user.did.slice(-4)}` : 'did:selfid:...'}
                </span>
                <button
                  type="button"
                  onClick={copyDid}
                  className="text-[#908fa0] hover:text-white transition-colors p-1"
                  title="Copy Digital ID"
                >
                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-4 mt-2">
            {navItems.map((item) => {
              const isActive =
                item.to === '/app/wallet'
                  ? location.pathname === '/app/wallet' ||
                    location.pathname.startsWith('/app/documents') ||
                    location.pathname.startsWith('/app/credentials')
                  : location.pathname === item.to ||
                    (item.to === '/app/requests' && location.pathname.startsWith('/app/requests'));

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                    isActive
                      ? 'bg-[#232a39] text-[#5de6ff] font-semibold shadow-inner border border-[#5de6ff]/20'
                      : 'text-[#c7c4d7] hover:bg-[#19202e] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.badgeColor || 'bg-[#2e3544] text-[#dce2f6]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-4 flex flex-col gap-3">
          {/* Account Role Badge (read-only from account) */}
          <div className="p-2.5 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#908fa0]">Account Role</span>
              <span className="text-[10px] font-mono text-[#4edea3]">Personal Account</span>
            </div>
            <div className="inline-flex p-1 rounded-lg bg-[#151b2a] border border-white/5">
              <span className="flex-1 text-center py-1 text-xs font-semibold bg-[#232a39] text-[#5de6ff] rounded-md shadow-sm">
                Document Owner
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#19202e] flex flex-col gap-2 border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[#8083ff] flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#4edea3] ring-2 ring-[#19202e]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white leading-tight truncate">
                    {profile?.full_name || user?.name || 'Elena Rostova'}
                  </span>
                  <span className="text-[10px] text-[#4edea3] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                    Locked on this device
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={copyDid}
                  title="Copy Full Digital ID"
                  className="w-7 h-7 rounded-lg bg-[#232a39] hover:bg-[#2e3544] text-[#908fa0] hover:text-white flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  className="w-7 h-7 rounded-lg bg-[#232a39] hover:bg-[#ffb4ab]/20 text-[#908fa0] hover:text-[#ffb4ab] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">logout</span>
                </button>
              </div>
            </div>
            <span className="font-mono text-[10px] text-[#908fa0] truncate">
              {user?.did || 'did:selfid:polygon:...'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="pl-72 flex-1 flex flex-col min-h-screen">
        {/* Dynamic Route Content */}
        <main className="flex-1 bg-[#0c1321]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
