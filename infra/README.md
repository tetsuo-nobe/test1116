# infra — コメントボード Mock の CDK アプリ

AWS CDK（JavaScript）で、コメントボード Mock の全リソースを 1 つのスタック（`CommentBoardStack`、リージョン ap-northeast-1）として作ります。

| リソース | 内容 |
|---|---|
| DynamoDB テーブル | パーティションキー `id`、オンデマンド、既定のサーバー側暗号化、削除時に消える |
| Lambda | `backend/src` をそのまま配置（Node.js 22、512 MB）。環境変数 `TABLE_NAME`。IAM は対象テーブルへの `dynamodb:PutItem` と `dynamodb:Scan` のみ |
| HTTP API | `POST /comments`、`GET /comments`。CORS は全オリジン許可（GET/POST/OPTIONS、`content-type`） |
| S3 バケット | 非公開。CloudFront の OAC 経由でのみ読める。削除時に中身ごと消える |
| CloudFront | `index.html` を既定で返す。HTTP は HTTPS にリダイレクト |
| BucketDeployment | `frontend/` を配置し、API URL 入りの `config.js`（`window.APP_CONFIG = { apiUrl: "..." };`）を生成して置く。`frontend/config.js`（ローカル用）は配信対象から外す |

出力: `WebUrl`（Web ページの URL）、`ApiUrl`（API のベース URL、末尾スラッシュなし）。

## 注意（必ずお読みください）

- **認証はありません（ADR-003、Mock 限定）。** デプロイすると、API と Web ページは URL を知る誰からでもインターネット経由で投稿・閲覧できます。
- 動作確認が終わったら、すぐに `cdk destroy` で削除してください。
- 認証情報やシークレットはコードに含めていません。デプロイには開発者のローカル環境の AWS 認証情報を使います。

## 前提

- Node.js 22 以上
- 初回のみ依存をインストールします（Windows の npm では `--prefix` 付きの install が失敗することがあるため、その場合はこのディレクトリで `npm install` を実行してください）。

```bash
npm --prefix infra install
```

## テスト

リポジトリのルートで実行します。AWS の認証情報も U1 の `frontend/` も不要です（配信元は `test/fixtures/frontend/` を使います）。

```bash
node --test infra/test/comment-board-stack.test.js
```

## 合成・デプロイ・削除

以下は `infra/` ディレクトリで実行します。`frontend/`（U1）がリポジトリのルートにあることが前提です。

```bash
# CloudFormation テンプレートを合成して確認する（cdk.out/ に出力）
npx cdk synth

# 初回のみ（そのアカウント・リージョンで CDK を使ったことがない場合）
npx cdk bootstrap

# デプロイする（完了後に WebUrl と ApiUrl が表示される）
npx cdk deploy

# 作成したリソースをすべて削除する
npx cdk destroy
```

`cdk deploy` は実際の AWS アカウントにリソースを作り、認証なしで公開します。実行前に上の注意を確認してください。
