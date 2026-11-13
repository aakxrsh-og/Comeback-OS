import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ORIGIN = 'https://aakxrsh-og.github.io';
const env = (overrides = {}) => ({
  ALLOWED_ORIGINS: ORIGIN,
  GEMINI_API_KEY: 'unit-test-only-secret',
  MENTOR_RATE_LIMIT: { limit: async () => ({ success: true }) },
  ...overrides,
});
const request = (body, { origin = ORIGIN, headers = {}, method = 'POST', path = '/api/mentor' } = {}) => new Request(`https://worker.test${path}`, {
  method,
  headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
  body: method === 'POST' ? JSON.stringify(body) : undefined,
});
const geminiReply = value => new Response(JSON.stringify({
  modelVersion: 'test-model',
  candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

async function withProvider(response, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return typeof response === 'function' ? response(...args) : response; };
  try { await run(calls); } finally { globalThis.fetch = original; }
}

test('health is public, no-store, and exposes no provider configuration', async () => {
  const res = await worker.fetch(new Request('https://worker.test/health'), env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, service: 'comeback-os-ai' });
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('mentor endpoint fails closed without the rate-limit binding', async () => {
  await withProvider(geminiReply({ reply: 'should not run', actions: [] }), async calls => {
    const res = await worker.fetch(request({ message: 'Plan my study' }), env({ MENTOR_RATE_LIMIT: undefined }));
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
  });
});

test('disallowed origins are rejected before rate limiting or provider access', async () => {
  let limited = false;
  await withProvider(geminiReply({ reply: 'should not run', actions: [] }), async calls => {
    const res = await worker.fetch(request({ message: 'Plan my study' }, { origin: 'https://evil.example' }), env({ MENTOR_RATE_LIMIT: { limit: async () => { limited = true; return { success: true }; } } }));
    assert.equal(res.status, 403);
    assert.equal(limited, false);
    assert.equal(calls.length, 0);
  });
});

test('rate-limit denials stop before the provider and return 429', async () => {
  await withProvider(geminiReply({ reply: 'should not run', actions: [] }), async calls => {
    const res = await worker.fetch(request({ message: 'Plan my study' }), env({ MENTOR_RATE_LIMIT: { limit: async () => ({ success: false }) } }));
    assert.equal(res.status, 429);
    assert.equal(calls.length, 0);
  });
});

test('provider failures return a sanitized error without exposing key material', async () => {
  await withProvider(new Response('provider detail', { status: 500 }), async calls => {
    const res = await worker.fetch(request({ message: 'Plan my study' }), env());
    const body = await res.text();
    assert.equal(res.status, 502);
    assert.match(body, /AI provider request failed/);
    assert.doesNotMatch(body, /unit-test-only-secret|provider detail/);
    assert.equal(new URL(calls[0][0]).search, '');
    assert.equal(calls[0][1].headers['x-goog-api-key'], 'unit-test-only-secret');
  });
});

test('provider action proposals are filtered to the explicit allowlist', async () => {
  const proposal = { reply: 'Review these options.', actions: [
    { type: 'create_quest', title: 'Physics practice', minutes: 45, category: 'Main Quest', date: '2026-11-14', time: '09:30', extra: 'drop me' },
    { type: 'set_status', chapterId: 'ch-1', status: 'Mastered' },
    { type: 'set_topic_status', chapterId: 'ch-1', topicKey: 'kinematics', status: 'completed' },
    { type: 'delete_account' },
    { type: 'create_quest', title: 'too many proposals', minutes: 45, category: 'Main Quest' },
  ] };
  await withProvider(geminiReply(proposal), async () => {
    const res = await worker.fetch(request({ message: 'Help me plan', studyContext: 'local study record' }), env());
    assert.equal(res.status, 200);
    const result = await res.json();
    assert.equal(result.reply, proposal.reply);
    assert.deepEqual(result.actions, [
      { type: 'create_quest', title: 'Physics practice', minutes: 45, category: 'Main Quest', date: '2026-11-14', time: '09:30' },
      { type: 'set_topic_status', chapterId: 'ch-1', topicKey: 'kinematics', status: 'completed' },
    ]);
  });
});

test('request body and message are bounded and validated before provider calls', async () => {
  await withProvider(geminiReply({ reply: 'unused', actions: [] }), async calls => {
    const noMessage = await worker.fetch(request({ message: '  ' }), env());
    assert.equal(noMessage.status, 400);
    const tooLong = await worker.fetch(request({ message: 'x'.repeat(8001) }), env());
    assert.equal(tooLong.status, 400);
    const wrongType = await worker.fetch(request({ message: 'hello' }, { headers: { 'Content-Type': 'text/plain' } }), env());
    assert.equal(wrongType.status, 415);
    assert.equal(calls.length, 0);
  });
});



test('impossible calendar dates are dropped from every date-bearing action', async () => {
  const proposal = { reply: 'No invalid schedules.', actions: [
    { type: 'create_quest', title: 'Bad date quest', minutes: 30, category: 'Side Quest', date: '2026-02-30' },
    { type: 'reschedule_quest', questId: 'q1', date: '2026-99-99' },
    { type: 'create_assessment', title: 'Bad date exam', subject: 'Physics', date: '2026-04-31' },
  ] };
  await withProvider(geminiReply(proposal), async () => {
    const res = await worker.fetch(request({ message: 'Schedule these.' }), env());
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).actions, []);
  });
});
