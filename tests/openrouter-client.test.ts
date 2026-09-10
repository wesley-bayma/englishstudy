import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiServiceError } from '../lib/api-errors';
import { DEFAULT_OPENROUTER_MODEL, requestOpenRouterJson } from '../lib/openrouter-client';

const originalFetch = globalThis.fetch;
const originalEndpoint = process.env.OPENROUTER_API_BASE_URL;
const originalTimeout = process.env.OPENROUTER_TIMEOUT_MS;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('OpenRouter client', () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_BASE_URL;
    process.env.OPENROUTER_TIMEOUT_MS = '50000';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEndpoint === undefined) delete process.env.OPENROUTER_API_BASE_URL;
    else process.env.OPENROUTER_API_BASE_URL = originalEndpoint;
    if (originalTimeout === undefined) delete process.env.OPENROUTER_TIMEOUT_MS;
    else process.env.OPENROUTER_TIMEOUT_MS = originalTimeout;
    vi.restoreAllMocks();
  });

  it('sends strict structured output with provider healing enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
    }));
    globalThis.fetch = fetchMock;

    await expect(requestOpenRouterJson<{ ok: boolean }>({
      apiKey: 'server-only-test-key',
      prompt: 'test',
      jsonSchema: {
        name: 'test',
        strict: true,
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
          additionalProperties: false
        }
      }
    })).resolves.toEqual({ ok: true });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.provider.require_parameters).toBe(true);
    expect(body.plugins).toEqual([{ id: 'response-healing' }]);
  });

  it('maps provider rate limits and invalid structured responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(response({ error: { message: 'slow down' } }, 429));
    await expect(requestOpenRouterJson({ apiKey: 'test', prompt: 'test' })).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMIT',
      status: 429
    } satisfies Partial<ApiServiceError>);

    globalThis.fetch = vi.fn().mockResolvedValue(response({
      choices: [{ message: { content: '{"wrong":true}' }, finish_reason: 'stop' }]
    }));
    await expect(requestOpenRouterJson({
      apiKey: 'test',
      prompt: 'test',
      validateResponse: value => (value as { ok?: boolean }).ok === true
    })).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' });
  });

  it('uses an available structured-output default model and supports injected endpoints for stress tests', async () => {
    expect(DEFAULT_OPENROUTER_MODEL).toBe('z-ai/glm-5.3-flash');
    process.env.OPENROUTER_API_BASE_URL = 'http://127.0.0.1:4010/chat/completions';
    const fetchMock = vi.fn().mockResolvedValue(response({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }]
    }));
    globalThis.fetch = fetchMock;

    await expect(requestOpenRouterJson<{ ok: boolean }>({ apiKey: 'test', prompt: 'test' })).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:4010/chat/completions');
  });
});
