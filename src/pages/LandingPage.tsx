import React from 'react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { PublicFooter } from '../components/layout/PublicFooter';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0c1321] text-[#dce2f6] flex flex-col selection:bg-[#8083ff]/30 selection:text-[#c0c1ff] relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-[#8083ff]/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-[#5de6ff]/10 rounded-full blur-[160px]" />
      </div>

      <PublicNavbar />

      <main className="w-full pt-20 relative z-10 flex-1">
        {/* HERO SECTION */}
        <section className="relative w-full overflow-hidden px-6 lg:px-8 py-16 lg:py-24 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Value Prop */}
            <div className="lg:col-span-7 flex flex-col items-start gap-6">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#151b2a] border border-white/5 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]" />
                </span>
                <span className="text-[11px] font-mono text-[#5de6ff] uppercase tracking-widest font-semibold">
                  Safe Digital Documents (Easy & Secure)
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
                Own your identity.{' '}
                <span className="bg-gradient-to-r from-[#c0c1ff] via-[#5de6ff] to-[#6ffbbe] bg-clip-text text-transparent">
                  Share only what's needed.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[#c7c4d7] max-w-2xl leading-relaxed">
                The simple digital safe that lets you prove who you are without handing over your sensitive papers. Keep your documents locked safely on your device, share only what is asked for, and take back access anytime.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
                <Link
                  to="/auth"
                  className="relative group overflow-hidden px-7 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] shadow-lg hover:shadow-[#22d3ee]/25 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-2.5"
                >
                  <span>Get started</span>
                  <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </Link>
              </div>

              {/* Trust Strip */}
              <div className="pt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[#908fa0] font-mono text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
                  Zero central servers
                </span>
                <span className="text-[#464554]">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff]" />
                  Bank-level security
                </span>
                <span className="text-[#464554]">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8083ff]" />
                  Standard Digital ID
                </span>
                <span className="text-[#464554]">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
                  Locked on this phone
                </span>
              </div>
            </div>

            {/* Right Interactive Credential Illustration */}
            <div className="lg:col-span-5 relative flex justify-center items-center">
              <div className="absolute w-80 h-80 rounded-full bg-[#8083ff]/20 blur-[90px] -z-10" />

              {/* Floating Security Badge Top Right */}
              <div className="absolute -top-4 -right-2 z-20 hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#232a39]/90 backdrop-blur-md shadow-xl border border-white/10">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">verified</span>
                <span className="text-xs text-white font-medium">Confirmed by official issuer</span>
              </div>

              {/* Floating Secure Enclave Badge Bottom Left */}
              <div className="absolute -bottom-5 -left-4 z-20 hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#232a39]/90 backdrop-blur-md shadow-xl border border-white/10">
                <span className="material-symbols-outlined text-[#5de6ff] text-[18px]">fingerprint</span>
                <div>
                  <div className="text-xs text-white font-medium">Locked on this device</div>
                  <div className="font-mono text-[10px] text-[#4edea3] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                    Protected
                  </div>
                </div>
              </div>

              {/* Main Credential Card */}
              <div className="w-full max-w-md rounded-2xl p-6 bg-[#151b2a] border border-white/10 shadow-2xl relative overflow-hidden transition-all duration-300 hover:shadow-cyan-950/40">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8083ff] via-[#5de6ff] to-[#4edea3]" />

                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8083ff] to-[#5de6ff] flex items-center justify-center text-white shadow-md">
                      <span className="material-symbols-outlined text-2xl">shield_person</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#5de6ff] tracking-wide uppercase font-semibold">
                        SelfID Verified Document
                      </span>
                      <p className="font-mono text-[11px] text-[#908fa0] truncate max-w-[190px]">
                        did:key:z6Mku...84X92kE
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00885d]/30 text-[#4edea3] text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
                    <span>Active</span>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="p-3 rounded-xl bg-[#19202e] flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#908fa0] text-[18px]">
                        badge
                      </span>
                      <span className="text-xs text-[#c7c4d7]">Verified Legal Name</span>
                    </div>
                    <span className="text-sm font-semibold text-white">Alex Sterling</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#19202e] flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                        check_circle
                      </span>
                      <span className="text-xs text-[#c7c4d7]">Age Check</span>
                    </div>
                    <span className="font-mono text-xs text-[#4edea3] px-2 py-0.5 rounded bg-[#4edea3]/10 font-semibold">
                      Over 21: [TRUE]
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#19202e] flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#908fa0] text-[18px]">
                        public
                      </span>
                      <span className="text-xs text-[#c7c4d7]">Country</span>
                    </div>
                    <span className="text-xs text-white font-medium">Germany (EU)</span>
                  </div>
                </div>

                {/* Privacy Shield */}
                <div className="p-3.5 rounded-xl bg-[#232a39]/90 border border-[#5de6ff]/20 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#5de6ff] text-[22px] shrink-0 mt-0.5">
                    lock_person
                  </span>
                  <div>
                    <div className="text-xs text-[#5de6ff] font-semibold">
                      Privacy Shield Active
                    </div>
                    <p className="text-[11px] text-[#c7c4d7] leading-relaxed mt-0.5">
                      SSN, full address and exact birthdate stay hidden. The verifier (organization checking your info) only gets a simple confirmation.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[#908fa0] font-mono text-[10px]">
                  <span className="truncate max-w-[210px]">fingerprint: 0x8f2c...4a9e1d88</span>
                  <span className="text-[#5de6ff] flex items-center gap-1 cursor-pointer hover:underline">
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    <span>Copy fingerprint</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON: The Old Way vs The SelfID Way */}
        <section id="how-it-works" className="w-full px-6 lg:px-8 py-20 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs text-[#5de6ff] tracking-widest uppercase font-semibold font-mono">
              Paradigm Shift
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mt-2 tracking-tight">
              The Old Way vs. The SelfID Way
            </h2>
            <p className="text-base text-[#c7c4d7] mt-3">
              Traditional online verification forces you to surrender full document scans that
              linger in vulnerable databases forever. SelfID proves facts without giving up raw records.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Left: The Old Way */}
            <div className="rounded-3xl p-8 bg-[#070e1c] border border-red-500/20 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-[#ffb4ab]">
                      <span className="material-symbols-outlined text-2xl">warning</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#ffb4ab] font-semibold uppercase tracking-wider">
                        Legacy Model
                      </span>
                      <h3 className="text-xl font-bold text-white">High-Risk Over-Exposure</h3>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-[#ffb4ab] font-mono text-[11px] font-medium">
                    12 DB Copies Leaked
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#151b2a] border border-red-500/20 mb-6 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between mb-3 text-[#ffb4ab] font-sans font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">file_open</span>
                      Unencrypted Passport.pdf
                    </span>
                    <span className="text-[10px] uppercase">Plaintext Transmitted</span>
                  </div>
                  <div className="flex justify-between py-1 bg-[#232a39]/60 px-3 rounded text-[#c7c4d7]">
                    <span>Full Name:</span>
                    <span className="text-[#ffb4ab] font-semibold">ALEXANDER MICHAEL STERLING</span>
                  </div>
                  <div className="flex justify-between py-1 bg-[#232a39]/60 px-3 rounded text-[#c7c4d7]">
                    <span>Tax / SSN:</span>
                    <span className="text-[#ffb4ab] font-semibold">982-41-XXXX (Full Visible)</span>
                  </div>
                  <div className="flex justify-between py-1 bg-[#232a39]/60 px-3 rounded text-[#c7c4d7]">
                    <span>Date of Birth:</span>
                    <span className="text-[#ffb4ab]">14.07.1994 (Exact Day Expose)</span>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-[#c7c4d7]">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#ffb4ab] text-[20px] shrink-0 mt-0.5">
                      cancel
                    </span>
                    <p>
                      <strong className="text-white">Data breaches happen weekly:</strong> Raw scans
                      stored in plaintext cloud buckets sell on dark-web dumps.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#ffb4ab] text-[20px] shrink-0 mt-0.5">
                      cancel
                    </span>
                    <p>
                      <strong className="text-white">Permanent digital footprint:</strong> No mechanism to verify whether servers actually deleted your scan.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: The SelfID Way (Harmonious sleek dark card with glowing emerald border) */}
            <div className="rounded-3xl p-8 bg-[#151b2a] border border-[#4edea3]/30 text-white shadow-2xl shadow-emerald-950/20 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#8083ff] via-[#5de6ff] to-[#4edea3]" />
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00885d]/30 border border-[#4edea3]/30 flex items-center justify-center text-[#4edea3] shadow-md">
                      <span className="material-symbols-outlined text-2xl">verified</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#4edea3] font-bold uppercase tracking-wider">
                        SelfID Safe Way
                      </span>
                      <h3 className="text-xl font-bold text-white">
                        Share only what is needed
                      </h3>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#00885d]/20 text-[#4edea3] border border-[#4edea3]/30 font-mono text-[11px] font-bold">
                    Fast & Private
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#070e1c] border border-white/5 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-[#908fa0] font-semibold uppercase tracking-wider">
                      Shared info preview
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#4edea3] bg-[#00885d]/20 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
                      Instant check
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#19202e] border border-white/10 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#00885d]/30 flex items-center justify-center text-[#4edea3]">
                        <span className="material-symbols-outlined text-[20px]">done_all</span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Age 21 or older confirmed</div>
                        <div className="font-mono text-[11px] text-[#908fa0]">
                          Confirmed without revealing your birthdate
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#4edea3] bg-[#00885d]/30 border border-[#4edea3]/30 px-3 py-1 rounded-md">
                      PASSED
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[#908fa0] font-mono text-[11px]">
                    <span>Raw DOB, SSN, Home Address:</span>
                    <span className="text-[#5de6ff] font-bold uppercase">100% Stays on your phone</span>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-[#c7c4d7]">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#4edea3] text-[20px] shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <p>
                      <strong className="text-white">Your original documents never leave your phone:</strong> Verifiers (organizations checking your info) only see verified facts, never your actual papers.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#4edea3] text-[20px] shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <p>
                      <strong className="text-white">Take back access in one click:</strong> Stop sharing anytime; verifiers lose access right away.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4-STEP HOW IT WORKS */}
        <section className="w-full px-6 lg:px-8 py-20 bg-[#070e1c]/60 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs text-[#5de6ff] tracking-widest uppercase font-semibold font-mono">
                Simple 4-Step Process
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mt-2 tracking-tight">
                How SelfID Works
              </h2>
              <p className="text-base text-[#c7c4d7] mt-3">
                No central database, no tracking cookies, and no middlemen holding your sensitive documents.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-3xl font-bold text-[#8083ff]/40">01</span>
                    <div className="w-10 h-10 rounded-xl bg-[#232a39] flex items-center justify-center text-[#8083ff]">
                      <span className="material-symbols-outlined text-xl">key</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Get your Digital ID</h3>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">
                    Create your unique Digital ID safely inside your phone. No phone number or email address required.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 font-mono text-[11px] text-[#5de6ff]">
                  did:ion:48...39k
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-3xl font-bold text-[#5de6ff]/40">02</span>
                    <div className="w-10 h-10 rounded-xl bg-[#232a39] flex items-center justify-center text-[#5de6ff]">
                      <span className="material-symbols-outlined text-xl">download_done</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Get your Documents</h3>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">
                    Official organizations (governments, banks, universities) issue stamped digital documents straight to your phone.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 font-mono text-[11px] text-[#4edea3]">
                  Confirmed with official stamp
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-3xl font-bold text-[#4edea3]/40">03</span>
                    <div className="w-10 h-10 rounded-xl bg-[#232a39] flex items-center justify-center text-[#4edea3]">
                      <span className="material-symbols-outlined text-xl">tune</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Pick What to Share</h3>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">
                    Pick only the facts you want to share. Prove you are over 21 without revealing your exact birthdate or home address.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 font-mono text-[11px] text-[#8083ff]">
                  Zero personal leaks
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-3xl font-bold text-[#ffb4ab]/40">04</span>
                    <div className="w-10 h-10 rounded-xl bg-[#232a39] flex items-center justify-center text-[#ffb4ab]">
                      <span className="material-symbols-outlined text-xl">lock_reset</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Allow or Take Back Access</h3>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">
                    See who has access to your details in real time. Take back access instantly whenever you want with one tap.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 font-mono text-[11px] text-[#ffb4ab]">
                  Instant permission control
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES BENTO GRID */}
        <section id="features" className="w-full px-6 lg:px-8 py-20 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <span className="text-xs text-[#5de6ff] tracking-widest uppercase font-semibold font-mono">
                Built For You
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mt-2 tracking-tight">
                Complete Privacy. Everyday Simplicity.
              </h2>
            </div>
            <p className="text-sm text-[#c7c4d7] max-w-md">
              Designed so that your identity documents stay in your hands, safe from data leaks and tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Indigo Accent */}
            <div className="p-7 rounded-3xl bg-[#151b2a] border border-indigo-500/30 shadow-xl flex flex-col justify-between relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" />
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 mb-6">
                  <span className="material-symbols-outlined text-2xl">visibility_off</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Share only what is asked</h3>
                <p className="text-xs text-[#c7c4d7] mb-6 leading-relaxed">
                  Share only specific details or a simple yes/no answer. Prove you are eligible without showing your whole document.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/20 flex items-center justify-between font-mono text-[11px] text-indigo-200">
                <span>Income &gt; $80k?</span>
                <span className="text-indigo-300 font-bold bg-indigo-500/20 px-2 py-0.5 rounded">YES (Confirmed)</span>
              </div>
            </div>

            {/* Card 2: Cyan Accent */}
            <div className="p-7 rounded-3xl bg-[#151b2a] border border-cyan-400/30 shadow-xl flex flex-col justify-between relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1 bg-cyan-400" />
              <div>
                <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 mb-6">
                  <span className="material-symbols-outlined text-2xl">enhanced_encryption</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Locked on your phone</h3>
                <p className="text-xs text-[#c7c4d7] mb-6 leading-relaxed">
                  Documents are locked securely inside your device. Nobody can peek inside or take them without your permission.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-400/20 flex items-center justify-between font-mono text-[11px] text-cyan-100">
                <span>Where it is kept:</span>
                <span className="text-cyan-300 font-bold bg-cyan-400/20 px-2 py-0.5 rounded">Safe hardware chip</span>
              </div>
            </div>

            {/* Card 3: Violet Accent */}
            <div className="p-7 rounded-3xl bg-[#151b2a] border border-violet-500/30 shadow-xl flex flex-col justify-between relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1 bg-violet-500" />
              <div>
                <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300 mb-6">
                  <span className="material-symbols-outlined text-2xl">history_edu</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Secure public record of permissions</h3>
                <p className="text-xs text-[#c7c4d7] mb-6 leading-relaxed">
                  A tamper-proof public record logs who you allowed, without ever showing your name or personal info.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-violet-950/50 border border-violet-500/20 flex items-center justify-between font-mono text-[11px] text-violet-200">
                <span>Record status:</span>
                <span className="text-violet-300 font-bold bg-violet-500/20 px-2 py-0.5 rounded">Up to date</span>
              </div>
            </div>

            {/* Card 4: Teal Accent */}
            <div className="p-7 rounded-3xl bg-[#151b2a] border border-teal-400/30 shadow-xl flex flex-col justify-between relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1 bg-teal-400" />
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-400/15 border border-teal-400/30 flex items-center justify-center text-teal-300 mb-6">
                  <span className="material-symbols-outlined text-2xl">gpp_bad</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Take back access anytime</h3>
                <p className="text-xs text-[#c7c4d7] mb-6 leading-relaxed">
                  Change your mind? Stop sharing in one tap. The organization will immediately lose access to your info.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-teal-950/50 border border-teal-400/20 flex items-center justify-between font-mono text-[11px] text-teal-100">
                <span>Speed:</span>
                <span className="text-teal-300 font-bold bg-teal-400/20 px-2 py-0.5 rounded">Instant</span>
              </div>
            </div>

            {/* Card 5: Indigo Accent */}
            <div className="p-7 rounded-3xl bg-[#151b2a] border border-indigo-500/30 shadow-xl flex flex-col justify-between relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" />
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 mb-6">
                  <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Plain English helper</h3>
                <p className="text-xs text-[#c7c4d7] mb-6 leading-relaxed">
                  Our helper reads what the organization is asking for and explains it clearly so you never share by accident.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/20 flex items-center gap-2 font-mono text-[11px] text-indigo-200">
                <span className="material-symbols-outlined text-[14px] text-indigo-300">info</span>
                <span>"They want your SSN; we suggest saying no"</span>
              </div>
            </div>

            {/* Card 6: Cyan Accent */}
            <div className="p-7 rounded-3xl bg-[#151b2a] border border-cyan-400/30 shadow-xl flex flex-col justify-between relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1 bg-cyan-400" />
              <div>
                <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 mb-6">
                  <span className="material-symbols-outlined text-2xl">dataset</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Permission history</h3>
                <p className="text-xs text-[#c7c4d7] mb-6 leading-relaxed">
                  A simple list of who you shared info with, what you told them, and when access was given or taken back.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-400/20 flex items-center justify-between font-mono text-[11px] text-cyan-100">
                <span>Download summary:</span>
                <span className="text-cyan-300 font-bold bg-cyan-400/20 px-2 py-0.5 rounded">1-Click PDF/JSON</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY ARCHITECTURE */}
        <section id="security" className="w-full px-6 lg:px-8 py-20 bg-[#070e1c]/80 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5de6ff]/10 text-[#5de6ff] text-xs font-mono mb-3">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                <span>Top-grade safety</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                Bank-Grade Protection. You Stay In Control.
              </h2>
              <p className="text-base text-[#c7c4d7] mt-3">
                SelfID cannot see or open your documents. Everything is kept directly in your hands.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="p-8 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#232a39] flex items-center justify-center text-[#5de6ff] mb-6">
                    <span className="material-symbols-outlined text-2xl">tag</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">Only fingerprints on the public record</h3>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">
                    Your real documents never touch any public record. Only anonymous fingerprints are saved to check if things are real and not expired.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 text-[#5de6ff] font-mono text-xs">
                  Zero personal info in public
                </div>
              </div>

              <div className="p-8 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#232a39] flex items-center justify-center text-[#4edea3] mb-6">
                    <span className="material-symbols-outlined text-2xl">memory</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">Locked safely on your device</h3>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">
                    Your documents and details live solely on your phone. They are locked behind your fingerprint or Face ID.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 text-[#4edea3] font-mono text-xs">
                  Hardware protected
                </div>
              </div>

              <div className="p-8 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#232a39] flex items-center justify-center text-[#8083ff] mb-6">
                    <span className="material-symbols-outlined text-2xl">vpn_key</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">Confirmed with your stamp</h3>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">
                    Every piece of shared info is stamped with your personal mark, so nobody can fake it or reuse it on other sites.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 text-[#8083ff] font-mono text-xs">
                  Cannot be faked or copied
                </div>
              </div>
            </div>

            {/* Certifications strip */}
            <div className="p-6 rounded-2xl bg-[#151b2a] border border-white/5 flex flex-wrap items-center justify-around gap-6 text-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#4edea3] text-2xl">gavel</span>
                <div>
                  <div className="font-semibold text-white">Security Audited</div>
                  <div className="text-xs text-[#908fa0]">Zero security flaws found</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#5de6ff] text-2xl">verified</span>
                <div>
                  <div className="font-semibold text-white">Official Open Standards</div>
                  <div className="text-xs text-[#908fa0]">Works with organizations worldwide</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#8083ff] text-2xl">policy</span>
                <div>
                  <div className="font-semibold text-white">Privacy Certified</div>
                  <div className="text-xs text-[#908fa0]">Continuous independent testing</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="w-full px-6 lg:px-8 py-24 max-w-7xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden p-10 lg:p-16 bg-[#151b2a] border border-white/10 shadow-2xl">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#8083ff]/25 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[#5de6ff]/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 max-w-3xl flex flex-col items-start gap-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5de6ff]/10 text-[#5de6ff] text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff]" />
                <span>Free & Open For Everyone</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                Take back control of your digital life today.
              </h2>

              <p className="text-base text-[#c7c4d7] leading-relaxed">
                Join thousands of people and verifiers (organizations checking info) building a web where your personal privacy comes first.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4 w-full sm:w-auto">
                <Link
                  to="/auth"
                  className="relative group overflow-hidden px-8 py-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#6366f1] via-[#494bd6] to-[#22d3ee] shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                  <span>Log in / Sign up</span>
                  <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
