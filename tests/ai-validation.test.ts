import { describe, expect, it } from 'vitest';
import { parseAIAnalysis, parseCardReview, validateParsedStudySheet } from '../lib/ai-validation';

const validSheet = {
  term: 'building',
  ipa: '/ˈbɪldɪŋ/',
  grammatical_class: 'substantivo',
  translation: 'construção',
  examples: [{ en: 'The building is very tall.', pt: 'O prédio é muito alto.' }],
  tip_warning: 'Use building para falar de uma construção ou prédio.'
};

describe('AI response validation', () => {
  it('accepts a complete study sheet and rejects malformed nested data', () => {
    expect(validateParsedStudySheet(validSheet, 'vocabulary')).toMatchObject({ ok: true });
    expect(validateParsedStudySheet({ ...validSheet, examples: [{ en: 'missing translation' }] }, 'vocabulary')).toMatchObject({ ok: false });
  });

  it('validates the analysis contract and numeric confidence range', () => {
    const result = parseAIAnalysis({
      classification: 'vocabulary',
      base_form: 'build',
      has_possible_match: false,
      matched_existing_content: null,
      similarity_type: 'none',
      confidence: 0.8,
      meaning_pt: 'construir',
      explanation: 'Forma válida.',
      suggested_example: ''
    });
    expect(result.ok).toBe(true);
    expect(parseAIAnalysis({ ...result.ok ? result.data : {}, confidence: 2 })).toMatchObject({ ok: false });
    expect(parseAIAnalysis({ ...result.ok ? result.data : {}, base_form: undefined })).toMatchObject({ ok: false });
  });

  it('validates the card review contract and observation limit', () => {
    expect(parseCardReview({
      status: 'good',
      status_label: '✅ Bom',
      score: 90,
      observations: ['Tudo certo.'],
      summary: 'Card adequado.'
    })).toMatchObject({ ok: true });
    expect(parseCardReview({
      status: 'good',
      status_label: '✅ Bom',
      score: 90,
      observations: ['1', '2', '3', '4'],
      summary: 'Card adequado.'
    })).toMatchObject({ ok: false });
  });
});
