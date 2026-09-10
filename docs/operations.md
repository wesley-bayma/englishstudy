# English Study Hub — operação e deploy

## Variáveis obrigatórias

Configure estas variáveis na Vercel, separadas por ambiente:

- `GEMINI_API_KEY`: chave privada do Gemini, usada somente pelas rotas do servidor.
- `APP_PASSWORD`: senha pessoal de acesso à aplicação.
- `SESSION_SECRET`: segredo aleatório com pelo menos 32 caracteres, diferente da senha.
- `GEMINI_TIMEOUT_MS`: `12000` (a rota reserva o restante da janela para o fallback).
- `GEMINI_MODEL`: opcional; o padrão é `gemini-3.8-flash`.
- `OPENROUTER_API_KEY`: contingência privada para o Gemini; usada somente se a geração principal falhar.
- `OPENROUTER_FALLBACK_MODEL`: opcional; o padrão é `z-ai/glm-5.3-flash`.

Nunca coloque a chave Gemini em `NEXT_PUBLIC_*`, localStorage, código do navegador ou logs.

## Verificação após deploy

1. Acesse `/api/health` e confirme HTTP 200 e `status: "ok"`.
2. Confirme o header `X-EnglishHub-Release` ou o campo `release` do health check.
3. Abra a ficha curada `cheap` e confirme que não houve chamada à IA.
4. Gere `building`, uma frase de sobrevivência e um phrasal verb. Em caso de falha do Gemini, a tentativa única de contingência usa o modelo GLM pelo OpenRouter.
5. Verifique nos logs o evento `ai_request`, duração, status, modelo, `finishReason` e `requestId`.
6. Confirme que a chave não aparece no payload da rede nem no localStorage.

O check não-pago pode ser executado com `SMOKE_TEST_URL=https://seu-deployment.vercel.app npm run smoke`. As gerações de IA são deliberadamente manuais para evitar cobrança acidental em CI.

## Verificações locais sem cobrança

O contrato do modelo OpenRouter pode ser verificado sem enviar uma geração:

```text
npm run verify-provider-model
```

Para stress test, inicie o mock local e o app com endpoints apontando para `127.0.0.1:4010`; nunca use essas variáveis contra um provedor pago. O harness executa 100 chamadas por endpoint, primeiro com concorrência 10 e depois com 25, impõe timeout no cliente e verifica respostas inválidas, timeout, 429, rate limit, limite de concorrência e deduplicação de ficha:

# Terminal 1 — mantenha o mock rodando
```text
node scripts/mock-ai-provider.mjs
```

# Terminal 2 — com as variáveis abaixo no mesmo processo do app
```text
$env:APP_PASSWORD='stress-password'
$env:SESSION_SECRET='local-stress-secret-with-at-least-32-characters'
$env:GEMINI_API_KEY='mock'
$env:OPENROUTER_API_KEY='mock'
$env:GEMINI_API_BASE_URL='http://127.0.0.1:4010/models'
$env:OPENROUTER_API_BASE_URL='http://127.0.0.1:4010/chat/completions'
$env:GEMINI_TIMEOUT_MS='150'
$env:OPENROUTER_TIMEOUT_MS='150'
npm run build
npm start -- -p 3100
```

# Terminal 3 — execute contra o app local
```text
$env:STRESS_TEST_URL='http://localhost:3100'
$env:STRESS_PASSWORD='stress-password'
$env:STRESS_MOCK_URL='http://localhost:4010'
npm run stress
$env:STRESS_CONCURRENCY='25'; npm run stress
```

Os logs estruturados `api_request_failed` e `ai_request` carregam `requestId`; ao investigar uma falha, use essa referência sem registrar chaves ou prompts sensíveis.

## Rollback

Use o deployment anterior da Vercel se o canário falhar. Não execute reset do IndexedDB para corrigir deploy: o sincronismo do dataset preserva o progresso existente. Faça exportação JSON antes de qualquer operação manual de limpeza ou migração.

## CI

O workflow do GitHub executa `npm ci`, TypeScript, lint, testes e build para pushes em branches de correção e pull requests para `main`.
