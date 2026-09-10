import { ApiServiceError } from './api-errors';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_OPENROUTER_MODEL = 'z-ai/glm-5.3-flash';
const DEFAULT_TIMEOUT_MS = 50_000;
const DEADLINE_SAFETY_MARGIN_MS = 1_000;

export function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new ApiServiceError('AI_NOT_CONFIGURED', 503, 'A integração com a IA ainda não está configurada.');
  }
  return apiKey;
}

type OpenRouterContentPart = string | { type?: string; text?: string };

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | OpenRouterContentPart[] | null;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
}

export interface OpenRouterResponseMeta {
  model: string;
  status: number;
  finishReason: string | null;
}

export interface OpenRouterJsonRequest {
  apiKey: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: Record<string, unknown>;
  validateResponse?: (value: unknown) => boolean;
  onResponse?: (meta: OpenRouterResponseMeta) => void;
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

function extractContent(payload: OpenRouterResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'string' ? part : part.text || '')
      .join('');
  }

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

export async function requestOpenRouterJson<T>({
  apiKey,
  model: requestedModel,
  prompt,
  systemPrompt = 'Responda somente com JSON válido, sem markdown ou texto adicional.',
  maxTokens = 4096,
  temperature = 0.2,
  jsonSchema,
  validateResponse,
  onResponse,
  deadlineAt,
  maxTimeoutMs = 55_000
}: OpenRouterJsonRequest): Promise<T> {
  const controller = new AbortController();
  const configuredTimeout = Number(process.env.OPENROUTER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = resolveTimeoutMs(configuredTimeout, maxTimeoutMs, deadlineAt);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const model = requestedModel || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const endpoint = process.env.OPENROUTER_API_BASE_URL || OPENROUTER_ENDPOINT;

  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://english-bayma.vercel.app',
        'X-Title': 'English Study Hub'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: jsonSchema
          ? { type: 'json_schema', json_schema: jsonSchema }
          : { type: 'json_object' },
        ...(jsonSchema ? { provider: { require_parameters: true } } : {}),
        ...(jsonSchema ? { plugins: [{ id: 'response-healing' }] } : {}),
        max_tokens: maxTokens,
        temperature
      }),
      signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiServiceError('UPSTREAM_TIMEOUT', 504, 'A geração demorou demais. Tente novamente.');
      }
      throw new ApiServiceError('UPSTREAM_ERROR', 502, 'Não foi possível conectar ao provedor de IA.');
    }

    let payload: OpenRouterResponse;
    try {
      payload = await response.json() as OpenRouterResponse;
    } catch {
      throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'O provedor retornou uma resposta inválida.');
    }

    const finishReason = payload.choices?.[0]?.finish_reason || null;
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

    if (finishReason?.toLowerCase() === 'length') {
      throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'A resposta do provedor foi interrompida antes de concluir.');
    }

    const parsed = parseJsonResponse<T>(extractContent(payload));
    if (validateResponse && !validateResponse(parsed)) {
      throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'O provedor retornou uma ficha incompatível com o formato esperado.');
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiServiceError) throw error;
    throw new ApiServiceError('UPSTREAM_ERROR', 502, 'Não foi possível concluir a geração com o provedor de IA.');
  } finally {
    clearTimeout(timeout);
  }
}
