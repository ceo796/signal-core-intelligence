#!/usr/bin/env node

const webBaseUrl = (
  process.argv[2] ||
  process.env.SMOKE_WEB_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  ''
).replace(/\/+$/, '');

const apiBaseUrl = (
  process.argv[3] ||
  process.env.SMOKE_API_BASE_URL ||
  webBaseUrl ||
  ''
).replace(/\/+$/, '');

if (!webBaseUrl || !apiBaseUrl) {
  console.error('Usage: pnpm smoke:production https://signal87.ai [https://signal87-api.onrender.com]');
  console.error('   or: SMOKE_WEB_BASE_URL=https://signal87.ai SMOKE_API_BASE_URL=https://signal87-api.onrender.com pnpm smoke:production');
  process.exit(2);
}

const checks = [
  { service: 'web', baseUrl: webBaseUrl, path: '/', expected: 200 },
  { service: 'web', baseUrl: webBaseUrl, path: '/sign-in', expected: 200 },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/healthz', expected: 200, json: true },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/runtime-check', expected: 200, json: true, runtimeHealthy: true },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/documents', expected: 401, json: true },
  { service: 'api', baseUrl: apiBaseUrl, path: '/api/documents/999999/original', expected: 401, json: true },
];

let failures = 0;

for (const check of checks) {
  const url = `${check.baseUrl}${check.path}`;
  try {
    const response = await fetch(url, {
      headers: { accept: check.json ? 'application/json' : 'text/html,application/xhtml+xml' },
    });

    const statusOk = response.status === check.expected;
    let bodyOk = true;
    let runtimeOk = true;
    if (check.json) {
      const contentType = response.headers.get('content-type') || '';
      bodyOk = contentType.includes('application/json');
      if (bodyOk) {
        const body = await response.json();
        if (check.runtimeHealthy) {
          runtimeOk = body?.status === 'ok';
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

    if (statusOk && bodyOk && runtimeOk) {
      console.log(`PASS ${check.service} ${check.path} -> ${response.status}`);
    } else {
      failures += 1;
      console.error(
        `FAIL ${check.service} ${check.path} -> ${response.status}; expected ${check.expected}` +
          (check.json && !bodyOk ? '; expected JSON response' : '') +
          (check.runtimeHealthy && !runtimeOk ? '; expected runtime status ok' : ''),
      );
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${check.service} ${check.path} -> ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`Smoke test failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log(`Smoke test passed for web=${webBaseUrl} api=${apiBaseUrl}.`);
