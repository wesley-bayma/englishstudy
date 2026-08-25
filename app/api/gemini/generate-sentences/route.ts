import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { term, type = 'vocabulary', meaningPt = '', apiKey: userApiKey } = await req.json();

    if (!term) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // Fallback offline examples if no API key configured
      return NextResponse.json({
        term,
        sentences: [
          {
            en: `I need to use the ${term} today.`,
            pt: `Eu preciso usar o(a) ${meaningPt || term} hoje.`,
            clue: `I need to use the (${meaningPt || term}) today.`
          },
          {
            en: `Can you show me the ${term}?`,
            pt: `Você pode me mostrar o(a) ${meaningPt || term}?`,
            clue: `Can you show me the (${meaningPt || term})?`
          },
          {
            en: `This is a very important ${term}.`,
            pt: `Este é um(a) ${meaningPt || term} muito importante.`,
            clue: `This is a very important (${meaningPt || term}).`
          },
          {
            en: `Where did you find this ${term}?`,
            pt: `Onde você encontrou este(a) ${meaningPt || term}?`,
            clue: `Where did you find this (${meaningPt || term})?`
          },
          {
            en: `I always remember to check the ${term}.`,
            pt: `Eu sempre lembro de checar o(a) ${meaningPt || term}.`,
            clue: `I always remember to check the (${meaningPt || term}).`
          }
        ],
        isOfflineFallback: true
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            term: { type: SchemaType.STRING },
            ipa: { type: SchemaType.STRING, description: 'Transcrição fonética IPA padrão do termo (ex: /ˈwɑː.lət/)' },
            sentences: {
              type: SchemaType.ARRAY,
              description: 'Exatamente 5 frases curtas no nível A2',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  en: {
                    type: SchemaType.STRING,
                    description: 'Frase curta em inglês de 5 a 8 palavras no nível A2 contendo o termo'
                  },
                  pt: {
                    type: SchemaType.STRING,
                    description: 'Tradução natural e direta da frase para o português brasileiro'
                  },
                  clue: {
                    type: SchemaType.STRING,
                    description: 'A frase em inglês com o termo substituído pela sua dica em português entre parênteses para o card do Anki (ex: "I forgot my (carteira) again.")'
                  }
                },
                required: ['en', 'pt', 'clue']
              }
            }
          },
          required: ['term', 'sentences']
        }
      }
    });

    const prompt = `Você é um especialista em aquisição de segunda língua (nível A2) e criação de flashcards de alta eficiência para o Anki.

Gere exatamente 5 frases de exemplo curtas, reais e cotidianas para o termo: "${term}" (${type === 'phrasal_verb' ? 'Phrasal Verb' : type === 'survival_phrase' ? 'Frase de Sobrevivência' : 'Palavra de Vocabulário'}).
Significado sugerido em português (se houver): "${meaningPt}".

CRITÉRIOS OBRIGATÓRIOS PARA CADA UMA DAS 5 FRASES:
1. Tamanho curto: entre 5 e 8 palavras. Frases longas sobrecarregam a memória de trabalho no Anki.
2. Nível A2 / cotidiano: use vocabulário simples ao redor da palavra-alvo para dar contexto imediato.
3. Variedade contextual: cada uma das 5 frases deve mostrar um uso ou situação prática diferente (ex: trabalho, casa, restaurante, viagem, conversa casual).
4. Campo "clue": coloque a dica em português entre parênteses no lugar da palavra-alvo (ex: se o termo for "wallet", a frase "I forgot my wallet again" vira "I forgot my (carteira) again."). Se for phrasal verb, coloque "(PV: significado)".`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return NextResponse.json({
      ...parsed,
      isOfflineFallback: false
    });
  } catch (error: any) {
    console.error('Error generating sentences with Gemini:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate sentences',
      sentences: []
    }, { status: 500 });
  }
}
