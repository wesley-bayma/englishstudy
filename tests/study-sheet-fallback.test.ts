import { describe, expect, it } from 'vitest';
import { buildUnavailableStudySheet } from '../lib/study-sheet-fallback';

describe('study sheet safe fallback', () => {
  it('returns only explicit input and status labels', () => {
    const sheet = buildUnavailableStudySheet('regular', 'vocabulary', 'regular, comum');

    expect(sheet).toMatchObject({
      term: 'regular',
      type: 'vocabulary',
      isFallback: true,
      translation: 'regular, comum',
      ipa: 'Pronúncia pendente'
    });
    expect(sheet.examples).toBeUndefined();
    expect(sheet.collocations).toBeUndefined();
    expect(sheet.related_words).toBeUndefined();
    expect(sheet.fallbackMessage).toContain('nenhum exemplo');
  });

  it('does not invent a translation when none was supplied', () => {
    const sheet = buildUnavailableStudySheet('Can I get a receipt, please?', 'survival_phrase', '');

    expect(sheet.translation).toBe('Tradução pendente');
    expect(sheet.strategic_gap).toBeUndefined();
    expect(sheet.variations).toBeUndefined();
  });

  it('preserves a user-provided IPA during provider fallback', () => {
    const sheet = buildUnavailableStudySheet('regular', 'vocabulary', 'regular, comum', '/ˈreɡ.jə.lɚ/');

    expect(sheet.ipa).toBe('/ˈreɡ.jə.lɚ/');
  });
});
