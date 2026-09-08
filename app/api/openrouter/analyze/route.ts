import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_OPENROUTER_MODEL, getOpenRouterApiKey, requestOpenRouterJson, OpenRouterResponseMeta } from '../../../../lib/openrouter-client';
import { AI_ANALYSIS_JSON_SCHEMA } from '../../../../lib/ai-schemas';
import { parseAIAnalysis } from '../../../../lib/ai-validation';
import { ApiServiceError, apiErrorResponse, createRequestId, getApiErrorInfo, logAiRequest, logApiFailure } from '../../../../lib/api-errors';
import { assertAllowedFields, getClientAddress, optionalString, optionalStringArray, parseJsonBody, requiredString } from '../../../../lib/api-validation';
import { checkRateLimit, tryAcquireConcurrency } from '../../../../lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = '/api/openrouter/analyze';
  let releaseConcurrency: (() => void) | null = null;
  let responseMeta: OpenRouterResponseMeta | undefined;
  let responseLogged = false;
  let attemptedAi = false;

  try {
    const body = await parseJsonBody(req, 16_384);
    assertAllowedFields(body, ['query', 'candidates', 'context']);
    const query = requiredString(body, 'query', { max: 200 });
    const candidates = optionalStringArray(body, 'candidates', { maxItems: 50, maxItemLength: 200 });
    const context = optionalString(body, 'context', 800);
    const apiKey = getOpenRouterApiKey();

    const clientKey = `${route}:${getClientAddress(req)}`;
    const rateLimit = checkRateLimit(clientKey, 30, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Muitas análises em pouco tempo. Tente novamente mais tarde.', requestId } }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds), 'Cache-Control': 'no-store' }
      });
    }
    releaseConcurrency = tryAcquireConcurrency(clientKey, 2);
    if (!releaseConcurrency) {
      return NextResponse.json({ error: { code: 'CONCURRENCY_LIMITED', message: 'Já existe uma análise em andamento. Aguarde alguns segundos.', requestId } }, {
        status: 429,
        headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' }
      });
    }

    const prompt = `Você é um assistente linguístico especializado para um app de estudo de inglês pessoal.
Analise o termo que o usuário digitou: "${query}".
Contexto adicional onde encontrou (se houver): "${context}".

Candidatos existentes próximos no banco de dados do usuário:
${candidates.length > 0 ? candidates.map((c: string) => `- ${c}`).join('\n') : '(Nenhum candidato direto)'}

Instruções fundamentais:
1. Se "${query}" for uma forma flexionada (ex: gerúndio, passado, plural, particípio) de uma palavra base existente nos candidatos (ex: "running" -> "run", "finding out" -> "find out"), identifique como "inflection", aponte a base_form correspondente, marque has_possible_match = true e matched_existing_content com o item do banco. Explique de forma amigável em português.
2. Se "${query}" for uma frase com a mesma função comunicativa/sentido de uma frase existente, identifique como "semantic_similarity", marque has_possible_match = true e matched_existing_content = a frase do banco. Explique a sutil diferença ou equivalência comunicativa.
3. Se for uma palavra nova ou frase sem relação com os candidatos, forneça a classificação correta, forma base e tradução concisa em português.
4. Só forneça suggested_example quando houver um contexto fornecido pelo usuário ou quando a frase for realmente natural e semanticamente validada. Nunca use o termo isolado como exemplo e nunca invente uma frase genérica para preencher o campo.
5. Uma frase completa deve ser classificada como survival_phrase e preservada como unidade comunicativa; não a transforme em colocação.
6. Responda ESTRITAMENTE em JSON válido com estes campos: classification, base_form, has_possible_match, matched_existing_content, similarity_type, confidence, meaning_pt, explanation e suggested_example.`;

    attemptedAi = true;
    const parsed = await requestOpenRouterJson<unknown>({
      apiKey,
      prompt,
      systemPrompt: 'Você é um assistente linguístico. Responda somente com JSON válido, sem markdown ou texto adicional.',
      maxTokens: 1200,
      temperature: 0.1,
      jsonSchema: AI_ANALYSIS_JSON_SCHEMA,
      onResponse: meta => { responseMeta = meta; }
    });
    const result = parseAIAnalysis(parsed);
    if (!result.ok) throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'A IA retornou uma análise inválida.');
    logAiRequest({ requestId, route, model: responseMeta?.model || DEFAULT_OPENROUTER_MODEL, durationMs: Date.now() - startedAt, status: responseMeta?.status || 200, finishReason: responseMeta?.finishReason });
    responseLogged = true;
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    if (attemptedAi && !responseLogged) {
      const info = getApiErrorInfo(error);
      logAiRequest({ requestId, route, model: responseMeta?.model || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL, durationMs: Date.now() - startedAt, status: responseMeta?.status || info.status, finishReason: responseMeta?.finishReason });
    }
    logApiFailure(requestId, route, error);
    return apiErrorResponse(requestId, error);
  } finally {
    releaseConcurrency?.();
  }
}
