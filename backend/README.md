# backend — コメント保存・一覧 API（CommentService）

API Gateway HTTP API から呼ばれる AWS Lambda（Node.js 22、ES Modules）です。1 つの関数で次の 2 つのルートを扱います。

| メソッド・パス | 成功 | エラー |
|---|---|---|
| `POST /comments`（`{"body": "..."}`） | `201` `{"id", "body", "createdAt"}` | `400` `{"message"}`（不正な JSON、空・空白のみ、500 文字超）、`500` `{"message"}` |
| `GET /comments` | `200` コメントの配列（`createdAt` の新しい順、0 件は `[]`） | `500` `{"message"}` |

- `id` は UUID、`createdAt` は UTC の ISO 8601（例: `2026-11-16T02:00:00.000Z`）。
- 未対応のルートは `404`。応答はすべて `Content-Type: application/json`。
- DynamoDB の失敗は `console.error` に JSON で記録し、利用者には一般的なメッセージだけを返します。
- CORS は HTTP API 側で設定しています（`infra/` を参照）。

## 構成

| ファイル | 役割 |
|---|---|
| `src/handler.mjs` | API 層。`createHandler({ client, tableName })` と、環境変数 `TABLE_NAME` で動く既定の `handler`（CDK のハンドラー指定は `handler.handler`） |
| `src/validation.mjs` | 入力検証（文字列必須、空白のみ不可、500 文字以内） |
| `src/comment.mjs` | Comment の生成（ID・保存時刻）と新しい順の並べ替え |
| `src/repository.mjs` | DynamoDB への保存（PutItem）と全件取得（Scan、続きがあれば追って読む） |

AWS SDK v3 は Lambda の Node.js 22 ランタイムに同梱のものを使うため、デプロイ資産は `src/` だけでバンドルは不要です。`package.json` の依存はローカルでのテスト用です。

## テスト

初回のみ依存をインストールします（Windows の npm では `--prefix` 付きの install が失敗することがあるため、その場合はこのディレクトリで `npm install` を実行してください）。

```bash
npm --prefix backend install
```

リポジトリのルートで実行します。AWS の認証情報は不要です（DynamoDB は偽クライアントで置き換えています）。

```bash
node --test backend/test/validation.test.mjs backend/test/handler.test.mjs
```

## デプロイ

この関数は `infra/` の CDK スタックで一緒にデプロイされます。手順と注意は `infra/README.md` を参照してください。
