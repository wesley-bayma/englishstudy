import { ContentItem, ContentType } from './types';

export interface FormattedAnkiCard {
  front: string;
  back: string;
  copyFull: string;
  target: string;
  clue: string;
  fullSentence: string;
  formsOrIpa: string;
  explanation: string;
  pedagogicalTip: string;
  audioNote: string;
}

// Basic Portuguese dictionary for common canonical vocabulary to provide natural clues
const VOCAB_CLUES: Record<string, { pt: string; sentence: string; ipa?: string; explanation?: string }> = {
  wallet: { pt: 'carteira', sentence: 'I forgot my wallet again.', ipa: '/ˈwɑː.lət/', explanation: 'Substantivo comum para carteira de dinheiro/documentos.' },
  motivation: { pt: 'motivação', sentence: 'He found new motivation to study.', ipa: '/ˌmoʊ.t̬əˈveɪ.ʃən/', explanation: 'Motivação, estímulo para agir.' },
  complete: { pt: 'completar / completo', sentence: 'Please complete this form.', ipa: '/kəmˈpliːt/', explanation: 'Verbo ou adjetivo para terminar algo.' },
  income: { pt: 'renda / rendimento', sentence: 'They have a steady income.', ipa: '/ˈɪn.kʌm/', explanation: 'Renda financeira mensal ou anual.' },
  feel: { pt: 'sentir', sentence: 'I feel great today.', ipa: '/fiːl/', explanation: 'Verbo de percepção e estado emocional.' },
  apple: { pt: 'maçã', sentence: 'I eat an apple every morning.', ipa: '/ˈæp.əl/', explanation: 'Substantivo comum para a fruta maçã.' },
  add: { pt: 'adicionar / somar', sentence: 'Add a little salt to the soup.', ipa: '/æd/', explanation: 'Adicionar ingredientes ou informações.' },
  wonderful: { pt: 'maravilhoso', sentence: 'We had a wonderful time together.', ipa: '/ˈwʌn.dɚ.fəl/', explanation: 'Adjetivo para algo excelente.' },
  prove: { pt: 'provar / demonstrar', sentence: 'He tried to prove his point.', ipa: '/pruːv/', explanation: 'Demonstrar a verdade de algo.' },
  cinema: { pt: 'cinema', sentence: 'Let us go to the cinema tonight.', ipa: '/ˈsɪn.ə.mə/', explanation: 'Local de exibição de filmes.' },
  safe: { pt: 'seguro / a salvo', sentence: 'Keep your passport in a safe place.', ipa: '/seɪf/', explanation: 'Lugar ou estado de segurança.' },
  honest: { pt: 'honesto / sincero', sentence: 'Thank you for your honest opinion.', ipa: '/ˈɑː.nɪst/', explanation: 'A letra H é muda (/ˈɑː.nɪst/).' },
  behavior: { pt: 'comportamento', sentence: 'His behavior was very polite.', ipa: '/bɪˈheɪ.vjɚ/', explanation: 'Modo de se comportar.' },
  solve: { pt: 'resolver', sentence: 'We need to solve this problem now.', ipa: '/sɑːlv/', explanation: 'Encontrar solução para algo.' },
  run: { pt: 'correr', sentence: 'I run in the park every morning.', ipa: '/rʌn/', explanation: 'Verbo correr (passado: ran, particípio: run).' },
  awkward: { pt: 'estranho / constrangedor', sentence: 'That was an awkward moment.', ipa: '/ˈɑː.kwɚd/', explanation: 'Situação social desconfortável ou sem jeito.' }
};

/**
 * Generates ready-to-copy Anki Front and Back according to the user's canonical rules
 */
export function generateAnkiCardData(item: ContentItem): FormattedAnkiCard {
  const type = item.type;
  const content = item.content.trim();
  const lowerContent = content.toLowerCase();

  // 1. VOCABULARY CARD FORMAT
  if (type === 'vocabulary' || type === 'personal_vocabulary') {
    const known = VOCAB_CLUES[lowerContent];
    const clue = item.meaning_pt || known?.pt || lowerContent;
    const fullSentence = item.example || known?.sentence || `I need to use this ${content} today.`;
    
    // Replace word in sentence with (dica em português)
    let frontSentence = fullSentence;
    const regex = new RegExp(`\\b${escapeRegExp(content)}\\b`, 'i');
    if (regex.test(fullSentence)) {
      frontSentence = fullSentence.replace(regex, `(${clue})`);
    } else {
      frontSentence = `I need a (${clue}) right now.`;
    }

    const ipaStr = known?.ipa ? ` ${known.ipa}` : '';
    const front = frontSentence;
    const back = `${content}${ipaStr}\n${fullSentence}\n🔊 Áudio no verso.`;
    const explanation = known?.explanation || item.notes || `Palavra de vocabulário "${content}". Pratique a pronúncia da palavra e fale a frase completa em voz alta antes de revelar o verso.`;
    const pedagogicalTip = 'Mantenha 1 único alvo. A dica em português funciona apenas como gatilho de recuperação ativa.';

    return {
      front,
      back,
      copyFull: `FRENTE:\n${front}\n\nVERSO:\n${back}`,
      target: content,
      clue,
      fullSentence,
      formsOrIpa: ipaStr.trim(),
      explanation,
      pedagogicalTip,
      audioNote: 'Áudio no verso'
    };
  }

  // 2. SURVIVAL PHRASE CARD FORMAT
  if (type === 'survival_phrase' || type === 'personal_phrase') {
    const translation = item.meaning_pt || 'Tradução em português';
    const words = content.split(' ');
    
    // Choose the key chunk or last 1-2 words for the blank
    let blankFront = '';
    if (words.length <= 3) {
      blankFront = words.map((w, idx) => idx === words.length - 1 ? '(..?)' : w).join(' ');
    } else {
      // Find key word or replace middle/end chunk
      const blankIndex = Math.min(2, words.length - 1);
      blankFront = words.map((w, idx) => idx === blankIndex ? '(..?)' : w).join(' ');
    }

    const front = `${blankFront}?\n${translation}`;
    const back = `${content}\n🔊 Áudio da frase completa no verso.`;
    const explanation = `Frase essencial para situações reais de comunicação. Foque no chunk/expressão completa em vez de traduzir palavra por palavra.`;
    const pedagogicalTip = 'Use a lacuna (..?) e a tradução como suporte. Fale a frase inteira com ritmo e entonação natural.';

    return {
      front,
      back,
      copyFull: `FRENTE:\n${front}\n\nVERSO:\n${back}`,
      target: content,
      clue: translation,
      fullSentence: content,
      formsOrIpa: '',
      explanation,
      pedagogicalTip,
      audioNote: 'Áudio da frase completa no verso'
    };
  }

  // 3. PHRASAL VERB CARD FORMAT
  // Phrasal verbs: find out -> find out — finding out — found out
  const meaning = item.meaning_pt || 'significado do PV';
  const exampleSentence = item.example || `I need to ${content} today.`;
  
  // Extract base verb for inflections
  const parts = content.split(' ');
  const baseVerb = parts[0] || content;
  const particle = parts.slice(1).join(' ');
  
  const ingForm = `${getIngForm(baseVerb)} ${particle}`.trim();
  const pastForm = `${getPastForm(baseVerb)} ${particle}`.trim();
  const formsStr = `${content} — ${ingForm} — ${pastForm}`;

  let frontSentence = exampleSentence;
  const regex = new RegExp(`\\b${escapeRegExp(content)}\\b`, 'i');
  if (regex.test(exampleSentence)) {
    frontSentence = exampleSentence.replace(regex, `(PV: ${meaning})`);
  } else {
    frontSentence = `I need to (PV: ${meaning}) the truth.`;
  }

  const front = frontSentence;
  const back = `${formsStr}\n${exampleSentence}\n🔊 Áudio no verso.`;
  const explanation = `Phrasal Verb com sentido principal: "${meaning}". Aprenda o verbo em conjunto com as 3 formas mais comuns para fixar a conjugação natural.`;
  const pedagogicalTip = 'Use sempre o prefixo "PV:" na dica da frente para sinalizar que a resposta esperada é uma combinação verbo + partícula.';

  return {
    front,
    back,
    copyFull: `FRENTE:\n${front}\n\nVERSO:\n${back}`,
    target: content,
    clue: `PV: ${meaning}`,
    fullSentence: exampleSentence,
    formsOrIpa: formsStr,
    explanation,
    pedagogicalTip,
    audioNote: 'Áudio no verso'
  };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getIngForm(verb: string): string {
  if (verb.endsWith('e') && !verb.endsWith('ee')) return verb.slice(0, -1) + 'ing';
  if (verb === 'run') return 'running';
  if (verb === 'get') return 'getting';
  if (verb === 'sit') return 'sitting';
  if (verb === 'put') return 'putting';
  if (verb === 'cut') return 'cutting';
  if (verb === 'set') return 'setting';
  return verb + 'ing';
}

function getPastForm(verb: string): string {
  const irregulars: Record<string, string> = {
    go: 'went',
    come: 'came',
    get: 'got',
    take: 'took',
    give: 'gave',
    make: 'made',
    find: 'found',
    look: 'looked',
    point: 'pointed',
    grow: 'grew',
    set: 'set',
    turn: 'turned',
    bring: 'brought',
    put: 'put',
    run: 'ran',
    stand: 'stood',
    hold: 'held',
    pull: 'pulled',
    break: 'broke',
    show: 'showed',
    work: 'worked',
    keep: 'kept',
    cut: 'cut',
    shut: 'shut',
    step: 'stepped',
    lay: 'laid',
    call: 'called',
    walk: 'walked',
    pick: 'picked',
    carry: 'carried',
    fill: 'filled',
    pass: 'passed',
    hand: 'handed',
    write: 'wrote',
    pay: 'paid'
  };
  return irregulars[verb] || (verb.endsWith('e') ? verb + 'd' : verb + 'ed');
}
