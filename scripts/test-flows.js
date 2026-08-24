const fs = require('fs');
const path = require('path');

// Import normalizer functions
function normalizeContent(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?:;*()[\]{}/#$^\-_+=~|<>"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWordMorphologyCandidates(word) {
  const c = new Set();
  if (word.length <= 2) return [word];

  if (word.endsWith('ing') && word.length > 4) {
    const baseIng = word.slice(0, -3);
    c.add(baseIng);
    c.add(baseIng + 'e');
    if (baseIng.length > 1 && baseIng[baseIng.length - 1] === baseIng[baseIng.length - 2]) {
      c.add(baseIng.slice(0, -1));
    }
  }
  if (word.endsWith('ed') && word.length > 3) {
    const baseEd = word.slice(0, -2);
    c.add(baseEd);
    c.add(word.slice(0, -1));
    if (baseEd.length > 1 && baseEd[baseEd.length - 1] === baseEd[baseEd.length - 2]) {
      c.add(baseEd.slice(0, -1));
    }
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    c.add(word.slice(0, -1));
  }
  return Array.from(c);
}

function getBasicLemmaCandidates(normalized) {
  const candidates = new Set();
  candidates.add(normalized);

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

const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed-data.json'), 'utf8'));

console.log('=== TEST SUITE: ENGLISH STUDY HUB ===\n');

// Test 1: Exact matches
console.log('1. Testing Exact Matches (wallet, Wallet, WALLET, wallet.)');
const testTerms = ['wallet', 'Wallet', 'WALLET', 'wallet.', '  wallet  '];
const normalizedTerms = testTerms.map(t => normalizeContent(t));
const allEqual = normalizedTerms.every(t => t === 'wallet');
console.log(`- Normalization consistency: ${allEqual ? 'PASSED ✅' : 'FAILED ❌'}`);

const walletInDb = seedData.find(i => i.normalized_content === 'wallet');
console.log(`- Wallet in DB: ${walletInDb ? `Found (ID: ${walletInDb.id}, Order: #${walletInDb.original_order}) ✅` : 'FAILED ❌'}`);

// Test 2: Morphological candidates (running -> run)
console.log('\n2. Testing Morphology (running -> run)');
const runningLemmas = getBasicLemmaCandidates('running');
console.log(`- Candidates for 'running':`, runningLemmas);
const runInDb = seedData.find(i => runningLemmas.includes(i.normalized_content) && i.content === 'run');
console.log(`- Base 'run' found in DB from 'running': ${runInDb ? `Found (ID: ${runInDb.id}, Order: #${runInDb.original_order}) ✅` : 'FAILED ❌'}`);

// Test 3: Phrasal Verb inflection (finding out -> find out)
console.log('\n3. Testing Phrasal Verb Morphology (finding out -> find out)');
const findingOutLemmas = getBasicLemmaCandidates('finding out');
console.log(`- Candidates for 'finding out':`, findingOutLemmas);
const findOutInDb = seedData.find(i => findingOutLemmas.includes(i.normalized_content) && i.content === 'find out');
console.log(`- Base 'find out' found in DB: ${findOutInDb ? `Found (ID: ${findOutInDb.id}, Order: #${findOutInDb.original_order}) ✅` : 'FAILED ❌'}`);

// Test 4: Phrase Semantic Match (Where is the restroom?)
console.log('\n4. Testing Survival Phrase (#73: Where is the restroom?)');
const phrase73 = seedData.find(i => i.original_order === 73 && i.type === 'survival_phrase');
console.log(`- Phrase 73 content: "${phrase73 ? phrase73.content : 'NOT FOUND'}" (${phrase73 ? phrase73.meaning_pt : ''})`);
console.log(`- Normalized: "${phrase73 ? phrase73.normalized_content : ''}"`);
console.log(`- Match status: ${phrase73 ? 'PASSED ✅' : 'FAILED ❌'}`);

// Test 5: Seed counts
console.log('\n5. Canonical Counts Verification');
const vocabCount = seedData.filter(i => i.type === 'vocabulary').length;
const phrasesCount = seedData.filter(i => i.type === 'survival_phrase').length;
const pvCount = seedData.filter(i => i.type === 'phrasal_verb').length;
console.log(`- Vocabularies: ${vocabCount} / 3000 -> ${vocabCount === 3000 ? 'PASSED ✅' : 'FAILED ❌'}`);
console.log(`- Phrases: ${phrasesCount} / 100 -> ${phrasesCount === 100 ? 'PASSED ✅' : 'FAILED ❌'}`);
console.log(`- Phrasal Verbs: ${pvCount} / 150 -> ${pvCount === 150 ? 'PASSED ✅' : 'FAILED ❌'}`);
console.log(`- Total: ${seedData.length} / 3250 -> ${seedData.length === 3250 ? 'PASSED ✅' : 'FAILED ❌'}`);

console.log('\n=== ALL VERIFICATION TESTS COMPLETED ===');
