#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');

if (!baseUrl) {
  console.error('Usage: pnpm smoke:production https://signal87.ai');
  console.error('   or: SMOKE_BASE_URL=https://signal87.ai pnpm smoke:production');
  process.exit(2);
}

const checks = [
  { path: '/', expected: 200 },
  { path: '/sign-in', expected: 200 },
  { path: '/api/healthz', expected: 200, json: true },
  { path: '/api/runtime-check', expected: 200, json: true },
  { path: '/api/documents', expected: 401, json: true },
];

let failures = 0;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const response = await fetch(url, {
      headers: { accept: check.json ? 'application/json' : 'text/html,application/xhtml+xml' },
    });

    const statusOk = response.status === check.expected;
    let bodyOk = true;
    if (check.json) {
      const contentType = response.headers.get('content-type') || '';
      bodyOk = contentType.includes('application/json');
      if (bodyOk) await response.json();
    }

    if (statusOk && bodyOk) {
      console.log(`PASS ${check.path} -> ${response.status}`);
    } else {
      failures += 1;
      console.error(
        `FAIL ${check.path} -> ${response.status}; expected ${check.expected}` +
          (check.json && !bodyOk ? '; expected JSON response' : ''),
      );
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${check.path} -> ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`Smoke test failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log(`Smoke test passed for ${baseUrl}.`);
