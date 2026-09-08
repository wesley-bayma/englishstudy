import type {
  AIAnalysisResult,
  CardReviewResult,
  ContentType,
  StudySheet
} from './types';
import { validateStudySheet } from './card-format';

const CONTENT_TYPES = new Set<ContentType>([
  'vocabulary',
  'survival_phrase',
  'phrasal_verb',
  'personal_phrase',
  'personal_vocabulary'
]);
const SIMILARITY_TYPES = new Set(['exact', 'inflection', 'semantic_similarity', 'synonym', 'none']);
const PHRASAL_SEPARABILITY = new Set(['separable', 'inseparable', 'both', 'not_applicable']);
const PHRASAL_TRANSITIVITY = new Set(['transitive', 'intransitive', 'both']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, max = 2000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isStringArray(value: unknown, maxItems: number, maxItemLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every(item => isNonEmptyString(item, maxItemLength));
}

function isBilingualArray(value: unknown, maxItems: number): value is Array<{ en: string; pt: string }> {
  return Array.isArray(value) && value.length <= maxItems && value.every(item => (
    isRecord(item) && isNonEmptyString(item.en, 500) && isNonEmptyString(item.pt, 500)
  ));
}

export function parseStudySheet(value: unknown):
  | { ok: true; data: StudySheet }
  | { ok: false; errors: string[] } {
  if (!isRecord(value)) return { ok: false, errors: ['A resposta não é um objeto.'] };

  const errors: string[] = [];
  if (!isNonEmptyString(value.term, 200)) errors.push('term');
  if (!isNonEmptyString(value.ipa, 200)) errors.push('ipa');
  if (!isNonEmptyString(value.grammatical_class, 120)) errors.push('grammatical_class');
  if (!isNonEmptyString(value.translation, 500)) errors.push('translation');
  if (!isNonEmptyString(value.tip_warning, 800)) errors.push('tip_warning');
  if (value.useful_structures !== undefined && !isStringArray(value.useful_structures, 12, 300)) errors.push('useful_structures');
  if (value.related_words !== undefined && !isStringArray(value.related_words, 12, 120)) errors.push('related_words');
  if (value.collocations !== undefined && !isBilingualArray(value.collocations, 12)) errors.push('collocations');
  if (value.examples !== undefined && !isBilingualArray(value.examples, 8)) errors.push('examples');
  if (value.variations !== undefined && !isBilingualArray(value.variations, 8)) errors.push('variations');

  if (value.phrasal_verb_info !== undefined) {
    const info = value.phrasal_verb_info;
    if (!isRecord(info) || !isNonEmptyString(info.primary_meaning, 300) ||
      typeof info.separability !== 'string' || !PHRASAL_SEPARABILITY.has(info.separability) ||
      typeof info.transitivity !== 'string' || !PHRASAL_TRANSITIVITY.has(info.transitivity) ||
      !isNonEmptyString(info.object_pattern, 300) ||
      (info.pronoun_rule !== undefined && !isNonEmptyString(info.pronoun_rule, 300))) {
      errors.push('phrasal_verb_info');
    }
  }

  if (value.strategic_gap !== undefined) {
    const gap = value.strategic_gap;
    if (!isRecord(gap) || !isNonEmptyString(gap.gap_sentence, 500) || !isNonEmptyString(gap.expected_chunk, 300) ||
      (gap.explanation !== undefined && !isNonEmptyString(gap.explanation, 500))) {
      errors.push('strategic_gap');
    }
  }

  if (value.pattern !== undefined && !isNonEmptyString(value.pattern, 300)) errors.push('pattern');
  if (value.connotation_usage !== undefined && !isNonEmptyString(value.connotation_usage, 1200)) errors.push('connotation_usage');

  if (value.type !== undefined && (typeof value.type !== 'string' || !CONTENT_TYPES.has(value.type as ContentType))) {
    errors.push('type');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: value as unknown as StudySheet };
}

export function validateParsedStudySheet(value: unknown, type: ContentType):
  | { ok: true; data: StudySheet }
  | { ok: false; errors: string[] } {
  const parsed = parseStudySheet(value);
  if (!parsed.ok) return parsed;
  const data = { ...parsed.data, type };
  const errors = validateStudySheet(data);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data };
}

export function parseAIAnalysis(value: unknown):
  | { ok: true; data: AIAnalysisResult }
  | { ok: false; errors: string[] } {
  if (!isRecord(value)) return { ok: false, errors: ['A resposta não é um objeto.'] };
  const errors: string[] = [];
  if (typeof value.classification !== 'string' || !CONTENT_TYPES.has(value.classification as ContentType)) errors.push('classification');
  if (value.base_form !== null && !isNonEmptyString(value.base_form, 200)) errors.push('base_form');
  if (typeof value.has_possible_match !== 'boolean') errors.push('has_possible_match');
  if (value.matched_existing_content !== null && !isNonEmptyString(value.matched_existing_content, 300)) errors.push('matched_existing_content');
  if (typeof value.similarity_type !== 'string' || !SIMILARITY_TYPES.has(value.similarity_type)) errors.push('similarity_type');
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) errors.push('confidence');
  if (!isNonEmptyString(value.meaning_pt, 500)) errors.push('meaning_pt');
  if (!isNonEmptyString(value.explanation, 1200)) errors.push('explanation');
  if (typeof value.suggested_example !== 'string' || value.suggested_example.length > 500) errors.push('suggested_example');
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data: value as unknown as AIAnalysisResult };
}

export function parseCardReview(value: unknown):
  | { ok: true; data: CardReviewResult }
  | { ok: false; errors: string[] } {
  if (!isRecord(value)) return { ok: false, errors: ['A resposta não é um objeto.'] };
  const validLabels = new Set(['✅ Bom', '⚠️ Pode melhorar', '❌ Problema importante']);
  const errors: string[] = [];
  if (value.status !== 'good' && value.status !== 'improvable' && value.status !== 'bad') errors.push('status');
  if (typeof value.status_label !== 'string' || !validLabels.has(value.status_label)) errors.push('status_label');
  if (typeof value.score !== 'number' || !Number.isFinite(value.score) || value.score < 0 || value.score > 100) errors.push('score');
  if (!isStringArray(value.observations, 3, 500)) errors.push('observations');
  if (!isNonEmptyString(value.summary, 500)) errors.push('summary');
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data: value as unknown as CardReviewResult };
}
