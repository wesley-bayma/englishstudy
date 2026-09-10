import http from 'node:http';

const port = Number(process.env.MOCK_AI_PORT || 4010);
const scenarioCounts = new Map();

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function isGemini(pathname) {
  return pathname.includes('/models/');
}

function promptFrom(pathname, body) {
  if (isGemini(pathname)) return body?.contents?.[0]?.parts?.[0]?.text || '';
  return body?.messages?.map(message => message.content || '').join('\n') || '';
}

function recordScenario(prompt) {
  for (const scenario of ['stress-timeout', 'stress-rate-limit', 'stress-invalid-json', 'stress-fallback', 'stress-dedup', 'stress-concurrency']) {
    if (prompt.includes(scenario)) {
      scenarioCounts.set(scenario, (scenarioCounts.get(scenario) || 0) + 1);
      return scenario;
    }
  }
  return 'normal';
}

function studySheet(prompt) {
  const phrase = prompt.includes('FRASE DE SOBREVIVÊNCIA') || prompt.includes('Can I get a receipt');
  if (phrase) {
    return {
      term: 'Can I get a receipt, please?',
      ipa: '/kæn aɪ ɡet ə rɪˈsiːt pliːz/',
      grammatical_class: 'frase de sobrevivência',
      translation: 'Posso receber um recibo, por favor?',
      strategic_gap: { gap_sentence: 'Can I get (_____), please?', expected_chunk: 'a receipt' },
      variations: [{ en: 'Could I have a receipt, please?', pt: 'Eu poderia receber um recibo, por favor?' }],
      tip_warning: 'Use please para manter o pedido educado.'
    };
  }

  return {
    term: prompt.includes('go on') ? 'go on' : 'regular',
    ipa: prompt.includes('go on') ? '/ɡoʊ ɑːn/' : '/ˈreɡ.jə.lɚ/',
    grammatical_class: prompt.includes('go on') ? 'phrasal verb' : 'adjetivo',
    translation: prompt.includes('go on') ? 'continuar' : 'regular, comum',
    examples: [{
      en: prompt.includes('go on') ? 'Please go on.' : 'I have a regular checkup every year.',
      pt: prompt.includes('go on') ? 'Por favor, continue.' : 'Eu faço um check-up regular todos os anos.'
    }],
    ...(prompt.includes('go on') ? {
      phrasal_verb_info: {
        primary_meaning: 'continuar',
        verb_forms: { base: 'go on', gerund: 'going on', past: 'went on' },
        separability: 'inseparable',
        transitivity: 'intransitive',
        object_pattern: 'go on + verb-ing'
      }
    } : {}),
    tip_warning: 'Use o termo conforme o contexto.'
  };
}

function responseFor(prompt) {
  if (prompt.includes('assistente linguístico')) {
    return {
      classification: 'vocabulary',
      base_form: 'regular',
      has_possible_match: false,
      matched_existing_content: null,
      similarity_type: 'none',
      confidence: 0.9,
      meaning_pt: 'regular',
      explanation: 'Resposta controlada do provedor de teste.',
      suggested_example: 'I have a regular checkup every year.'
    };
  }

  if (prompt.includes('avaliador especializado')) {
    return {
      status: 'good',
      status_label: '✅ Bom',
      score: 90,
      observations: ['Resposta controlada do provedor de teste.'],
      summary: 'Card adequado.'
    };
  }

  return studySheet(prompt);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/stats') {
    sendJson(res, 200, { total: [...scenarioCounts.values()].reduce((sum, count) => sum + count, 0), scenarios: Object.fromEntries(scenarioCounts) });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 404, { error: { message: 'Not found' } });
    return;
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    sendJson(res, 400, { error: { message: 'Invalid JSON' } });
    return;
  }

  const prompt = promptFrom(req.url || '', body);
  recordScenario(prompt);

  if (prompt.includes('stress-timeout')) {
    await wait(250);
  }
  if (prompt.includes('stress-dedup')) await wait(100);
  if (prompt.includes('stress-concurrency')) await wait(125);
  if (prompt.includes('stress-rate-limit')) {
    sendJson(res, 429, { error: { message: 'Synthetic rate limit' } });
    return;
  }
  if (prompt.includes('stress-invalid-json')) {
    if (isGemini(req.url || '')) {
      sendJson(res, 200, { candidates: [{ content: { parts: [{ text: 'not json' }] }, finishReason: 'STOP' }] });
    } else {
      sendJson(res, 200, { choices: [{ message: { content: 'not json' }, finish_reason: 'stop' }] });
    }
    return;
  }
  if (prompt.includes('stress-fallback') && isGemini(req.url || '')) {
    sendJson(res, 503, { error: { message: 'Synthetic primary failure' } });
    return;
  }

  const payload = responseFor(prompt);
  if (isGemini(req.url || '')) {
    sendJson(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }] });
  } else {
    sendJson(res, 200, { choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }] });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock AI provider listening on http://127.0.0.1:${port}`);
});
