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
  it('uses the manual vocabulary format: Portuguese hint, term with IPA and full English sentence', () => {
    expect(buildCanonicalCard(sheet({
      term: 'wallet',
      ipa: '/ˈwɑː.lət/',
      translation: 'carteira',
      examples: [{ en: 'I forgot my wallet again.', pt: 'Esqueci minha carteira de novo.' }]
    }))).toEqual({
      front: 'I forgot my (carteira) again.',
      back: 'wallet /ˈwɑː.lət/\nI forgot my wallet again.'
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
      back: 'apple /ˈæpəl/\nShe bought an apple.'
    });
  });

  it('does not create a card when no vocabulary example contains the term', () => {
    expect(buildCanonicalCard(sheet({
      examples: [{ en: 'This sentence is unrelated.', pt: 'Frase sem relação.' }]
    }))).toBeNull();
  });

  it('keeps one normalized strategic gap for a survival phrase', () => {
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
      front: 'Could you speak (..?)?\nVocê poderia falar mais devagar?',
      back: 'Could you speak more slowly?'
    });
  });

  it('formats a phrasal verb with its prioritized meaning', () => {
    expect(buildCanonicalCard(sheet({
      term: 'find out',
      type: 'phrasal_verb',
      ipa: '/faɪnd aʊt/',
      grammatical_class: 'phrasal verb',
      translation: 'descobrir',
      examples: [{ en: 'I need to find out the truth.', pt: 'Preciso descobrir a verdade.' }],
      phrasal_verb_info: {
        primary_meaning: 'descobrir',
        verb_forms: { base: 'find out', gerund: 'finding out', past: 'found out' },
        separability: 'separable',
        transitivity: 'transitive',
        object_pattern: 'find out + information'
      }
    }))).toEqual({
      front: 'I need to (PV: descobrir) the truth.',
      back: 'find out — finding out — found out\nI need to find out the truth.'
    });
  });

  it('validates the three card types without legacy fields on their backs', () => {
    expect(validateCanonicalCard(
      'I like (maçã).',
      'apple /ˈæpəl/\nI like apple.',
      'vocabulary'
    )).toEqual([]);

    expect(validateCanonicalCard(
      'Could you speak (..?)?\nVocê poderia falar mais devagar?',
      'Could you speak more slowly?',
      'survival_phrase'
    )).toEqual([]);
  });

  it('requires term and IPA on the first vocabulary back line', () => {
    expect(validateCanonicalCard(
      'I like (maçã).',
      'I like apple.\n/ˈæpəl/',
      'vocabulary'
    )).toContain('O verso do vocabulário deve conter “termo IPA” e a frase completa em inglês.');
  });

  it('requires syntactic metadata for phrasal verbs', () => {
    expect(validateStudySheet(sheet({
      term: 'find out',
      type: 'phrasal_verb',
      grammatical_class: 'phrasal verb',
      translation: 'descobrir',
      examples: [{ en: 'I need to find out.', pt: 'Preciso descobrir.' }]
    }))).toContain('O phrasal verb precisa informar sentido, formas, estrutura, separabilidade e transitividade.');
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
