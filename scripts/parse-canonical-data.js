const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '..', 'documento canonico-english-leia-aqui.md');
const rawText = fs.readFileSync(mdPath, 'utf8');

// 1. EXTRACT 3000 VOCABULARY WORDS
const vocabStartIndex = rawText.indexOf('# **3000 palavras em inglês para o cotidiano**');
const phrasesStartIndex = rawText.indexOf('# **100 FRASES DE SOBREVIVÊNCIA EM INGLÊS**');
const pvStartIndex = rawText.indexOf('**150 PHRASAL VERBS MAIS FREQUENTES**');

if (vocabStartIndex === -1 || phrasesStartIndex === -1 || pvStartIndex === -1) {
  console.error('Indices not found:', { vocabStartIndex, phrasesStartIndex, pvStartIndex });
  process.exit(1);
}

const vocabText = rawText.slice(vocabStartIndex, phrasesStartIndex);
const vocabRegex = /(\d+)\\\.\s+([a-zA-Z0-9\-]+)/g;
let match;
const vocabMap = new Map();

while ((match = vocabRegex.exec(vocabText)) !== null) {
  const num = parseInt(match[1], 10);
  const word = match[2].trim();
  if (num >= 1 && num <= 3000 && !vocabMap.has(num)) {
    vocabMap.set(num, word);
  }
}

console.log(`Parsed ${vocabMap.size} vocabulary words (Expected 3000).`);

const vocabItems = [];
for (let i = 1; i <= 3000; i++) {
  const word = vocabMap.get(i);
  if (!word) {
    console.warn(`Missing vocab #${i}`);
  }
  vocabItems.push({
    id: `base_vocab_${i}`,
    content: word || `word_${i}`,
    normalized_content: (word || `word_${i}`).toLowerCase().replace(/[^a-z0-9]/g, ''),
    type: 'vocabulary',
    source: 'base',
    original_order: i,
    anki_status: 'not_created',
    times_encountered: 0,
    meaning_pt: null,
    example: null,
    notes: null,
    base_form: word || null,
    date_added: '2026-08-24T00:00:00.000Z'
  });
}

// 2. EXTRACT 100 SURVIVAL PHRASES
const phraseText = rawText.slice(phrasesStartIndex, pvStartIndex);
const phraseLines = phraseText.split('\n');
const phraseMap = new Map();

for (const line of phraseLines) {
  const lineMatch = line.match(/^(\d+)\\\.\s+(.*?)\s+[—–-]\s+(.*)$/);
  if (lineMatch) {
    const num = parseInt(lineMatch[1], 10);
    const phrase = lineMatch[2].trim().replace(/\\/g, '');
    const meaning = lineMatch[3].trim().replace(/\\/g, '');
    phraseMap.set(num, { phrase, meaning });
  }
}

console.log(`Parsed ${phraseMap.size} survival phrases (Expected 100).`);

const phraseItems = [];
for (let i = 1; i <= 100; i++) {
  const data = phraseMap.get(i) || { phrase: `Phrase #${i}`, meaning: '' };
  phraseItems.push({
    id: `base_phrase_${i}`,
    content: data.phrase,
    normalized_content: data.phrase.toLowerCase().replace(/[^a-z0-9]/g, ''),
    type: 'survival_phrase',
    source: 'base',
    original_order: i,
    anki_status: 'not_created',
    times_encountered: 0,
    meaning_pt: data.meaning || null,
    example: null,
    notes: null,
    base_form: null,
    date_added: '2026-08-24T00:00:00.000Z'
  });
}

// 3. EXTRACT 150 PHRASAL VERBS
const pvText = rawText.slice(pvStartIndex);
const pvLines = pvText.split('\n');
const pvMap = new Map();

let currentPv = null;

for (let i = 0; i < pvLines.length; i++) {
  const line = pvLines[i].trim();
  const pvHeaderMatch = line.match(/^(\d+)\\\.\s+([A-Z\s()]+)\s+[—–-]\s+(.*)$/);
  if (pvHeaderMatch) {
    const num = parseInt(pvHeaderMatch[1], 10);
    const pvName = pvHeaderMatch[2].trim().replace(/\\/g, '').toLowerCase();
    const meaning = pvHeaderMatch[3].trim().replace(/\\/g, '');
    currentPv = { num, pvName, meaning, example: '' };
    pvMap.set(num, currentPv);
    continue;
  }

  if (currentPv && line.startsWith('Ex.:')) {
    currentPv.example = line.replace(/^Ex\.:\s*/, '').replace(/\\/g, '').trim();
  }
}

console.log(`Parsed ${pvMap.size} phrasal verbs (Expected 150).`);

const pvItems = [];
for (let i = 1; i <= 150; i++) {
  const data = pvMap.get(i) || { pvName: `PV #${i}`, meaning: '', example: '' };
  pvItems.push({
    id: `base_pv_${i}`,
    content: data.pvName,
    normalized_content: data.pvName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    type: 'phrasal_verb',
    source: 'base',
    original_order: i,
    anki_status: 'not_created',
    times_encountered: 0,
    meaning_pt: data.meaning || null,
    example: data.example || null,
    notes: null,
    base_form: data.pvName,
    date_added: '2026-08-24T00:00:00.000Z'
  });
}

const allItems = [...vocabItems, ...phraseItems, ...pvItems];
console.log(`Total canonical items generated: ${allItems.length} (Expected 3250)`);

console.log('\n--- VERIFICATION OF FIRST 10 ITEMS (DAY 1) ---');
console.log('5 Vocabularies:', vocabItems.slice(0, 5).map(v => `#${v.original_order} ${v.content}`));
console.log('3 Survival Phrases:', phraseItems.slice(0, 3).map(p => `#${p.original_order} ${p.content} (${p.meaning_pt})`));
console.log('2 Phrasal Verbs:', pvItems.slice(0, 2).map(pv => `#${pv.original_order} ${pv.content} (${pv.meaning_pt})`));

const outputPath = path.join(__dirname, '..', 'data', 'seed-data.json');
fs.writeFileSync(outputPath, JSON.stringify(allItems, null, 2), 'utf8');
console.log(`\nSuccessfully saved clean canonical dataset to ${outputPath}!`);
