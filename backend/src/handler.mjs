// API 層: API Gateway HTTP API（ペイロード v2）から呼ばれる Lambda ハンドラー。
// POST /comments（保存）と GET /comments（一覧）を routeKey で振り分ける。
// CORS は HTTP API 側（corsPreflight）で設定するため、ここでは扱わない。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { validateBody } from './validation.mjs';
import { createComment, sortNewestFirst } from './comment.mjs';
import { putComment, listComments } from './repository.mjs';

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  };
}

function decodeBody(event) {
  if (event.body == null) return '';
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

async function handlePost(event, client, tableName) {
  let parsed;
  try {
    parsed = JSON.parse(decodeBody(event));
  } catch {
    return jsonResponse(400, { message: 'リクエスト本文が正しい JSON ではありません。' });
  }
  const validation = validateBody(parsed);
  if (!validation.ok) {
    return jsonResponse(400, { message: validation.message });
  }
  const comment = createComment(validation.value);
  await putComment(client, tableName, comment);
  return jsonResponse(201, comment);
}

async function handleGet(client, tableName) {
  const comments = await listComments(client, tableName);
  return jsonResponse(200, sortNewestFirst(comments));
}

/**
 * DynamoDB クライアントとテーブル名を注入してハンドラーを作る。
 * @param {{ client: { send: Function }, tableName: string }} deps
 */
export function createHandler({ client, tableName }) {
  return async function handle(event) {
    const routeKey = event?.routeKey;
    try {
      if (routeKey === 'POST /comments') return await handlePost(event, client, tableName);
      if (routeKey === 'GET /comments') return await handleGet(client, tableName);
    } catch (error) {
      // DynamoDB などの失敗。詳細はログにだけ残し、利用者には一般的な理由を返す。
      console.error(
        JSON.stringify({
          level: 'ERROR',
          message: 'コメントの処理に失敗しました',
          routeKey,
          requestId: event?.requestContext?.requestId,
          errorName: error?.name,
          errorMessage: error?.message,
        }),
      );
      return jsonResponse(500, { message: 'サーバーでエラーが発生しました。時間をおいて再度お試しください。' });
    }
    return jsonResponse(404, { message: 'Not Found' });
  };
}

// 既定のハンドラー。クライアントは最初の呼び出し時に作るので、
// テストでこのモジュールを読み込むだけなら AWS の設定は不要。
let defaultHandler;

export async function handler(event) {
  if (!defaultHandler) {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('環境変数 TABLE_NAME が設定されていません。');
    }
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    defaultHandler = createHandler({ client, tableName });
  }
  return defaultHandler(event);
}
