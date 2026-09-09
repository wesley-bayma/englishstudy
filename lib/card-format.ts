import { ContentType, StudySheet } from './types';

export interface CanonicalCard {
  front: string;
  back: string;
}

const GAP_PATTERN = /\(\s*(?:_{2,}|\.{2,}\?)\s*\)|\[\s*\.{2,}\s*\]|_{2,}/g;

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

function primaryMeaning(translation: string): string {
  return (translation || '')
    .split(/[;,/]/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function isSurvivalPhrase(sheet: StudySheet): boolean {
  return sheet.type === 'survival_phrase' ||
    sheet.type === 'personal_phrase' ||
    Boolean(sheet.strategic_gap || sheet.pattern) ||
    (sheet.grammatical_class || '').toLowerCase().includes('frase');
}

function isPhrasalVerb(sheet: StudySheet): boolean {
  return sheet.type === 'phrasal_verb' ||
    (sheet.grammatical_class || '').toLowerCase().includes('phrasal');
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

    const translation = sheet.translation.trim();
    return {
      front: `${normalizeStrategicGap(gap.gap_sentence)}\n${translation}`.trim(),
      back: sheet.term.trim()
    };
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

  return {
    front: frontSentence,
    back: isPhrasalVerb(sheet)
      ? `${forms!.base.trim()} — ${forms!.gerund.trim()} — ${forms!.past.trim()}\n${backSentence}`
      : `${sheet.term.trim()} ${sheet.ipa.trim()}\n${backSentence}`
  };
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

  const gapCount = front.match(GAP_PATTERN)?.length || 0;
  const backLines = back.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (isPhrase) {
    if (gapCount !== 1) issues.push('A frase de sobrevivência deve ter uma única lacuna significativa.');
    if (!front.includes('\n')) issues.push('Inclua a tradução completa abaixo da frase na frente.');
    if (backLines.length !== 1) issues.push('O verso da frase de sobrevivência deve conter somente a frase completa em inglês.');
  } else {
    if (!front.match(/\([^()]+\)/)) issues.push('A frente precisa conter uma única pista entre parênteses.');
    if (backLines[0]?.match(/\([^()]+\)/)) {
      issues.push('A frase em inglês do verso não deve conter o termo entre parênteses.');
    }
    if (isPv) {
      if (!front.includes('PV:')) issues.push('A frente do phrasal verb deve indicar o sentido com “PV:”.');
      if (backLines.length !== 2 || !backLines[0]?.includes(' — ')) {
        issues.push('O verso do phrasal verb deve conter as formas base, gerúndio e passado e a frase em inglês.');
      }
    } else if (backLines.length !== 2 || !backLines[0]?.match(/\/[^\/\n]+\//)) {
      issues.push('O verso do vocabulário deve conter “termo IPA” e a frase completa em inglês.');
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
    if (!gap || gapCount !== 1 || !gap.expected_chunk?.trim()) {
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
