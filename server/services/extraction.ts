import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { z } from 'zod';

export interface UploadedDocumentFile {
  fileName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

export const REQUIRED_DOCUMENT_FIELDS = [
  'fullName',
  'institution',
  'course',
  'academicYear',
  'studentId',
  'studentStatus',
  'dateOfBirth',
] as const;

export const extractedDocumentSchema = z.object({
  fullName: z.string().default(''),
  institution: z.string().default(''),
  course: z.string().default(''),
  academicYear: z.string().default(''),
  studentId: z.string().default(''),
  studentStatus: z.string().default(''),
  dateOfBirth: z.string().default(''),
  missingFields: z.array(z.string()).default([]),
  looksLikeCollegeId: z.boolean().default(false),
});

export type ExtractedDocumentFields = z.infer<typeof extractedDocumentSchema>;

export interface ExtractionResult extends ExtractedDocumentFields {
  isTestMode: boolean;
  readerNote: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
]);

/**
 * Validates file type, size, and binary header integrity.
 * Throws plain-English errors as required.
 */
function validateUploadedFile(file: UploadedDocumentFile): void {
  const mime = (file.mimeType || '').toLowerCase();
  const ext = (file.fileName || '').toLowerCase().split('.').pop() || '';
  const validExt = ['pdf', 'jpg', 'jpeg', 'png'].includes(ext);

  if (!ALLOWED_MIME_TYPES.has(mime) && !validExt) {
    throw new Error('Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG file.');
  }

  if (file.fileSize > MAX_FILE_SIZE_BYTES || file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('File too big. Maximum file size is 10 MB.');
  }

  if (!file.buffer || file.buffer.length < 8) {
    throw new Error("Couldn't read the text. We couldn't open this file. Please try another file.");
  }

  // Check magic bytes for PNG, JPEG, PDF
  const isPng =
    file.buffer[0] === 0x89 &&
    file.buffer[1] === 0x50 &&
    file.buffer[2] === 0x4e &&
    file.buffer[3] === 0x47;
  const isJpeg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8;
  const isPdf =
    file.buffer.subarray(0, 1024).toString('ascii').includes('%PDF-') || ext === 'pdf';

  if (!isPng && !isJpeg && !isPdf) {
    throw new Error("Couldn't read the text. Format not recognized. Please try another file.");
  }
}

/**
 * Normalizes extracted fields and computes missingFields accurately.
 */
function normalizeExtraction(raw: ExtractedDocumentFields): ExtractedDocumentFields {
  const invalidPlaceholders = new Set([
    '',
    'n/a',
    'na',
    'none',
    'null',
    'undefined',
    'unknown',
    'unknown college',
    '--- missing ---',
    '--- unreadable ---',
    'missing',
    'unreadable',
  ]);

  const cleaned: Record<string, string> = {
    fullName: (raw.fullName || '').trim(),
    institution: (raw.institution || '').trim(),
    course: (raw.course || '').trim(),
    academicYear: (raw.academicYear || '').trim(),
    studentId: (raw.studentId || '').trim(),
    studentStatus: (raw.studentStatus || '').trim(),
    dateOfBirth: (raw.dateOfBirth || '').trim(),
  };

  const missingSet = new Set<string>(raw.missingFields || []);

  for (const field of REQUIRED_DOCUMENT_FIELDS) {
    const val = cleaned[field] || '';
    if (!val || invalidPlaceholders.has(val.toLowerCase())) {
      cleaned[field] = '';
      missingSet.add(field);
    } else {
      missingSet.delete(field);
    }
  }

  const missingFields = Array.from(missingSet);
  const looksLikeCollegeId = Boolean(raw.looksLikeCollegeId && missingFields.length === 0);

  return extractedDocumentSchema.parse({
    ...cleaned,
    missingFields,
    looksLikeCollegeId,
  });
}

/**
 * Checks if the uploaded file is one of the synthetic sample PNGs with embedded metadata
 * or matches sample filenames for deterministic test fallback.
 */
function runTestReaderFallback(file: UploadedDocumentFile): ExtractedDocumentFields {
  // Check if file buffer contains our synthetic sample metadata chunk
  const marker = 'SelfIDSample\0';
  const ascii = file.buffer.toString('utf8');
  const markerIdx = ascii.indexOf(marker);
  if (markerIdx !== -1) {
    try {
      const startJson = markerIdx + marker.length;
      const endBrace = ascii.indexOf('}', startJson);
      if (endBrace !== -1) {
        const jsonStr = ascii.slice(startJson, endBrace + 1);
        const parsed = JSON.parse(jsonStr);
        return normalizeExtraction(extractedDocumentSchema.parse(parsed));
      }
    } catch {
      // Continue to filename check
    }
  }

  const lowerName = (file.fileName || '').toLowerCase();

  if (
    lowerName.includes('blurry') ||
    lowerName.includes('incomplete') ||
    lowerName.includes('missing') ||
    lowerName.includes('bad')
  ) {
    return normalizeExtraction({
      fullName: 'Rohan Verma',
      institution: '',
      course: '',
      academicYear: '',
      studentId: '',
      studentStatus: '',
      dateOfBirth: '',
      missingFields: [
        'institution',
        'course',
        'academicYear',
        'studentId',
        'studentStatus',
        'dateOfBirth',
      ],
      looksLikeCollegeId: false,
    });
  }

  if (lowerName.includes('other') || lowerName.includes('horizon') || lowerName.includes('nid')) {
    return normalizeExtraction({
      fullName: 'Meera Krishnan',
      institution: 'Horizon State University',
      course: 'B.S. Data Science',
      academicYear: '2023 - 2027',
      studentId: 'HSU-2023-8841',
      studentStatus: 'Active',
      dateOfBirth: '2003-11-09',
      missingFields: [],
      looksLikeCollegeId: true,
    });
  }

  return normalizeExtraction({
    fullName: 'Aarav Sharma',
    institution: 'CMR Institute of Technology',
    course: 'B.Tech Computer Science',
    academicYear: '2024 - 2028',
    studentId: '1CR24CS042',
    studentStatus: 'Active',
    dateOfBirth: '2004-05-18',
    missingFields: [],
    looksLikeCollegeId: true,
  });
}

/**
 * Server-side document reader:
 * Reads details from an uploaded PDF, JPG, JPEG, or PNG file using the Gemini Vision API.
 * If GEMINI_API_KEY is missing, falls back to a clearly labelled test reader with isTestMode = true.
 */
export async function extractDocumentFields(
  file: UploadedDocumentFile
): Promise<ExtractionResult> {
  validateUploadedFile(file);

  const rawKey = (process.env.GEMINI_API_KEY || '').trim();
  const hasRealGeminiKey =
    Boolean(rawKey) &&
    rawKey !== 'your-gemini-api-key' &&
    rawKey !== 'YOUR_GEMINI_API_KEY';

  if (!hasRealGeminiKey) {
    const testExtracted = runTestReaderFallback(file);
    return {
      ...testExtracted,
      isTestMode: true,
      readerNote:
        'Test mode: GEMINI_API_KEY is not set on the server. Using the built-in sample document reader.',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: rawKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const normalizedMime =
      file.mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.mimeType.toLowerCase();

    const filePart = {
      inlineData: {
        mimeType: normalizedMime,
        data: file.buffer.toString('base64'),
      },
    };

    const promptText = `You are a precise, tolerant document reader for student and college ID cards.
If this is a multi-page document or PDF, examine the first 2 pages.
Be tolerant with different wording commonly found on official student documents:
- College / Institution / University / School / Academy / Institute
- Roll No / Student ID / Registration No / Reg. No / Enrollment No / USN / ID
- Course / Branch / Program / Degree / Department / Major
- Academic Year / Batch / Session / Valid Thru / Year of Study
- Student Status (e.g. Active, Enrolled, Student, Full Time)
- Date of Birth / DOB / Birthdate

Read the document and return ONLY a JSON object with these exact keys:
- fullName: The student's full legal name in Title Case (or "" if missing or unreadable)
- institution: The college or university name in Title Case (or "" if missing or unreadable)
- course: The degree, course, major or branch (or "" if missing or unreadable)
- academicYear: The academic year or batch, e.g. "2024 - 2028" (or "" if missing or unreadable)
- studentId: The student ID, roll number, or reg no (or "" if missing or unreadable)
- studentStatus: The student status, e.g. "Active" (or "" if missing or unreadable)
- dateOfBirth: The date of birth in YYYY-MM-DD format if possible (or "" if missing or unreadable)
- missingFields: An array of field names from [fullName, institution, course, academicYear, studentId, studentStatus, dateOfBirth] that are missing, blank, or unreadable.
- looksLikeCollegeId: true ONLY if this document has identifiable student credentials and none of the key fields are missing; otherwise false.`;

    let attempts = 0;
    let response: GenerateContentResponse | null = null;
    let lastErr: unknown = null;

    while (attempts < 2) {
      attempts++;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [filePart, { text: promptText }],
          },
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                fullName: { type: Type.STRING },
                institution: { type: Type.STRING },
                course: { type: Type.STRING },
                academicYear: { type: Type.STRING },
                studentId: { type: Type.STRING },
                studentStatus: { type: Type.STRING },
                dateOfBirth: { type: Type.STRING },
                missingFields: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                looksLikeCollegeId: { type: Type.BOOLEAN },
              },
              required: [
                'fullName',
                'institution',
                'course',
                'academicYear',
                'studentId',
                'studentStatus',
                'dateOfBirth',
                'missingFields',
                'looksLikeCollegeId',
              ],
            },
          },
        });
        if (response?.text) break;
      } catch (callErr: any) {
        lastErr = callErr;
        if (attempts >= 2) break;
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    const textOutput = response?.text;
    if (!textOutput) {
      if (lastErr && String(lastErr).includes('RESOURCE_EXHAUSTED')) {
        throw new Error('Service busy. Please try again in a moment.');
      }
      throw new Error("Couldn't read the text. We couldn't read the information from this file.");
    }

    const parsedJson = JSON.parse(textOutput.trim());
    const validated = normalizeExtraction(extractedDocumentSchema.parse(parsedJson));

    return {
      ...validated,
      isTestMode: false,
      readerNote: 'Details read from your uploaded file on the server.',
    };
  } catch (err: unknown) {
    // Check if the uploaded file is one of the embedded sample files and Gemini API key is invalid/unconfigured in preview
    const marker = 'SelfIDSample\0';
    if (file.buffer.toString('utf8').includes(marker)) {
      const fallback = runTestReaderFallback(file);
      return {
        ...fallback,
        isTestMode: true,
        readerNote:
          'Test mode: Using the built-in sample document reader because the live Gemini key was unavailable.',
      };
    }

    const errStr = err instanceof Error ? err.message : String(err);
    if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('503')) {
      throw new Error('Service busy. Please try again in a moment.');
    }

    throw new Error(
      err instanceof Error && err.message
        ? err.message
        : "Couldn't read the text. We couldn't read the information from this file."
    );
  }
}
