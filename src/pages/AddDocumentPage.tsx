import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  credentialService,
  DocumentExtractResponse,
} from '../services/credentialService';
import { VerifiableCredential } from '../types';
import { getExplorerTxUrl } from '../lib/explorer';

type StepNumber = 1 | 2 | 3 | 4;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/x-pdf',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
];
const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

const resizeImageIfNeeded = (dataUrl: string, mimeType: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!mimeType.startsWith('image/')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const MAX_DIM = 2000;
      if (img.width <= MAX_DIM && img.height <= MAX_DIM) {
        resolve(dataUrl);
        return;
      }
      let width = img.width;
      let height = img.height;
      if (width > height) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const outMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(outMime, 0.92));
    };
    img.src = dataUrl;
  });
};

export const AddDocumentPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<StepNumber>(1);
  const [isDragging, setIsDragging] = useState(false);

  // Selected File State
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    base64Data: string;
    previewUrl: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2 & 3: Extraction State
  const [extractResult, setExtractResult] = useState<DocumentExtractResponse | null>(null);

  // Step 4: Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [creationStage, setCreationStage] = useState<
    'locking' | 'fingerprinting' | 'anchoring' | 'done' | 'failed'
  >('locking');
  const [createdDocument, setCreatedDocument] = useState<VerifiableCredential | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const processFileObject = (file: File) => {
    setErrorMessage(null);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();

    if (!ACCEPTED_TYPES.includes(mime) && !ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrorMessage('Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG file.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('File too big. Maximum file size is 10 MB.');
      return;
    }

    if (file.size === 0) {
      setErrorMessage("Couldn't read the text. We couldn't open this file. Please try another file.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMessage("Couldn't read the text. We couldn't open this file. Please try another file.");
    };
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      if (!dataUrl || !dataUrl.includes(',')) {
        setErrorMessage("Couldn't read the text. We couldn't open this file. Please try another file.");
        return;
      }
      const resolvedMime =
        mime ||
        (ext === 'pdf'
          ? 'application/pdf'
          : ext === 'png'
          ? 'image/png'
          : 'image/jpeg');

      // Resize large phone photos in the browser to max 2000px before uploading
      const processedDataUrl = await resizeImageIfNeeded(dataUrl, resolvedMime);

      setSelectedFile({
        name: file.name,
        type: resolvedMime,
        size: file.size,
        base64Data: processedDataUrl,
        previewUrl: processedDataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFileObject(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFileObject(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExtractResult(null);
    setErrorMessage(null);
    setStep(1);
  };

  const handleContinueToRead = async () => {
    if (!selectedFile) return;
    setErrorMessage(null);
    setStep(2);

    try {
      const result = await credentialService.extractDocument({
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
        base64Data: selectedFile.base64Data,
      });

      setExtractResult(result);
      setStep(3);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Couldn't read details. Try a clearer document.";
      setErrorMessage(msg);
      setStep(1);
    }
  };

  const handleConfirmAndCreate = async () => {
    if (!extractResult) return;
    setErrorMessage(null);
    setStep(4);
    setIsCreating(true);
    setCreationStage('locking');

    try {
      setTimeout(() => setCreationStage('fingerprinting'), 300);
      setTimeout(() => setCreationStage('anchoring'), 600);

      // Browser sends ONLY fileId, confirm: true, and the user's signature over the fingerprint;
      // server builds document strictly from extracted values
      const created = await credentialService.confirmDocument(extractResult.fileId, {
        credentialHash: extractResult.credentialHash,
        storageRef: extractResult.storageRef,
      });

      setCreatedDocument(created);
      setCreationStage('done');
      setIsCreating(false);

      showToast('Document locked and saved', {
        type: 'success',
        description: 'Fingerprint saved on the secure public record.',
      });
    } catch (err: unknown) {
      setIsCreating(false);
      setCreationStage('failed');
      const rawMsg = err instanceof Error ? err.message : 'Saving failed. Please try again.';
      const cleanMsg =
        rawMsg.includes('needs more test coins') || rawMsg.includes('insufficient funds')
          ? 'The demo wallet needs more test coins'
          : rawMsg;
      setErrorMessage(cleanMsg);
      showToast('Saving Failed', {
        type: 'error',
        description: cleanMsg,
      });
    }
  };

  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Read' },
    { num: 3, label: 'Review' },
    { num: 4, label: 'Create' },
  ];

  const hasMissingOrInvalid =
    !extractResult ||
    !extractResult.extraction.looksLikeCollegeId ||
    extractResult.extraction.missingFields.length > 0;

  const reviewFields = extractResult
    ? [
        { key: 'fullName', label: 'Full Name', value: extractResult.extraction.fullName },
        {
          key: 'institution',
          label: 'Institution / College',
          value: extractResult.extraction.institution,
        },
        { key: 'course', label: 'Course', value: extractResult.extraction.course },
        {
          key: 'academicYear',
          label: 'Academic Year',
          value: extractResult.extraction.academicYear,
        },
        { key: 'studentId', label: 'Student ID', value: extractResult.extraction.studentId },
        {
          key: 'studentStatus',
          label: 'Student Status',
          value: extractResult.extraction.studentStatus,
        },
        {
          key: 'dateOfBirth',
          label: 'Date of Birth',
          value: extractResult.extraction.dateOfBirth,
        },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto flex flex-col gap-6">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/app/wallet"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#151b2a] hover:bg-[#232a39] text-xs font-semibold text-[#c7c4d7] hover:text-white border border-white/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Wallet</span>
        </Link>
      </div>

      {/* 4-Step Progress Bar: Upload, Read, Review, Create */}
      <div className="p-5 rounded-2xl bg-[#151b2a] border border-white/5 shadow-lg">
        <div className="grid grid-cols-4 gap-3">
          {steps.map((s) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num || (step === 4 && creationStage === 'done');
            return (
              <div key={s.num} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors ${
                      isCompleted
                        ? 'bg-[#4edea3] text-[#003824]'
                        : isActive
                        ? 'bg-[#5de6ff] text-[#070e1c]'
                        : 'bg-[#232a39] text-[#908fa0]'
                    }`}
                  >
                    {isCompleted ? '✓' : s.num}
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-semibold ${
                      isActive || isCompleted ? 'text-white' : 'text-[#908fa0]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#070e1c] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isCompleted
                        ? 'w-full bg-[#4edea3]'
                        : isActive
                        ? 'w-full bg-[#5de6ff]'
                        : 'w-0'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plain-English Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-start gap-3 text-[#ffb4ab]">
          <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">error</span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-white">{errorMessage}</span>
            <span className="text-xs text-[#ffb4ab]">
              Accepted formats: PDF, JPG, JPEG, PNG (up to 10 MB).
            </span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 1: UPLOAD                                                      */}
      {/* =================================================================== */}
      {step === 1 && (
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Add a document
            </h1>
            <p className="text-sm text-[#5de6ff] font-medium">
              Upload your document. We read the details from it.
            </p>
            <p className="text-xs text-[#4edea3] mt-0.5 flex items-center gap-1.5 font-medium">
              <span className="material-symbols-outlined text-[15px]">lock</span>
              <span>Your file is read once to find the details and is not kept.</span>
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-[#5de6ff] bg-[#5de6ff]/10'
                  : 'border-white/15 bg-[#070e1c] hover:border-[#5de6ff]/50 hover:bg-[#070e1c]/80'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#19202e] text-[#5de6ff] flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-3xl">upload_file</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-base font-bold text-white">
                  Drag and drop your document here, or click to browse
                </span>
                <span className="text-xs text-[#908fa0]">
                  Supports PDF, JPG, JPEG, PNG • Max 10 MB
                </span>
                <span className="text-[11px] text-[#4edea3] mt-1">
                  Your file is read once to find the details and is not kept.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-[#070e1c] border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {selectedFile.type.startsWith('image/') ? (
                  <img
                    src={selectedFile.previewUrl}
                    alt="Uploaded document preview"
                    className="w-24 h-16 object-cover rounded-xl border border-white/10 shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#19202e] text-[#5de6ff] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate">
                    {selectedFile.name}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-[#908fa0] font-mono mt-1">
                    <span>{selectedFile.type}</span>
                    <span>•</span>
                    <span>{formatFileSize(selectedFile.size)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap self-end md:self-center">
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-[#ffb4ab] text-xs font-semibold border border-red-500/30 transition-colors"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold border border-white/5 transition-colors"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleContinueToRead}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-md hover:brightness-105 transition-all flex items-center gap-1.5"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 2: READ DETAILS (Loading State)                                */}
      {/* =================================================================== */}
      {step === 2 && (
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-12 shadow-xl flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#232a39] text-[#5de6ff] flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-3xl animate-spin">
              progress_activity
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-white">
              Reading details from your document...
            </h2>
            <p className="text-xs text-[#908fa0]">
              Checking {selectedFile?.name} on the server and reading student details.
            </p>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 3: REVIEW                                                      */}
      {/* =================================================================== */}
      {step === 3 && extractResult && (
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Details found in your document
                </h1>
                {extractResult.isTestMode && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#5de6ff]/15 text-[#5de6ff] border border-[#5de6ff]/30 text-xs font-mono font-semibold">
                    Test mode
                  </span>
                )}
              </div>
              <p className="text-xs text-[#908fa0]">
                These details were read directly from your uploaded file and cannot be edited by hand.
              </p>
            </div>
          </div>

          {extractResult.isTestMode && (
            <div className="p-3.5 rounded-xl bg-[#5de6ff]/10 border border-[#5de6ff]/30 flex items-center gap-2.5 text-xs text-[#5de6ff]">
              <span className="material-symbols-outlined text-[18px]">science</span>
              <span>{extractResult.readerNote}</span>
            </div>
          )}

          {/* Missing Fields / Invalid College ID Warning */}
          {hasMissingOrInvalid && (
            <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#ffb4ab] text-xl shrink-0 mt-0.5">
                warning
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-white">
                  We couldn't read all the details. Try a clearer document.
                </span>
                {extractResult.extraction.missingFields.length > 0 && (
                  <span className="text-xs text-[#ffb4ab]">
                    Missing or unreadable fields:{' '}
                    {extractResult.extraction.missingFields.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Side-by-Side Layout: File Preview + Read-Only Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* File Preview Column */}
            <div className="lg:col-span-5 bg-[#070e1c] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-[#908fa0]">
                <span className="font-semibold text-white">Uploaded File Preview</span>
                <span className="font-mono">{selectedFile?.name}</span>
              </div>

              {selectedFile?.type.startsWith('image/') ? (
                <img
                  src={selectedFile.previewUrl}
                  alt="Uploaded document"
                  className="w-full rounded-xl border border-white/10 bg-white object-contain"
                />
              ) : (
                <div className="h-56 rounded-xl bg-[#151b2a] flex flex-col items-center justify-center gap-2 text-[#5de6ff]">
                  <span className="material-symbols-outlined text-5xl">picture_as_pdf</span>
                  <span className="text-xs text-white font-semibold">{selectedFile?.name}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#151b2a] border border-white/5 flex flex-col gap-1 font-mono text-[11px]">
                <span className="text-[#908fa0]">Uploaded File SHA-256 (source_file_hash):</span>
                <span className="text-[#5de6ff] break-all">{extractResult.sourceFileHash}</span>
              </div>
            </div>

            {/* Read-Only Extracted Fields Column */}
            <div className="lg:col-span-7 flex flex-col gap-2.5">
              {reviewFields.map((field) => {
                const isMissing = !field.value;
                return (
                  <div
                    key={field.key}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isMissing
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-[#070e1c] border-white/5'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#908fa0]">
                        {field.label}
                      </span>
                      <span
                        className={`text-sm font-semibold mt-0.5 ${
                          isMissing ? 'text-[#ffb4ab] italic' : 'text-white'
                        }`}
                      >
                        {field.value || 'Missing / Unreadable'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#19202e] text-[#908fa0] font-mono text-[10px] flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      Read-only
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Honest Wording Note */}
          <div className="p-4 rounded-xl bg-[#070e1c] border border-white/10 flex items-start gap-3">
            <span className="material-symbols-outlined text-[#5de6ff] text-lg shrink-0 mt-0.5">
              verified_user
            </span>
            <p className="text-xs text-[#c7c4d7] leading-relaxed">
              SelfID reads details directly from your uploaded document and records their fingerprint on the public record.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRemoveFile}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold transition-colors"
            >
              Use a different document
            </button>

            <button
              type="button"
              onClick={handleConfirmAndCreate}
              disabled={hasMissingOrInvalid}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-lg hover:brightness-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>These details are correct</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 4: CREATE                                                      */}
      {/* =================================================================== */}
      {step === 4 && (
        <div className="bg-[#151b2a] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {creationStage === 'done'
                  ? 'Document Locked & Saved'
                  : creationStage === 'failed'
                  ? 'Confirmation Could Not Complete'
                  : 'Securing Your Document on Chain...'}
              </h1>
              {extractResult?.isTestMode && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#5de6ff]/15 text-[#5de6ff] border border-[#5de6ff]/30 text-xs font-mono font-semibold">
                  Test mode
                </span>
              )}
            </div>
            <p className="text-xs text-[#908fa0]">
              Lock and save &rarr; Fingerprint &rarr; Save fingerprint on the secure public record
            </p>
          </div>

          {/* 3-Step Creation Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">1. Lock and save</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                  check_circle
                </span>
              </div>
              <span className="text-[11px] text-[#908fa0]">
                Locked with AES-256-GCM encryption on the server.
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">2. Fingerprint</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                  check_circle
                </span>
              </div>
              <span className="text-[11px] text-[#908fa0]">
                Computed SHA-256 fingerprint of the final details and uploaded file.
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#070e1c] border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  3. Save fingerprint on public record
                </span>
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    creationStage === 'done'
                      ? 'text-[#4edea3]'
                      : creationStage === 'failed'
                      ? 'text-red-400'
                      : 'text-[#5de6ff] animate-spin'
                  }`}
                >
                  {creationStage === 'done'
                    ? 'check_circle'
                    : creationStage === 'failed'
                    ? 'error'
                    : 'progress_activity'}
                </span>
              </div>
              <span className="text-[11px] text-[#908fa0]">
                {creationStage === 'done'
                  ? 'Fingerprint confirmed on public record.'
                  : creationStage === 'failed'
                  ? 'On-chain anchoring failed.'
                  : 'Waiting for blockchain block confirmation...'}
              </span>
            </div>
          </div>

          {/* FAILED STATE BANNER WITH RETRY BUTTON */}
          {creationStage === 'failed' && (
            <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col gap-4 text-xs">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-red-400 text-2xl shrink-0 mt-0.5">
                  error
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-sm text-white">
                    Blockchain Anchoring Failed
                  </span>
                  <span className="text-[#ffb4ab] leading-relaxed">
                    {errorMessage || 'Transaction could not be confirmed on-chain.'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold transition-colors"
                >
                  Back to Review
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndCreate}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-md hover:brightness-105 flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Retry Confirmation</span>
                </button>
              </div>
            </div>
          )}

          {/* WAITING LOADING STATE */}
          {isCreating && creationStage === 'anchoring' && (
            <div className="p-6 rounded-2xl bg-[#070e1c] border border-white/10 flex flex-col items-center justify-center text-center gap-3">
              <span className="material-symbols-outlined text-3xl text-[#5de6ff] animate-spin">
                progress_activity
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-sm text-white">
                  Waiting for On-Chain Confirmation...
                </span>
                <span className="text-xs text-[#908fa0]">
                  Submitting anchorCredential to the blockchain smart contract and awaiting block confirmation.
                </span>
              </div>
            </div>
          )}

          {createdDocument && !isCreating && creationStage === 'done' && (
            <div className="p-5 rounded-2xl bg-[#070e1c] border border-[#4edea3]/30 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4edea3]">lock</span>
                  <span className="text-sm font-bold text-white">
                    {createdDocument.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#00885d]/20 text-[#4edea3] text-xs font-semibold">
                    Locked and saved
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#8083ff]/20 text-[#c0c1ff] text-xs font-semibold">
                    Fingerprint saved on public record
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-[#151b2a] border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] text-[#908fa0] uppercase">
                    Document Fingerprint (SHA-256)
                  </span>
                  <span className="text-[#5de6ff] break-all">
                    {createdDocument.sha256Hash}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#151b2a] border border-white/5 flex flex-col gap-1">
                  <span className="text-[10px] text-[#908fa0] uppercase">
                    Uploaded File Hash (source_file_hash)
                  </span>
                  <span className="text-[#c7c4d7] break-all">
                    {createdDocument.sourceFileHash}
                  </span>
                </div>
              </div>

              {/* On-Chain Transaction Explorer Link */}
              {(createdDocument.chainTxHash || createdDocument.onChainState?.txHash) && (
                <div className="p-3 rounded-xl bg-[#151b2a] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
                  <span className="text-[11px] text-[#908fa0]">
                    Public Record Transaction:
                  </span>
                  <a
                    href={getExplorerTxUrl(createdDocument.chainTxHash || createdDocument.onChainState.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#5de6ff] hover:underline"
                    title="View transaction on block explorer"
                  >
                    <span>
                      {(createdDocument.chainTxHash || createdDocument.onChainState.txHash).slice(0, 16)}...
                    </span>
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <Link
                  to="/app/wallet"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#232a39] hover:bg-[#2e3544] text-white text-xs font-semibold text-center"
                >
                  Return to Wallet
                </Link>
                <button
                  type="button"
                  onClick={() => navigate(`/app/documents/${createdDocument.id}`)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#22d3ee] text-white text-xs font-bold shadow-md hover:brightness-105 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>View Document Details</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
