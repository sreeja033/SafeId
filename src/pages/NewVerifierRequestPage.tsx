import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { verifierService } from '../services/verifierService';

const DEFAULT_PRESETS = [
  { label: 'College / Institution', hint: 'School / organization name' },
  { label: 'Student Enrollment Status', hint: 'Active enrollment standing' },
  { label: 'Full Legal Name', hint: 'Student legal identity' },
  { label: 'Age >= 21 (Private proof)', hint: 'Birthdate stays completely private', isZk: true },
  { label: 'Course / Program', hint: 'Degree or program name' },
  { label: 'Student ID', hint: 'Roll or student identifier' },
  { label: 'Department / Major', hint: 'Field of study or faculty' },
  { label: 'Graduation Year', hint: 'Expected or completed year' },
  { label: 'Date of Birth', hint: 'Date of birth record' },
  { label: 'Email Address', hint: 'Institutional student email' },
  { label: 'CGPA / Grade Score', hint: 'Academic grading standing' },
  { label: 'Library Card #', hint: 'Campus library access identifier' },
];

export const NewVerifierRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [targetQuery, setTargetQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [purpose, setPurpose] = useState(
    'Academic Enrollment Audit & Selective Disclosure Check'
  );
  const [legalBasis, setLegalBasis] = useState(
    'Student Consent & Selective Disclosure Policy'
  );
  const [validityWindow, setValidityWindow] = useState('24 Hours');
  const [availablePresets, setAvailablePresets] = useState(DEFAULT_PRESETS);
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>({
    'College / Institution': true,
    'Student Enrollment Status': true,
    'Full Legal Name': true,
    'Age >= 21 (Private proof)': true,
    'Course / Program': false,
    'Student ID': false,
  });
  const [customFieldInput, setCustomFieldInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddCustomField = () => {
    const trimmed = customFieldInput.trim();
    if (!trimmed) return;
    if (!availablePresets.some((p) => p.label.toLowerCase() === trimmed.toLowerCase())) {
      setAvailablePresets((prev) => [
        ...prev,
        { label: trimmed, hint: 'Custom requested detail' },
      ]);
    }
    setSelectedClaims((prev) => ({ ...prev, [trimmed]: true }));
    setCustomFieldInput('');
    showToast(`Added field: "${trimmed}"`, { type: 'success' });
  };

  const handleRemoveField = (fieldLabel: string) => {
    setAvailablePresets((prev) => prev.filter((p) => p.label !== fieldLabel));
    setSelectedClaims((prev) => {
      const copy = { ...prev };
      delete copy[fieldLabel];
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const requestedClaims = Object.entries(selectedClaims)
      .filter(([, checked]) => checked)
      .map(([name]) => name);

    if (requestedClaims.length === 0) {
      setErrorMessage('Please select or add at least one detail to request.');
      return;
    }

    setIsSubmitting(true);
    const searchTarget = targetQuery.trim();

    try {
      const newRecord = await verifierService.initiatePresentationRequest(
        searchTarget || 'did:selfid:current-holder',
        requestedClaims,
        purpose,
        validityWindow
      );

      setIsSubmitting(false);
      showToast(`Request ${newRecord.id} sent!`, {
        type: 'success',
        description: 'The person can now review your request and allow access.',
      });
      navigate('/verifier');
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to send request';
      if (
        msg.toLowerCase().includes("couldn't find that user") ||
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('404')
      ) {
        setErrorMessage("We couldn't find that user.");
      } else {
        setErrorMessage(msg);
      }
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          to="/verifier"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151b2a] hover:bg-[#232a39] text-[#c7c4d7] hover:text-white text-xs border border-white/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Verifier Console</span>
        </Link>
      </div>

      <div className="bg-[#070e1c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#8083ff] via-[#5de6ff] to-[#4edea3]" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#19202e] flex items-center justify-center text-[#5de6ff]">
            <span className="material-symbols-outlined text-2xl">add_circle</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Ask for Document Details
            </h1>
            <p className="text-sm text-[#5de6ff] font-medium mt-0.5">
              Create a new request asking a person to confirm information from their documents.
            </p>
            <p className="text-xs text-[#908fa0] mt-0.5">
              Select the details you need and set how long you require access.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white">
              Person's Email or Digital ID
            </label>
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => {
                setTargetQuery(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. alicestudent@example.com or did:selfid:... (or leave empty for demo wallet)"
              className="w-full px-4 py-2.5 rounded-xl bg-[#151b2a] border border-white/5 text-white font-mono text-xs focus:outline-none focus:border-[#5de6ff]"
            />
            <span className="text-[10px] text-[#908fa0]">
              Look up by user email or Digital ID. If the person isn't found, you'll be notified.
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white">
                Requested Details ({Object.values(selectedClaims).filter(Boolean).length} selected)
              </label>
              <span className="text-[10px] text-[#5de6ff] font-mono">You can ask for any document detail</span>
            </div>

            {/* Custom field adder input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customFieldInput}
                onChange={(e) => setCustomFieldInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomField();
                  }
                }}
                placeholder="Type any custom detail to request (e.g. Department, Blood Group, GPA, Hostel Wing)..."
                className="flex-1 px-4 py-2 rounded-xl bg-[#151b2a] border border-white/10 text-white text-xs placeholder:text-[#908fa0] focus:outline-none focus:border-[#5de6ff]"
              />
              <button
                type="button"
                onClick={handleAddCustomField}
                className="px-4 py-2 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-[#5de6ff] text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add Field</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {availablePresets.map((item) => {
                const isChecked = Boolean(selectedClaims[item.label]);
                const isDefault = DEFAULT_PRESETS.some((p) => p.label === item.label);
                return (
                  <div
                    key={item.label}
                    className={`flex items-start justify-between gap-2 p-3 rounded-xl bg-[#151b2a] border transition-colors ${
                      item.isZk
                        ? 'border-[#8083ff]/40 bg-[#151b2a]'
                        : isChecked
                        ? 'border-[#5de6ff]/30'
                        : 'border-white/5 opacity-75'
                    }`}
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setSelectedClaims((prev) => ({
                            ...prev,
                            [item.label]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded text-[#5de6ff] focus:ring-0 bg-[#232a39] cursor-pointer shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-white truncate" title={item.label}>
                          {item.label}
                        </span>
                        <span className="text-[10px] text-[#908fa0]">{item.hint}</span>
                      </div>
                    </label>
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleRemoveField(item.label)}
                        className="text-[#908fa0] hover:text-[#ffb4ab] text-xs p-1 cursor-pointer"
                        title="Remove custom detail"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white">Why you need this info</label>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-[#151b2a] border border-white/5 text-white text-xs resize-none focus:outline-none focus:border-[#5de6ff]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white">Rule or policy</label>
              <textarea
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-[#151b2a] border border-white/5 text-white text-xs resize-none focus:outline-none focus:border-[#5de6ff]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white">How long you need access</label>
              <select
                value={validityWindow}
                onChange={(e) => setValidityWindow(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#151b2a] border border-white/5 text-white text-xs focus:outline-none"
              >
                <option value="1 Hour">1 Hour (Short access)</option>
                <option value="24 Hours">24 Hours (Standard)</option>
                <option value="7 Days">7 Days (Longer check)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white">Security Method</label>
              <div className="px-4 py-2.5 rounded-xl bg-[#151b2a] border border-white/5 flex items-center justify-between text-xs text-[#5de6ff]">
                <span>Personal stamp + Public record check</span>
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">
                  verified
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <Link
              to="/verifier"
              className="px-5 py-2.5 rounded-xl bg-[#151b2a] hover:bg-[#232a39] text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-lg hover:brightness-105 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{isSubmitting ? 'Sending Request...' : 'Send Request to Person'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Collapsed Technical Details Section */}
      <details className="p-4 rounded-xl bg-[#151b2a] border border-white/5 text-xs text-[#908fa0] cursor-pointer select-none">
        <summary className="font-semibold text-white flex items-center justify-between hover:text-[#5de6ff]">
          <span>Technical details</span>
          <span className="text-xs font-normal text-[#908fa0]">Click to view record IDs, fingerprints, and public keys</span>
        </summary>
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2 font-mono text-[11px] text-[#c7c4d7]">
          <div>
            <span className="text-[#908fa0]">Requested to: </span>
            <span className="text-[#5de6ff]">{targetQuery || 'Active user wallet'}</span>
          </div>
          <div>
            <span className="text-[#908fa0]">Verification standard: </span>
            <span className="text-white">W3C Presentation Exchange v2.0</span>
          </div>
        </div>
      </details>
    </div>
  );
};
