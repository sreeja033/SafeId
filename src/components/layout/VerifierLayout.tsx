import React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const VerifierLayout: React.FC = () => {
  const { verifier, profile, signOut } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSyncState = () => {
    showToast('Records refreshed with secure public record', {
      type: 'success',
      description: 'Everything is up to date and verified.',
    });
  };

  const handleLogout = async () => {
    await signOut();
    showToast('Logged out successfully', { type: 'info' });
    navigate('/auth');
  };

  const navItems = [
    {
      to: '/verifier',
      label: 'Dashboard',
      icon: 'grid_view',
      exact: true,
    },
    {
      to: '/verifier/new',
      label: 'New Request',
      icon: 'add_circle',
      badge: 'Quick',
      badgeColor: 'bg-[#8083ff] text-white',
    },
    {
      to: '/verifier/results/latest',
      label: 'Check Shared Info',
      icon: 'verified',
    },
    {
      to: '/verifier/profile',
      label: 'Profile',
      icon: 'manage_accounts',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0c1321] text-[#dce2f6] flex">
      {/* Verifier Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[#070e1c] z-50 flex flex-col justify-between p-4 shadow-[0_1px_8px_rgba(0,0,0,0.4)] border-r border-white/5">
        <div className="flex flex-col gap-6">
          {/* Logo & Brand Header */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg text-white tracking-tight">SelfID</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#2e3544] text-[#5de6ff]">
                    PORTAL
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#908fa0]">VER-001</span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm ${
                    isActive
                      ? 'bg-[#232a39] text-[#5de6ff] font-bold shadow-[0_0_16px_0_rgba(99,102,241,0.15)] border border-[#5de6ff]/20'
                      : 'text-[#c7c4d7] hover:bg-[#151b2a] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        item.badgeColor || 'bg-[#2e3544] text-[#dce2f6]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff]" />
                  ) : null}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-3">
          {/* Account Role Badge (read-only from account) */}
          <div className="p-2.5 rounded-xl bg-[#151b2a] border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#908fa0]">Account Role</span>
              <span className="text-[10px] font-mono text-[#4edea3]">Organization Account</span>
            </div>
            <div className="inline-flex p-1 rounded-lg bg-[#070e1c] border border-white/5">
              <span className="flex-1 text-center py-1 text-xs font-semibold bg-[#232a39] text-[#4edea3] rounded-md shadow-sm">
                Verifier (Organization)
              </span>
            </div>
          </div>

          {/* Node Status Widget */}
          <div className="p-3 bg-[#151b2a] rounded-xl flex flex-col gap-2 border border-white/5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#c7c4d7]">Status: Ready</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2e3544] text-[#4edea3] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
                Private
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] text-[#908fa0]">
                <span>Allowed checks</span>
                <span className="font-mono text-white font-semibold">84%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#2e3544] overflow-hidden">
                <div className="h-full w-[84%] rounded-full bg-[#5de6ff]" />
              </div>
            </div>
            <span className="font-mono text-[10px] text-[#908fa0]">
              Safe storage · Locked and protected
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-72 flex-1 flex flex-col min-h-screen">
        {/* Dynamic Route Content */}
        <main className="flex-1 bg-[#0c1321]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
