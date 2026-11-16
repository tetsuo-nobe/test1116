# コード概要 — u1-comment-web

## 作成したファイル（すべて新規、`frontend/` 配下）

| ファイル | 内容 |
|---|---|
| `index.html` | 投稿フォーム・エラー表示領域・一覧。`config.js` → `main.js`（type="module"）の順に読み込む。`data-testid`: `comment-form`, `comment-form-body-input`, `comment-form-submit-button`, `comment-error-message`, `comment-list`（行は `comment-list-item` / `-body` / `-created-at`、0 件は `comment-list-empty`） |
| `config.js` | `window.APP_CONFIG = { apiUrl: "http://localhost:3000" };`（ローカル既定値。デプロイ時に U2 の CDK が上書き） |
| `style.css` | 最小限のスタイル |
| `app.js` | 業務ロジック（`validateBody`, `sortNewestFirst`, `MAX_BODY_LENGTH`）、API 呼び出し（`ApiError`, `fetchComments`, `postComment`）、画面（`renderComments`, `showError`, `clearError`, `initApp`）。日本語 JSDoc 付き |
| `main.js` | `window.APP_CONFIG.apiUrl` と `window.fetch` で `initApp` を呼ぶだけ |
| `test/app.test.js` | T1〜T8 |
| `package.json` / `package-lock.json` | `"type": "module"`、`"test": "vitest run"`、devDependencies: vitest ^5.1.0, jsdom ^29.1.1、engines: node >=22.13.0 |
| `vitest.config.js` | `environment: 'jsdom'` |
| `.gitignore` | `node_modules/` |

## 主な実装判断

- 本文・保存時刻は `textContent` で描画し、保存時刻は `<time datetime="<createdAt>">` に入れる（NFR3）。
- 一覧は API の順序に加えて画面側でも createdAt の新しい順に並べ直す（FR2.2）。
- 送信前チェック: 空・空白のみ・500 文字超はエラー表示し、API を呼ばない。文字数は `String#length`（UTF-16 単位、textarea の `maxlength` と同じ）で数える。最終判定は U2。
- エラー表示: 一覧取得失敗は「コメントを取得できませんでした」、投稿失敗は「コメントを投稿できませんでした: <理由>」（400/500 は応答の `message`、通信失敗は「通信に失敗しました」）。エラーは `console.error` にも記録する。
- fetch は `initApp({ fetchFn })` に注入し、テストではグローバルの fetch を書き換えない。

## テスト

- 実行: `npm --prefix frontend test -- test/app.test.js` → **8 passed / 0 failed**（vitest v5.1.0）
- 対象: FR1.1（T2, T4）、FR1.3 画面側（T1, T5, T6）、FR2.2（T4）、FR2.3（T3, T7）、NFR3（T8）
- この段階で実行していないテスト: なし。

## ローカルでの確認方法

1. 準備: `(cd frontend && npm ci)`
2. `frontend/config.js` の `apiUrl` を API の URL（末尾スラッシュなし）にする。
3. 静的サーバー経由で開く（例: `npx serve frontend`）。ES モジュールを使うため `file://` では動かない。（この段階では未実行）

## 計画からの逸脱

1. インストール手順: `npm --prefix frontend install` はこの環境で失敗したため、`frontend/` に移動して実行する手順に変更した（`unit-test-instructions.md` も更新）。
2. 依存バージョン: vitest ^3.2.4 は npm audit で重大 2 件・中程度 1 件の指摘があったため ^5.1.0 に上げた。jsdom 31.x はローカルの Node v22.17.0 で動かないため ^29.1.1 にした。audit は 0 件。
3. 送信前チェックのエラーにも「コメントを投稿できませんでした: 」の接頭辞を付けた。

## U2 担当への申し送り

- CDK で `frontend/` を配信するとき、`node_modules/**`, `test/**`, `package*.json`, `vitest.config.js`, `.gitignore` を除外すること。
- 500 文字の判定は UTF-16 単位（`String#length`）で揃えること（絵文字を含む本文で画面と API の判定がずれないように）。
