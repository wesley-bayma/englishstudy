/**
 * Deterministic normalization for vocabulary, phrases, and phrasal verbs.
 * Strips punctuation, trims, lowercases, standardizes whitespace and quotes.
 */
export function normalizeContent(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    // Replace smart quotes and apostrophes with standard single quote or remove
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    // Remove punctuation like .,!?:;*()[]{}/#$
    .replace(/[.,!?:;*()[\]{}/#$^\-_+=~|<>"]/g, '')
    // Collapse all whitespace (spaces, tabs, newlines) into a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns heuristic candidate lemmas for basic English suffixes.
 * Fast deterministic check before calling AI.
 * Examples:
 * - "running" -> ["run", "running"]
 * - "swimming" -> ["swim", "swimming"]
 * - "walked" -> ["walk", "walked"]
 * - "plays" -> ["play", "plays"]
 * - "categories" -> ["category", "categories"]
 */
export function getBasicLemmaCandidates(normalized: string): string[] {
  const candidates = new Set<string>();
  candidates.add(normalized);

  // If multi-word (e.g. phrasal verb or phrase), try the first word
  const words = normalized.split(' ');
  if (words.length > 1) {
    const headWord = words[0];
    const headCandidates = getWordMorphologyCandidates(headWord);
    for (const hc of headCandidates) {
      const remaining = words.slice(1).join(' ');
      candidates.add(`${hc} ${remaining}`);
    }
  } else {
    const wordCandidates = getWordMorphologyCandidates(normalized);
    for (const wc of wordCandidates) {
      candidates.add(wc);
    }
  }

  return Array.from(candidates);
}

function getWordMorphologyCandidates(word: string): string[] {
  const c = new Set<string>();
  if (word.length <= 2) return [word];

  // -ing endings
  if (word.endsWith('ing') && word.length > 4) {
    const baseIng = word.slice(0, -3);
    c.add(baseIng); // e.g. asking -> ask
    c.add(baseIng + 'e'); // e.g. making -> make
    // doubled consonant: e.g. running -> run, swimming -> swim, hitting -> hit
    if (baseIng.length > 1 && baseIng[baseIng.length - 1] === baseIng[baseIng.length - 2]) {
      c.add(baseIng.slice(0, -1)); // running -> run
    }
  }

  // -ed endings
  if (word.endsWith('ed') && word.length > 3) {
    const baseEd = word.slice(0, -2);
    c.add(baseEd); // walked -> walk
    c.add(word.slice(0, -1)); // loved -> love
    if (baseEd.length > 1 && baseEd[baseEd.length - 1] === baseEd[baseEd.length - 2]) {
      c.add(baseEd.slice(0, -1)); // stopped -> stop
    }
    if (word.endsWith('ied') && word.length > 4) {
      c.add(word.slice(0, -3) + 'y'); // studied -> study
    }
  }

  // -s / -es / -ies endings
  if (word.endsWith('ies') && word.length > 4) {
    c.add(word.slice(0, -3) + 'y'); // categories -> category, tries -> try
  } else if (word.endsWith('es') && word.length > 3) {
    c.add(word.slice(0, -2)); // watches -> watch, boxes -> box
    c.add(word.slice(0, -1)); // smiles -> smile
  } else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    c.add(word.slice(0, -1)); // runs -> run, books -> book
  }

  // -ly endings
  if (word.endsWith('ly') && word.length > 4) {
    c.add(word.slice(0, -2)); // quickly -> quick
    if (word.endsWith('ily') && word.length > 4) {
      c.add(word.slice(0, -3) + 'y'); // happily -> happy
    }
  }

  return Array.from(c);
}
