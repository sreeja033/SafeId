import React from 'react';
import { Link } from 'react-router-dom';

export const PublicNavbar: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#070e1c]/80 backdrop-blur-xl border-b border-white/5 shadow-lg">
      <div className="h-20 max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-white shadow-md">
              <span className="material-symbols-outlined text-[24px]">shield</span>
            </div>
            <span className="font-bold text-xl text-white tracking-tight">SelfID</span>
          </Link>
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#232a39] text-[#5de6ff] text-xs border border-white/10 font-mono">
            Digital Safe
          </span>
        </div>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <a href="#how-it-works" className="text-[#5de6ff] hover:text-white transition-colors">
            How it works
          </a>
          <a href="#features" className="text-[#c7c4d7] hover:text-white transition-colors">
            Features
          </a>
          <a href="#security" className="text-[#c7c4d7] hover:text-white transition-colors">
            Security
          </a>
        </nav>

        {/* Single Action Button: Log in / Sign up */}
        <div className="flex items-center">
          <Link
            to="/auth"
            className="relative group overflow-hidden px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_28px_rgba(34,211,238,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span>Log in / Sign up</span>
            <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
};
