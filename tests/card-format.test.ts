import { describe, expect, it } from 'vitest';
import { buildCanonicalCard, validateCanonicalCard, validateStudySheet } from '../lib/card-format';
import { StudySheet } from '../lib/types';

function sheet(overrides: Partial<StudySheet>): StudySheet {
  return {
    term: 'apple',
    type: 'vocabulary',
    ipa: '/ˈæpəl/',
    grammatical_class: 'substantivo',
    translation: 'maçã',
    examples: [{ en: 'I like apple.', pt: 'Eu gosto de maçã.' }],
    tip_warning: '',
    ...overrides
  };
}

describe('canonical Anki card format', () => {
  it('mirrors a vocabulary target and includes the sentence translation and IPA on the back', () => {
    expect(buildCanonicalCard(sheet({}))).toEqual({
      front: 'I like (maçã).',
      back: 'I like apple.\n/ˈæpəl/\nEu gosto de maçã.'
    });
  });

  it('uses a natural example containing the target instead of inventing one', () => {
    expect(buildCanonicalCard(sheet({
      examples: [
        { en: 'This sentence has no target.', pt: 'Sem o termo.' },
        { en: 'She bought an apple.', pt: 'Ela comprou uma maçã.' }
      ]
    }))).toEqual({
      front: 'She bought an (maçã).',
      back: 'She bought an apple.\n/ˈæpəl/\nEla comprou uma maçã.'
    });
  });

  it('does not create a card when no vocabulary example contains the term', () => {
    expect(buildCanonicalCard(sheet({
      examples: [{ en: 'This sentence is unrelated.', pt: 'Frase sem relação.' }]
    }))).toBeNull();
  });

  it('keeps one meaningful gap for a survival phrase', () => {
    expect(buildCanonicalCard(sheet({
      term: 'Could you speak more slowly?',
      type: 'survival_phrase',
      ipa: '/kʊd juː spiːk mɔːr ˈsloʊ.li/',
      grammatical_class: 'frase de sobrevivência',
      translation: 'Você poderia falar mais devagar?',
      strategic_gap: {
        gap_sentence: 'Could you speak (_____) ?',
        expected_chunk: 'more slowly'
      },
      examples: []
    }))).toEqual({
      front: 'Could you speak (_____) ?\nVocê poderia falar mais devagar?',
      back: 'Could you speak more slowly?\n/kʊd juː spiːk mɔːr ˈsloʊ.li/\nVocê poderia falar mais devagar?'
    });
  });

  it('formats a phrasal verb with its prioritized meaning', () => {
    expect(buildCanonicalCard(sheet({
      term: 'find out',
      type: 'phrasal_verb',
      ipa: '/faɪnd aʊt/',
      grammatical_class: 'phrasal verb',
      translation: 'descobrir',
      examples: [{ en: 'I need to find out the truth.', pt: 'Preciso descobrir a verdade.' }]
    }))).toEqual({
      front: 'I need to (PV: descobrir) the truth.',
      back: 'I need to find out the truth.\n/faɪnd aʊt/\nPreciso descobrir a verdade.'
    });
  });

  it('rejects the old audio label and validates the three card types', () => {
    expect(validateCanonicalCard(
      'I like (maçã).',
      'I like (apple).\n/ˈæpəl/\nEu gosto de maçã.\nÁudio no verso.',
      'vocabulary'
    )).toContain('Remova o texto de áudio do card; deixe apenas o IPA.');

    expect(validateCanonicalCard(
      'Could you speak (_____) ?\nVocê poderia falar mais devagar?',
      'Could you speak more slowly?\n/kʊd juː spiːk mɔːr ˈsloʊ.li/\nVocê poderia falar mais devagar?',
      'survival_phrase'
    )).toEqual([]);
  });

  it('requires the IPA to remain on the second line of the back', () => {
    expect(validateCanonicalCard(
      'I like (maçã).',
      'I like (apple).\nEu gosto de maçã.\n/ˈæpəl/',
      'vocabulary'
    )).toContain('O IPA deve ser a segunda linha do verso.');
  });

  it('requires syntactic metadata for phrasal verbs', () => {
    expect(validateStudySheet(sheet({
      term: 'find out',
      type: 'phrasal_verb',
      grammatical_class: 'phrasal verb',
      translation: 'descobrir',
      examples: [{ en: 'I need to find out.', pt: 'Preciso descobrir.' }]
    }))).toContain('O phrasal verb precisa informar sentido, estrutura, separabilidade e transitividade.');
  });

  it('rejects a survival phrase with more than one gap', () => {
    expect(validateStudySheet(sheet({
      term: 'Could you help me?',
      type: 'survival_phrase',
      grammatical_class: 'frase de sobrevivência',
      translation: 'Você poderia me ajudar?',
      strategic_gap: {
        gap_sentence: 'Could (_____) help (_____)?',
        expected_chunk: 'you'
      },
      examples: []
    }))).toContain('A frase de sobrevivência precisa de uma única lacuna estratégica válida.');
  });
});
