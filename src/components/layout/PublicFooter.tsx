import React from 'react';
import { Link } from 'react-router-dom';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="w-full bg-[#070e1c]/90 backdrop-blur-md pt-10 pb-8 relative z-10 border-t border-[#232a39]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Zero Knowledge Sovereign Architecture Banner */}
        <div className="p-6 rounded-2xl bg-[#151b2a]/60 border border-white/5 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#232a39] flex items-center justify-center text-[#5de6ff] shrink-0">
              <span className="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Completely Private by Design</span>
                <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
              </div>
              <p className="text-xs text-[#908fa0] mt-0.5">
                Your private info stays locked right on your device. Only you decide what to share.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#232a39] text-[#c7c4d7] font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
              <span>Digital ID Ready</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#232a39] text-[#c7c4d7] font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
              <span>Secure Public Record Active</span>
            </div>
          </div>
        </div>

        {/* 4-column Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 text-sm">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs uppercase tracking-wider text-[#5de6ff] font-semibold">
              Product
            </span>
            <Link to="/app/wallet" className="text-xs text-[#908fa0] hover:text-white transition-colors">
              Saved Documents
            </Link>
            <Link to="/app/history" className="text-xs text-[#908fa0] hover:text-white transition-colors">
              Permission History
            </Link>
            <Link to="/verifier" className="text-xs text-[#908fa0] hover:text-white transition-colors">
              Verifier Portal (check info)
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs uppercase tracking-wider text-[#5de6ff] font-semibold">
              Developers
            </span>
            <a href="#sdk" className="text-xs text-[#908fa0] hover:text-white transition-colors">
              Core SDK
            </a>
            <a href="#api" className="text-xs text-[#908fa0] hover:text-white transition-colors">
              Verifier API
            </a>
            <a href="#w3c" className="text-xs text-[#908fa0] hover:text-white transition-colors">
              W3C DID Spec v2.0
            </a>
            <a href="#zkp" className="text-xs text-[#908fa0] hover:text-white transition-colors">
              Zero Knowledge Proofs
            </a>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs uppercase tracking-wider text-[#5de6ff] font-semibold">
              Trust & Compliance
            </span>
            <span className="text-xs text-[#908fa0]">SOC2 Type II Attested</span>
            <span className="text-xs text-[#908fa0]">eIDAS 2.0 Conformity</span>
            <span className="text-xs text-[#908fa0]">GDPR Sovereignty</span>
            <span className="text-xs text-[#908fa0]">FIPS 140-2 Level 3</span>
          </div>

          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <span className="uppercase tracking-wider text-[#5de6ff] font-semibold font-sans">
              Network Nodes
            </span>
            <div className="flex items-center justify-between text-[#908fa0]">
              <span>Identity Hub:</span>
              <span className="text-[#4edea3]">Operational</span>
            </div>
            <div className="flex items-center justify-between text-[#908fa0]">
              <span>Revocation Registry:</span>
              <span className="text-[#4edea3]">Online</span>
            </div>
            <div className="flex items-center justify-between text-[#908fa0]">
              <span>ZK-SNARK Prover:</span>
              <span className="text-[#5de6ff]">Synced</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-6 border-t border-[#232a39] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#908fa0]">
          <div>© 2025 SelfID Protocol Foundation. All cryptographic rights reserved.</div>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" className="hover:text-white transition-colors">
              Terms of Cryptographic Custody
            </a>
            <a href="#charter" className="hover:text-white transition-colors">
              Sovereignty Charter
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
