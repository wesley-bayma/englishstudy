import { GeminiAnalysisResult, CardReviewResult, ContentType, StudySheet, StudySheetCacheEntry } from './types';
import { validateCanonicalCard } from './card-format';
import { getDB } from './db';

const STUDY_SHEET_CACHE_VERSION = 'v2';
const studySheetMemoryCache = new Map<string, StudySheet>();
const studySheetRequests = new Map<string, Promise<StudySheet | null>>();

function getStudySheetCacheId(
  term: string,
  type: ContentType,
  meaningPt: string,
  contextSentence: string
): string {
  return `${STUDY_SHEET_CACHE_VERSION}:${encodeURIComponent(JSON.stringify([
    term.trim(),
    type,
    meaningPt.trim(),
    contextSentence.trim()
  ]))}`;
}

async function readCachedStudySheet(cacheId: string): Promise<StudySheet | null> {
  const memoryCached = studySheetMemoryCache.get(cacheId);
  if (memoryCached) return memoryCached;

  try {
    const cached = await getDB().study_sheets.get(cacheId);
    if (cached?.sheet) {
      studySheetMemoryCache.set(cacheId, cached.sheet);
      return cached.sheet;
    }
  } catch (error) {
    console.warn('Study sheet cache read skipped:', error);
  }

  return null;
}

async function writeCachedStudySheet(cacheId: string, sheet: StudySheet): Promise<void> {
  studySheetMemoryCache.set(cacheId, sheet);

  try {
    const entry: StudySheetCacheEntry = {
      id: cacheId,
      sheet,
      updated_at: new Date().toISOString()
    };
    await getDB().study_sheets.put(entry);
  } catch (error) {
    console.warn('Study sheet cache write skipped:', error);
  }
}

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
      suggested_example: contextSentence || ''
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
    
    const obs = validateCanonicalCard(front, back, type);


    return {
      status: obs.length === 0 ? 'good' : (obs.length === 1 ? 'improvable' : 'bad'),
      status_label: obs.length === 0 ? '✅ Bom' : (obs.length === 1 ? '⚠️ Pode melhorar' : '❌ Problema importante'),
      score: obs.length === 0 ? 95 : (obs.length === 1 ? 75 : 50),
      observations: obs.length > 0 ? obs : ['Estrutura atende às regras canônicas de recuperação ativa.'],
      summary: obs.length === 0 ? 'Card bem estruturado!' : 'Alguns ajustes são necessários.'
    };
  }
}

/**
 * Fetch complete pedagogical study sheet (IPA, natural usage, examples and tips) with Gemini Flash
 */
export async function getStudySheetWithGemini(
  term: string,
  type: ContentType = 'vocabulary',
  meaningPt: string = '',
  contextSentence: string = '',
  signal?: AbortSignal
): Promise<StudySheet | null> {
  const cacheId = getStudySheetCacheId(term, type, meaningPt, contextSentence);
  const cached = await readCachedStudySheet(cacheId);
  if (cached) return cached;

  const pendingRequest = studySheetRequests.get(cacheId);
  if (pendingRequest) return pendingRequest;

  const apiKey = getStoredApiKey();

  const request = (async (): Promise<StudySheet | null> => {
    try {
      const res = await fetch('/api/gemini/study-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          type,
          meaningPt,
          contextSentence,
          apiKey
        }),
        signal
      });

      if (!res.ok) {
        throw new Error(`Study sheet API error status ${res.status}`);
      }

      const data = await res.json() as StudySheet;
      void writeCachedStudySheet(cacheId, data);
      return data;
    } catch (error) {
      console.warn('Error fetching study sheet from Gemini:', error);
      return null;
    }
  })();

  studySheetRequests.set(cacheId, request);
  try {
    return await request;
  } finally {
    if (studySheetRequests.get(cacheId) === request) {
      studySheetRequests.delete(cacheId);
    }
  }
}

export function prefetchStudySheetWithGemini(
  term: string,
  type: ContentType = 'vocabulary',
  meaningPt: string = '',
  contextSentence: string = ''
): void {
  void getStudySheetWithGemini(term, type, meaningPt, contextSentence).catch(error => {
    console.warn('Study sheet prefetch skipped:', error);
  });
}
