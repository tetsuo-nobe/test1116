# コード生成サマリー — u2-comment-api

## 作成したファイル（既存ファイルの変更なし）

| 場所 | ファイル |
|---|---|
| `backend/` | `package.json`、`package-lock.json`、`.gitignore`、`README.md` |
| `backend/src/` | `handler.mjs`（POST/GET の振り分け）、`validation.mjs`、`comment.mjs`、`repository.mjs` |
| `backend/test/` | `validation.test.mjs`（4 件）、`handler.test.mjs`（6 件） |
| `infra/` | `package.json`、`package-lock.json`、`cdk.json`、`.gitignore`、`README.md` |
| `infra/bin/`・`infra/lib/` | `app.js`（ap-northeast-1）、`comment-board-stack.js` |
| `infra/test/` | `comment-board-stack.test.js`（3 件）、`fixtures/frontend/index.html` |

使用バージョン: aws-cdk-lib 2.277.0、aws-cdk 2.1148.1、constructs 10.8.1、@aws-sdk/* ^3.700.0。

## 主な実装判断

- IAM は `table.grant(fn, 'dynamodb:PutItem', 'dynamodb:Scan')` で対象テーブルの 2 操作だけを許可（NFR3）。テストで確認済み。
- Lambda のロググループを明示的に作り（保持 1 週間、削除時に消す）、`cdk destroy` で残らないようにした（NFR1）。
- Lambda は 512 MB、タイムアウト 10 秒（NFR2）。
- 保存時に `attribute_not_exists(id)` を条件にして ID の上書きを防ぐ。
- 文字数はコードポイントで数える（絵文字 1 文字 = 1）。
- 500 応答の本文は一般的なメッセージのみ。詳細は `console.error` に JSON で出す。
- `config.js` は `BucketDeployment` が API URL を入れて生成し、`frontend/config.js` はアップロードから除外する。
- S3 は非公開・SSL 必須・S3 管理の暗号化。CloudFront は OAC 経由・HTTPS へリダイレクト・既定のルートは `index.html`。

## テスト結果

| コマンド | 結果 |
|---|---|
| `node --test backend/test/validation.test.mjs backend/test/handler.test.mjs` | 10 件中 10 件成功 |
| `node --test infra/test/comment-board-stack.test.js` | 3 件中 3 件成功 |

カバレッジの下限はなし（express スコープ）。

## 書いたが実行していないもの

- `cdk synth`（本物の `frontend/` を使うもの）: U1 の `frontend/` がまだないため、統合後の Build and Test で実行する。
- `frontend/config.js` をアップロードから除外する設定のテスト: テスト用のフォルダに `config.js` がないため、本物の `frontend/` がそろうまで確認できない。
- `cdk deploy` / `cdk destroy`: このステージでは AWS にデプロイしない。

## 計画からのずれ・注意点

- `unit-test-instructions.md` の事前準備にある `npm --prefix backend install` は、この Windows 環境の npm 10.9.2 ではエラー（ENOENT）になった。各フォルダ内で `npm install` を実行すれば動く（両 README に記載）。
- `npm audit` で、aws-cdk-lib に同梱された `minimatch` に中程度の指摘が 2 件ある。開発端末でのビルド時だけ使われる。計画にないため `npm audit fix` は実行していない。
- BucketDeployment と autoDeleteObjects のために CDK が作る補助 Lambda のロググループは、`cdk destroy` 後も残ることがある（NFR1「何も残らない」に対する小さなずれ）。
- デプロイすると、API と Web ページは認証なしでインターネットに公開される（ADR-003）。
