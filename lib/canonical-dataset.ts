/**
 * Counts for the checked-in canonical dataset. Keep these values in sync with
 * data/seed-data.json; the seed-data test guards against accidental drift.
 */
export const CANONICAL_DATASET_COUNTS = {
  vocabulary: 10_000,
  survival_phrase: 133,
  phrasal_verb: 178
} as const;

export const CANONICAL_DATASET_TOTAL =
  CANONICAL_DATASET_COUNTS.vocabulary +
  CANONICAL_DATASET_COUNTS.survival_phrase +
  CANONICAL_DATASET_COUNTS.phrasal_verb;
