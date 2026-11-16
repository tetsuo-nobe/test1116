# コード生成計画 — u2-comment-api

## Summary

- Builds: コメント保存・一覧 API（Lambda + HTTP API）と、DynamoDB・S3・CloudFront を作る CDK スタック
- Touches: `backend/`（Lambda ハンドラーとテスト）、`infra/`（CDK アプリとテスト）
- Tests: ユニットテスト 13 件（検証 4、ハンドラー 6、CDK スタック 3）、Node.js 組み込みのテストランナー（`node:test`）を使用

## 方針

- 言語は JavaScript（Node.js 22）。Lambda は ES Modules（`.mjs`）、CDK は CommonJS（CDK の JavaScript テンプレートと同じ形）。
- テストランナーは Node.js 組み込みの `node:test`。追加のテスト用パッケージは入れない。
- Lambda は 1 関数で `POST /comments` と `GET /comments` を `routeKey` で振り分ける。
- Lambda の AWS SDK v3 は Node.js 22 ランタイムに同梱のものを使う。デプロイ資産は `backend/src/` のみでバンドル不要。
- DynamoDB クライアントはハンドラー生成関数に注入できる形にし、テストでは偽クライアントを渡す（U1 のコードも AWS もなしでテストが通る）。
- CDK スタックは配信元ディレクトリを props で受け取る（既定は `../frontend`）。テストでは `infra/test/fixtures/frontend/` を使うので U1 のコードがなくても通る。
- `config.js` は `BucketDeployment` が API URL を入れて生成し、`frontend/config.js` は配信対象から除外して上書きされないようにする。
- `node_modules/` と `cdk.out/` は `backend/.gitignore` と `infra/.gitignore` で除外する。ルートの `.gitignore` は変更しない。
- このステージではデプロイしない（`cdk deploy` は実行しない）。デプロイすると API と Web ページは認証なしでインターネットに公開される（ADR-003）。

## 手順

- [x] Step 1: プロジェクト構成 — `backend/package.json`（`"type": "module"`、依存 `@aws-sdk/client-dynamodb`、`@aws-sdk/lib-dynamodb`）、`backend/.gitignore`、`infra/package.json`（依存 `aws-cdk-lib`、`constructs`、開発依存 `aws-cdk`）、`infra/cdk.json`、`infra/.gitignore` を作り、両方で `npm install` を実行する。（全要件の土台）
- [x] Step 2: テストランナーの準備 — 両 `package.json` に `"test": "node --test"` を定義し、`unit-test-instructions.md` のコマンドが実行できることを確認する。
- [x] Step 3: データアクセス層の実装 — `backend/src/repository.mjs`：`putComment(client, tableName, comment)`、`listComments(client, tableName)`（`LastEvaluatedKey` を追って Scan で全件取得）。（FR1.2、FR2.1）
- [x] Step 4: ビジネスロジックの実装 — `backend/src/validation.mjs`：`validateBody(body)`（文字列必須、trim 後の空は不可、500 文字以内）。`backend/src/comment.mjs`：`createComment(body)`（`crypto.randomUUID()` と UTC ISO 8601 の `createdAt` を付与）、`sortNewestFirst(list)`。（FR1.2、FR1.3、FR2.1）
- [x] Step 5: ビジネスロジックのテスト — `backend/test/validation.test.mjs`（正常、空、空白のみ、501 文字）を書いて実行する。（FR1.3）
- [x] Step 6: API 層の実装 — `backend/src/handler.mjs`：`createHandler({ client, tableName })` と、環境変数 `TABLE_NAME` で作る既定の `handler`。POST は JSON 解析、検証、保存、`201`。不正な JSON・検証エラーは `400 {"message"}`。GET は全件を新しい順に `200`。DynamoDB の失敗は `console.error` に記録して `500 {"message"}`。未対応ルートは `404`。応答はすべて `Content-Type: application/json`。（FR1.2、FR1.3、FR2.1）
- [x] Step 7: API 層とデータアクセス層のテスト — `backend/test/handler.test.mjs`（POST 201 で保存される、POST 400 で保存されない、不正な JSON で 400、GET が新しい順、GET 0 件で `[]`、DynamoDB 失敗で 500 とログ出力）を書いて実行する。（FR1.2、FR1.3、FR2.1）
- [x] Step 8: インフラの実装 — `infra/lib/comment-board-stack.js`：DynamoDB テーブル（パーティションキー `id`、オンデマンド、既定のサーバー側暗号化、`RemovalPolicy.DESTROY`）、Lambda（`nodejs22.x`、`backend/src`、`TABLE_NAME`、対象テーブルへの `dynamodb:PutItem` と `dynamodb:Scan` のみ許可）、HTTP API（`POST /comments`、`GET /comments`、CORS で全オリジン許可）、S3 バケット（非公開、`autoDeleteObjects`）、CloudFront（OAC 経由）、`BucketDeployment`（配信元ディレクトリ + 生成した `config.js`）、出力 `WebUrl`・`ApiUrl`。`infra/bin/app.js`（リージョン ap-northeast-1）。（NFR1、NFR3）
- [x] Step 9: インフラのテスト — `infra/test/fixtures/frontend/index.html` と `infra/test/comment-board-stack.test.js`（テーブルのキーと削除ポリシー、Lambda の IAM がテーブル ARN への PutItem/Scan のみ、HTTP API のルート・CORS・CloudFront・出力）を書いて実行する。（NFR1、NFR3）
- [x] Step 10: ドキュメントとトレーサビリティ — `backend/README.md` と `infra/README.md`（テスト・`cdk synth`・`cdk deploy`・`cdk destroy` の手順と、認証なしで公開される注意）を書く。

## 要件と手順の対応

| 要件 | 手順 |
|---|---|
| FR1.2 保存（ID・時刻付与、201） | Step 3, 4, 6, 7 |
| FR1.3 入力検証（400、保存しない） | Step 4, 5, 6, 7 |
| FR2.1 一覧（新しい順、0 件は空配列） | Step 3, 4, 6, 7 |
| NFR1 1 コマンドでデプロイ・削除 | Step 8, 9, 10 |
| NFR2 応答性 | Step 8（Lambda 512 MB、Scan 1 回で 100 件程度は十分） |
| NFR3 セキュリティ | Step 6, 8, 9 |
| NFR4 テスト | Step 5, 7, 9 |

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:6cb23162168334768ff8f29699669845616670119c9eb58bf9bb05af6fefd3de",
  "contract_sha256": "sha256:283a836cf0757ed2efa4b5dd3135f3986eb59880b3017f4ba87a685cfebedfdb"
}
```

