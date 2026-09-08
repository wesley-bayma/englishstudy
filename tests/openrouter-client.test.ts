import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiServiceError } from '../lib/api-errors';
import { getOpenRouterApiKey, requestOpenRouterJson } from '../lib/openrouter-client';

const originalFetch = globalThis.fetch;
const originalTimeout = process.env.OPENROUTER_TIMEOUT_MS;
const originalApiKey = process.env.OPENROUTER_API_KEY;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('OpenRouter client', () => {
  beforeEach(() => {
    process.env.OPENROUTER_TIMEOUT_MS = '50000';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalTimeout === undefined) delete process.env.OPENROUTER_TIMEOUT_MS;
    else process.env.OPENROUTER_TIMEOUT_MS = originalTimeout;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('sends strict JSON schema and parses a completed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
    }));
    globalThis.fetch = fetchMock;

    const result = await requestOpenRouterJson<{ ok: boolean }>({
      apiKey: 'server-only-test-key',
      prompt: 'test',
      jsonSchema: {
        name: 'test',
        strict: true,
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }
      }
    });

    expect(result).toEqual({ ok: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.provider.require_parameters).toBe(true);
  });

  it('maps provider auth, rate-limit, truncation and malformed JSON failures', async () => {
    const failures = [
      { body: { error: { message: 'no' } }, status: 401, code: 'UPSTREAM_AUTH' },
      { body: { error: { message: 'slow down' } }, status: 429, code: 'UPSTREAM_RATE_LIMIT' },
      { body: { choices: [{ message: { content: '{}' }, finish_reason: 'length' }] }, status: 200, code: 'INVALID_AI_RESPONSE' },
      { body: { choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }] }, status: 200, code: 'INVALID_AI_RESPONSE' }
    ];

    for (const failure of failures) {
      globalThis.fetch = vi.fn().mockResolvedValue(response(failure.body, failure.status));
      await expect(requestOpenRouterJson({ apiKey: 'test', prompt: 'test' })).rejects.toMatchObject({ code: failure.code });
    }
  });

  it('maps an outbound AbortController timeout to a 504 error', async () => {
    process.env.OPENROUTER_TIMEOUT_MS = '5';
    globalThis.fetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));

    await expect(requestOpenRouterJson({ apiKey: 'test', prompt: 'test' })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      status: 504
    } satisfies Partial<ApiServiceError>);
  });

  it('fails explicitly when the server key is absent', () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(() => getOpenRouterApiKey()).toThrowError(
      expect.objectContaining({ code: 'AI_NOT_CONFIGURED', status: 503 })
    );
  });
});
