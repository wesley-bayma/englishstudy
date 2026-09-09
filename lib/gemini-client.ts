import { ApiServiceError } from './api-errors';
import { requestOpenRouterJson } from './openrouter-client';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_OPENROUTER_FALLBACK_MODEL = 'z-ai/glm-5.3-flash';
const DEFAULT_TIMEOUT_MS = 50_000;
const AI_ROUTE_DEADLINE_MS = 52_000;
const PRIMARY_PROVIDER_MAX_MS = 30_000;
const FALLBACK_PROVIDER_MAX_MS = 35_000;
const DEADLINE_SAFETY_MARGIN_MS = 1_000;

export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiServiceError('AI_NOT_CONFIGURED', 503, 'A integração com a IA ainda não está configurada.');
  }
  return apiKey;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

export interface GeminiResponseMeta {
  model: string;
  status: number;
  finishReason: string | null;
}

export interface GeminiJsonRequest {
  apiKey: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: Record<string, unknown>;
  onResponse?: (meta: GeminiResponseMeta) => void;
  deadlineAt?: number;
  maxTimeoutMs?: number;
}

function resolveTimeoutMs(configuredTimeout: number, maxTimeoutMs: number, deadlineAt?: number): number {
  const configured = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_TIMEOUT_MS;
  const remaining = deadlineAt === undefined
    ? Number.POSITIVE_INFINITY
    : deadlineAt - Date.now() - DEADLINE_SAFETY_MARGIN_MS;

  if (remaining <= 0) {
    throw new ApiServiceError('UPSTREAM_TIMEOUT', 504, 'A geração demorou demais. Tente novamente.');
  }

  return Math.min(configured, maxTimeoutMs, remaining);
}

const GEMINI_SCHEMA_TYPES: Record<string, string> = {
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  object: 'OBJECT',
  array: 'ARRAY',
  null: 'NULL'
};

function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key === 'type') {
      if (typeof child === 'string') return [key, GEMINI_SCHEMA_TYPES[child] || child];
      if (Array.isArray(child)) return [key, child.map(type => typeof type === 'string' ? (GEMINI_SCHEMA_TYPES[type] || type) : type)];
    }
    return [key, toGeminiSchema(child)];
  }));
}

function extractContent(payload: GeminiResponse): string {
  const content = payload.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (content) return content;
  throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'O provedor retornou uma resposta vazia.');
}

function parseJsonResponse<T>(content: string): T {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || content).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'O provedor não retornou JSON válido.');
    }
    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'O provedor não retornou JSON válido.');
    }
  }
}

export async function requestGeminiJson<T>({
  apiKey,
  prompt,
  systemPrompt = 'Responda somente com JSON válido, sem markdown ou texto adicional.',
  maxTokens = 4096,
  temperature = 0.2,
  jsonSchema,
  onResponse,
  deadlineAt,
  maxTimeoutMs = 55_000
}: GeminiJsonRequest): Promise<T> {
  const controller = new AbortController();
  const configuredTimeout = Number(process.env.GEMINI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = resolveTimeoutMs(configuredTimeout, maxTimeoutMs, deadlineAt);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  try {
    let response: Response;
    try {
      response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            ...(jsonSchema ? { responseSchema: toGeminiSchema(jsonSchema.schema || jsonSchema) } : {}),
            maxOutputTokens: maxTokens,
            temperature
          }
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiServiceError('UPSTREAM_TIMEOUT', 504, 'A geração demorou demais. Tente novamente.');
      }
      throw new ApiServiceError('UPSTREAM_ERROR', 502, 'Não foi possível conectar ao provedor de IA.');
    }

    let payload: GeminiResponse;
    try {
      payload = await response.json() as GeminiResponse;
    } catch {
      throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'O provedor retornou uma resposta inválida.');
    }

    const finishReason = payload.candidates?.[0]?.finishReason || null;
    onResponse?.({ model, status: response.status, finishReason });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiServiceError('UPSTREAM_AUTH', 502, 'A chave do provedor de IA foi rejeitada.', response.status);
      }
      if (response.status === 429) {
        throw new ApiServiceError('UPSTREAM_RATE_LIMIT', 429, 'O provedor de IA atingiu um limite temporário.', response.status);
      }
      throw new ApiServiceError('UPSTREAM_ERROR', 502, 'O provedor de IA não concluiu a solicitação.', response.status);
    }

    if (finishReason === 'MAX_TOKENS') {
      throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'A resposta do provedor foi interrompida antes de concluir.');
    }

    return parseJsonResponse<T>(extractContent(payload));
  } catch (error) {
    if (error instanceof ApiServiceError) throw error;
    throw new ApiServiceError('UPSTREAM_ERROR', 502, 'Não foi possível concluir a geração com o provedor de IA.');
  } finally {
    clearTimeout(timeout);
  }
}

function canUseOpenRouterFallback(error: unknown): boolean {
  return error instanceof ApiServiceError && [
    'UPSTREAM_AUTH',
    'UPSTREAM_RATE_LIMIT',
    'UPSTREAM_TIMEOUT',
    'UPSTREAM_ERROR',
    'INVALID_AI_RESPONSE'
  ].includes(error.code);
}

/**
 * Uses Gemini first and retries once with the OpenRouter fallback only when
 * the AI provider itself fails. Input, authentication, and rate-limit errors
 * from this application never spend a second provider request.
 */
export async function requestAiJson<T>(request: Omit<GeminiJsonRequest, 'apiKey'>): Promise<T> {
  const deadlineAt = request.deadlineAt || Date.now() + AI_ROUTE_DEADLINE_MS;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  let primaryError: unknown;

  if (geminiApiKey) {
    try {
      return await requestGeminiJson<T>({
        ...request,
        apiKey: geminiApiKey,
        deadlineAt,
        maxTimeoutMs: Math.min(request.maxTimeoutMs || PRIMARY_PROVIDER_MAX_MS, PRIMARY_PROVIDER_MAX_MS)
      });
    } catch (error) {
      if (!canUseOpenRouterFallback(error)) throw error;
      primaryError = error;
    }
  } else {
    primaryError = new ApiServiceError('AI_NOT_CONFIGURED', 503, 'A integração com a IA ainda não está configurada.');
  }

  const fallbackApiKey = process.env.OPENROUTER_API_KEY;
  if (!fallbackApiKey) throw primaryError;

  if (deadlineAt - Date.now() <= DEADLINE_SAFETY_MARGIN_MS) {
    throw new ApiServiceError('UPSTREAM_TIMEOUT', 504, 'A geração demorou demais. Tente novamente.');
  }

  return requestOpenRouterJson<T>({
    ...request,
    apiKey: fallbackApiKey,
    model: process.env.OPENROUTER_FALLBACK_MODEL || DEFAULT_OPENROUTER_FALLBACK_MODEL,
    deadlineAt,
    maxTimeoutMs: Math.min(request.maxTimeoutMs || FALLBACK_PROVIDER_MAX_MS, FALLBACK_PROVIDER_MAX_MS)
  });
}
