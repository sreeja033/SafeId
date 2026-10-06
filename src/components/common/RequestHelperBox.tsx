import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/apiClient';

interface RequestHelperBoxProps {
  requestId: string;
  verifierName: string;
  purpose: string;
  requestedFields: string[];
}

interface ExplainResponse {
  explanation: string;
  isAiGenerated: boolean;
  question?: string;
}

export const RequestHelperBox: React.FC<RequestHelperBoxProps> = ({
  requestId,
  verifierName,
  purpose,
  requestedFields,
}) => {
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState<boolean>(false);

  const quickChips = [
    'Is this safe?',
    'What if I say no?',
    'Can I take it back later?',
  ] as const;

  const fetchExplanation = async (question?: string) => {
    setLoading(true);
    try {
      // Security: ONLY field names and stated purpose are sent to the server/model.
      // Document contents/values are never included.
      const { data, error } = await apiRequest<ExplainResponse>(
        `/requests/${requestId}/explain`,
        {
          method: 'POST',
          body: JSON.stringify({
            verifierName,
            purpose,
            requestedFields,
            question,
          }),
        }
      );

      if (data && data.explanation) {
        setExplanation(data.explanation);
        setIsAiGenerated(Boolean(data.isAiGenerated));
      } else if (error) {
        throw error;
      }
    } catch {
      // Fallback if request fails
      if (question === 'Is this safe?') {
        setExplanation(
          `Yes, this is safe because SelfID uses selective disclosure. Only the specific checkboxes you tick are shared with ${verifierName}, and your original document remains locked and encrypted in your safe.`
        );
      } else if (question === 'What if I say no?') {
        setExplanation(
          `If you say no or deny this request, none of your document details will be shared. ${verifierName} will simply receive a notice that access was declined.`
        );
      } else if (question === 'Can I take it back later?') {
        setExplanation(
          `Yes, you can take back access at any time from your Permission History page. With one click, your permission is revoked on the public record and ${verifierName} loses access immediately.`
        );
      } else {
        const fieldsList = requestedFields.length > 0 ? requestedFields.join(', ') : 'fields';
        setExplanation(
          `${verifierName} is asking for ${fieldsList} to verify "${purpose}". For this purpose, you only need to prove your student status or enrollment; detailed fields like your student ID or date of birth are not needed and can be left unchecked.`
        );
      }
      setIsAiGenerated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExplanation();
  }, [requestId, verifierName, purpose]);

  const handleChipClick = (chip: typeof quickChips[number]) => {
    if (activeChip === chip) {
      setActiveChip(null);
      fetchExplanation();
    } else {
      setActiveChip(chip);
      fetchExplanation(chip);
    }
  };

  return (
    <div className="w-full bg-gradient-to-br from-[#151b2a] via-[#151b2a] to-[#19202e] border border-[#8083ff]/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col gap-4">
      {/* Subtle top indicator glow */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8083ff] via-[#5de6ff] to-[#4edea3]" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#8083ff]/20 text-[#c0c1ff] border border-[#8083ff]/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Helper</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8083ff]/20 text-[#c0c1ff] border border-[#8083ff]/30">
                {isAiGenerated ? 'Gemini 2.5 Flash' : 'Privacy Rules'}
              </span>
            </div>
            <span className="text-[11px] text-[#908fa0]">
              Plain-language explanation of what is needed and what you can safely leave unchecked
            </span>
          </div>
        </div>

        {activeChip && (
          <button
            type="button"
            onClick={() => {
              setActiveChip(null);
              fetchExplanation();
            }}
            className="text-[11px] text-[#908fa0] hover:text-white flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            <span>Back to general advice</span>
          </button>
        )}
      </div>

      {/* Explanation Content */}
      <div className="bg-[#070e1c] p-4 rounded-xl border border-white/5 min-h-[64px] flex items-center">
        {loading ? (
          <div className="flex items-center gap-2.5 text-xs text-[#908fa0] py-1">
            <span className="material-symbols-outlined text-base animate-spin text-[#5de6ff]">
              progress_activity
            </span>
            <span>Analyzing request purpose against requested fields...</span>
          </div>
        ) : (
          <p className="text-xs sm:text-[13px] text-[#dce2f6] leading-relaxed">
            {explanation}
          </p>
        )}
      </div>

      {/* Quick Chips */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-[#908fa0]">Quick questions:</span>
          {quickChips.map((chip) => {
            const isSelected = activeChip === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white font-semibold shadow-md'
                    : 'bg-[#19202e] hover:bg-[#232a39] text-[#c7c4d7] hover:text-white border border-white/10'
                }`}
              >
                <span>{chip}</span>
                {isSelected && (
                  <span className="material-symbols-outlined text-[14px]">check</span>
                )}
              </button>
            );
          })}
        </div>

        <span className="text-[10px] text-[#908fa0] italic">
          Only field names &amp; purpose analyzed. Document values are never sent.
        </span>
      </div>
    </div>
  );
};
