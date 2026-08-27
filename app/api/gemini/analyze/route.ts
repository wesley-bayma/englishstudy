import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { query, candidates = [], context = '', apiKey: userApiKey } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // Return offline fallback if no API key is available
      return NextResponse.json({
        classification: query.split(' ').length > 3 ? 'survival_phrase' : (query.includes(' ') ? 'phrasal_verb' : 'vocabulary'),
        base_form: query.trim().toLowerCase(),
        has_possible_match: false,
        matched_existing_content: null,
        similarity_type: 'none',
        confidence: 0.8,
        meaning_pt: '',
        explanation: 'Configure sua chave de API Gemini em Progresso > Configurações para análise avançada de IA.',
        suggested_example: context || ''
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
            classification: {
              type: SchemaType.STRING,
              enum: ['vocabulary', 'survival_phrase', 'phrasal_verb', 'personal_phrase', 'personal_vocabulary'],
              description: 'Classificação do tipo de conteúdo em inglês'
            },
            base_form: {
              type: SchemaType.STRING,
              description: 'Forma lematizada ou base em inglês (ex: run para running, find out para finding out)'
            },
            has_possible_match: {
              type: SchemaType.BOOLEAN,
              description: 'True se houver uma correspondência ou variante morfológica ou frase semanticamente similar na lista de candidatos ou banco'
            },
            matched_existing_content: {
              type: SchemaType.STRING,
              nullable: true,
              description: 'O texto exato do item existente com o qual se relaciona (ex: "run" ou "Where is the restroom?")'
            },
            similarity_type: {
              type: SchemaType.STRING,
              enum: ['exact', 'inflection', 'semantic_similarity', 'synonym', 'none'],
              description: 'Tipo de relação: inflection (flexão verbal/plural), semantic_similarity (mesma função comunicativa como Where is the restroom vs Where is the bathroom), synonym ou none'
            },
            confidence: {
              type: SchemaType.NUMBER,
              description: 'Grau de confiança de 0.0 a 1.0'
            },
            meaning_pt: {
              type: SchemaType.STRING,
              description: 'Significado principal conciso em português'
            },
            explanation: {
              type: SchemaType.STRING,
              description: 'Explicação curta em português (1-2 frases) sobre a palavra/frase ou relação com o termo existente'
            },
            suggested_example: {
              type: SchemaType.STRING,
              description: 'Frase de exemplo curta e natural em inglês (5-7 palavras)'
            }
          },
          required: [
            'classification',
            'base_form',
            'has_possible_match',
            'similarity_type',
            'confidence',
            'meaning_pt',
            'explanation',
            'suggested_example'
          ]
        }
      }
    });

    const prompt = `Você é um assistente linguístico especializado para um app de estudo de inglês pessoal.
Analise o termo que o usuário digitou: "${query}".
Contexto adicional onde encontrou (se houver): "${context}".

Candidatos existentes próximos no banco de dados do usuário:
${candidates.length > 0 ? candidates.map((c: string) => `- ${c}`).join('\n') : '(Nenhum candidato direto)'}

Instruções fundamentais:
1. Se "${query}" for uma forma flexionada (ex: gerúndio, passado, plural, particípio) de uma palavra base existente nos candidatos (ex: "running" -> "run", "finding out" -> "find out"), identifique como "inflection", aponte a base_form correspondente, marque has_possible_match = true e matched_existing_content com o item do banco. Explique de forma amigável em português (ex: "'running' é uma forma flexionada do verbo 'run' que já existe na Base").
2. Se "${query}" for uma frase com a mesma função comunicativa/sentido de uma frase existente (ex: "Where's the bathroom?" vs "Where is the restroom?"), identifique como "semantic_similarity", marque has_possible_match = true e matched_existing_content = a frase do banco. Explique a sutil diferença ou equivalência comunicativa.
3. Se for uma palavra nova ou frase sem relação com os candidatos, forneça a classificação correta, forma base e tradução concisa em português.
4. Só forneça suggested_example quando houver um contexto fornecido pelo usuário ou quando a frase for realmente natural e semanticamente validada. Nunca use o termo isolado como exemplo e nunca invente uma frase genérica para preencher o campo.
5. Uma frase completa deve ser classificada como survival_phrase e preservada como unidade comunicativa; não a transforme em colocação.
6. Responda ESTRITAMENTE em formato JSON.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze:', error);
    return NextResponse.json(
      {
        classification: 'vocabulary',
        base_form: '',
        has_possible_match: false,
        matched_existing_content: null,
        similarity_type: 'none',
        confidence: 0,
        meaning_pt: '',
        explanation: 'Erro ao processar com Gemini. O app continuará normalmente.',
        suggested_example: ''
      },
      { status: 200 }
    );
  }
}
