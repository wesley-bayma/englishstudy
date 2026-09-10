import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiServiceError } from '../lib/api-errors';
import { getGeminiApiKey, requestGeminiJson } from '../lib/gemini-client';

const originalFetch = globalThis.fetch;
const originalTimeout = process.env.GEMINI_TIMEOUT_MS;
const originalEndpoint = process.env.GEMINI_API_BASE_URL;
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
    if (originalEndpoint === undefined) delete process.env.GEMINI_API_BASE_URL;
    else process.env.GEMINI_API_BASE_URL = originalEndpoint;
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
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            optional: { type: ['string', 'null'] }
          },
          required: ['ok'],
          additionalProperties: false
        }
      }
    });

    expect(result).toEqual({ ok: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeUndefined();
    expect(body.generationConfig.responseJsonSchema.type).toBe('object');
    expect(body.generationConfig.responseJsonSchema.properties.ok.type).toBe('boolean');
    expect(body.generationConfig.responseJsonSchema.properties.optional.type).toEqual(['string', 'null']);
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
    })) as unknown as typeof fetch;

    await expect(requestGeminiJson({ apiKey: 'test', prompt: 'test' })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      status: 504
    } satisfies Partial<ApiServiceError>);
  });

  it('retries once with the configured structured-output model through OpenRouter when Gemini fails', async () => {
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
    expect(fallbackBody.model).toBe('google/gemini-2.5-flash-lite');
    expect(fetchMock.mock.calls[1][0]).toContain('openrouter.ai');
  });

  it('uses OpenRouter when Gemini returns JSON that fails the application validator', async () => {
    const { requestAiJson } = await import('../lib/gemini-client');
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        candidates: [{ content: { parts: [{ text: '{"ok":false}' }] }, finishReason: 'STOP' }]
      }))
      .mockResolvedValueOnce(response({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
      }));
    globalThis.fetch = fetchMock;

    await expect(requestAiJson<{ ok: boolean }>({
      prompt: 'test',
      validateResponse: value => (value as { ok?: boolean }).ok === true
    })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not start a fallback after the shared 55-second request deadline has elapsed', async () => {
    const { requestAiJson } = await import('../lib/gemini-client');
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { message: 'temporary failure' } }, 503));
    globalThis.fetch = fetchMock;
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(55_000);

    await expect(requestAiJson({ prompt: 'test' })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      status: 504
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cuts off Gemini after 12 seconds and allows the fallback to use the remaining route budget', async () => {
    const { requestAiJson } = await import('../lib/gemini-client');
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }))
      .mockResolvedValueOnce(response({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
      }));
    globalThis.fetch = fetchMock;

    const result = requestAiJson<{ ok: boolean }>({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(12_000);

    await expect(result).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forces the fallback even when the primary fetch ignores AbortController', async () => {
    const { requestAiJson } = await import('../lib/gemini-client');
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(response({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
      }));
    globalThis.fetch = fetchMock;

    const result = requestAiJson<{ ok: boolean }>({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(12_000);

    await expect(result).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails explicitly when the server key is absent', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => getGeminiApiKey()).toThrowError(
      expect.objectContaining({ code: 'AI_NOT_CONFIGURED', status: 503 })
    );
  });
});
