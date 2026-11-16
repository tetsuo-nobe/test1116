# ユニットテスト手順 — u1-comment-web

## テストフレームワークと設定

- ランナー: Vitest（`frontend/package.json` の devDependencies）
- DOM 環境: jsdom（`frontend/vitest.config.js` で `environment: 'jsdom'`）
- Node.js 22.13.0 以上（`frontend/package.json` の `engines`。jsdom 29 の要件）

## 準備（初回のみ）

```bash
(cd frontend && npm ci)
```

`npm --prefix frontend install` はこの環境（Windows / npm 10.9.2）でルートの `package.json` を探して失敗するため、`frontend/` に移動して実行する。`package-lock.json` があるので `npm ci` を使う。

## この UNIT のテストの実行

```bash
npm --prefix frontend test -- test/app.test.js
```

`npm --prefix frontend test` は `frontend/` をカレントにして `vitest run` を実行する。引数でテストファイルを `test/app.test.js` に限定しているため、この UNIT のテストだけが走る。U2（`backend/`・`infra/`）のコードは不要。

## 期待するカバレッジ

- Minimal 戦略: 担当要件ごとに 1 件以上（FR1.1、FR1.3 画面側、FR2.2、FR2.3、NFR3 画面側）＋ コンポーネントの正常系 1 件以上。計 8 件（計画の T1〜T8）。
- express スコープのため行カバレッジの下限はない。カバレッジ閾値は設定しない。

## モック・スタブの方針

- `fetch` は `vi.fn()` で作ったモックを `initApp({ fetchFn })` / `postComment(..., fetchFn)` に注入する。グローバルの `fetch` は書き換えない。
- 応答は `{ ok, status, json: async () => ... }` の最小オブジェクトで表す。通信エラーは `mockRejectedValue(new TypeError('Failed to fetch'))`。
- DOM は各テストの `beforeEach` で `document.body.innerHTML` に `index.html` と同じ要素（`data-testid` 付き）を組み立てる。

## テストデータ

- コメントはテスト内の固定値（`id`、`body`、`createdAt` は固定の ISO 8601 UTC 文字列）。
- 並び順の確認には createdAt の異なる 2 件を使う。
- 長さ境界は `'a'.repeat(500)`（OK）と `'a'.repeat(501)`（エラー）。
