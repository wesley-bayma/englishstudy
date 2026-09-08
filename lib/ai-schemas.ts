export const STUDY_SHEET_JSON_SCHEMA = {
  name: 'study_sheet',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      term: { type: 'string' },
      ipa: { type: 'string' },
      grammatical_class: { type: 'string' },
      translation: { type: 'string' },
      connotation_usage: { type: 'string' },
      useful_structures: { type: 'array', items: { type: 'string' } },
      collocations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { en: { type: 'string' }, pt: { type: 'string' } },
          required: ['en', 'pt']
        }
      },
      examples: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { en: { type: 'string' }, pt: { type: 'string' } },
          required: ['en', 'pt']
        }
      },
      related_words: { type: 'array', items: { type: 'string' } },
      phrasal_verb_info: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primary_meaning: { type: 'string' },
          separability: { type: 'string', enum: ['separable', 'inseparable', 'both', 'not_applicable'] },
          transitivity: { type: 'string', enum: ['transitive', 'intransitive', 'both'] },
          object_pattern: { type: 'string' },
          pronoun_rule: { type: 'string' }
        },
        required: ['primary_meaning', 'separability', 'transitivity', 'object_pattern']
      },
      pattern: { type: 'string' },
      variations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { en: { type: 'string' }, pt: { type: 'string' } },
          required: ['en', 'pt']
        }
      },
      strategic_gap: {
        type: 'object',
        additionalProperties: false,
        properties: {
          gap_sentence: { type: 'string' },
          expected_chunk: { type: 'string' },
          explanation: { type: 'string' }
        },
        required: ['gap_sentence', 'expected_chunk']
      },
      tip_warning: { type: 'string' }
    },
    required: ['term', 'ipa', 'grammatical_class', 'translation', 'tip_warning']
  }
} as const;

export const AI_ANALYSIS_JSON_SCHEMA = {
  name: 'ai_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      classification: { type: 'string', enum: ['vocabulary', 'survival_phrase', 'phrasal_verb', 'personal_phrase', 'personal_vocabulary'] },
      base_form: { type: ['string', 'null'] },
      has_possible_match: { type: 'boolean' },
      matched_existing_content: { type: ['string', 'null'] },
      similarity_type: { type: 'string', enum: ['exact', 'inflection', 'semantic_similarity', 'synonym', 'none'] },
      confidence: { type: 'number' },
      meaning_pt: { type: 'string' },
      explanation: { type: 'string' },
      suggested_example: { type: 'string' }
    },
    required: ['classification', 'base_form', 'has_possible_match', 'matched_existing_content', 'similarity_type', 'confidence', 'meaning_pt', 'explanation', 'suggested_example']
  }
} as const;

export const CARD_REVIEW_JSON_SCHEMA = {
  name: 'card_review',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['good', 'improvable', 'bad'] },
      status_label: { type: 'string', enum: ['✅ Bom', '⚠️ Pode melhorar', '❌ Problema importante'] },
      score: { type: 'number' },
      observations: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' }
    },
    required: ['status', 'status_label', 'score', 'observations', 'summary']
  }
} as const;
