import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestService } from '../services/requestService';
import { VerificationRequest } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const RequestsListPage: React.FC = () => {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = requestService.subscribeToRequests((data) => {
      setRequests(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5de6ff] uppercase tracking-wider font-semibold font-mono">
              Incoming Requests
            </span>
            <span className="text-[#908fa0] text-xs">•</span>
            <span className="text-[#4edea3] text-xs font-mono">
              Secure connection ready
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Requests to Check Your Info
          </h1>
          <p className="text-sm text-[#5de6ff] mt-1 font-medium">
            Here you can review questions from organizations that want to check your info, choose what to share, and allow or deny access.
          </p>
          <p className="text-xs text-[#c7c4d7] mt-1">
            Organizations that check your info have sent you requests. Review what they need, hide any private details, and allow or deny access.
          </p>
        </div>

        <Link
          to="/verifier"
          className="px-4 py-2.5 rounded-xl bg-[#19202e] hover:bg-[#232a39] border border-white/5 text-xs text-[#5de6ff] font-semibold flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Create new request as Verifier (check info)</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[#908fa0] flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
          <span>Checking for incoming requests...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#151b2a] border border-white/5 text-center text-[#908fa0] flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-4xl">mark_email_read</span>
          <span className="text-base text-white font-semibold">No Pending Requests</span>
          <span className="text-xs">All questions from organizations have been answered.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests.map((req) => (
            <div
              key={req.id}
              className="p-6 rounded-2xl bg-[#151b2a] border border-white/10 shadow-xl flex flex-col justify-between transition-all duration-200 hover:border-[#5de6ff]/30 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8083ff] to-[#5de6ff]" />

              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#232a39] text-[#5de6ff] flex items-center justify-center shrink-0 shadow-inner">
                      <span className="material-symbols-outlined text-2xl">shield</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{req.verifierName}</h3>
                        <span className="px-2 py-0.5 rounded bg-[#232a39] text-[#5de6ff] font-mono text-[10px]">
                          {req.id}
                        </span>
                      </div>
                      <span className="text-xs text-[#908fa0]">
                        {req.verifierCategory} • Authorized Verifier
                      </span>
                    </div>
                  </div>

                  <StatusBadge
                    status={req.status === 'pending' ? 'pending' : req.status === 'approved' ? 'valid' : 'revoked'}
                    label={req.status === 'pending' ? 'Awaiting Permission' : req.status === 'approved' ? 'Allowed' : 'Denied'}
                    pulse={req.status === 'pending'}
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#070e1c] border border-white/5 text-xs">
                  <span className="text-[10px] text-[#5de6ff] font-semibold uppercase tracking-wider block mb-1">
                    Why they need this info
                  </span>
                  <p className="text-[#c7c4d7] leading-relaxed line-clamp-2">{req.purpose}</p>
                </div>

                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="text-[10px] text-[#908fa0] uppercase tracking-wider font-semibold">
                    Requested Details ({req.claims.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {req.claims.map((c) => (
                      <span
                        key={c.key}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          c.zkEligible
                            ? 'bg-[#8083ff]/20 text-[#c0c1ff] border border-[#8083ff]/30'
                            : 'bg-[#232a39] text-[#dce2f6] border border-white/5'
                        }`}
                      >
                        {c.label} {c.zkEligible ? '(Can keep private)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="font-mono text-[#908fa0] text-[11px]">
                  Expires in {req.expiresIn}
                </span>

                <Link
                  to={`/app/requests/${req.id}`}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white font-semibold text-xs shadow-md hover:brightness-105 transition-all flex items-center gap-1.5"
                >
                  <span>Review &amp; Allow</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed Technical Details Section */}
      <details className="p-4 rounded-xl bg-[#151b2a] border border-white/5 text-xs text-[#908fa0] cursor-pointer select-none">
        <summary className="font-semibold text-white flex items-center justify-between hover:text-[#5de6ff]">
          <span>Technical details</span>
          <span className="text-xs font-normal text-[#908fa0]">Click to view record IDs, fingerprints, and public keys</span>
        </summary>
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2 font-mono text-[11px] text-[#c7c4d7]">
          {requests.map((r) => (
            <div key={r.id}>
              <span className="text-[#908fa0]">{r.id}: </span>
              <span className="text-[#5de6ff]">Verifier Digital ID: {r.verifierDid}</span>
              <span className="text-slate-400"> | Fingerprint: {r.ephemeralHash}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};
