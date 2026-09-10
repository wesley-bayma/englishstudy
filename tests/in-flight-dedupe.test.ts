import { describe, expect, it } from 'vitest';
import { getInFlightCount, withInFlightDeduplication } from '../lib/in-flight-dedupe';

describe('in-flight request deduplication', () => {
  it('shares concurrent work and removes it after settlement', async () => {
    let calls = 0;
    let release!: () => void;
    const pending = new Promise<string>(resolve => { release = () => resolve('ready'); });
    const factory = () => {
      calls += 1;
      return pending;
    };

    const first = withInFlightDeduplication('same-card', factory);
    const second = withInFlightDeduplication('same-card', factory);
    expect(first).toBe(second);
    expect(calls).toBe(1);
    expect(getInFlightCount()).toBe(1);

    release();
    await expect(first).resolves.toBe('ready');
    await Promise.resolve();
    expect(getInFlightCount()).toBe(0);

    await expect(withInFlightDeduplication('same-card', async () => {
      calls += 1;
      return 'fresh';
    })).resolves.toBe('fresh');
    expect(calls).toBe(2);
  });
});
