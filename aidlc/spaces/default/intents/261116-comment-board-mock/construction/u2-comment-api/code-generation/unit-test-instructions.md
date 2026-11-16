# ユニットテスト手順 — u2-comment-api

## テストフレームワーク

- Node.js 22 組み込みのテストランナー `node:test` と `node:assert/strict` を使う。追加の設定ファイルは不要。
- 事前準備（初回のみ）: `npm --prefix backend install` と `npm --prefix infra install`

## この UNIT のテストを実行する

バックエンド（検証・ハンドラー、10 件）:

```bash
node --test backend/test/validation.test.mjs backend/test/handler.test.mjs
```

インフラ（CDK スタック、3 件）:

```bash
node --test infra/test/comment-board-stack.test.js
```

どちらもリポジトリのルートで実行する。AWS の認証情報も U1 の `frontend/` も不要。

## 期待するカバレッジ

- Minimal 戦略: 要件ごとに 1 件以上（FR1.2、FR1.3、FR2.1、NFR1、NFR3）と、コンポーネントごとに正常系 1 件以上。
- express スコープのため行カバレッジの下限はない。

## モック・スタブの方針

- DynamoDB: `createHandler({ client, tableName })` に `send(command)` を持つ偽クライアントを渡す。送られたコマンドの種類（`PutCommand` / `ScanCommand`）と入力を記録し、返す値や投げる例外をテストごとに決める。
- ログ: DynamoDB 失敗のテストでは `console.error` を `mock.method` で差し替えて呼び出しを確認する。
- CDK: `aws-cdk-lib/assertions` の `Template` で合成結果を検査する。配信元は `infra/test/fixtures/frontend/` を props で渡す。

## テストデータ

- コメント本文はテスト内の固定文字列（`"hello"`、空文字、空白のみ、501 文字）。
- 一覧の並び順は `createdAt` が異なる固定の 2 件で確認する。
