import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';

import { computeOrderTrackingToken, verifyOrderTrackingToken } from '../supabase/functions/_shared/order-tracking-token.ts';

type UnitTest = {
  name: string;
  fn: () => Promise<void> | void;
};

const tests: UnitTest[] = [];

function registerTest(name: string, fn: UnitTest['fn']) {
  tests.push({ name, fn });
}

async function run() {
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      // eslint-disable-next-line no-console
      console.log(`✅ ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`❌ ${name}`);
      console.error(error);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nTests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

registerTest('computeOrderTrackingToken is deterministic', async () => {
  const secret = 'test-secret';
  const orderId = 'order-123';

  const first = await computeOrderTrackingToken(orderId, secret);
  const second = await computeOrderTrackingToken(orderId, secret);

  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{32}$/);
});

registerTest('verifyOrderTrackingToken accepts valid token and rejects invalid token', async () => {
  const secret = 'another-secret';
  const orderId = 'order-456';

  const token = await computeOrderTrackingToken(orderId, secret);
  const ok = await verifyOrderTrackingToken(orderId, secret, token);
  assert.equal(ok, true);

  const badSecret = await verifyOrderTrackingToken(orderId, 'wrong-secret', token);
  assert.equal(badSecret, false);

  const badToken = `${token.slice(1)}a`;
  const malformed = await verifyOrderTrackingToken(orderId, secret, badToken);
  assert.equal(malformed, false);
});

registerTest('workflow promote-main-to-production.yml contains manual promote safeguards', () => {
  const workflowPath = resolve(process.cwd(), '.github/workflows/promote-main-to-production.yml');
  const raw = readFileSync(workflowPath, 'utf8');

  assert.ok(/on:\n\s*workflow_dispatch:/m.test(raw), 'workflow_dispatch trigger is present');
  assert.ok(/required:\s*true/.test(raw), 'manual inputs include required fields');
  assert.ok(/release_tag:/.test(raw), 'release_tag input exists');
  assert.ok(/reason:/.test(raw), 'reason input exists');
  assert.ok(/promote_strategy:/.test(raw), 'promote_strategy input exists');
  assert.ok(/git merge --no-edit origin\/main/.test(raw), 'default merge strategy uses merge commit');
  assert.ok(/git merge --ff-only origin\/main/.test(raw), 'ff-only strategy is supported');
  assert.ok(/Create release tag/.test(raw), 'release tag step exists');
  assert.ok(/Audit summary/.test(raw), 'audit summary step exists');
});

registerTest('deploy-edge-functions.yml has protected deploy requirements', () => {
  const workflowPath = resolve(process.cwd(), '.github/workflows/deploy-edge-functions.yml');
  const raw = readFileSync(workflowPath, 'utf8');

  assert.ok(/workflow_dispatch:/.test(raw), 'workflow supports manual dispatch');
  assert.ok(/SUPABASE_ACCESS_TOKEN/.test(raw), 'SUPABASE_ACCESS_TOKEN secret is required');
  assert.ok(/supabase functions deploy/.test(raw), 'edge functions deploy command is present');
  assert.ok(/permissions:/.test(raw), 'permissions block is configured');
});

await run();
