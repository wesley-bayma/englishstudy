import { AIAnalysisResult, CardReviewResult, ContentType, StudySheet, StudySheetCacheEntry } from './types';
import { getDB } from './db';
import { parseStudySheet } from './ai-validation';

const STUDY_SHEET_CACHE_VERSION = 'v9-item-ipa';
const studySheetMemoryCache = new Map<string, StudySheet>();
const studySheetRequests = new Map<string, Promise<StudySheet | null>>();

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string | null = null,
    public readonly status: number | null = null,
    public readonly requestId: string | null = null
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function getStudySheetCacheId(
  term: string,
  type: ContentType,
  meaningPt: string,
  contextSentence: string,
  ipa: string
): string {
  return `${STUDY_SHEET_CACHE_VERSION}:${encodeURIComponent(JSON.stringify([
    term.trim(),
    type,
    meaningPt.trim(),
    contextSentence.trim(),
    ipa.trim()
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
    throw new ApiClientError(
      `A API retornou uma resposta inválida (HTTP ${res.status}).`,
      'INVALID_API_RESPONSE',
      res.status,
      res.headers.get('X-Request-ID')
    );
  }

  if (!res.ok) {
    const error = data && typeof data === 'object' && 'error' in data
      ? (data as { error?: string | { code?: string; message?: string; requestId?: string } }).error
      : undefined;
    const message = typeof error === 'string'
      ? error
      : error?.message || `A API retornou HTTP ${res.status}.`;
    throw new ApiClientError(
      message,
      typeof error === 'object' ? error.code || null : null,
      res.status,
      typeof error === 'object'
        ? error.requestId || res.headers.get('X-Request-ID')
        : res.headers.get('X-Request-ID')
    );
  }

  return data as T;
}

/**
 * Call the protected server API to analyze a query with Gemini.
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
 * Call the protected server API to review a card with Gemini.
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
 * Fetch complete pedagogical study sheet (IPA, natural usage, examples and tips) with Gemini.
 */
export async function getStudySheetWithOpenRouter(
  term: string,
  type: ContentType = 'vocabulary',
  meaningPt: string = '',
  contextSentence: string = '',
  ipa: string = ''
): Promise<StudySheet | null> {
  const cacheId = getStudySheetCacheId(term, type, meaningPt, contextSentence, ipa);
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
          contextSentence,
          ipa
        }),
      });

      if (!res.ok) {
        return parseApiResponse<StudySheet>(res);
      }

      const data = await parseApiResponse<StudySheet>(res);
      // A fallback is deliberately not cached: a later retry must be able to
      // replace it with a complete provider response.
      if (!data.isFallback) void writeCachedStudySheet(cacheId, data);
      return data;
    } catch (error) {
      console.warn('Error fetching study sheet from Gemini:', error);
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
  contextSentence: string = '',
  ipa: string = ''
): void {
  void getStudySheetWithOpenRouter(term, type, meaningPt, contextSentence, ipa).catch(error => {
    console.warn('Study sheet prefetch skipped:', error);
  });
}
