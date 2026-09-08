const baseUrl = process.env.SMOKE_TEST_URL;

if (!baseUrl) {
  console.error('Defina SMOKE_TEST_URL com a URL do deployment.');
  process.exit(1);
}

const healthUrl = new URL('/api/health', baseUrl);
const response = await fetch(healthUrl);
let payload;

try {
  payload = await response.json();
} catch {
  console.error(`Health check retornou HTTP ${response.status} sem JSON válido.`);
  process.exit(1);
}

if (response.status !== 200 || payload.status !== 'ok') {
  console.error('Health check falhou:', { status: response.status, payload });
  process.exit(1);
}

console.log(`Health OK — release ${payload.release ?? 'desconhecido'}`);
console.log('Canário sem custo concluído; chamadas de IA devem ser feitas manualmente uma por vez.');
