import { ContentItem } from './types';

/**
 * Picks the next pending card from a stable queue snapshot. The caller keeps
 * this result while IndexedDB updates the current card, so a parent rerender
 * cannot change or cancel the intended navigation target.
 */
export function getNextQueueItem(queueItems: ContentItem[], itemId: string): ContentItem | null {
  const currentQueueIndex = queueItems.findIndex(queueItem => queueItem.id === itemId);
  if (currentQueueIndex < 0) return null;

  return queueItems.find((queueItem, index) => (
    index > currentQueueIndex && queueItem.anki_status !== 'created'
  )) || queueItems[currentQueueIndex + 1] || null;
}
