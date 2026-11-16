// 入力検証のテスト（FR1.3）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBody, MAX_BODY_LENGTH } from '../src/validation.mjs';

test('正常: 500 文字以内の本文はそのまま受け付ける', () => {
  const atLimit = 'あ'.repeat(MAX_BODY_LENGTH);
  assert.deepEqual(validateBody({ body: 'hello' }), { ok: true, value: 'hello' });
  assert.deepEqual(validateBody({ body: atLimit }), { ok: true, value: atLimit });
});

test('空の本文はエラーになる', () => {
  const result = validateBody({ body: '' });
  assert.equal(result.ok, false);
  assert.equal(result.message, 'コメントを入力してください。');
});

test('空白のみの本文はエラーになる', () => {
  const result = validateBody({ body: ' \t\n　' });
  assert.equal(result.ok, false);
  assert.equal(result.message, 'コメントを入力してください。');
});

test('501 文字の本文はエラーになる', () => {
  const result = validateBody({ body: 'a'.repeat(MAX_BODY_LENGTH + 1) });
  assert.equal(result.ok, false);
  assert.match(result.message, /500 文字以内/);
});
