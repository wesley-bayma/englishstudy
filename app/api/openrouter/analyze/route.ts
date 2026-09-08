import { NextRequest, NextResponse } from 'next/server';
import type { AIAnalysisResult } from '../../../../lib/types';
import { requestOpenRouterJson } from '../../../../lib/openrouter-client';

export async function POST(req: NextRequest) {
  try {
    const { query, candidates = [], context = '', apiKey: userApiKey } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY || userApiKey;

    if (!apiKey) {
      return NextResponse.json({
        classification: query.split(' ').length > 3 ? 'survival_phrase' : (query.includes(' ') ? 'phrasal_verb' : 'vocabulary'),
        base_form: query.trim().toLowerCase(),
        has_possible_match: false,
        matched_existing_content: null,
        similarity_type: 'none',
        confidence: 0.8,
        meaning_pt: '',
        explanation: 'Configure sua chave de API OpenRouter em Progresso > Configurações para análise avançada de IA.',
        suggested_example: context || ''
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

    const parsed = await requestOpenRouterJson<AIAnalysisResult>({
      apiKey,
      prompt,
      systemPrompt: 'Você é um assistente linguístico. Responda somente com JSON válido, sem markdown ou texto adicional.',
      maxTokens: 1200,
      temperature: 0.1
    });

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error('Error in /api/openrouter/analyze:', error);
    return NextResponse.json(
      {
        classification: 'vocabulary',
        base_form: '',
        has_possible_match: false,
        matched_existing_content: null,
        similarity_type: 'none',
        confidence: 0,
        meaning_pt: '',
        explanation: 'Erro ao processar com OpenRouter. O app continuará normalmente.',
        suggested_example: ''
      },
      { status: 200 }
    );
  }
}
