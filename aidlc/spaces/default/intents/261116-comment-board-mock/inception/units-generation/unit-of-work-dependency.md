# UNIT 間の依存関係 — コメントボード Mock

## 依存 DAG

U1 と U2 の間にコード上の依存はない。どちらも相手のコードなしでビルド・テストできるため、2 名が同時に開発できる。実行時の結合点は下記の API 仕様だけ。

```yaml
units:
  - name: u1-comment-web
    kind: ui
    depends_on: []
  - name: u2-comment-api
    kind: service
    depends_on: []
```

## 結合点（API 仕様 — 両 UNIT はこれに従う）

ベース URL は `window.APP_CONFIG.apiUrl`（末尾スラッシュなし）。JSON、UTF-8、CORS 許可。

| メソッド・パス | リクエスト | 成功応答 | エラー応答 |
|---|---|---|---|
| `POST /comments` | `{"body": "<1〜500 文字、空白のみ不可>"}` | `201` `{"id": "<uuid>", "body": "...", "createdAt": "<ISO 8601 UTC>"}` | `400` `{"message": "<理由>"}`、`500` `{"message": "<理由>"}` |
| `GET /comments` | なし | `200` `[{"id": "...", "body": "...", "createdAt": "..."}]`（createdAt の新しい順、0 件は `[]`） | `500` `{"message": "<理由>"}` |

- 設定の受け渡し: U2 の CDK がデプロイ時に `config.js`（`window.APP_CONFIG = { apiUrl: "<API URL>" };`）を生成し、配信用バケットに置く。U1 はこのファイルを `index.html` から読み込むだけ。
- 配信対象: U2 の CDK は `frontend/` ディレクトリをそのまま配信する。

## 並行開発

- {u1-comment-web, u2-comment-api} は辺がないため同時に着手できる（どちらの順でもよい）。
