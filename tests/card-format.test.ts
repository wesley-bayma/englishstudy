import { describe, expect, it } from 'vitest';
import { buildCanonicalCard, formatCanonicalCardForClipboard, validateCanonicalCard, validateStudySheet } from '../lib/card-format';
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
  it('uses the manual vocabulary format: Portuguese hint, sentence, IPA and sentence translation', () => {
    expect(buildCanonicalCard(sheet({
      term: 'wallet',
      ipa: '/ˈwɑː.lət/',
      translation: 'carteira',
      examples: [{ en: 'I forgot my wallet again.', pt: 'Esqueci minha carteira de novo.' }]
    }))).toEqual({
      front: 'I forgot my (carteira) again.',
      back: 'I forgot my wallet again.\n/ˈwɑː.lət/\nEsqueci minha carteira de novo.'
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

  it('uses the declared vocabulary type even when legacy phrase fields are present', () => {
    expect(buildCanonicalCard(sheet({
      term: 'wallet',
      ipa: '/ˈwɑː.lət/',
      translation: 'carteira',
      examples: [{ en: 'I forgot my wallet again.', pt: 'Esqueci minha carteira de novo.' }],
      strategic_gap: { gap_sentence: 'I forgot my (_____ ) again.', expected_chunk: 'wallet' }
    }))).toEqual({
      front: 'I forgot my (carteira) again.',
      back: 'I forgot my wallet again.\n/ˈwɑː.lət/\nEsqueci minha carteira de novo.'
    });
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
      'I like apple.\n/ˈæpəl/\nEu gosto de maçã.',
      'vocabulary'
    )).toEqual([]);

    expect(validateCanonicalCard(
      'Could you speak (..?)?\nVocê poderia falar mais devagar?',
      'Could you speak more slowly?',
      'survival_phrase'
    )).toEqual([]);
  });

  it('requires sentence, IPA and translation on the vocabulary back', () => {
    expect(validateCanonicalCard(
      'I like (maçã).',
      'apple /ˈæpəl/\nI like apple.',
      'vocabulary'
    )).toContain('O verso do vocabulário deve conter frase completa, IPA e tradução da frase.');
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

  it('rejects a survival phrase whose answer does not contain the expected chunk', () => {
    expect(buildCanonicalCard(sheet({
      term: 'Could you repeat that?',
      type: 'survival_phrase',
      grammatical_class: 'frase de sobrevivência',
      translation: 'Você poderia repetir?',
      strategic_gap: {
        gap_sentence: 'Could you speak (_____)?',
        expected_chunk: 'more slowly'
      },
      examples: []
    }))).toBeNull();
  });

  it('requires exactly one vocabulary hint and rejects Anki/audio markup', () => {
    expect(validateCanonicalCard(
      'I forgot my (carteira) (again).',
      'wallet /ˈwɑː.lət/\nI forgot my wallet again.',
      'vocabulary'
    )).toContain('A frente precisa conter uma única pista entre parênteses.');

    expect(validateCanonicalCard(
      'I forgot my (carteira) again.',
      'I forgot my wallet again.\n/ˈwɑː.lət/\n[sound:wallet.mp3]',
      'vocabulary'
    )).toContain('O card canônico deve conter somente texto; não inclua áudio nem campos reversos do Anki.');
  });

  it('formats the complete card for manual clipboard copying without reversed fields', () => {
    const card = buildCanonicalCard(sheet({
      term: 'wallet',
      ipa: '/ˈwɑː.lət/',
      translation: 'carteira',
      examples: [{ en: 'I forgot my wallet again.', pt: 'Esqueci minha carteira de novo.' }]
    }));

    expect(card).not.toBeNull();
    expect(formatCanonicalCardForClipboard(card!)).toBe(
      'Frente:\nI forgot my (carteira) again.\n\nVerso:\nI forgot my wallet again.\n/ˈwɑː.lət/\nEsqueci minha carteira de novo.'
    );
    expect(formatCanonicalCardForClipboard(card!)).not.toContain('Basic (and reversed card)');
    expect(formatCanonicalCardForClipboard(card!)).not.toContain('[sound:');
  });
});
