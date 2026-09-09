import { ContentType, StudySheet } from './types';

export interface CanonicalCard {
  front: string;
  back: string;
}

export function formatCanonicalCardForClipboard(card: CanonicalCard): string {
  return `Frente:\n${card.front}\n\nVerso:\n${card.back}`;
}

const GAP_PATTERN = /\(\s*(?:_{2,}|\.{2,}\?)\s*\)|\[\s*\.{2,}\s*\]|_{2,}/g;
const CANONICAL_GAP = /\(\.\.\?\)/g;
const PARENTHETICAL_PATTERN = /\([^()\r\n]+\)/g;
const ANKI_MARKUP_PATTERN = /\[sound:[^\]]+\]|<audio\b|\{\{\s*(?:frontside|front|back|c\d+::)/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTerm(sentence: string, term: string, replacement: string): string | null {
  const cleanSentence = sentence.trim();
  const cleanTerm = term.trim();
  if (!cleanSentence || !cleanTerm) return null;

  const expression = new RegExp(
    `(^|[^A-Za-z])${escapeRegExp(cleanTerm)}(?=$|[^A-Za-z])`,
    'i'
  );

  if (!expression.test(cleanSentence)) return null;
  return cleanSentence.replace(expression, (_match, prefix: string) => `${prefix}${replacement}`);
}

function normalizedWords(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryMeaning(translation: string): string {
  return (translation || '')
    .split(/[;,/]/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function isSurvivalPhrase(sheet: StudySheet): boolean {
  return sheet.type === 'survival_phrase' || sheet.type === 'personal_phrase';
}

function isPhrasalVerb(sheet: StudySheet): boolean {
  return sheet.type === 'phrasal_verb';
}

function normalizeStrategicGap(sentence: string): string {
  return sentence
    .replace(/\(\s*_{2,}\s*\)|\[\s*\.{2,}\s*\]|_{2,}/g, '(..?)')
    .replace(/\(\.\.\?\)\s+([?.!,;:])/g, '(..?)$1')
    .replace(/\s+([?.!,;:])/g, '$1')
    .trim();
}

/**
 * Builds the only canonical Anki format used by the study sheet.
 * Returning null is intentional: an invalid/missing example must never be
 * replaced with an invented sentence.
 */
export function buildCanonicalCard(sheet: StudySheet): CanonicalCard | null {
  if (isSurvivalPhrase(sheet)) {
    const gap = sheet.strategic_gap;
    if (!gap?.gap_sentence || !gap.expected_chunk || !sheet.term.trim()) return null;

    const gapCount = gap.gap_sentence.match(GAP_PATTERN)?.length || 0;
    if (gapCount !== 1) return null;

    const expectedChunk = normalizedWords(gap.expected_chunk);
    const answerSentence = normalizedWords(sheet.term);
    if (!expectedChunk || !answerSentence.includes(expectedChunk)) return null;

    const translation = sheet.translation.trim();
    const card = {
      front: `${normalizeStrategicGap(gap.gap_sentence)}\n${translation}`.trim(),
      back: sheet.term.trim()
    };
    return validateCanonicalCard(card.front, card.back, sheet.type).length === 0 ? card : null;
  }

  const example = sheet.examples?.find(item => replaceTerm(item.en, sheet.term, sheet.term));
  const meaning = primaryMeaning(sheet.translation);
  if (!example || !meaning || !example.pt?.trim()) return null;

  const frontTarget = isPhrasalVerb(sheet)
    ? `(PV: ${meaning})`
    : `(${meaning})`;
  const frontSentence = replaceTerm(example.en, sheet.term, frontTarget);
  const backSentence = replaceTerm(example.en, sheet.term, sheet.term.trim());
  const forms = sheet.phrasal_verb_info?.verb_forms;

  if (!frontSentence || !backSentence || (isPhrasalVerb(sheet) && (!forms?.base || !forms.gerund || !forms.past))) return null;

  const card = {
    front: frontSentence,
    back: isPhrasalVerb(sheet)
      ? `${backSentence}\n${example.pt.trim()}`
      : `${backSentence}\n${sheet.ipa.trim()}\n${example.pt.trim()}`
  };
  return validateCanonicalCard(card.front, card.back, sheet.type).length === 0 ? card : null;
}

export function validateCanonicalCard(
  front: string,
  back: string,
  type?: ContentType
): string[] {
  const issues: string[] = [];
  const normalizedType = type || 'vocabulary';
  const isPhrase = normalizedType === 'survival_phrase' || normalizedType === 'personal_phrase';
  const isPv = normalizedType === 'phrasal_verb';

  if (ANKI_MARKUP_PATTERN.test(front) || ANKI_MARKUP_PATTERN.test(back)) {
    issues.push('O card canônico deve conter somente texto; não inclua áudio nem campos reversos do Anki.');
  }

  const gapCount = front.match(GAP_PATTERN)?.length || 0;
  const backLines = back.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (isPhrase) {
    if (gapCount !== 1) issues.push('A frase de sobrevivência deve ter uma única lacuna significativa.');
    const frontLines = front.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const canonicalGapCount = front.match(CANONICAL_GAP)?.length || 0;
    const parentheticalParts = front.match(PARENTHETICAL_PATTERN) || [];
    if (frontLines.length !== 2 || !frontLines[1]) issues.push('Inclua somente a frase com lacuna e a tradução completa na frente.');
    if (canonicalGapCount !== 1 || parentheticalParts.length !== 1 || parentheticalParts[0] !== '(..?)') {
      issues.push('A lacuna deve ser normalizada exatamente como (..?).');
    }
    if (backLines.length !== 1) issues.push('O verso da frase de sobrevivência deve conter somente a frase completa em inglês.');
    if (backLines[0]?.match(GAP_PATTERN)) issues.push('A frase completa do verso não pode conter lacuna.');
  } else {
    const hints = front.match(PARENTHETICAL_PATTERN) || [];
    if (hints.length !== 1) issues.push('A frente precisa conter uma única pista entre parênteses.');
    if (isPv) {
      if (!front.includes('PV:')) issues.push('A frente do phrasal verb deve indicar o sentido com “PV:”.');
      const looksLikeLegacyVerbForms = (backLines[0] || '').split(' — ').length === 3;
      if (backLines.length !== 2 || looksLikeLegacyVerbForms || !backLines[0] || !backLines[1]) {
        issues.push('O verso do phrasal verb deve conter somente a frase completa em inglês e a tradução.');
      }
    } else if (
      front.includes('PV:') ||
      backLines.length !== 3 ||
      backLines[0]?.match(PARENTHETICAL_PATTERN) ||
      !backLines[1]?.match(/^\/[^\/\n]+\/$/) ||
      !backLines[2]
    ) {
      issues.push('O verso do vocabulário deve conter frase completa, IPA e tradução da frase.');
    }

  }

  return issues.slice(0, 3);
}

export function validateStudySheet(sheet: StudySheet): string[] {
  const issues: string[] = [];
  const survival = isSurvivalPhrase(sheet);
  const pv = isPhrasalVerb(sheet);

  if (!sheet.term?.trim()) issues.push('O termo está vazio.');
  if (!sheet.translation?.trim()) issues.push('Falta o significado principal.');
  if (!sheet.ipa?.trim()) issues.push('Falta a pronúncia IPA.');

  if (survival) {
    const gap = sheet.strategic_gap;
    const gapCount = gap?.gap_sentence?.match(GAP_PATTERN)?.length || 0;
    const expectedChunk = normalizedWords(gap?.expected_chunk || '');
    const answerSentence = normalizedWords(sheet.term || '');
    if (!gap || gapCount !== 1 || !expectedChunk || !answerSentence.includes(expectedChunk)) {
      issues.push('A frase de sobrevivência precisa de uma única lacuna estratégica válida.');
    }
  } else if (!sheet.examples?.some(example => replaceTerm(example.en, sheet.term, sheet.term))) {
    issues.push('É necessário um exemplo natural que contenha exatamente o termo estudado.');
  }

  if (pv) {
    const info = sheet.phrasal_verb_info;
    if (!info?.primary_meaning || !info.verb_forms?.base || !info.verb_forms?.gerund || !info.verb_forms?.past || !info.object_pattern || !info.separability || !info.transitivity) {
      issues.push('O phrasal verb precisa informar sentido, formas, estrutura, separabilidade e transitividade.');
    }
  }

  return issues;
}
