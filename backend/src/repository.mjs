// データアクセス層: DynamoDB へのコメント保存と全件取得。
// client は `send(command)` を持つ DynamoDBDocumentClient（テストでは偽クライアント）。
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

/**
 * コメントを 1 件保存する。
 * @param {{ send: Function }} client
 * @param {string} tableName
 * @param {{ id: string, body: string, createdAt: string }} comment
 */
export async function putComment(client, tableName, comment) {
  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: comment,
      // 同じ id の上書きを防ぐ（UUID なので通常は起きない）
      ConditionExpression: 'attribute_not_exists(id)',
    }),
  );
}

/**
 * テーブルの全コメントを取得する。Scan の 1 MB 上限を超える場合は
 * LastEvaluatedKey を追って続きを読む。
 * @param {{ send: Function }} client
 * @param {string} tableName
 * @returns {Promise<Array<{ id: string, body: string, createdAt: string }>>}
 */
export async function listComments(client, tableName) {
  const items = [];
  let exclusiveStartKey;
  do {
    const result = await client.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey }),
    );
    items.push(...(result.Items ?? []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}
