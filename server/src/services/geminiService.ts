import { GoogleGenAI } from '@google/genai';
import { AIEvaluationOutputSchema, validateAIOutput, AIEvaluationOutput } from '../validators/aiOutput';
import { buildEvaluationPrompt } from '../utils/promptBuilder';


interface CriteriaInfo {
  id: string;
  nameTh: string;
  nameEn: string;
  groupNameEn: string;
}


interface CaseInfo {
  title: string;
  descriptionTh: string;
  descriptionEn: string;
  reasoningIndicators: string[];
}


export type AIEvaluationErrorCode =
  | 'AI_CONFIG_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'AI_PARSE_ERROR'
  | 'AI_VALIDATION_ERROR';


export class AIEvaluationError extends Error {
  code: AIEvaluationErrorCode;
  details?: string;

  constructor(code: AIEvaluationErrorCode, message: string, details?: string) {
    super(message);
    this.name = 'AIEvaluationError';
    this.code = code;
    this.details = details;
  }
}


/**
 * Attempt to repair common JSON issues from LLM output:
 * - Trailing commas before ] or }
 * - Truncated responses (try to close open brackets)
 * - Extra text after JSON
 */
function repairJson(str: string): string {
  let fixed = str.replace(/,\s*([}\]])/g, '$1');

  try {
    JSON.parse(fixed);
    return fixed;
  } catch { }

  const opens = (fixed.match(/\[/g) || []).length;
  const closes = (fixed.match(/\]/g) || []).length;
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;

  if (openBraces > closeBraces) {
    const lastCompleteObj = fixed.lastIndexOf('}');
    if (lastCompleteObj > 0) {
      fixed = fixed.substring(0, lastCompleteObj + 1);
    }
  }

  for (let i = 0; i < opens - (fixed.match(/\]/g) || []).length; i++) {
    fixed += ']';
  }
  for (let i = 0; i < (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length; i++) {
    fixed += '}';
  }

  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  return fixed;
}


// ── Vertex AI fallback helper (now uses @google/genai) ──────────────────────
async function generateWithVertex(prompt: string, modelName: string): Promise<string> {
  const project = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  if (!project) throw new Error('VERTEX_PROJECT_ID not configured');

  const vertex = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  const response = await vertex.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      temperature: 0.1,
      topP: 0.95,
    },
  });

  return response.text ?? '';
}


function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}


function normalizeParsedOutput(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const obj = parsed as Record<string, unknown>;
  const next: Record<string, unknown> = { ...obj };

  if (Array.isArray(obj.criteriaScores)) {
    next.criteriaScores = obj.criteriaScores.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const scoreRaw = (item as Record<string, unknown>).score;
      const asNumber = Number(scoreRaw);
      if (!Number.isFinite(asNumber)) return item;
      return {
        ...(item as Record<string, unknown>),
        score: clamp(Math.round(asNumber), 1, 5),
      };
    });
  }

  if ('confidenceScore' in obj) {
    const confidence = Number(obj.confidenceScore);
    if (Number.isFinite(confidence)) {
      next.confidenceScore = clamp(confidence, 0, 1);
    }
  }

  return next;
}


function asEvaluationError(err: unknown, fallbackCode: AIEvaluationErrorCode): AIEvaluationError {
  if (err instanceof AIEvaluationError) return err;
  if (err instanceof Error) return new AIEvaluationError(fallbackCode, err.message, err.stack);
  return new AIEvaluationError(fallbackCode, String(err));
}


export async function evaluateWithGemini(
  criteria: CriteriaInfo[],
  caseInfo: CaseInfo,
  transcript: string,
  retryCount: number = 0
): Promise<{ output: AIEvaluationOutput; rawResponse: string; retryCount: number }> {

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new AIEvaluationError(
      'AI_CONFIG_ERROR',
      'GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY not configured'
    );
  }

  // ── AI Studio client ────────────────────────────────────────────────────
  const genAI = new GoogleGenAI({ apiKey });

  const configuredModels = (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

  const expectedIds = criteria.map(c => c.id);
  const prompt = buildEvaluationPrompt(criteria, caseInfo, transcript);

  console.log(`[Gemini] Evaluating ${criteria.length} criteria for case: ${caseInfo.title}`);
  console.log(`[Gemini] Expected criteria IDs:`, expectedIds);

  let lastError: string = '';
  let lastFailure: AIEvaluationError | null = null;

  // ── AI Studio model loop ────────────────────────────────────────────────
  for (const modelName of configuredModels) {
    console.log(`[Gemini] Trying model: ${modelName}`);

    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const fullPrompt = attempt === 0
          ? prompt
          : `${prompt}\n\nPREVIOUS ATTEMPT FAILED WITH ERROR: ${lastError}\nPlease fix the output and try again. Return ONLY the JSON, no other text.`;

        let responseText = '';
        try {
          const response = await genAI.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
              temperature: 0.1,
              topP: 0.95,
              maxOutputTokens: 2048,
            },
          });
          responseText = response.text ?? '';
        } catch (err: any) {
          lastError = err.message || 'Unknown error';
          if (err.message?.includes('503') || err.message?.includes('Service Unavailable')) {
            console.warn(`[Gemini] Model ${modelName} returned 503, skipping to next model`);
            break;
          }
          console.error(`[Gemini] Model ${modelName}, attempt ${attempt + 1} failed:`, lastError);
        }

        console.log(`[Gemini] Model ${modelName}, attempt ${attempt + 1}: Received response (length: ${responseText.length})`);

        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
          console.log('[Gemini] Extracted JSON from markdown code block');
        } else {
          const braceMatch = responseText.match(/\{[\s\S]*\}/);
          if (braceMatch) {
            jsonStr = braceMatch[0];
            console.log('[Gemini] Extracted raw JSON from response');
          } else {
            console.log('[Gemini] No JSON pattern found in response');
          }
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          console.log('[Gemini] Direct JSON parse failed, attempting repair...');
          try {
            const repaired = repairJson(jsonStr);
            parsed = JSON.parse(repaired);
            console.log('[Gemini] JSON repair succeeded');
          } catch (repairErr) {
            throw new AIEvaluationError(
              'AI_PARSE_ERROR',
              `Unable to parse Gemini JSON output for model ${modelName}`,
              repairErr instanceof Error ? repairErr.message : String(repairErr)
            );
          }
        }

        const normalizedParsed = normalizeParsedOutput(parsed);
        let validated: AIEvaluationOutput;
        try {
          validated = AIEvaluationOutputSchema.parse(normalizedParsed);
        } catch (schemaErr) {
          throw new AIEvaluationError(
            'AI_VALIDATION_ERROR',
            `Gemini output schema validation failed on model ${modelName}`,
            schemaErr instanceof Error ? schemaErr.message : String(schemaErr)
          );
        }

        console.log(`[Gemini] Successfully parsed and validated. Got ${validated.criteriaScores.length} scores`);

        const rubricCheck = validateAIOutput(validated, expectedIds);
        if (!rubricCheck.valid) {
          lastError = rubricCheck.errors.join('; ');
          console.error(`[Gemini] Validation failed: ${lastError}`);
          if (attempt === 0) continue;
          throw new AIEvaluationError(
            'AI_VALIDATION_ERROR',
            `AI output validation failed after retry: ${lastError}`
          );
        }

        console.log(`[Gemini] Validation successful with model ${modelName}`);
        return {
          output: validated,
          rawResponse: responseText,
          retryCount: retryCount + attempt
        };

      } catch (err: any) {
        const evaluationErr = asEvaluationError(err, 'AI_PROVIDER_ERROR');
        lastFailure = evaluationErr;
        lastError = evaluationErr.message || 'Unknown error';
        console.error(
          `[Gemini] Model ${modelName}, attempt ${attempt + 1} failed (${evaluationErr.code}):`,
          evaluationErr.details || lastError
        );
        if (attempt === 1) break;
      }
    }
  }

  // ── Vertex AI fallback ──────────────────────────────────────────────────
  const vertexProject = process.env.VERTEX_PROJECT_ID;
  const vertexModels = (process.env.VERTEX_MODELS || 'gemini-2.5-flash')
    .split(',').map(m => m.trim()).filter(Boolean);

  if (vertexProject && vertexModels.length > 0) {
    console.warn('[Gemini] All AI Studio models failed. Switching to Vertex AI fallback...');

    for (const modelName of vertexModels) {
      console.log(`[Vertex] Trying model: ${modelName}`);
      try {
        const responseText = await generateWithVertex(prompt, modelName);
        if (!responseText) throw new Error('Empty Vertex AI response');

        let jsonStr = responseText.trim();

        const fenceMatch = jsonStr.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/s);
        if (fenceMatch) {
          jsonStr = fenceMatch[1].trim();
        }

        if (!jsonStr.startsWith('{')) {
          const braceStart = jsonStr.indexOf('{');
          const braceEnd = jsonStr.lastIndexOf('}');
          if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
            jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
          }
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          const repaired = repairJson(jsonStr);
          parsed = JSON.parse(repaired);
        }

        const normalizedParsed = normalizeParsedOutput(parsed);
        const validated = AIEvaluationOutputSchema.parse(normalizedParsed);
        const rubricCheck = validateAIOutput(validated, expectedIds);
        if (!rubricCheck.valid) throw new Error(rubricCheck.errors.join('; '));

        console.log(`[Vertex] Success with model ${modelName}`);
        return { output: validated, rawResponse: responseText, retryCount: retryCount + 1 };

      } catch (err: any) {
        console.error(`[Vertex] Model ${modelName} failed:`, err.message);
      }
    }
  }
  // ── End Vertex AI fallback ──────────────────────────────────────────────

  throw (
    lastFailure ||
    new AIEvaluationError('AI_PROVIDER_ERROR', `AI evaluation failed for all configured models: ${lastError}`)
  );
}