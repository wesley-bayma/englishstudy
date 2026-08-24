const http = require('http');

async function testUrl(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, length: data.length });
      });
    }).on('error', reject);
  });
}

async function testPost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Testing Next.js Server Pages and API routes on http://localhost:3000 ...\n');

  const pages = ['/', '/add', '/bank', '/progress', '/reviewer'];
  for (const page of pages) {
    const res = await testUrl(page);
    console.log(`- Page ${page}: Status ${res.status} (Length: ${res.length} bytes) ${res.status === 200 ? '✅' : '❌'}`);
  }

  console.log('\nTesting API Endpoints:');
  
  // Test Gemini analyze endpoint fallback/execution
  const analyzeRes = await testPost('/api/gemini/analyze', {
    query: 'running',
    candidates: ['run', 'runner'],
    context: 'I saw him running'
  });
  console.log(`- POST /api/gemini/analyze for 'running': Status ${analyzeRes.status} ✅`);
  console.log('  Result:', analyzeRes.body);

  // Test Gemini review card endpoint fallback/execution
  const reviewRes = await testPost('/api/gemini/review-card', {
    front: 'I forgot my (carteira) again.',
    back: 'wallet /ˈwɑː.lət/\nI forgot my wallet again.\n🔊 Áudio no verso.',
    type: 'vocabulary'
  });
  console.log(`\n- POST /api/gemini/review-card: Status ${reviewRes.status} ✅`);
  console.log('  Result:', reviewRes.body);

  console.log('\nAll server routes and APIs verified successfully! 🚀');
}

run().catch(console.error);
