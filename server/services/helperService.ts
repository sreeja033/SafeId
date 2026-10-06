import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

export interface HelperExplanationParams {
  verifierName: string;
  purpose: string;
  requestedFields: string[];
  question?: 'Is this safe?' | 'What if I say no?' | 'Can I take it back later?' | string;
}

export interface HelperExplanationResult {
  explanation: string;
  isAiGenerated: boolean;
  question?: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildFallbackExplanation(params: HelperExplanationParams): string {
  const { verifierName, purpose, requestedFields, question } = params;
  const fieldsStr = requestedFields.length > 0 ? requestedFields.join(', ') : 'credential fields';

  if (question === 'Is this safe?') {
    return `Yes, this is safe because SelfID uses selective disclosure. Only the specific checkboxes you tick are shared with ${verifierName}, and your original document remains locked and encrypted in your safe.`;
  }

  if (question === 'What if I say no?') {
    return `If you say no or deny this request, none of your document details will be shared. ${verifierName} will simply receive a polite notice that access was declined.`;
  }

  if (question === 'Can I take it back later?') {
    return `Yes, you can take back access at any time from your Permission History page. With one click, your permission is revoked on the public record and ${verifierName} loses access immediately.`;
  }

  // Default explanation
  return `${verifierName} is asking for ${fieldsStr} to verify "${purpose}". For this purpose, you only need to confirm your college enrollment, so extra details like your student ID number or date of birth are not needed and can be left unchecked.`;
}

/**
 * Explains what the verifier is asking and highlights fields not needed for their purpose.
 * NEVER receives or transmits document contents/values—strictly works with field names and purpose.
 */
export async function getHelperExplanation(
  params: HelperExplanationParams
): Promise<HelperExplanationResult> {
  const { verifierName, purpose, requestedFields, question } = params;
  const ai = getGeminiClient();

  if (!ai) {
    return {
      explanation: buildFallbackExplanation(params),
      isAiGenerated: false,
      question,
    };
  }

  const fieldsStr = requestedFields.length > 0 ? requestedFields.join(', ') : 'document fields';

  let prompt = '';
  if (question === 'Is this safe?') {
    prompt = `You are the SelfID privacy assistant. The user is reviewing a request from "${verifierName}" asking for [${fieldsStr}] for the purpose of "${purpose}".
The user asks: "Is this safe?"
In 2 short sentences, explain why selective disclosure keeps them safe and that only checked fields are shared while the original document stays encrypted. Do not hallucinate or request document values.`;
  } else if (question === 'What if I say no?') {
    prompt = `You are the SelfID privacy assistant. The user is reviewing a request from "${verifierName}" asking for [${fieldsStr}] for the purpose of "${purpose}".
The user asks: "What if I say no?"
In 2 short sentences, explain that they have full control to decline, no personal details will be revealed, and the verifier will only see that request was denied.`;
  } else if (question === 'Can I take it back later?') {
    prompt = `You are the SelfID privacy assistant. The user is reviewing a request from "${verifierName}" asking for [${fieldsStr}] for the purpose of "${purpose}".
The user asks: "Can I take it back later?"
In 2 short sentences, explain that they can revoke permission anytime from their Permission History page and it takes effect immediately on the public record.`;
  } else {
    prompt = `You are the SelfID privacy assistant. A student is reviewing a verification request from "${verifierName}".
Stated purpose: "${purpose}".
Requested field names: [${fieldsStr}].

In 2 to 3 short, simple sentences:
1. Explain in plain words what "${verifierName}" is asking for and why.
2. Clearly point out which of these fields may not be needed for their stated purpose, and reassure the student they can leave those unchecked.
Do not ask for or output any personal data or document values. Keep the tone helpful, clear, and reassuring.`;
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return {
        explanation: buildFallbackExplanation(params),
        isAiGenerated: false,
        question,
      };
    }

    return {
      explanation: text,
      isAiGenerated: true,
      question,
    };
  } catch (err) {
    console.warn('[HelperService] Gemini API call failed, falling back to deterministic explanation:', err instanceof Error ? err.message : 'Error');
    return {
      explanation: buildFallbackExplanation(params),
      isAiGenerated: false,
      question,
    };
  }
}
