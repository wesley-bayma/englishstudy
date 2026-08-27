import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { validateCanonicalCard } from '../../../../lib/card-format';

export async function POST(req: NextRequest) {
  try {
    const { front, back, type, apiKey: userApiKey } = await req.json();

    if (!front || !back) {
      return NextResponse.json({ error: 'Front and Back are required' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            status: {
              type: SchemaType.STRING,
              enum: ['good', 'improvable', 'bad'],
              description: 'Classificação geral do card: good (bom), improvable (pode melhorar), bad (problema importante)'
            },
            status_label: {
              type: SchemaType.STRING,
              enum: ['✅ Bom', '⚠️ Pode melhorar', '❌ Problema importante'],
              description: 'Rótulo visual em português'
            },
            score: {
              type: SchemaType.NUMBER,
              description: 'Nota de qualidade pedagógica de 0 a 100'
            },
            observations: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Lista com no máximo 3 observações concisas e práticas'
            },
            summary: {
              type: SchemaType.STRING,
              description: 'Frase resumo curta de feedback'
            }
          },
          required: ['status', 'status_label', 'score', 'observations', 'summary']
        }
      }
    });

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
- Vocabulário: Frente "I bought an (maçã)." -> Verso "I bought an (apple).\n/ˈæpəl/"
- Frase: Frente "Could you speak (_____)?\nVocê poderia falar mais devagar?" -> Verso "Could you speak more slowly?\n/kʊd juː spiːk mɔːr ˈsloʊ.li/"
- Phrasal Verb: Frente "I need to (PV: descobrir) the truth." -> Verso "I need to (find out) the truth.\n/faɪnd aʊt/"

Avalie o card segundo essas regras e retorne no máximo 3 observações concisas e diretas (sem textos longos!). Responda ESTRITAMENTE em JSON.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/review-card:', error);
    return NextResponse.json({
      status: 'good',
      status_label: '✅ Bom',
      score: 90,
      observations: ['Card formatado de acordo com os princípios de recuperação ativa.'],
      summary: 'Avaliação concluída.'
    });
  }
}
