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
    if (!back.toLowerCase().includes('áudio') && !back.toLowerCase().includes('audio') && !back.includes('🔊')) {
      obs.push('Lembre-se de manter o áudio no VERSO do card.');
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

export interface GeneratedSentenceOption {
  en: string;
  pt: string;
  clue: string;
}

export interface GenerateSentencesResult {
  term: string;
  ipa?: string;
  sentences: GeneratedSentenceOption[];
  isOfflineFallback?: boolean;
}

/**
 * Generate 5 short, real-life A2 sentences with Gemini Flash for Anki
 */
export async function generateSentencesWithGemini(
  term: string,
  type: ContentType = 'vocabulary',
  meaningPt: string = ''
): Promise<GenerateSentencesResult> {
  const apiKey = getStoredApiKey();

  try {
    const res = await fetch('/api/gemini/generate-sentences', {
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
      throw new Error(`Sentence generation API status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.warn('Error fetching generated sentences:', error);
    return {
      term,
      sentences: [
        {
          en: `I need to check the ${term} today.`,
          pt: `Eu preciso verificar o(a) ${meaningPt || term} hoje.`,
          clue: `I need to check the (${meaningPt || term}) today.`
        },
        {
          en: `Can you show me your ${term}?`,
          pt: `Você pode me mostrar seu(sua) ${meaningPt || term}?`,
          clue: `Can you show me your (${meaningPt || term})?`
        },
        {
          en: `This is a very nice ${term}.`,
          pt: `Este é um(a) ${meaningPt || term} muito bom(boa).`,
          clue: `This is a very nice (${meaningPt || term}).`
        },
        {
          en: `Where is the ${term} right now?`,
          pt: `Onde está o(a) ${meaningPt || term} agora?`,
          clue: `Where is the (${meaningPt || term}) right now?`
        },
        {
          en: `I found a new ${term} yesterday.`,
          pt: `Eu encontrei um(a) novo(a) ${meaningPt || term} ontem.`,
          clue: `I found a new (${meaningPt || term}) yesterday.`
        }
      ],
      isOfflineFallback: true
    };
  }
}

