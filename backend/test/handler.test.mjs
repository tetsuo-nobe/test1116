// API 層とデータアクセス層のテスト（FR1.2、FR1.3、FR2.1）
// DynamoDB は send(command) を持つ偽クライアントで置き換える。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../src/handler.mjs';

const TABLE_NAME = 'CommentsTest';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// 送られたコマンドを記録し、respond(command) の結果を返す偽クライアント
function createFakeClient(respond = () => ({})) {
  const sent = [];
  return {
    sent,
    async send(command) {
      sent.push(command);
      return respond(command);
    },
  };
}

function postEvent(body) {
  return { routeKey: 'POST /comments', body, isBase64Encoded: false };
}

const getEvent = { routeKey: 'GET /comments' };

function assertJson(response) {
  assert.match(response.headers['Content-Type'], /^application\/json/);
  return JSON.parse(response.body);
}

test('POST: 正しい本文なら 201 で ID と保存時刻付きのコメントを返し、テーブルに保存する', async () => {
  const client = createFakeClient();
  const handle = createHandler({ client, tableName: TABLE_NAME });

  const response = await handle(postEvent(JSON.stringify({ body: 'hello' })));

  assert.equal(response.statusCode, 201);
  const saved = assertJson(response);
  assert.equal(saved.body, 'hello');
  assert.match(saved.id, UUID_PATTERN);
  assert.match(saved.createdAt, ISO_UTC_PATTERN);
  assert.equal(client.sent.length, 1);
  assert.ok(client.sent[0] instanceof PutCommand);
  assert.equal(client.sent[0].input.TableName, TABLE_NAME);
  assert.deepEqual(client.sent[0].input.Item, saved);
});

test('POST: 空白のみの本文は 400 とメッセージを返し、保存しない', async () => {
  const client = createFakeClient();
  const handle = createHandler({ client, tableName: TABLE_NAME });

  const response = await handle(postEvent(JSON.stringify({ body: '   ' })));

  assert.equal(response.statusCode, 400);
  assert.equal(assertJson(response).message, 'コメントを入力してください。');
  assert.equal(client.sent.length, 0);
});

test('POST: 不正な JSON は 400 を返し、保存しない', async () => {
  const client = createFakeClient();
  const handle = createHandler({ client, tableName: TABLE_NAME });

  const response = await handle(postEvent('{"body": "hello"'));

  assert.equal(response.statusCode, 400);
  assert.match(assertJson(response).message, /JSON/);
  assert.equal(client.sent.length, 0);
});

test('GET: 全件を createdAt の新しい順で 200 で返す（Scan の続きも読む）', async () => {
  const older = { id: 'a', body: '古い', createdAt: '2026-11-16T01:00:00.000Z' };
  const newer = { id: 'b', body: '新しい', createdAt: '2026-11-16T02:00:00.000Z' };
  const client = createFakeClient((command) =>
    command.input.ExclusiveStartKey
      ? { Items: [newer] }
      : { Items: [older], LastEvaluatedKey: { id: 'a' } },
  );
  const handle = createHandler({ client, tableName: TABLE_NAME });

  const response = await handle(getEvent);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(assertJson(response), [newer, older]);
  assert.equal(client.sent.length, 2);
  assert.ok(client.sent.every((command) => command instanceof ScanCommand));
  assert.equal(client.sent[0].input.TableName, TABLE_NAME);
  assert.deepEqual(client.sent[1].input.ExclusiveStartKey, { id: 'a' });
});

test('GET: 0 件なら空配列を返す', async () => {
  const client = createFakeClient(() => ({ Items: [] }));
  const handle = createHandler({ client, tableName: TABLE_NAME });

  const response = await handle(getEvent);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(assertJson(response), []);
});

test('DynamoDB の失敗は console.error に記録し、500 とメッセージを返す', async (t) => {
  const failure = new Error('ProvisionedThroughputExceeded');
  failure.name = 'ProvisionedThroughputExceededException';
  const client = createFakeClient(() => {
    throw failure;
  });
  const handle = createHandler({ client, tableName: TABLE_NAME });
  const errorLog = t.mock.method(console, 'error', () => {});

  const response = await handle(getEvent);

  assert.equal(response.statusCode, 500);
  assert.equal(typeof assertJson(response).message, 'string');
  assert.doesNotMatch(response.body, /ProvisionedThroughput/);
  assert.equal(errorLog.mock.callCount(), 1);
  const logged = JSON.parse(errorLog.mock.calls[0].arguments[0]);
  assert.equal(logged.level, 'ERROR');
  assert.equal(logged.routeKey, 'GET /comments');
  assert.equal(logged.errorName, 'ProvisionedThroughputExceededException');
});
