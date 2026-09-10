const baseUrl = process.env.STRESS_TEST_URL || 'http://localhost:3000';
const password = process.env.STRESS_PASSWORD || 'stress-password';
const totalPerEndpoint = Number(process.env.STRESS_REQUESTS || 100);
const concurrency = Number(process.env.STRESS_CONCURRENCY || 10);
const mockUrl = process.env.STRESS_MOCK_URL || '';
const requestTimeoutMs = Number(process.env.STRESS_REQUEST_TIMEOUT_MS || 10_000);

if (!Number.isInteger(totalPerEndpoint) || totalPerEndpoint < 1 || totalPerEndpoint > 1000) {
  throw new Error('STRESS_REQUESTS deve estar entre 1 e 1000.');
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) {
  throw new Error('STRESS_CONCURRENCY deve estar entre 1 e 100.');
}
if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 60_000) {
  throw new Error('STRESS_REQUEST_TIMEOUT_MS deve estar entre 100 e 60000.');
}

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function login() {
  const response = await fetchWithTimeout(new URL('/api/auth/login', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!response.ok) throw new Error(`Login do stress test falhou: HTTP ${response.status}`);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Login não retornou cookie de sessão.');
  return cookie;
}

function requestHeaders(index) {
  return {
    'Content-Type': 'application/json',
    Cookie: cookie,
    // Keep the normal stress run below the per-IP application limit while
    // still exercising provider and route concurrency.
    'X-Forwarded-For': `198.51.100.${(index % 50) + 1}`
  };
}

function requestFor(route, index) {
  const scenario = index % 20;
  if (route === 'study-sheet') {
    if (scenario === 17) return { term: 'stress-timeout', type: 'vocabulary' };
    if (scenario === 18) return { term: 'stress-rate-limit', type: 'vocabulary' };
    if (scenario === 19) return { term: 'stress-invalid-json', type: 'vocabulary' };
    if (scenario === 16) return { term: 'stress-fallback', type: 'vocabulary' };
    if (index % 3 === 0) return { term: 'Can I get a receipt, please?', type: 'survival_phrase' };
    if (index % 3 === 1) return { term: 'go on', type: 'phrasal_verb' };
    return { term: 'regular', type: 'vocabulary' };
  }
  if (route === 'analyze') {
    return { query: index % 2 ? 'regular' : 'running', candidates: ['run', 'regular'] };
  }
  return {
    front: 'I forgot my (carteira) again.',
    back: 'wallet /ˈwɑː.lət/\nI forgot my wallet again.',
    type: 'vocabulary'
  };
}

async function runRoute(route, cookie) {
  const path = `/api/openrouter/${route === 'study-sheet' ? 'study-sheet' : route === 'review-card' ? 'review-card' : 'analyze'}`;
  const results = [];
  let next = 0;
  const startedAt = performance.now();

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= totalPerEndpoint) return;
      const body = requestFor(route, index);
      const requestStarted = performance.now();
      try {
        const response = await fetchWithTimeout(new URL(path, baseUrl), {
          method: 'POST',
          headers: requestHeaders(index),
          body: JSON.stringify(body)
        });
        let payload = null;
        try { payload = await response.json(); } catch {}
        results.push({ status: response.status, durationMs: performance.now() - requestStarted, payload });
      } catch (error) {
        results.push({ status: 0, durationMs: performance.now() - requestStarted, error: String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const durations = results.map(result => result.durationMs).sort((a, b) => a - b);
  const percentile = value => Math.round(durations[Math.min(durations.length - 1, Math.floor(durations.length * value))]);
  const statusCounts = Object.fromEntries([...new Set(results.map(result => result.status))].map(status => [status, results.filter(result => result.status === status).length]));
  const unexpected = results.filter(result => result.status === 0 || result.status >= 500 && ![502, 503, 504].includes(result.status));

  console.log(JSON.stringify({
    route,
    requests: results.length,
    concurrency,
    durationMs: Math.round(performance.now() - startedAt),
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    statusCounts,
    unexpected: unexpected.length
  }));

  if (results.length !== totalPerEndpoint || unexpected.length > 0) {
    throw new Error(`Stress test falhou em ${route}.`);
  }
}

async function runDeduplicationCheck() {
  const body = { term: 'stress-dedup', type: 'vocabulary' };
  let beforeProviderCalls = 0;
  if (mockUrl) {
    const statsResponse = await fetchWithTimeout(new URL('/stats', mockUrl));
    const stats = await statsResponse.json();
    beforeProviderCalls = stats.scenarios?.['stress-dedup'] || 0;
  }
  const responses = await Promise.all(Array.from({ length: 10 }, (_, index) => fetchWithTimeout(new URL('/api/openrouter/study-sheet', baseUrl), {
    method: 'POST',
    headers: {
      ...requestHeaders(index),
      'X-Forwarded-For': `203.0.113.${index + 1}`
    },
    body: JSON.stringify(body)
  })));

  const statuses = responses.map(response => response.status);
  if (statuses.some(status => status !== 200)) {
    throw new Error(`Deduplicação falhou: status inesperado ${statuses.join(', ')}.`);
  }

  if (mockUrl) {
    const statsResponse = await fetchWithTimeout(new URL('/stats', mockUrl));
    const stats = await statsResponse.json();
    const providerCalls = (stats.scenarios?.['stress-dedup'] || 0) - beforeProviderCalls;
    if (providerCalls !== 1) {
      throw new Error(`Deduplicação falhou: o mock recebeu ${providerCalls} gerações novas para a mesma ficha.`);
    }
    console.log(JSON.stringify({ deduplication: 'ok', duplicateRequests: statuses.length, providerCalls }));
  } else {
    console.log(JSON.stringify({ deduplication: 'ok', duplicateRequests: statuses.length }));
  }
}

async function runConcurrencyCheck() {
  const responses = await Promise.all(Array.from({ length: 3 }, (_, index) => fetchWithTimeout(new URL('/api/openrouter/study-sheet', baseUrl), {
    method: 'POST',
    headers: {
      ...requestHeaders(index),
      'X-Forwarded-For': '203.0.114.200'
    },
    body: JSON.stringify({ term: 'stress-concurrency', type: 'vocabulary' })
  })));
  const payloads = await Promise.all(responses.map(async response => {
    try { return await response.json(); } catch { return null; }
  }));
  const concurrencyLimited = payloads.some(payload => payload?.error?.code === 'CONCURRENCY_LIMITED');
  if (!concurrencyLimited) throw new Error(`Limite de concorrência não foi observado: ${responses.map(response => response.status).join(', ')}.`);
  console.log(JSON.stringify({ concurrencyLimit: 'ok', statuses: responses.map(response => response.status) }));
}

async function runRateLimitCheck() {
  const statuses = [];
  for (let index = 0; index < 31; index += 1) {
    const response = await fetchWithTimeout(new URL('/api/openrouter/analyze', baseUrl), {
      method: 'POST',
      headers: {
        ...requestHeaders(index),
        'X-Forwarded-For': '192.0.2.250'
      },
      body: JSON.stringify({ query: `rate-check-${index}`, candidates: [] })
    });
    statuses.push(response.status);
  }
  if (!statuses.includes(429)) throw new Error('Rate limit não bloqueou a sequência acima do limite.');
  console.log(JSON.stringify({ rateLimit: 'ok', statuses: Object.fromEntries([...new Set(statuses)].map(status => [status, statuses.filter(item => item === status).length])) }));
}

const cookie = await login();
for (const route of ['study-sheet', 'analyze', 'review-card']) {
  await runRoute(route, cookie);
}

await runDeduplicationCheck();
await runConcurrencyCheck();
await runRateLimitCheck();

console.log(`Stress test concluído: ${totalPerEndpoint} requisições por endpoint com concorrência ${concurrency}.`);
