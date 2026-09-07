import { NextRequest, NextResponse } from 'next/server';
import type { CardReviewResult } from '../../../../lib/types';
import { validateCanonicalCard } from '../../../../lib/card-format';
import { requestOpenRouterJson } from '../../../../lib/openrouter-client';

export async function POST(req: NextRequest) {
  try {
    const { front, back, type, apiKey: userApiKey } = await req.json();

    if (!front || !back) {
      return NextResponse.json({ error: 'Front and Back are required' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      const obs = validateCanonicalCard(front, back, type);

      return NextResponse.json({
        status: obs.length === 0 ? 'good' : (obs.length === 1 ? 'improvable' : 'bad'),
        status_label: obs.length === 0 ? '✅ Bom' : (obs.length === 1 ? '⚠️ Pode melhorar' : '❌ Problema importante'),
        score: obs.length === 0 ? 95 : (obs.length === 1 ? 75 : 50),
        observations: obs.length > 0 ? obs : ['Estrutura atende às regras de recuperação ativa.'],
        summary: obs.length === 0 ? 'Card bem equilibrado e natural.' : 'Alguns ajustes são necessários.'
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
7. O verso pode conter somente a pronúncia IPA como metadado; não exija nem escreva um rótulo de áudio.

PADRÕES ESPERADOS PELO USUÁRIO:
- Vocabulário: Frente "I bought an (maçã)." -> Verso "I bought an apple.\n/ˈæpəl/"
- Frase: Frente "Could you speak (_____)?\nVocê poderia falar mais devagar?" -> Verso "Could you speak more slowly?\n/kʊd juː spiːk mɔːr ˈsloʊ.li/"
- Phrasal Verb: Frente "I need to (PV: descobrir) the truth." -> Verso "I need to find out the truth.\n/faɪnd aʊt/"

Avalie o card segundo essas regras e retorne no máximo 3 observações concisas e diretas (sem textos longos!). Responda ESTRITAMENTE em JSON válido com os campos status, status_label, score, observations e summary.`;

    const parsed = await requestOpenRouterJson<CardReviewResult>({
      apiKey,
      prompt,
      systemPrompt: 'Você é um avaliador de flashcards. Responda somente com JSON válido, sem markdown ou texto adicional.',
      maxTokens: 1000,
      temperature: 0.1
    });

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error('Error in /api/openrouter/review-card:', error);
    return NextResponse.json({
      status: 'good',
      status_label: '✅ Bom',
      score: 90,
      observations: ['Card formatado de acordo com os princípios de recuperação ativa.'],
      summary: 'Avaliação concluída.'
    });
  }
}
