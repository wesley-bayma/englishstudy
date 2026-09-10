const model = process.env.OPENROUTER_FALLBACK_MODEL || 'z-ai/glm-5.3-flash';
const endpoint = `https://openrouter.ai/api/v1/model/${model}`;

const response = await fetch(endpoint, {
  headers: { 'User-Agent': 'EnglishStudyHub-provider-check' }
});

let payload;
try {
  payload = await response.json();
} catch {
  console.error(`OpenRouter retornou HTTP ${response.status} sem JSON válido.`);
  process.exit(1);
}

if (!response.ok || !payload?.data) {
  console.error(`Modelo OpenRouter indisponível: ${model} (HTTP ${response.status}).`);
  process.exit(1);
}

const supported = new Set(payload.data.supported_parameters || []);
const required = ['response_format', 'structured_outputs'];
const missing = required.filter(parameter => !supported.has(parameter));

if (missing.length > 0) {
  console.error(`Modelo ${model} não suporta: ${missing.join(', ')}.`);
  process.exit(1);
}

console.log(`Modelo OpenRouter válido: ${payload.data.id}`);
console.log(`Structured outputs: ${required.every(parameter => supported.has(parameter)) ? 'OK' : 'FALHOU'}`);
