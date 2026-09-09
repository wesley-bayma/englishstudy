import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiServiceError } from '../lib/api-errors';
import { getGeminiApiKey, requestGeminiJson } from '../lib/gemini-client';

const originalFetch = globalThis.fetch;
const originalTimeout = process.env.GEMINI_TIMEOUT_MS;
const originalApiKey = process.env.GEMINI_API_KEY;
const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Gemini client', () => {
  beforeEach(() => {
    process.env.GEMINI_TIMEOUT_MS = '50000';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalTimeout === undefined) delete process.env.GEMINI_TIMEOUT_MS;
    else process.env.GEMINI_TIMEOUT_MS = originalTimeout;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalOpenRouterApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
    vi.restoreAllMocks();
  });

  it('sends a Gemini structured JSON request and parses a completed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }]
    }));
    globalThis.fetch = fetchMock;

    const result = await requestGeminiJson<{ ok: boolean }>({
      apiKey: 'server-only-test-key',
      prompt: 'test',
      jsonSchema: {
        name: 'test',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }
      }
    });

    expect(result).toEqual({ ok: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
    expect(body.generationConfig.responseSchema.properties.ok.type).toBe('BOOLEAN');
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.8-flash:generateContent');
  });

  it('maps provider auth, rate-limit, truncation and malformed JSON failures', async () => {
    const failures = [
      { body: { error: { message: 'no' } }, status: 401, code: 'UPSTREAM_AUTH' },
      { body: { error: { message: 'slow down' } }, status: 429, code: 'UPSTREAM_RATE_LIMIT' },
      { body: { candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'MAX_TOKENS' }] }, status: 200, code: 'INVALID_AI_RESPONSE' },
      { body: { candidates: [{ content: { parts: [{ text: 'not json' }] }, finishReason: 'STOP' }] }, status: 200, code: 'INVALID_AI_RESPONSE' }
    ];

    for (const failure of failures) {
      globalThis.fetch = vi.fn().mockResolvedValue(response(failure.body, failure.status));
      await expect(requestGeminiJson({ apiKey: 'test', prompt: 'test' })).rejects.toMatchObject({ code: failure.code });
    }
  });

  it('maps an outbound AbortController timeout to a 504 error', async () => {
    process.env.GEMINI_TIMEOUT_MS = '5';
    globalThis.fetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));

    await expect(requestGeminiJson({ apiKey: 'test', prompt: 'test' })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      status: 504
    } satisfies Partial<ApiServiceError>);
  });

  it('retries once with z-ai/glm-5.3-flash through OpenRouter when Gemini fails', async () => {
    const { requestAiJson } = await import('../lib/gemini-client');
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { message: 'temporary failure' } }, 503))
      .mockResolvedValueOnce(response({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
      }));
    globalThis.fetch = fetchMock;

    await expect(requestAiJson<{ ok: boolean }>({ prompt: 'test' })).resolves.toEqual({ ok: true });
    const fallbackBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(fallbackBody.model).toBe('z-ai/glm-5.3-flash');
    expect(fetchMock.mock.calls[1][0]).toContain('openrouter.ai');
  });

  it('fails explicitly when the server key is absent', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => getGeminiApiKey()).toThrowError(
      expect.objectContaining({ code: 'AI_NOT_CONFIGURED', status: 503 })
    );
  });
});
