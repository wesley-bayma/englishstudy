import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Pre-curated instant entries matching user's canonical examples
const CURATED_SHEETS: Record<string, any> = {
  motivation: {
    term: 'motivation',
    type: 'vocabulary',
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
    type: 'vocabulary',
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
    type: 'vocabulary',
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
    type: 'vocabulary',
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
    type: 'vocabulary',
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
    type: 'phrasal_verb',
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
    type: 'phrasal_verb',
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
  },

  // CURATED SURVIVAL PHRASES
  'where is the nearest subway station?': {
    term: 'Where is the nearest subway station?',
    type: 'survival_phrase',
    ipa: '/wɛər ɪz ðə ˈnɪr.ɪst ˈsʌb.weɪ ˈsteɪ.ʃən/',
    grammatical_class: 'frase de sobrevivência',
    translation: 'Onde fica a estação de metrô mais próxima?',
    connotation_usage: 'Frase essencial de locomoção e orientação urbana. Usada ao pedir direções na rua ou em cidades com transporte subterrâneo.',
    pattern: 'Where is the nearest + [LUGAR]?',
    variations: [
      { en: 'Where is the nearest bathroom?', pt: 'Onde fica o banheiro mais próximo?' },
      { en: 'Where is the nearest pharmacy?', pt: 'Onde fica a farmácia mais próxima?' },
      { en: 'Where is the nearest ATM?', pt: 'Onde fica o caixa eletrônico mais próximo?' },
      { en: 'Where is the nearest bus stop?', pt: 'Onde fica o ponto de ônibus mais próximo?' }
    ],
    strategic_gap: {
      gap_sentence: 'Where is the (_____)?',
      expected_chunk: 'nearest subway station',
      explanation: 'Esconde o chunk com maior valor comunicativo para recuperação ativa no Anki.'
    },
    tip_warning: '💡 Dica: "nearest" significa "mais próximo(a)" em distância física. Você pode trocar apenas o destino final.'
  },
  'could you speak more slowly?': {
    term: 'Could you speak more slowly?',
    type: 'survival_phrase',
    ipa: '/kʊd juː spiːk mɔːr ˈsloʊ.li/',
    grammatical_class: 'frase de sobrevivência',
    translation: 'Você poderia falar mais devagar?',
    connotation_usage: 'Frase de clarificação de altíssima utilidade para viagens e conversação quando o interlocutor fala rápido demais.',
    pattern: 'Could you speak + [MODO / ADVÉRBIO]?',
    variations: [
      { en: 'Could you speak a little louder?', pt: 'Você poderia falar um pouco mais alto?' },
      { en: 'Could you speak in English, please?', pt: 'Você poderia falar em inglês, por favor?' },
      { en: 'Could you repeat that more slowly?', pt: 'Você poderia repetir isso mais devagar?' },
      { en: 'Could you say that again, please?', pt: 'Você poderia dizer isso novamente, por favor?' }
    ],
    strategic_gap: {
      gap_sentence: 'Could you speak (_____)?',
      expected_chunk: 'more slowly',
      explanation: 'Esconde o modificador de velocidade "more slowly", enquanto a tradução na frente indica a intenção exata.'
    },
    tip_warning: '💡 "Could you..." soa muito mais educado e natural do que "Can you..." ou o imperativo "Speak slowly".'
  },
  'can i pay by card?': {
    term: 'Can I pay by card?',
    type: 'survival_phrase',
    ipa: '/kæn aɪ peɪ baɪ kɑːrd/',
    grammatical_class: 'frase de sobrevivência',
    translation: 'Posso pagar com cartão?',
    connotation_usage: 'Frase indispensável para compras, restaurantes, táxis e comércio em geral no exterior.',
    pattern: 'Can I pay + [FORMA / MEIO DE PAGAMENTO]?',
    variations: [
      { en: 'Can I pay in cash?', pt: 'Posso pagar em dinheiro vivo?' },
      { en: 'Can I pay with credit card?', pt: 'Posso pagar com cartão de crédito?' },
      { en: 'Can I pay with Apple Pay?', pt: 'Posso pagar com Apple Pay?' },
      { en: 'Can I pay here?', pt: 'Posso pagar aqui?' }
    ],
    strategic_gap: {
      gap_sentence: 'Can I pay (_____)?',
      expected_chunk: 'by card',
      explanation: 'Esconde a forma de pagamento "by card".'
    },
    tip_warning: '⚠️ Preposição importante: dizemos "by card" (de cartão), mas "in cash" (em dinheiro vivo).'
  },
  "i'd like a glass of water, please.": {
    term: "I'd like a glass of water, please.",
    type: 'survival_phrase',
    ipa: '/aɪd laɪk ə ɡlæs əv ˈwɔː.tər pliːz/',
    grammatical_class: 'frase de sobrevivência',
    translation: 'Eu gostaria de um copo de água, por favor.',
    connotation_usage: 'Padrão universal de cortesia para pedir comida, bebida ou serviços em restaurantes, aviões e hotéis.',
    pattern: "I'd like + [COISA / ITEM] + , please.",
    variations: [
      { en: "I'd like a coffee, please.", pt: 'Eu gostaria de um café, por favor.' },
      { en: "I'd like a table for two, please.", pt: 'Eu gostaria de uma mesa para dois, por favor.' },
      { en: "I'd like the check, please.", pt: 'Eu gostaria da conta, por favor.' },
      { en: "I'd like a bottle of water, please.", pt: 'Eu gostaria de uma garrafa de água, por favor.' }
    ],
    strategic_gap: {
      gap_sentence: "I'd like (_____), please.",
      expected_chunk: 'a glass of water',
      explanation: 'Esconde o item específico do pedido mantendo a estrutura de cortesia intacta.'
    },
    tip_warning: "💡 I'd like é a contração de I would like (eu gostaria). É a forma padrão internacional de pedir qualquer coisa com elegância."
  }
};

export async function POST(req: NextRequest) {
  try {
    const { term, type = 'vocabulary', meaningPt = '', apiKey: userApiKey } = await req.json();

    if (!term) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const cleanTerm = term.trim().toLowerCase();
    const isSurvivalPhrase = type === 'survival_phrase' || type === 'personal_phrase' || (term.includes(' ') && (term.endsWith('?') || term.endsWith('.') || term.split(' ').length >= 4));

    // Check curated database first
    if (CURATED_SHEETS[cleanTerm]) {
      return NextResponse.json({
        ...CURATED_SHEETS[cleanTerm],
        isCurated: true
      });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // 1. SURVIVAL PHRASE HANDLER
    if (isSurvivalPhrase) {
      if (!apiKey) {
        // Fallback for survival phrase without API key
        const words = term.trim().split(' ');
        const gapTarget = words.length > 3 ? words.slice(-2).join(' ') : words[words.length - 1];
        const gapSentence = term.replace(gapTarget, '(_____)');

        return NextResponse.json({
          term,
          type: 'survival_phrase',
          ipa: `/${cleanTerm}/`,
          grammatical_class: 'frase de sobrevivência',
          translation: meaningPt || term,
          connotation_usage: `Frase comunicativa para situações reais e práticas do cotidiano.`,
          pattern: `${words.slice(0, 2).join(' ')} + [COMPLEMENTO]?`,
          variations: [
            { en: term, pt: meaningPt || 'Frase original' },
            { en: `Could you help me with this?`, pt: 'Você poderia me ajudar com isso?' },
            { en: `Excuse me, where is this?`, pt: 'Com licença, onde fica isto?' },
            { en: `Thank you very much.`, pt: 'Muito obrigado(a).' }
          ],
          strategic_gap: {
            gap_sentence: gapSentence,
            expected_chunk: gapTarget,
            explanation: 'Esconde o chunk essencial para recuperação ativa no Anki.'
          },
          tip_warning: `💡 Dica: Pratique a frase completa em voz alta focando no ritmo e entonação natural.`,
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
              type: { type: SchemaType.STRING },
              ipa: { type: SchemaType.STRING, description: 'Transcrição fonética IPA da frase completa' },
              grammatical_class: { type: SchemaType.STRING, description: 'Sempre "frase de sobrevivência"' },
              translation: { type: SchemaType.STRING, description: 'Tradução natural e completa em português' },
              connotation_usage: { type: SchemaType.STRING, description: 'Contexto real e situações práticas de uso (aeroporto, restaurante, rua, emergência, etc.)' },
              pattern: { type: SchemaType.STRING, description: 'Padrão comunicativo reutilizável da frase (ex: "Where is the nearest + [LUGAR]?" ou "I\'d like + [COISA], please.")' },
              variations: {
                type: SchemaType.ARRAY,
                description: 'Exatamente 4 variações naturais da frase trocando apenas o elemento variável',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    en: { type: SchemaType.STRING, description: 'Variação natural em inglês' },
                    pt: { type: SchemaType.STRING, description: 'Tradução precisa em português' }
                  },
                  required: ['en', 'pt']
                }
              },
              strategic_gap: {
                type: SchemaType.OBJECT,
                description: 'Seleção de UMA ÚNICA lacuna estratégica com alto valor comunicativo',
                properties: {
                  gap_sentence: { type: SchemaType.STRING, description: 'A frase com o chunk escondido por (_____), ex: "Where is the (_____)?"' },
                  expected_chunk: { type: SchemaType.STRING, description: 'O chunk ou palavra exata que foi escondida, ex: "nearest subway station"' },
                  explanation: { type: SchemaType.STRING, description: 'Breve explicação pedagógica da escolha da lacuna' }
                },
                required: ['gap_sentence', 'expected_chunk']
              },
              tip_warning: { type: SchemaType.STRING, description: 'Dica prática de uso, preposição ou etiqueta iniciada com 💡 ou ⚠️' }
            },
            required: [
              'term',
              'type',
              'ipa',
              'grammatical_class',
              'translation',
              'connotation_usage',
              'pattern',
              'variations',
              'strategic_gap',
              'tip_warning'
            ]
          }
        }
      });

      const prompt = `Você é um especialista em ensino de inglês comunicativo focado em Frases de Sobrevivência para o Anki.
Analise a FRASE DE SOBREVIVÊNCIA COMPLETA: "${term}".
Tradução sugerida: "${meaningPt}".

REGRA ABSOLUTA:
Esta é uma FRASE COMPLETA. NUNCA a trate como palavra isolada nem a encaixe dentro de outras frases (proibido coisas como "need + frase" ou "use + frase").

GERE UMA FICHA DE FRASE DE SOBREVIVÊNCIA:
1. Pronúncia IPA da frase.
2. Tradução natural completa.
3. Contexto real de uso (onde e quando usar).
4. Padrão reutilizável da frase (ex: "Where is the nearest + [LUGAR]?", "Can I pay + [MEIO DE PAGAMENTO]?").
5. 4 Variações naturais preservando o padrão e trocando apenas o elemento variável, com tradução.
6. Escolha de UMA ÚNICA LACUNA ESTRATÉGICA com alto valor comunicativo (ex: em "Could you speak more slowly?", esconda "more slowly" -> "Could you speak (_____)?").
7. Dica de ouro ou atenção cultural/prática.`;

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      return NextResponse.json({ ...parsed, isCurated: false });
    }

    // 2. VOCABULARY & PHRASAL VERBS HANDLER
    if (!apiKey) {
      return NextResponse.json({
        term,
        type,
        ipa: `/${cleanTerm}/`,
        grammatical_class: type === 'phrasal_verb' ? 'phrasal verb' : 'substantivo/verbo',
        translation: meaningPt || cleanTerm,
        connotation_usage: `Uso no nível A2 para "${term}".`,
        useful_structures: [],
        collocations: [
          { en: `have ${term}`, pt: `ter ${meaningPt || term}` },
          { en: `need ${term}`, pt: `precisar de ${meaningPt || term}` },
          { en: `find ${term}`, pt: `encontrar ${meaningPt || term}` },
          { en: `use ${term}`, pt: `usar ${meaningPt || term}` }
        ],
        examples: [
          { en: `I need ${term} today.`, pt: `Eu preciso de ${meaningPt || term} hoje.` },
          { en: `She has a lot of ${term}.`, pt: `Ela tem muito(a) ${meaningPt || term}.` },
          { en: `Where can I find ${term}?`, pt: `Onde posso encontrar ${meaningPt || term}?` },
          { en: `This is an important ${term}.`, pt: `Este é um(a) ${meaningPt || term} importante.` },
          { en: `Please show me the ${term}.`, pt: `Por favor, me mostre o(a) ${meaningPt || term}.` }
        ],
        related_words: [meaningPt || term],
        tip_warning: `💡 Dica: Pratique a palavra em frases curtas de 5 a 7 palavras no seu Anki.`,
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
            type: { type: SchemaType.STRING },
            ipa: { type: SchemaType.STRING, description: 'Transcrição fonética IPA padrão' },
            grammatical_class: { type: SchemaType.STRING, description: 'Classe gramatical em português (ex: substantivo, verbo, adjetivo, phrasal verb)' },
            translation: { type: SchemaType.STRING, description: 'Tradução principal clara em português' },
            connotation_usage: { type: SchemaType.STRING, description: 'Explicação de uso, contabilidade, formas (infinitivo/passado) e conotação' },
            useful_structures: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Estruturas gramaticais ou sentidos numerados (ex: ① go on = continuar / ② go on = acontecer)'
            },
            collocations: {
              type: SchemaType.ARRAY,
              description: 'Exatamente 4 colocações ou chunks comuns com tradução',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  en: { type: SchemaType.STRING },
                  pt: { type: SchemaType.STRING }
                },
                required: ['en', 'pt']
              }
            },
            examples: {
              type: SchemaType.ARRAY,
              description: 'Exatamente 5 frases curtas (5-8 palavras) reais e naturais no nível A2 com tradução',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  en: { type: SchemaType.STRING },
                  pt: { type: SchemaType.STRING }
                },
                required: ['en', 'pt']
              }
            },
            related_words: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Palavras da mesma família com tradução entre parênteses'
            },
            tip_warning: {
              type: SchemaType.STRING,
              description: 'Dica de atenção ou armadilha iniciada por 💡 ou ⚠️'
            }
          },
          required: [
            'term',
            'type',
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
Gere uma FICHA DE ESTUDO LEXICAL para a palavra/chunk: "${term}" (${type === 'phrasal_verb' ? 'Phrasal Verb' : 'Vocabulário'}).
Tradução sugerida: "${meaningPt}".

ESTRUTURA OBRIGATÓRIA:
1. Pronúncia IPA e classe gramatical.
2. Tradução principal.
3. Uso importante e particularidades.
4. Estruturas úteis (se aplicável).
5. 4 Colocações comuns (chunks naturais com tradução).
6. 5 Exemplos reais curtos (5 a 8 palavras) no nível A2 com tradução.
7. Palavras relacionadas.
8. Dica de atenção pedagógica.`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return NextResponse.json({ ...parsed, isCurated: false });
  } catch (error: any) {
    console.error('Error generating study sheet with Gemini:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate study sheet'
    }, { status: 500 });
  }
}
