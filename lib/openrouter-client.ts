const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_OPENROUTER_MODEL = '~deepseek/deepseek-v4-flash-latest';

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

interface OpenRouterJsonRequest {
  apiKey: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

function extractContent(payload: OpenRouterResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'string' ? part : part.text || '')
      .join('');
  }

  throw new Error(payload.error?.message || 'OpenRouter retornou uma resposta vazia.');
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
      throw new Error('OpenRouter não retornou JSON válido.');
    }
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
  }
}

export async function requestOpenRouterJson<T>({
  apiKey,
  prompt,
  systemPrompt = 'Responda somente com JSON válido, sem markdown ou texto adicional.',
  maxTokens = 4096,
  temperature = 0.2
}: OpenRouterJsonRequest): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 60000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://englishstudy-chi.vercel.app',
        'X-Title': 'English Study Hub'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        temperature
      }),
      signal: controller.signal
    });

    const payload = await response.json() as OpenRouterResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `OpenRouter respondeu HTTP ${response.status}.`);
    }

    if (payload.choices?.[0]?.finish_reason === 'length') {
      throw new Error('OpenRouter atingiu o limite de tokens antes de concluir o JSON.');
    }

    return parseJsonResponse<T>(extractContent(payload));
  } finally {
    clearTimeout(timeout);
  }
}
