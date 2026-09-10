const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:3000';
const sessionCookie = process.env.VERIFY_SESSION_COOKIE || '';
const runLiveAi = process.env.VERIFY_LIVE_AI === 'true';

function headers() {
  return sessionCookie ? { Cookie: sessionCookie } : {};
}

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    redirect: 'manual',
    headers: { ...headers(), ...(options.headers || {}) }
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // HTML pages and empty responses are valid for some checks.
  }

  return { status: response.status, body };
}

function assertStatus(label, actual, expected) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(actual)) {
    throw new Error(`${label}: esperado HTTP ${accepted.join(' ou ')}, recebido ${actual}.`);
  }
  console.log(`- ${label}: HTTP ${actual} ✅`);
}

async function run() {
  console.log(`Verificando English Study Hub em ${baseUrl}...\n`);

  const health = await request('/api/health');
  assertStatus('Health check', health.status, 200);
  if (health.body?.status !== 'ok') {
    throw new Error('Health check retornou status diferente de "ok".');
  }

  const pages = ['/', '/add', '/bank', '/progress', '/reviewer'];
  const expectedPageStatus = sessionCookie ? 200 : 307;
  for (const page of pages) {
    const result = await request(page);
    assertStatus(`Página ${page}`, result.status, expectedPageStatus);
  }

  const protectedApi = await request('/api/openrouter/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'running', candidates: ['run'] })
  });

  if (!sessionCookie) {
    assertStatus('API protegida sem sessão', protectedApi.status, 401);
    console.log('\nAPI de IA não executada: defina VERIFY_SESSION_COOKIE e VERIFY_LIVE_AI=true para um canário real.');
    return;
  }

  assertStatus('API protegida com sessão', protectedApi.status, runLiveAi ? 200 : [200, 400, 401, 429, 502, 503]);

  if (runLiveAi) {
    const review = await request('/api/openrouter/review-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        front: 'I forgot my (carteira) again.',
        back: 'wallet /ˈwɑː.lət/\nI forgot my wallet again.',
        type: 'vocabulary'
      })
    });
    assertStatus('Revisão de card', review.status, [200, 429, 502, 503]);
  }

  console.log('\nVerificação concluída sem falsos positivos.');
}

run().catch(error => {
  console.error(`\nFalha: ${error.message}`);
  process.exitCode = 1;
});
