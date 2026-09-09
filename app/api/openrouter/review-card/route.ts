import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_GEMINI_MODEL, GeminiResponseMeta, requestAiJson } from '../../../../lib/gemini-client';
import { CARD_REVIEW_JSON_SCHEMA } from '../../../../lib/ai-schemas';
import { parseCardReview } from '../../../../lib/ai-validation';
import { ApiServiceError, apiErrorResponse, createRequestId, getApiErrorInfo, logAiRequest, logApiFailure } from '../../../../lib/api-errors';
import { assertAllowedFields, getClientAddress, optionalContentType, parseJsonBody, requiredString } from '../../../../lib/api-validation';
import { checkRateLimit, tryAcquireConcurrency } from '../../../../lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = '/api/openrouter/review-card';
  let releaseConcurrency: (() => void) | null = null;
  let responseMeta: GeminiResponseMeta | undefined;
  let responseLogged = false;
  let attemptedAi = false;

  try {
    const body = await parseJsonBody(req, 16_384);
    assertAllowedFields(body, ['front', 'back', 'type']);
    const front = requiredString(body, 'front', { max: 2000 });
    const back = requiredString(body, 'back', { max: 2000 });
    const type = optionalContentType(body, 'type');
    const clientKey = `${route}:${getClientAddress(req)}`;
    const rateLimit = checkRateLimit(clientKey, 30, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Muitas revisões em pouco tempo. Tente novamente mais tarde.', requestId } }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds), 'Cache-Control': 'no-store' }
      });
    }
    releaseConcurrency = tryAcquireConcurrency(clientKey, 2);
    if (!releaseConcurrency) {
      return NextResponse.json({ error: { code: 'CONCURRENCY_LIMITED', message: 'Já existe uma revisão em andamento. Aguarde alguns segundos.', requestId } }, {
        status: 429,
        headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' }
      });
    }

    const prompt = `Você é um avaliador especializado em flashcards do Anki para estudo de inglês, nível A2/B1.
Avalie o card que o usuário criou manualmente:

TIPO: ${type || 'não especificado'}

FRENTE DO CARD:
"""
${front}
"""

VERSO DO CARD:
"""
${back}
"""

REGRAS CANÔNICAS DE AVALIAÇÃO:
1. Um único alvo por card (não testar 2 palavras ao mesmo tempo).
2. Contexto curto (idealmente de 5 a 7 palavras na frase).
3. A dica em português não deve entregar a resposta de bandeja nem ser ambígua.
4. Frase natural e realista em inglês.
5. Evitar palavras excessivamente difíceis no contexto da frase.
6. Recuperação ativa garantida (a frente força a mente a buscar a palavra/chunk em inglês).
7. A regra de áudio é externa à aplicação: o usuário adicionará o áudio manualmente no campo Verso do Anki. Não exija markup de áudio no texto recebido.
8. O modelo do Anki é sempre Basic, com uma frente e um verso; não recomende Basic (and reversed card) para esta rotina.

PADRÕES ESPERADOS PELO USUÁRIO:
- Vocabulário: Frente "I forgot my (carteira) again." -> Verso "wallet /ˈwɑː.lət/\nI forgot my wallet again."
- Frase: Frente "Could you speak (..?)?\nVocê poderia falar mais devagar?" -> Verso "Could you speak more slowly?"
- Phrasal Verb: Frente "I need to (PV: descobrir) the truth." -> Verso "find out — finding out — found out\nI need to find out the truth."

Avalie o card segundo essas regras e retorne no máximo 3 observações concisas e diretas (sem textos longos!). Responda ESTRITAMENTE em JSON válido com os campos status, status_label, score, observations e summary.`;

    attemptedAi = true;
    const parsed = await requestAiJson<unknown>({
      prompt,
      systemPrompt: 'Você é um avaliador de flashcards. Responda somente com JSON válido, sem markdown ou texto adicional.',
      maxTokens: 1000,
      temperature: 0.1,
      jsonSchema: CARD_REVIEW_JSON_SCHEMA,
      onResponse: meta => { responseMeta = meta; }
    });
    const result = parseCardReview(parsed);
    if (!result.ok) throw new ApiServiceError('INVALID_AI_RESPONSE', 502, 'A IA retornou uma avaliação inválida.');
    logAiRequest({ requestId, route, model: responseMeta?.model || DEFAULT_GEMINI_MODEL, durationMs: Date.now() - startedAt, status: responseMeta?.status || 200, finishReason: responseMeta?.finishReason });
    responseLogged = true;
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    if (attemptedAi && !responseLogged) {
      const info = getApiErrorInfo(error);
      logAiRequest({ requestId, route, model: responseMeta?.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, durationMs: Date.now() - startedAt, status: responseMeta?.status || info.status, finishReason: responseMeta?.finishReason });
    }
    logApiFailure(requestId, route, error);
    return apiErrorResponse(requestId, error);
  } finally {
    releaseConcurrency?.();
  }
}
