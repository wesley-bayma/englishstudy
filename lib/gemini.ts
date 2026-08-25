import { GeminiAnalysisResult, CardReviewResult, ContentType } from './types';

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('gemini_api_key') || '';
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('gemini_api_key', key.trim());
}

/**
 * Call the Next.js API route to analyze query with Gemini Flash
 */
export async function analyzeWithGemini(
  query: string,
  candidates: string[] = [],
  contextSentence: string = ''
): Promise<GeminiAnalysisResult> {
  const apiKey = getStoredApiKey();

  try {
    const res = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        candidates,
        context: contextSentence,
        apiKey
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.warn('Gemini analysis failed or offline, returning fallback:', error);
    // Graceful offline fallback
    return {
      classification: query.split(' ').length > 3 ? 'survival_phrase' : (query.includes(' ') ? 'phrasal_verb' : 'vocabulary'),
      base_form: query.trim().toLowerCase(),
      has_possible_match: false,
      matched_existing_content: null,
      similarity_type: 'none',
      confidence: 0.8,
      meaning_pt: '',
      explanation: 'Análise offline básica (configure sua chave Gemini nas Configurações para análise avançada de variantes e lematização).',
      suggested_example: query
    };
  }
}

/**
 * Call the Next.js API route to review a card with Gemini Flash
 */
export async function reviewCardWithGemini(
  front: string,
  back: string,
  type?: ContentType
): Promise<CardReviewResult> {
  const apiKey = getStoredApiKey();

  try {
    const res = await fetch('/api/gemini/review-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        front,
        back,
        type,
        apiKey
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.warn('Gemini card review failed or offline, returning fallback evaluation:', error);
    
    // Deterministic rule checks fallback
    const obs: string[] = [];
    const wordCount = front.trim().split(/\s+/).length;
    
    if (wordCount > 10) {
      obs.push('Frase na frente um pouco longa. Prefira frases curtas de 5–7 palavras.');
    }
    if (!front.includes('(') && !front.includes('..')) {
      obs.push('Recomendado incluir uma lacuna ou dica entre parênteses para recuperação ativa.');
    }


    return {
      status: obs.length === 0 ? 'good' : (obs.length === 1 ? 'improvable' : 'bad'),
      status_label: obs.length === 0 ? '✅ Bom' : (obs.length === 1 ? '⚠️ Pode melhorar' : '❌ Problema importante'),
      score: obs.length === 0 ? 95 : (obs.length === 1 ? 75 : 50),
      observations: obs.length > 0 ? obs : ['Estrutura básica do card atende às regras canônicas de recuperação ativa.'],
      summary: obs.length === 0 ? 'Card bem estruturado!' : 'Card avaliado com regras locais.'
    };
  }
}

/**
 * Fetch complete pedagogical study sheet (IPA, collocations, 5 examples, tips) with Gemini Flash
 */
export async function getStudySheetWithGemini(
  term: string,
  type: ContentType = 'vocabulary',
  meaningPt: string = ''
): Promise<any> {
  const apiKey = getStoredApiKey();

  try {
    const res = await fetch('/api/gemini/study-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term,
        type,
        meaningPt,
        apiKey
      })
    });

    if (!res.ok) {
      throw new Error(`Study sheet API error status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.warn('Error fetching study sheet from Gemini, returning fallback:', error);
    return {
      term,
      ipa: `/${term}/`,
      grammatical_class: type === 'phrasal_verb' ? 'phrasal verb' : (type === 'survival_phrase' ? 'frase de sobrevivência' : 'substantivo/verbo'),
      translation: meaningPt || term,
      connotation_usage: `Uso no nível A2 para "${term}".`,
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
      tip_warning: `💡 Dica: Pratique a pronúncia e o contexto de "${term}" em frases simples do cotidiano.`
    };
  }
}


