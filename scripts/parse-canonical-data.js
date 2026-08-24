const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '..', 'documento canonico-english-leia-aqui.md');
const content = fs.readFileSync(docPath, 'utf8');

function normalizeContent(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '')
    .replace(/\s+/g, ' ');
}

// 1. Parse 3000 Vocabulary words
const vocabMap = new Map();
// Look for pattern: <number>\. <word> or <number>. <word>
// The words are in sections GRUPO A, GRUPO B, GRUPO C
const vocabRegex = /(\d+)(?:\\)?\.\s+([a-zA-Z0-9\-\']+)/g;
let match;

// We isolate the vocabulary section up to "100 FRASES DE SOBREVIVÊNCIA"
const vocabSectionEnd = content.indexOf('100 FRASES DE SOBREVIVÊNCIA');
const vocabSection = content.slice(0, vocabSectionEnd);

while ((match = vocabRegex.exec(vocabSection)) !== null) {
  const num = parseInt(match[1], 10);
  const word = match[2].trim();
  if (num >= 1 && num <= 3000 && !vocabMap.has(num)) {
    vocabMap.set(num, word);
  }
}

console.log(`Parsed ${vocabMap.size} vocabulary words.`);

// Check for missing vocabulary indices
const missingVocab = [];
for (let i = 1; i <= 3000; i++) {
  if (!vocabMap.has(i)) {
    missingVocab.push(i);
  }
}
if (missingVocab.length > 0) {
  console.log(`Missing vocab indices (${missingVocab.length}):`, missingVocab.slice(0, 10));
}

// 2. Parse 100 Survival Phrases
// Look in section between "100 FRASES DE SOBREVIVÊNCIA" and "150 PHRASAL VERBS"
const phrasesSectionStart = content.indexOf('100 FRASES DE SOBREVIVÊNCIA');
const phrasesSectionEnd = content.indexOf('150 PHRASAL VERBS');
const phrasesSection = content.slice(phrasesSectionStart, phrasesSectionEnd);

const phrasesMap = new Map();
// Match lines like: 1\. Where is the nearest subway station? — Onde fica a estação de metrô mais próxima?
const phraseLines = phrasesSection.split('\n');
const phraseRegex = /^(\d+)(?:\\)?\.\s*(.+?)\s*—\s*(.+)$/;

for (const rawLine of phraseLines) {
  const line = rawLine.trim().replace(/\\!/g, '!').replace(/\\\./g, '.');
  const pMatch = line.match(/^(\d+)\.\s*(.+?)\s*—\s*(.+)$/);
  if (pMatch) {
    const num = parseInt(pMatch[1], 10);
    const eng = pMatch[2].trim();
    const pt = pMatch[3].trim();
    phrasesMap.set(num, { english: eng, portuguese: pt });
  }
}

console.log(`Parsed ${phrasesMap.size} survival phrases.`);

// 3. Parse 150 Phrasal Verbs
const pvSectionStart = content.indexOf('150 PHRASAL VERBS');
const pvSection = content.slice(pvSectionStart);

const pvMap = new Map();
// Blocks like:
// 1\. GO ON — acontecer; continuar/prosseguir
// Ex.: What’s going on here?
const pvBlocks = pvSection.split(/(?=\n\d+(?:\\)?\.\s+[A-Z])/);

for (const block of pvBlocks) {
  const headMatch = block.match(/(\d+)(?:\\)?\.\s+([A-Z\s\(\)\/]+?)\s*—\s*([^\n\r]+)/);
  if (headMatch) {
    const num = parseInt(headMatch[1], 10);
    let pvName = headMatch[2].trim();
    const meaning = headMatch[3].trim().replace(/\\!/g, '!').replace(/\\\./g, '.');
    
    // Example sentence
    const exMatch = block.match(/Ex\.:\s*([^\n\r]+)/);
    const example = exMatch ? exMatch[1].trim().replace(/\\!/g, '!').replace(/\\\./g, '.') : '';
    
    pvMap.set(num, {
      content: pvName.toLowerCase(),
      original_content: pvName,
      meaning_pt: meaning,
      example: example
    });
  }
}

console.log(`Parsed ${pvMap.size} phrasal verbs.`);

// Build seed items array
const items = [];
const now = new Date().toISOString();

// Vocabulary
for (let i = 1; i <= 3000; i++) {
  const word = vocabMap.get(i) || `word_${i}`;
  items.push({
    id: `base-vocab-${i}`,
    content: word,
    normalized_content: normalizeContent(word),
    type: 'vocabulary',
    source: 'base',
    source_detail: 'Documento Canônico',
    source_url: null,
    timestamp_marker: null,
    original_order: i,
    anki_status: 'not_created',
    anki_created_at: null,
    date_added: now,
    times_encountered: 0,
    last_encountered: null,
    meaning_pt: null,
    example: null,
    base_form: word,
    notes: null
  });
}

// Survival Phrases
for (let i = 1; i <= 100; i++) {
  const phrase = phrasesMap.get(i);
  if (phrase) {
    items.push({
      id: `base-phrase-${i}`,
      content: phrase.english,
      normalized_content: normalizeContent(phrase.english),
      type: 'survival_phrase',
      source: 'base',
      source_detail: 'Documento Canônico',
      source_url: null,
      timestamp_marker: null,
      original_order: i,
      anki_status: 'not_created',
      anki_created_at: null,
      date_added: now,
      times_encountered: 0,
      last_encountered: null,
      meaning_pt: phrase.portuguese,
      example: phrase.english,
      base_form: phrase.english,
      notes: null
    });
  }
}

// Phrasal Verbs
for (let i = 1; i <= 150; i++) {
  const pv = pvMap.get(i);
  if (pv) {
    items.push({
      id: `base-pv-${i}`,
      content: pv.content,
      normalized_content: normalizeContent(pv.content),
      type: 'phrasal_verb',
      source: 'base',
      source_detail: 'Documento Canônico',
      source_url: null,
      timestamp_marker: null,
      original_order: i,
      anki_status: 'not_created',
      anki_created_at: null,
      date_added: now,
      times_encountered: 0,
      last_encountered: null,
      meaning_pt: pv.meaning_pt,
      example: pv.example,
      base_form: pv.content,
      notes: null
    });
  }
}

console.log(`Total seed items created: ${items.length}`);

// Ensure data folder exists
const outDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'seed-data.json'), JSON.stringify(items, null, 2), 'utf8');
console.log(`Successfully written to data/seed-data.json`);
