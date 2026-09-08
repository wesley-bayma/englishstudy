import { AIAnalysisResult, CardReviewResult, ContentType, StudySheet, StudySheetCacheEntry } from './types';
import { getDB } from './db';
import { parseStudySheet } from './ai-validation';

const STUDY_SHEET_CACHE_VERSION = 'v4-openrouter-schema';
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
  if (memoryCached && parseStudySheet(memoryCached).ok) return memoryCached;

  try {
    const cached = await getDB().study_sheets.get(cacheId);
    if (cached?.sheet && parseStudySheet(cached.sheet).ok) {
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

async function parseApiResponse<T>(res: Response): Promise<T> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`A API retornou uma resposta inválida (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const error = data && typeof data === 'object' && 'error' in data
      ? (data as { error?: string | { message?: string } }).error
      : undefined;
    const message = typeof error === 'string'
      ? error
      : error?.message || `A API retornou HTTP ${res.status}.`;
    throw new Error(message);
  }

  return data as T;
}

/**
 * Call the Next.js API route to analyze query with OpenRouter.
 */
export async function analyzeWithOpenRouter(
  query: string,
  candidates: string[] = [],
  contextSentence: string = ''
): Promise<AIAnalysisResult> {
  const res = await fetch('/api/openrouter/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, candidates, context: contextSentence })
  });
  return parseApiResponse<AIAnalysisResult>(res);
}

/**
 * Call the Next.js API route to review a card with OpenRouter.
 */
export async function reviewCardWithOpenRouter(
  front: string,
  back: string,
  type?: ContentType
): Promise<CardReviewResult> {
  const res = await fetch('/api/openrouter/review-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back, type })
  });
  return parseApiResponse<CardReviewResult>(res);
}

/**
 * Fetch complete pedagogical study sheet (IPA, natural usage, examples and tips) with OpenRouter.
 */
export async function getStudySheetWithOpenRouter(
  term: string,
  type: ContentType = 'vocabulary',
  meaningPt: string = '',
  contextSentence: string = ''
): Promise<StudySheet | null> {
  const cacheId = getStudySheetCacheId(term, type, meaningPt, contextSentence);
  const cached = await readCachedStudySheet(cacheId);
  if (cached) return cached;

  const pendingRequest = studySheetRequests.get(cacheId);
  if (pendingRequest) return pendingRequest;

  const request = (async (): Promise<StudySheet | null> => {
    try {
      const res = await fetch('/api/openrouter/study-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          type,
          meaningPt,
          contextSentence
        }),
      });

      if (!res.ok) {
        return parseApiResponse<StudySheet>(res);
      }

      const data = await parseApiResponse<StudySheet>(res);
      void writeCachedStudySheet(cacheId, data);
      return data;
    } catch (error) {
      console.warn('Error fetching study sheet from OpenRouter:', error);
      throw error;
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

export function prefetchStudySheetWithOpenRouter(
  term: string,
  type: ContentType = 'vocabulary',
  meaningPt: string = '',
  contextSentence: string = ''
): void {
  void getStudySheetWithOpenRouter(term, type, meaningPt, contextSentence).catch(error => {
    console.warn('Study sheet prefetch skipped:', error);
  });
}
