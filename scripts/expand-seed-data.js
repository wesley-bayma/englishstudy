const fs = require('node:fs/promises');
const path = require('node:path');

const SEED_PATH = path.resolve(__dirname, '..', 'data', 'seed-data.json');
const VOCABULARY_SOURCE =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt';
const TARGET_VOCABULARY_COUNT = 10000;
const SEED_DATE = '2026-08-27T00:00:00.000Z';

// These are corpus entries that are useful for ranking but not useful as
// standalone learner vocabulary in this app (abbreviations, domains, etc.).
const OBVIOUS_NON_WORDS = new Set([
  'al', 'am', 'ca', 'co', 'com', 'dr', 'edu', 'faq', 'id', 'ii', 'inc', 'la',
  'mr', 'mrs', 'ms', 'net', 'ny', 'pc', 'pdf', 'pm', 'q', 'rss', 'st', 'tv',
  'www', 'x', 'z'
]);

const SURVIVAL_PHRASES = [
  'Excuse me, could you help me?',
  "I'm lost. Can you help me?",
  'Could you say that again, please?',
  'Could you speak a little more slowly?',
  "I don't understand.",
  'Do you speak English?',
  'What does this mean?',
  'How do you pronounce this?',
  'Could you write it down, please?',
  'Can you show me on the map?',
  'How do I get to the city center?',
  'Is it within walking distance?',
  'Which way is the train station?',
  'Where can I buy a bus ticket?',
  'What time does the bus leave?',
  'Does this bus go downtown?',
  'Where can I catch a taxi?',
  'Could you take me to this address?',
  'How much is the fare?',
  "I'd like to check in, please.",
  'I have a reservation under this name.',
  'What time is check-out?',
  'Could I have another key, please?',
  'Could I get some more towels, please?',
  'Is breakfast included?',
  'What time is breakfast served?',
  'Is there Wi-Fi in the room?',
  'Could you call a taxi for me?',
  "I'd like a table for two, please.",
  'Could we see the menu, please?',
  'What do you recommend?',
  "I'm allergic to peanuts.",
  'Could I have this without onions?',
  'Could I have the bill, please?',
  'Can I pay by card?',
  'Could I get this to go?',
  'Do you have this in a different size?',
  'Can I try this on?',
  'Do you have this in another color?',
  'Is this on sale?',
  'Could I have a receipt, please?',
  'I need to cancel my reservation.',
  "My room key doesn't work.",
  "I think there's a mistake on the bill.",
  'I need to see a doctor.',
  'Where is the nearest pharmacy?',
  'Please call an ambulance.',
  "I've lost my passport.",
  'Can you help me contact the police?',
  'Could you wait a moment, please?'
];

const PHRASAL_VERBS = [
  'take care of', 'look for', 'look after', 'get along with', 'run out of',
  'deal with', 'wake up', 'calm down', 'fill out', 'hand in', 'check in',
  'check out', 'log in', 'sign up', 'hang up', 'hold on', 'hurry up',
  'slow down', 'turn on', 'turn off', 'turn down', 'turn up', 'put on',
  'try on', 'bring back', 'give back', 'pay back', 'call back', 'leave out',
  'sort out', 'set off', 'show around', 'drop off', 'let down', 'break down',
  'break up', 'carry on', 'keep up', 'move on', 'go ahead', 'back up',
  'look forward to', 'look into', 'come across', 'run into', 'get over',
  'take over', 'take up', 'cut down on', 'make up', 'put away', 'put off',
  'put up with', 'get rid of'
];

function normalizedKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?:;*()[\]{}/#$^\-_+=~|<>"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createBaseItem({ id, content, type, originalOrder }) {
  return {
    id,
    content,
    normalized_content: normalizedKey(content),
    type,
    source: 'base',
    source_detail: null,
    source_url: null,
    timestamp_marker: null,
    original_order: originalOrder,
    anki_status: 'not_created',
    anki_created_at: null,
    date_added: SEED_DATE,
    times_encountered: 0,
    last_encountered: null,
    meaning_pt: null,
    example: null,
    base_form: content,
    notes: null
  };
}

function insertAfterLastOfType(items, type, additions) {
  if (additions.length === 0) return items;
  let index = -1;
  items.forEach((item, itemIndex) => {
    if (item.type === type) index = itemIndex;
  });

  if (index === -1) return [...items, ...additions];
  return [...items.slice(0, index + 1), ...additions, ...items.slice(index + 1)];
}

async function fetchFrequencyWords() {
  const response = await fetch(VOCABULARY_SOURCE);
  if (!response.ok) {
    throw new Error(`Could not download frequency list: ${response.status} ${response.statusText}`);
  }

  return (await response.text())
    .split(/\r?\n/)
    .map(word => word.trim().toLowerCase())
    .filter(word => /^[a-z]+$/.test(word) && word.length >= 2)
    .filter(word => !OBVIOUS_NON_WORDS.has(word));
}

async function main() {
  const seed = JSON.parse(await fs.readFile(SEED_PATH, 'utf8'));
  const existingVocabulary = seed.filter(item => item.type === 'vocabulary');
  const existingKeys = new Set(seed.map(item => normalizedKey(item.content)));

  if (existingVocabulary.length > TARGET_VOCABULARY_COUNT) {
    throw new Error(
      `The seed already has ${existingVocabulary.length} vocabulary items; refusing to remove data.`
    );
  }

  const wordsNeeded = TARGET_VOCABULARY_COUNT - existingVocabulary.length;
  const sourceWords = await fetchFrequencyWords();
  const newWords = [];

  for (const word of sourceWords) {
    const key = normalizedKey(word);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    newWords.push(word);
    if (newWords.length === wordsNeeded) break;
  }

  if (newWords.length !== wordsNeeded) {
    throw new Error(
      `Frequency list only supplied ${newWords.length} new words; ${wordsNeeded} were required.`
    );
  }

  const newVocabulary = newWords.map((word, index) => createBaseItem({
    id: `base_vocab_${existingVocabulary.length + index + 1}`,
    content: word,
    type: 'vocabulary',
    originalOrder: existingVocabulary.length + index + 1
  }));

  let expandedSeed = insertAfterLastOfType(seed, 'vocabulary', newVocabulary);
  const existingPhraseCount = seed.filter(item => item.type === 'survival_phrase').length;
  const newPhrases = [];

  for (const phrase of SURVIVAL_PHRASES) {
    const key = normalizedKey(phrase);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    newPhrases.push(createBaseItem({
      id: `base_phrase_${existingPhraseCount + newPhrases.length + 1}`,
      content: phrase,
      type: 'survival_phrase',
      originalOrder: existingPhraseCount + newPhrases.length + 1
    }));
  }
  expandedSeed = insertAfterLastOfType(expandedSeed, 'survival_phrase', newPhrases);

  const existingPhrasalCount = seed.filter(item => item.type === 'phrasal_verb').length;
  const newPhrasalVerbs = [];

  for (const phrasalVerb of PHRASAL_VERBS) {
    const key = normalizedKey(phrasalVerb);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    newPhrasalVerbs.push(createBaseItem({
      id: `base_pv_${existingPhrasalCount + newPhrasalVerbs.length + 1}`,
      content: phrasalVerb,
      type: 'phrasal_verb',
      originalOrder: existingPhrasalCount + newPhrasalVerbs.length + 1
    }));
  }
  expandedSeed = insertAfterLastOfType(expandedSeed, 'phrasal_verb', newPhrasalVerbs);

  await fs.writeFile(SEED_PATH, `${JSON.stringify(expandedSeed, null, 2)}\n`, 'utf8');

  const counts = expandedSeed.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {});
  console.log(JSON.stringify({
    vocabulary: counts.vocabulary,
    survival_phrases: counts.survival_phrase,
    phrasal_verbs: counts.phrasal_verb,
    total: expandedSeed.length,
    added_vocabulary: newVocabulary.length,
    added_survival_phrases: newPhrases.length,
    added_phrasal_verbs: newPhrasalVerbs.length,
    source: VOCABULARY_SOURCE
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
