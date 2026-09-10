import type { ContentType, StudySheet } from './types';

const TYPE_LABELS: Record<ContentType, string> = {
  vocabulary: 'Vocabulário',
  survival_phrase: 'Frase de sobrevivência',
  phrasal_verb: 'Phrasal verb',
  personal_phrase: 'Frase pessoal',
  personal_vocabulary: 'Vocabulário pessoal'
};

/**
 * Safe, intentionally incomplete sheet used when both AI providers fail.
 * It contains only the user's input and explicit status labels; it must never
 * invent pronunciation, examples, translations, or grammatical facts.
 */
export function buildUnavailableStudySheet(
  term: string,
  type: ContentType,
  meaningPt: string
): StudySheet {
  return {
    term,
    type,
    isFallback: true,
    fallbackMessage: 'A IA está indisponível no momento. Exibimos somente os dados informados; nenhum exemplo ou informação foi inventado.',
    ipa: 'Pronúncia pendente',
    grammatical_class: `${TYPE_LABELS[type]} — classificação pendente`,
    translation: meaningPt.trim() || 'Tradução pendente',
    tip_warning: 'Ficha básica temporária. Tente novamente quando a IA estiver disponível para completar a pronúncia, o uso e os exemplos.'
  };
}
