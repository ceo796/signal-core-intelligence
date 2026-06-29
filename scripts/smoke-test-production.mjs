#!/usr/bin/env node

const webBaseUrl = (
  process.argv[2] ||
  process.env.SMOKE_WEB_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  ''
).replace(/\/+$/, '');

// Same-origin production: API checks use the web base URL when no separate API URL is given.
const apiBaseUrl = (
  process.argv[3] ||
  process.env.SMOKE_API_BASE_URL ||
  webBaseUrl ||
  ''
).replace(/\/+$/, '');

if (!webBaseUrl) {
  console.error('Usage: pnpm smoke:production <production-base-url> [api-base-url]');
  console.error('   Same-origin (recommended): pnpm smoke:production https://your-domain.example');
  console.error('   Split-origin (legacy):     pnpm smoke:production https://app.example https://api.example');
  console.error('   Env: SMOKE_WEB_BASE_URL=... [SMOKE_API_BASE_URL=...] pnpm smoke:production');
  process.exit(2);
}

const sameOrigin = webBaseUrl === apiBaseUrl;

const EXPECTED_PROVIDER_CHAIN = ['xai', 'google'];

function validateAiRuntime(body) {
  const errors = [];
  const ai = body?.ai;
  if (!ai) {
    errors.push('runtime-check missing ai block');
    return errors;
  }

  if (ai.openaiEnabled !== false) {
    errors.push(`openaiEnabled expected false, got ${JSON.stringify(ai.openaiEnabled)}`);
  }
  if (ai.embeddingStatus !== 'local') {
    errors.push(`embeddingStatus expected "local", got ${JSON.stringify(ai.embeddingStatus)}`);
  }
  for (const task of ['document_chat', 'multi_document_chat', 'executive_brief']) {
    const chain = ai.resolvedProviderChain?.[task];
    if (JSON.stringify(chain) !== JSON.stringify(EXPECTED_PROVIDER_CHAIN)) {
      errors.push(
        `resolvedProviderChain.${task} expected ${JSON.stringify(EXPECTED_PROVIDER_CHAIN)}, got ${JSON.stringify(chain)}`,
      );
    }
  }
  if (ai.availableProviders?.includes('openai')) {
    errors.push('availableProviders must not include openai');
  }

  return errors;
}

const checks = [
  { service: 'web', baseUrl: webBaseUrl, path: '/', expected: 200 },
  { service: 'web', baseUrl: webBaseUrl, path: '/sign-in', expected: 200 },
  { service: 'api', baseUrl: apiBaseUrl, path: '/health', expected: 200, json: true },
  { service: 'api', baseUrl: apiBaseUrl, path: '/healthz', expected: 200, json: true },
  {
    service: 'api',
    baseUrl: apiBaseUrl,
    path: '/api/healthz',
    expected: 200,
    json: true,
    sameOriginNoCors: sameOrigin,
  },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/health', expected: [200, 503], json: true },
  {
    service: 'api',
    baseUrl: apiBaseUrl,
    path: '/api/runtime-check',
    expected: 200,
    json: true,
    runtimeHealthy: true,
    validateAiRuntime: true,
  },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/documents', expected: 401, json: true },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/notes', expected: 401, json: true },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/trash', expected: 401, json: true },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/documents/999999/original', expected: 401, json: true },
];

let failures = 0;

for (const check of checks) {
  const url = `${check.baseUrl}${check.path}`;
  try {
    const headers = { accept: check.json ? 'application/json' : 'text/html,application/xhtml+xml' };
    const response = await fetch(url, { headers });

    const expectedStatuses = Array.isArray(check.expected) ? check.expected : [check.expected];
    const statusOk = expectedStatuses.includes(response.status);
    let bodyOk = true;
    let runtimeOk = true;
    let aiRuntimeOk = true;
    if (check.json) {
      const contentType = response.headers.get('content-type') || '';
      bodyOk = contentType.includes('application/json');
      if (bodyOk) {
        const body = await response.json();
        if (check.validateAiRuntime) {
          const aiErrors = validateAiRuntime(body);
          if (aiErrors.length > 0) {
            aiRuntimeOk = false;
            for (const message of aiErrors) {
              console.error(`AI runtime-check: ${message}`);
            }
          } else {
            console.log('PASS ai runtime-check openai disabled; xai→google chains; local embeddings');
          }
        }
        if (check.runtimeHealthy) {
          runtimeOk = body?.status === 'ok';
          if (body?.storage?.configured !== true) {
            runtimeOk = false;
            console.error('Runtime check requires storage.configured=true for durable uploads.');
          }
          if (!runtimeOk) {
            console.error(`Runtime check status is ${JSON.stringify(body?.status)}; expected "ok".`);
            if (body?.clerk?.testKeysDetected) {
              console.error('Runtime check detected Clerk test keys. Production must use live Clerk keys.');
            }
            if (body?.storage?.configured === false) {
              console.error('Runtime check reports file storage is not configured.');
            }
            if (body?.database?.connected === false) {
              console.error(`Runtime check reports database is not connected: ${body.database.error ?? 'unknown error'}`);
            }
          }
        }
      }
    }

    let corsOk = true;
    if (check.sameOriginNoCors) {
      const acao = response.headers.get('access-control-allow-origin');
      if (acao) {
        corsOk = false;
        console.error(`Same-origin smoke expected no Access-Control-Allow-Origin header; got ${acao}`);
      }
    }

    if (statusOk && bodyOk && runtimeOk && corsOk && aiRuntimeOk) {
      console.log(`PASS ${check.service} ${check.path} -> ${response.status}`);
    } else {
      failures += 1;
      console.error(
        `FAIL ${check.service} ${check.path} -> ${response.status}; expected ${expectedStatuses.join(' or ')}` +
          (check.json && !bodyOk ? '; expected JSON response' : '') +
          (check.runtimeHealthy && !runtimeOk ? '; expected runtime status ok' : '') +
          (check.validateAiRuntime && !aiRuntimeOk ? '; expected Gemini→Grok AI runtime policy' : ''),
      );
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${check.service} ${check.path} -> ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} production smoke check(s) failed.`);
  process.exit(1);
}

console.log('\nAll production smoke checks passed.');