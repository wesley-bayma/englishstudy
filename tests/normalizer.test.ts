import { describe, expect, it } from 'vitest';
import { normalizeContent } from '../lib/normalizer';

describe('content normalization', () => {
  it('keeps spaces in complete phrases while removing punctuation', () => {
    expect(normalizeContent('Can I get a receipt, please?')).toBe('can i get a receipt please');
  });
});
