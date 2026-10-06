import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../types';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, setRole, signUpUser, signInUser, signInVerifier } = useAuth();
  const { showToast } = useToast();

  const [activePersona, setActivePersona] = useState<UserRole>(role || 'USER');
  const [activeMode, setActiveMode] = useState<'signup' | 'login'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifierCode, setVerifierCode] = useState('');
  const [verifierPassword, setVerifierPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePersonaChange = (newPersona: UserRole) => {
    setActivePersona(newPersona);
    setRole(newPersona);
    setShowErrorBanner(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setShowErrorBanner(false);

    try {
      if (activePersona === 'USER') {
        if (activeMode === 'signup') {
          // Public signup ALWAYS creates role 'USER'
          const res = await signUpUser(fullName, email, passphrase);
          if (res.error) {
            setShowErrorBanner(true);
            setErrorMessage(res.error.message || 'Could not create account. Please check your details.');
            return;
          }
          showToast('Wallet Created & Ready', {
            type: 'success',
            description: 'Your Digital ID has been generated safely.',
          });
          const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app/wallet';
          navigate(from);
        } else {
          const res = await signInUser(email, passphrase);
          if (res.error) {
            setShowErrorBanner(true);
            setErrorMessage(res.error.message || 'Wrong email or password');
            return;
          }
          showToast('Wallet Unlocked', {
            type: 'success',
            description: 'Your safe is ready to use.',
          });
          const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app/wallet';
          navigate(from);
        }
      } else {
        // Verifier login: converts "VER-001" to ver-001@verifiers.selfid.demo
        const res = await signInVerifier(verifierCode, verifierPassword);
        if (res.error) {
          setShowErrorBanner(true);
          setErrorMessage(res.error.message || "This verifier ID doesn't exist");
          return;
        }
        showToast('Verifier Access Confirmed', {
          type: 'success',
          description: 'Connected to Verifier Console.',
        });
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/verifier';
        navigate(from);
      }
    } catch (err: unknown) {
      setShowErrorBanner(true);
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c1321] text-[#dce2f6] flex flex-col justify-between selection:bg-[#8083ff]/30 selection:text-[#c0c1ff]">
      {/* Top Header */}
      <header className="h-20 max-w-7xl w-full mx-auto px-6 lg:px-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-white shadow-md">
            <span className="material-symbols-outlined text-[24px]">shield</span>
          </div>
          <span className="font-bold text-xl text-white tracking-tight">SelfID</span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#232a39] text-[#5de6ff] text-xs font-mono">
            Safe Login
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151b2a] text-[#4edea3] font-mono text-xs border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
            <span>Security Status: Safe</span>
          </div>
          <Link
            to="/"
            className="text-xs text-[#c7c4d7] hover:text-white flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Form Split Screen */}
      <main className="w-full max-w-7xl mx-auto px-6 lg:px-8 py-8 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Brand & Security Showcase */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#070e1c] to-[#151b2a] p-8 lg:p-10 border border-white/5 shadow-2xl">
              <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#8083ff]/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#5de6ff]/15 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col items-start gap-5">
                {/* Central Emblem with orbital rings */}
                <div className="relative w-full py-6 flex items-center justify-center">
                  <div className="absolute w-56 h-56 rounded-full border border-[#8083ff]/20 animate-spin duration-[26s]" />
                  <div className="absolute w-72 h-72 rounded-full border border-[#5de6ff]/15 border-dashed" />

                  {/* Floating status pills */}
                  <div className="absolute top-0 left-4 px-3 py-1 rounded-full bg-[#232a39]/90 border border-white/10 shadow-md flex items-center gap-1.5 font-mono text-xs text-[#5de6ff]">
                    <span className="material-symbols-outlined text-[14px] text-[#4edea3]">
                      verified_user
                    </span>
                    <span>Protected on-device</span>
                  </div>
                  <div className="absolute bottom-0 right-4 px-3 py-1 rounded-full bg-[#232a39]/90 border border-white/10 shadow-md flex items-center gap-1.5 font-mono text-xs text-[#c7c4d7]">
                    <span className="material-symbols-outlined text-[14px] text-[#8083ff]">
                      key
                    </span>
                    <span>Digital ID ready</span>
                  </div>

                  {/* Shield Token */}
                  <div className="w-24 h-24 rounded-3xl bg-[#19202e] border border-white/10 shadow-2xl flex items-center justify-center text-[#5de6ff] relative group">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#8083ff]/30 to-[#5de6ff]/30 blur-md group-hover:blur-lg transition-all" />
                    <span className="material-symbols-outlined text-5xl relative z-10">
                      shield_locked
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#8083ff]/10 text-[#8083ff]">
                    Version 2.4
                  </span>
                  <span className="text-[#908fa0]">Safe Device Storage</span>
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight">
                  Your Identity. Your Control.{' '}
                  <span className="bg-gradient-to-r from-[#8083ff] to-[#5de6ff] bg-clip-text text-transparent">
                    Never Our Servers.
                  </span>
                </h1>

                <p className="text-sm text-[#c7c4d7] leading-relaxed">
                  Private and secure sign-in. Your documents and passwords stay locked inside your phone,
                  and nothing is sent to central servers without your direct permission.
                </p>

                {/* Verification state pill */}
                <div className="w-full flex items-center justify-between p-3 rounded-xl bg-[#19202e] border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#00885d]/30 flex items-center justify-center text-[#4edea3]">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-white font-medium">Device Stamp Ready</span>
                      <span className="font-mono text-[10px] text-[#908fa0]">
                        Safe hardware protection
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#232a39] text-[#4edea3] font-mono text-xs">
                    Protected
                  </span>
                </div>

                {/* Security badges */}
                <div className="w-full grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-[#19202e] border border-white/5 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[#5de6ff]">Bank Grade</span>
                    <span className="text-[11px] text-[#908fa0]">High Security</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#19202e] border border-white/5 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[#5de6ff]">Locked</span>
                    <span className="text-[11px] text-[#908fa0]">On This Device</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#19202e] border border-white/5 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[#5de6ff]">Standard ID</span>
                    <span className="text-[11px] text-[#908fa0]">Global Open Spec</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Form Card */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="rounded-2xl bg-[#151b2a] border border-white/10 p-6 sm:p-8 shadow-2xl relative">
              {/* Audience Switcher (User vs Verifier) */}
              <div className="grid grid-cols-2 p-1.5 rounded-xl bg-[#070e1c] border border-white/5 mb-6">
                <button
                  type="button"
                  onClick={() => handlePersonaChange('USER')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                    activePersona === 'USER'
                      ? 'bg-[#232a39] text-[#5de6ff] shadow-sm'
                      : 'text-[#908fa0] hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    account_balance_wallet
                  </span>
                  <span>User (Your Wallet)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePersonaChange('VERIFIER')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                    activePersona === 'VERIFIER'
                      ? 'bg-[#232a39] text-[#5de6ff] shadow-sm'
                      : 'text-[#908fa0] hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Verifier (Check Info)</span>
                </button>
              </div>

              {/* Mode Toggle Header: Sign Up vs Log In */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {activePersona === 'USER'
                      ? activeMode === 'signup'
                        ? 'Create Account'
                        : 'Unlock Your Wallet'
                      : 'Verifier Portal Access'}
                  </h2>
                  <p className="text-xs text-[#908fa0] mt-0.5">
                    {activePersona === 'USER'
                      ? activeMode === 'signup'
                        ? 'Set up your secure Digital ID in seconds'
                        : 'Unlock your saved documents on this device'
                      : 'Review documents and check info shared by people'}
                  </p>
                </div>

                {activePersona === 'USER' && (
                  <div className="flex items-center p-1 rounded-xl bg-[#070e1c] border border-white/5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveMode('signup')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        activeMode === 'signup'
                          ? 'bg-[#232a39] text-white shadow-sm'
                          : 'text-[#908fa0] hover:text-white'
                      }`}
                    >
                      Sign Up
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMode('login')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        activeMode === 'login'
                          ? 'bg-[#232a39] text-white shadow-sm'
                          : 'text-[#908fa0] hover:text-white'
                      }`}
                    >
                      Log In
                    </button>
                  </div>
                )}
              </div>

              {/* Error banner (if triggered) */}
              {showErrorBanner && (
                <div className="mb-6 p-3.5 rounded-xl bg-[#93000a]/20 border border-[#ffb4ab]/30 text-[#ffb4ab] flex items-start justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[#ffb4ab] text-[20px] shrink-0 mt-0.5">
                      error
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#93000a]/40 font-bold">
                          Notice
                        </span>
                      </div>
                      <span className="text-xs text-white mt-1 leading-relaxed">
                        {errorMessage}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowErrorBanner(false)}
                    className="text-[#908fa0] hover:text-white p-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {activePersona === 'USER' ? (
                  <>
                    {activeMode === 'signup' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-[#c7c4d7] font-medium">
                          Your Full Name
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-3.5 text-[#908fa0] text-[20px] pointer-events-none">
                            person
                          </span>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder="Elena Rostova"
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#070e1c] border border-white/5 text-white text-sm placeholder:text-[#908fa0] focus:outline-none focus:border-[#5de6ff] transition-all"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#c7c4d7] font-medium">
                        Email Address (for recovery)
                      </label>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3.5 text-[#908fa0] text-[20px] pointer-events-none">
                          alternate_email
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="elena@zk-identity.net"
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#070e1c] border border-white/5 text-white text-sm placeholder:text-[#908fa0] focus:outline-none focus:border-[#5de6ff] transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-[#c7c4d7] font-medium">
                          Password (locks your wallet)
                        </label>
                        <span className="font-mono text-[10px] text-[#4edea3] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
                          Strong password
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3.5 text-[#908fa0] text-[20px] pointer-events-none">
                          lock
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          required
                          className="w-full pl-11 pr-11 py-3 rounded-xl bg-[#070e1c] border border-white/5 text-white text-sm placeholder:text-[#908fa0] focus:outline-none focus:border-[#5de6ff] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 text-[#908fa0] hover:text-white p-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>

                      {/* Password strength meter */}
                      <div className="grid grid-cols-4 gap-1.5 mt-1">
                        <div className="h-1 rounded-full bg-[#4edea3]" />
                        <div className="h-1 rounded-full bg-[#4edea3]" />
                        <div className="h-1 rounded-full bg-[#4edea3]" />
                        <div className="h-1 rounded-full bg-[#4edea3]" />
                      </div>
                    </div>

                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[20px] animate-spin">
                            progress_activity
                          </span>
                          <span>Setting up your Digital ID...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {activeMode === 'signup'
                              ? 'Create your wallet'
                              : 'Unlock your wallet'}
                          </span>
                          <span className="material-symbols-outlined text-[18px]">
                            arrow_forward
                          </span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    {/* Verifier Login Fields */}
                    <div className="p-3.5 rounded-xl bg-[#070e1c] border border-white/10 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[#5de6ff] text-[16px]">domain</span>
                          <span>Available Verifier Accounts</span>
                        </span>
                        <span className="text-[10px] font-mono text-[#4edea3] bg-[#00885d]/20 border border-[#4edea3]/30 px-2 py-0.5 rounded-full">
                          Demo Credentials
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVerifierCode('VER-001');
                            setVerifierPassword('DemoVerifier2026!');
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            verifierCode === 'VER-001'
                              ? 'bg-[#19202e] border-[#5de6ff] shadow-sm'
                              : 'bg-[#151b2a] hover:bg-[#19202e] border-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#5de6ff] font-mono">VER-001</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#232a39] text-[#c7c4d7]">Default</span>
                          </div>
                          <div className="text-[11px] text-white font-medium mt-0.5 truncate">
                            CMRIT Portal
                          </div>
                          <div className="text-[10px] text-[#908fa0] mt-0.5">
                            Pass: DemoVerifier2026!
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setVerifierCode('VER-002');
                            setVerifierPassword('DemoVerifier2026!');
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            verifierCode === 'VER-002'
                              ? 'bg-[#19202e] border-[#5de6ff] shadow-sm'
                              : 'bg-[#151b2a] hover:bg-[#19202e] border-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#5de6ff] font-mono">VER-002</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#232a39] text-[#c7c4d7]">Bank</span>
                          </div>
                          <div className="text-[11px] text-white font-medium mt-0.5 truncate">
                            ABC Bank Demo
                          </div>
                          <div className="text-[10px] text-[#908fa0] mt-0.5">
                            Pass: DemoVerifier2026!
                          </div>
                        </button>
                      </div>
                      <p className="text-[10px] text-[#908fa0]">
                        Click either card above to auto-fill credentials, or manually enter <span className="text-white font-mono">VER-001</span> with password <span className="text-white font-mono">DemoVerifier2026!</span>.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-[#c7c4d7] font-medium">
                          Verifier Code or Email
                        </label>
                        <span className="font-mono text-[10px] text-[#5de6ff]">
                          e.g. VER-001 or VER-002
                        </span>
                      </div>
                      <input
                        type="text"
                        value={verifierCode}
                        onChange={(e) => setVerifierCode(e.target.value)}
                        required
                        placeholder="VER-001"
                        className="w-full px-4 py-3 rounded-xl bg-[#070e1c] border border-white/5 text-white font-mono text-xs focus:outline-none focus:border-[#5de6ff]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#c7c4d7] font-medium">
                        Password
                      </label>
                      <input
                        type="password"
                        value={verifierPassword}
                        onChange={(e) => setVerifierPassword(e.target.value)}
                        required
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-[#070e1c] border border-white/5 text-white text-xs focus:outline-none focus:border-[#5de6ff]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[20px] animate-spin">
                            progress_activity
                          </span>
                          <span>Connecting to Verifier Console...</span>
                        </>
                      ) : (
                        <>
                          <span>Go to Verifier Console</span>
                          <span className="material-symbols-outlined text-[18px]">
                            open_in_new
                          </span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>

              {/* Bottom Recovery Links */}
              <div className="mt-6 pt-4 border-t border-[#232a39] flex flex-wrap items-center justify-between text-xs text-[#908fa0]">
                <button
                  type="button"
                  onClick={() =>
                    showToast('Initiating recovery with your recovery words...', {
                      type: 'info',
                    })
                  }
                  className="hover:text-[#5de6ff] flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#8083ff]">
                    key_off
                  </span>
                  <span>Recover using your 24 secret words</span>
                </button>
                <div className="flex items-center gap-1 font-mono text-[11px] text-[#4edea3]">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  <span>Locked safe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
