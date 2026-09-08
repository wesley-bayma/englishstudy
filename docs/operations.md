# English Study Hub — operação e deploy

## Variáveis obrigatórias

Configure estas variáveis na Vercel, separadas por ambiente:

- `OPENROUTER_API_KEY`: chave privada do OpenRouter, usada somente pelas rotas do servidor.
- `APP_PASSWORD`: senha pessoal de acesso à aplicação.
- `SESSION_SECRET`: segredo aleatório com pelo menos 32 caracteres, diferente da senha.
- `OPENROUTER_TIMEOUT_MS`: `50000`.
- `OPENROUTER_MODEL`: opcional; o padrão é `~deepseek/deepseek-v4-flash-latest`.
- `OPENROUTER_SITE_URL`: domínio público da aplicação, quando disponível.

Nunca coloque a chave OpenRouter em `NEXT_PUBLIC_*`, localStorage, código do navegador ou logs.

## Verificação após deploy

1. Acesse `/api/health` e confirme HTTP 200 e `status: "ok"`.
2. Confirme o header `X-EnglishHub-Release` ou o campo `release` do health check.
3. Abra a ficha curada `cheap` e confirme que não houve chamada ao OpenRouter.
4. Gere `building`, uma frase de sobrevivência e um phrasal verb.
5. Verifique nos logs o evento `ai_request`, duração, status, modelo, `finishReason` e `requestId`.
6. Confirme que a chave não aparece no payload da rede nem no localStorage.

O check não-pago pode ser executado com `SMOKE_TEST_URL=https://seu-deployment.vercel.app npm run smoke`. As gerações de IA são deliberadamente manuais para evitar cobrança acidental em CI.

## Rollback

Use o deployment anterior da Vercel se o canário falhar. Não execute reset do IndexedDB para corrigir deploy: o sincronismo do dataset preserva o progresso existente. Faça exportação JSON antes de qualquer operação manual de limpeza ou migração.

## CI

O workflow do GitHub executa `npm ci`, TypeScript, lint, testes e build para pushes em branches de correção e pull requests para `main`.
