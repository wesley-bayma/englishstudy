import { describe, expect, it } from 'vitest';
import seedData from '../data/seed-data.json';

function key(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,!?:;*()[\]{}/#$^\-_+=~|<>"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('canonical seed dataset', () => {
  it('contains 10,000 vocabulary words and preserves the first three', () => {
    const vocabulary = seedData.filter(item => item.type === 'vocabulary');

    expect(vocabulary).toHaveLength(10000);
    expect(vocabulary.slice(0, 3).map(item => item.content)).toEqual([
      'motivation',
      'complete',
      'income'
    ]);
  });

  it('does not repeat newly added vocabulary with the existing dataset', () => {
    const vocabulary = seedData.filter(item => item.type === 'vocabulary');
    const originalSeedItems = seedData.filter(item => {
      const match = item.id.match(/^base_(?:vocab|phrase|pv)_(\d+)$/);
      if (!match) return true;

      const originalLimit = item.id.startsWith('base_vocab_')
        ? 3000
        : item.id.startsWith('base_phrase_')
          ? 100
          : 150;
      return Number(match[1]) <= originalLimit;
    });
    const existingKeys = new Set(originalSeedItems.map(item => key(item.content)));
    const addedKeys = vocabulary.slice(3000).map(item => key(item.content));

    expect(new Set(addedKeys).size).toBe(addedKeys.length);
    expect(addedKeys.every(item => !existingKeys.has(item))).toBe(true);
  });

  it('contains daily survival phrases and phrasal verbs', () => {
    expect(seedData.filter(item => item.type === 'survival_phrase').length).toBeGreaterThanOrEqual(133);
    expect(seedData.filter(item => item.type === 'phrasal_verb').length).toBeGreaterThanOrEqual(178);
  });
});
