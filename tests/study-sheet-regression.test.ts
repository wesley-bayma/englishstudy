import { describe, expect, it } from 'vitest';
import { validateParsedStudySheet } from '../lib/ai-validation';

describe('study sheet regression contracts', () => {
  it('accepts the vocabulary term from the reported failure', () => {
    const result = validateParsedStudySheet({
      term: 'regular',
      ipa: '/ˈreɡ.jə.lɚ/',
      grammatical_class: 'adjetivo',
      translation: 'regular, comum',
      examples: [{ en: 'I have a regular checkup every year.', pt: 'Eu faço um check-up regular todos os anos.' }],
      tip_warning: 'Use regular conforme o contexto.'
    }, 'vocabulary');

    expect(result).toMatchObject({ ok: true });
  });

  it('accepts the complete survival phrase from the reported failure', () => {
    const result = validateParsedStudySheet({
      term: 'Can I get a receipt, please?',
      ipa: '/kæn aɪ ɡet ə rɪˈsiːt pliːz/',
      grammatical_class: 'frase de sobrevivência',
      translation: 'Posso receber um recibo, por favor?',
      strategic_gap: {
        gap_sentence: 'Can I get (_____), please?',
        expected_chunk: 'a receipt'
      },
      variations: [{ en: 'Could I have a receipt, please?', pt: 'Eu poderia receber um recibo, por favor?' }],
      tip_warning: 'Use please para manter o pedido educado.'
    }, 'survival_phrase');

    expect(result).toMatchObject({ ok: true });
  });

  it('requires the phrasal-verb metadata instead of accepting a partial AI response', () => {
    const result = validateParsedStudySheet({
      term: 'go on',
      ipa: '/ɡoʊ ɑːn/',
      grammatical_class: 'phrasal verb',
      translation: 'continuar',
      examples: [{ en: 'Please go on.', pt: 'Por favor, continue.' }],
      tip_warning: 'Use go on para continuar.'
    }, 'phrasal_verb');

    expect(result).toMatchObject({ ok: false });
  });
});
