import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Pre-curated instant offline entries matching user's canonical examples
const CURATED_SHEETS: Record<string, any> = {
  motivation: {
    term: 'motivation',
    ipa: '/ˌmoʊ.t̬əˈveɪ.ʃən/',
    grammatical_class: 'substantivo',
    translation: 'motivação',
    connotation_usage: 'motivation é normalmente incontável quando falamos de motivação em geral. Conotação: geralmente positiva ou neutra.',
    useful_structures: [],
    collocations: [
      { en: 'have motivation', pt: 'ter motivação' },
      { en: 'lose motivation', pt: 'perder a motivação' },
      { en: 'find motivation', pt: 'encontrar motivação' },
      { en: 'need motivation', pt: 'precisar de motivação' }
    ],
    examples: [
      { en: 'I need motivation to study.', pt: 'Eu preciso de motivação para estudar.' },
      { en: 'She has a lot of motivation.', pt: 'Ela tem muita motivação.' },
      { en: 'I sometimes lose motivation.', pt: 'Às vezes eu perco a motivação.' },
      { en: 'Music gives me motivation.', pt: 'Música me dá motivação.' },
      { en: 'Where do you find motivation?', pt: 'Onde você encontra motivação?' }
    ],
    related_words: ['motivate (motivar)', 'motivated (motivado)', 'motivating (motivador)'],
    tip_warning: '💡 Atenção: motivation é a motivação; motivated descreve a pessoa: I\'m motivated.'
  },
  complete: {
    term: 'complete',
    ipa: '/kəmˈpliːt/',
    grammatical_class: 'verbo ou adjetivo',
    translation: 'completar, concluir / completo',
    connotation_usage: 'Infinitivo: to complete /tə kəmˈpliːt/. É bastante usado quando você termina uma tarefa, formulário, curso ou processo.',
    useful_structures: ['Como verbo: to complete a task / form / course', 'Como adjetivo: The work is complete.'],
    collocations: [
      { en: 'complete a task', pt: 'concluir uma tarefa' },
      { en: 'complete a course', pt: 'concluir um curso' },
      { en: 'complete a form', pt: 'preencher/completar um formulário' },
      { en: 'complete the process', pt: 'concluir o processo' }
    ],
    examples: [
      { en: 'I need to complete this task.', pt: 'Preciso concluir esta tarefa.' },
      { en: 'Please complete this form.', pt: 'Por favor, preencha este formulário.' },
      { en: 'She completed the course.', pt: 'Ela concluiu o curso.' },
      { en: 'The work is complete.', pt: 'O trabalho está completo.' },
      { en: 'Is your homework complete?', pt: 'Sua lição de casa está completa?' }
    ],
    related_words: ['completion (conclusão)', 'completely (completamente)', 'incomplete (incompleto)'],
    tip_warning: '⚠️ Para conversas simples, muitas vezes finish é mais natural que complete: I finished my homework. — Terminei minha lição.'
  },
  income: {
    term: 'income',
    ipa: '/ˈɪn.kʌm/',
    grammatical_class: 'substantivo',
    translation: 'renda, rendimento',
    connotation_usage: 'Normalmente usamos income para o dinheiro que uma pessoa recebe do trabalho, de um negócio, de investimentos etc.',
    useful_structures: [],
    collocations: [
      { en: 'monthly income', pt: 'renda mensal' },
      { en: 'annual income', pt: 'renda anual' },
      { en: 'low income', pt: 'baixa renda' },
      { en: 'extra income', pt: 'renda extra' }
    ],
    examples: [
      { en: 'What is your monthly income?', pt: 'Qual é a sua renda mensal?' },
      { en: 'She needs extra income.', pt: 'Ela precisa de uma renda extra.' },
      { en: 'His income is low.', pt: 'A renda dele é baixa.' },
      { en: 'My income changed this year.', pt: 'Minha renda mudou este ano.' },
      { en: 'This is my main source of income.', pt: 'Esta é minha principal fonte de renda.' }
    ],
    related_words: ['earn (ganhar dinheiro)', 'earnings (ganhos)', 'salary (salário)', 'wage (salário/pagamento)'],
    tip_warning: '💡 Não confunda: income é mais amplo que salary. Seu salary pode ser uma fonte de income.'
  },
  feel: {
    term: 'feel',
    ipa: '/fiːl/',
    grammatical_class: 'verbo',
    translation: 'sentir, sentir-se',
    connotation_usage: 'Infinitivo: to feel /tə fiːl/ • Passado: felt /felt/. Verbo essencial para expressar estados emocionais e físicos.',
    useful_structures: [
      'feel + adjetivo: I feel tired. (Eu me sinto cansado.)',
      'feel like + substantivo: I feel like a child. (Eu me sinto como uma criança.)',
      'feel like + verbo em -ing: I feel like sleeping. (Estou com vontade de dormir.)'
    ],
    collocations: [
      { en: 'feel good', pt: 'sentir-se bem' },
      { en: 'feel bad', pt: 'sentir-se mal' },
      { en: 'feel tired', pt: 'sentir-se cansado' },
      { en: 'feel better', pt: 'sentir-se melhor' }
    ],
    examples: [
      { en: 'I feel tired today.', pt: 'Eu me sinto cansado hoje.' },
      { en: 'Do you feel better now?', pt: 'Você se sente melhor agora?' },
      { en: 'I feel happy here.', pt: 'Eu me sinto feliz aqui.' },
      { en: 'She felt bad yesterday.', pt: 'Ela se sentiu mal ontem.' },
      { en: 'I feel like watching a movie.', pt: 'Estou com vontade de assistir a um filme.' }
    ],
    related_words: ['feeling (sentimento/sensação)', 'felt (sentiu/senti)', 'feelings (sentimentos)'],
    tip_warning: '💡 Atenção: "feel like + verbo em -ing" expressa vontade imediata de fazer algo (ex: I feel like having a coffee).'
  },
  envelope: {
    term: 'envelope',
    ipa: '/ˈen.və.loʊp/',
    grammatical_class: 'substantivo',
    translation: 'envelope',
    connotation_usage: 'Plural: envelopes /ˈen.və.loʊps/. Substantivo contável comum.',
    useful_structures: [],
    collocations: [
      { en: 'open an envelope', pt: 'abrir um envelope' },
      { en: 'seal an envelope', pt: 'fechar/selar um envelope' },
      { en: 'an empty envelope', pt: 'um envelope vazio' },
      { en: 'put something in an envelope', pt: 'colocar algo em um envelope' }
    ],
    examples: [
      { en: 'Open the envelope.', pt: 'Abra o envelope.' },
      { en: 'The letter is in the envelope.', pt: 'A carta está no envelope.' },
      { en: 'I need an envelope.', pt: 'Eu preciso de um envelope.' },
      { en: 'She put the money in an envelope.', pt: 'Ela colocou o dinheiro em um envelope.' },
      { en: 'This envelope is empty.', pt: 'Este envelope está vazio.' }
    ],
    related_words: ['letter (carta)', 'mail (correspondência/correio)', 'stamp (selo)', 'package (pacote)'],
    tip_warning: '💡 Atenção à pronúncia: o "e" inicial soa como /ˈen.və.loʊp/ ou /ˈɑːn.və.loʊp/.'
  },
  'go on': {
    term: 'go on',
    ipa: '/ɡoʊ ɑːn/',
    grammatical_class: 'phrasal verb',
    translation: 'continuar; acontecer',
    connotation_usage: 'Infinitivo: to go on /tə ɡoʊ ɑːn/. Dois sentidos fundamentais: ① go on = continuar / ② go on = acontecer.',
    useful_structures: [
      '① go on = continuar: Please, go on. (Por favor, continue.)',
      '② go on = acontecer: What\'s going on? (O que está acontecendo?)'
    ],
    collocations: [
      { en: 'go on talking', pt: 'continuar falando' },
      { en: 'go on working', pt: 'continuar trabalhando' },
      { en: 'what\'s going on?', pt: 'o que está acontecendo?' },
      { en: 'go on with something', pt: 'continuar algo' }
    ],
    examples: [
      { en: 'Please, go on.', pt: 'Por favor, continue.' },
      { en: 'He went on talking.', pt: 'Ele continuou falando.' },
      { en: 'What\'s going on here?', pt: 'O que está acontecendo aqui?' },
      { en: 'We can\'t go on like this.', pt: 'Não podemos continuar assim.' },
      { en: 'Go on with your work.', pt: 'Continue seu trabalho.' }
    ],
    related_words: ['continue (continuar)', 'happen (acontecer)', 'keep going (continuar em frente)'],
    tip_warning: '💡 Como go on possui muitos significados, associe principalmente go on → continuar e What\'s going on? → O que está acontecendo?'
  },
  'pick up': {
    term: 'pick up',
    ipa: '/pɪk ʌp/',
    grammatical_class: 'phrasal verb',
    translation: 'pegar; buscar alguém; atender o telefone',
    connotation_usage: 'Infinitivo: to pick up /tə pɪk ʌp/. Três sentidos essenciais: ① pegar algo / ② buscar alguém / ③ atender o telefone.',
    useful_structures: [
      '① pegar algo: Pick up your phone. (Pegue seu celular.)',
      '② buscar alguém: I\'ll pick you up at 8. (Vou buscar você às 8.)',
      '③ atender o telefone: Pick up the phone! (Atenda o telefone!)'
    ],
    collocations: [
      { en: 'pick up the phone', pt: 'atender/pegar o telefone' },
      { en: 'pick up a package', pt: 'buscar/pegar um pacote' },
      { en: 'pick someone up', pt: 'buscar alguém' },
      { en: 'pick something up', pt: 'pegar algo' }
    ],
    examples: [
      { en: 'Pick up your bag.', pt: 'Pegue sua bolsa/mochila.' },
      { en: 'I\'ll pick you up at the airport.', pt: 'Vou buscar você no aeroporto.' },
      { en: 'Can you pick me up at 6?', pt: 'Você pode me buscar às 6?' },
      { en: 'Please pick up the phone.', pt: 'Por favor, atenda o telefone.' },
      { en: 'I need to pick up my package.', pt: 'Preciso buscar meu pacote.' }
    ],
    related_words: ['pick (escolher/pegar)', 'pickup (retirada/coleta)', 'drop off (deixar alguém/algo)'],
    tip_warning: '💡 pick up × take: pick up significa "buscar/pegar" (I\'ll pick you up = vou buscar você), enquanto take significa "levar" (I\'ll take you to the airport = vou levar você ao aeroporto).'
  }
};

export async function POST(req: NextRequest) {
  try {
    const { term, type = 'vocabulary', meaningPt = '', apiKey: userApiKey } = await req.json();

    if (!term) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const cleanTerm = term.trim().toLowerCase();

    // Check curated database first
    if (CURATED_SHEETS[cleanTerm]) {
      return NextResponse.json({
        ...CURATED_SHEETS[cleanTerm],
        isCurated: true
      });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // Fallback generator if no API key is provided
      return NextResponse.json({
        term,
        ipa: `/${cleanTerm}/`,
        grammatical_class: type === 'phrasal_verb' ? 'phrasal verb' : (type === 'survival_phrase' ? 'frase' : 'substantivo/verbo'),
        translation: meaningPt || cleanTerm,
        connotation_usage: `Uso no nível A2 para o termo "${term}".`,
        useful_structures: [],
        collocations: [
          { en: `use ${term}`, pt: `usar ${meaningPt || term}` },
          { en: `need ${term}`, pt: `precisar de ${meaningPt || term}` },
          { en: `find ${term}`, pt: `encontrar ${meaningPt || term}` },
          { en: `have ${term}`, pt: `ter ${meaningPt || term}` }
        ],
        examples: [
          { en: `I need ${term} today.`, pt: `Eu preciso de ${meaningPt || term} hoje.` },
          { en: `Can you show me the ${term}?`, pt: `Você pode me mostrar o(a) ${meaningPt || term}?` },
          { en: `Where is the ${term}?`, pt: `Onde está o(a) ${meaningPt || term}?` },
          { en: `I have a ${term} here.`, pt: `Eu tenho um(a) ${meaningPt || term} aqui.` },
          { en: `This is my favorite ${term}.`, pt: `Este é meu(minha) ${meaningPt || term} favorito(a).` }
        ],
        related_words: [meaningPt || term],
        tip_warning: `💡 Dica: Pratique a pronúncia e o contexto de "${term}" em frases simples do cotidiano.`,
        isCurated: false
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
            ipa: { type: SchemaType.STRING, description: 'Transcrição fonética IPA padrão (ex: /ˌmoʊ.t̬əˈveɪ.ʃən/)' },
            grammatical_class: { type: SchemaType.STRING, description: 'Classe gramatical em português (ex: substantivo, verbo, adjetivo, phrasal verb)' },
            translation: { type: SchemaType.STRING, description: 'Tradução principal clara e direta em português' },
            connotation_usage: { type: SchemaType.STRING, description: 'Explicação de uso importante, contabilidade, conotação e particularidades' },
            useful_structures: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Estruturas gramaticais ou sentidos principais numerados com exemplos curtos (se aplicável)'
            },
            collocations: {
              type: SchemaType.ARRAY,
              description: 'Exatamente 4 colocações ou chunks comuns com tradução',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  en: { type: SchemaType.STRING, description: 'Colocação em inglês (ex: have motivation)' },
                  pt: { type: SchemaType.STRING, description: 'Tradução da colocação (ex: ter motivação)' }
                },
                required: ['en', 'pt']
              }
            },
            examples: {
              type: SchemaType.ARRAY,
              description: 'Exatamente 5 frases reais, curtas (5-8 palavras) e naturais no nível A2 com tradução',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  en: { type: SchemaType.STRING, description: 'Frase curta em inglês (5-8 palavras)' },
                  pt: { type: SchemaType.STRING, description: 'Tradução natural em português brasileiro' }
                },
                required: ['en', 'pt']
              }
            },
            related_words: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Palavras da mesma família ou muito relacionadas com tradução (ex: ["motivate (motivar)", "motivated (motivado)"])'
            },
            tip_warning: {
              type: SchemaType.STRING,
              description: 'Dica de atenção, armadilha comum ou contraste importante iniciado por 💡 ou ⚠️'
            }
          },
          required: [
            'term',
            'ipa',
            'grammatical_class',
            'translation',
            'connotation_usage',
            'collocations',
            'examples',
            'related_words',
            'tip_warning'
          ]
        }
      }
    });

    const prompt = `Você é um linguista e professor de inglês de elite especializado em aquisição lexical de alta retenção no nível A2.

Gere uma FICHA DE ESTUDO LEXICAL COMPLETA para o termo: "${term}" (${type === 'phrasal_verb' ? 'Phrasal Verb' : type === 'survival_phrase' ? 'Frase de Sobrevivência' : 'Vocabulário'}).
Significado sugerido (se houver): "${meaningPt}".

SIGA RIGOROSAMENTE ESTA ESTRUTURA PEDAGÓGICA:
1. Pronúncia IPA padrão e classe gramatical precisa em português.
2. Tradução principal concisa e clara.
3. Uso importante: explique particularidades de uso (ex: se é incontável, preposições obrigatórias, formas infinitivo/passado, conotação positiva/negativa).
4. Estruturas úteis: se houver diferentes sentidos (ex: ① go on = continuar / ② go on = acontecer) ou padrões (feel + adj, feel like + noun).
5. Exatamente 4 Colocações comuns (chunks naturais com tradução).
6. Exatamente 5 Exemplos reais: frases curtas (5 a 8 palavras), naturais do cotidiano no nível A2 com tradução precisa.
7. Palavras relacionadas (família de palavras com tradução entre parênteses).
8. Dica de atenção (💡 Atenção / ⚠️ Não confunda): diferencie de palavras parecidas, mostre armadilhas de tradução literal ou uso correto.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return NextResponse.json({
      ...parsed,
      isCurated: false
    });
  } catch (error: any) {
    console.error('Error generating study sheet with Gemini:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate study sheet'
    }, { status: 500 });
  }
}
