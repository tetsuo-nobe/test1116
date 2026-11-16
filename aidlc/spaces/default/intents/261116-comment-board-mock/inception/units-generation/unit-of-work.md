# Unit of Work — コメントボード Mock

Domain Design の 2 コンポーネント（ADR-001: フロント/バック分割）をそれぞれ 1 UNIT とし、2 名で分担する。

| Unit ID | Directory | Kind | 実装するコンポーネント | 担当 | 規模 |
|---|---|---|---|---|---|
| U1 | u1-comment-web | ui | CommentWebUI | 担当者 1 | S |
| U2 | u2-comment-api | service | CommentService（+ デプロイ用 IaC） | 担当者 2 | M |

## U1 — u1-comment-web（kind: `ui`）

- **説明**: ブラウザで動く素の HTML / JavaScript の Web ページ。ビルド工程なし。
- **境界**: リポジトリの `frontend/` 配下のみ。
- **責務**:
  - 本文入力欄と投稿ボタン（FR1.1）
  - 一覧の取得と新しい順の表示（FR2.2）、取得・投稿失敗時のエラー表示（FR2.3、FR1.3 の画面側）
  - 本文は `textContent` で描画（NFR3 の XSS 防止）
  - API の URL は `frontend/config.js` の `window.APP_CONFIG.apiUrl` から読む（デプロイ時に U2 の CDK が生成して上書き。ローカル用の既定ファイルを U1 が用意）
- **デプロイ形態**: 静的ファイルとして S3 + CloudFront で配信（配信基盤は U2 の CDK が作る）
- **実装メモ**: API 呼び出しと描画ロジックを関数に分け、Node.js のテストランナー（例: Vitest + jsdom）で fetch をモックしてテストする。U2 のコードがなくてもテストが通ること。

## U2 — u2-comment-api（kind: `service`）

- **説明**: AWS Lambda（Node.js / JavaScript）+ API Gateway の保存・一覧 API と、全リソースを作る AWS CDK（JavaScript）アプリ。
- **境界**: `backend/`（Lambda ハンドラー）と `infra/`（CDK アプリ）。
- **責務**:
  - `POST /comments`: 検証（必須・空白のみ不可・500 文字以内）、ID（UUID）と createdAt（UTC ISO 8601）の付与、DynamoDB へ保存（FR1.2、FR1.3）
  - `GET /comments`: 全件取得し createdAt の新しい順で返す（FR2.1）
  - CORS 許可、DynamoDB 失敗時のログ出力と HTTP 500
  - CDK: DynamoDB テーブル（パーティションキー `id`）、Lambda（対象テーブルのみの最小権限）、API Gateway（HTTP API）、S3 + CloudFront（`frontend/` を配信し、`config.js` に API URL を書き込む）。`cdk deploy` / `cdk destroy` で作成・削除できること（NFR1）
- **デプロイ形態**: 単一 CDK スタックで一括デプロイ（独立デプロイ不要）
- **実装メモ**: ハンドラーは DynamoDB クライアントを差し替え可能にし、AWS SDK をモックしてユニットテストする。U1 のコードがなくてもテストが通ること。`frontend/` の配信設定は、統合後の Build and Test で `cdk synth` により確認する。
