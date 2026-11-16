# コード生成計画 — u1-comment-web

## Summary

- Builds: コメント投稿フォームと一覧表示の静的 Web ページ（素の HTML / JavaScript、ビルドなし）
- Touches: `frontend/`（index.html, config.js, app.js, main.js, style.css, package.json, vitest.config.js, test/app.test.js, .gitignore）
- Tests: Vitest + jsdom のユニットテスト 8 件（fetch をモック）

## 前提と入力

- 入力: `inception/units-generation/unit-of-work.md`（U1）、`inception/units-generation/unit-of-work-dependency.md`（API 仕様）、`inception/requirements-analysis/requirements.md`、`inception/domain-design/components.md`（CommentWebUI）
- 担当要件: FR1.1、FR1.3（画面側）、FR2.2、FR2.3、NFR3（XSS 防止の画面側）、NFR4
- 境界: `frontend/` 配下のみ。U2 のコードがなくてもテストが通る。
- API: `POST /comments`（201 / 400 / 500）、`GET /comments`（200 / 500）。ベース URL は `window.APP_CONFIG.apiUrl`（末尾スラッシュなし）。
- テスト用ファイル（`package.json`、`vitest.config.js`、`test/`、`node_modules/`）も `frontend/` に置く。U2 の CDK で `frontend/` を配信する際、これらを除外する（`exclude: ['node_modules/**', 'test/**', 'package*.json', 'vitest.config.js', '.gitignore']`）よう U2 担当と合意が必要。

## 実装ステップ

- [x] Step 1: プロジェクト構成と本番用設定の骨組み — `frontend/index.html`（入力欄・投稿ボタン・エラー表示領域・一覧、`data-testid` 付与、`config.js` → `main.js`（type="module"）の順に読み込み）、`frontend/config.js`（ローカル用既定値 `window.APP_CONFIG = { apiUrl: "http://localhost:3000" };`、デプロイ時に U2 が上書き）、`frontend/style.css`（最小限）、`frontend/.gitignore`（`node_modules/`）。[FR1.1, FR2.2]
- [x] Step 2: テストランナーの準備 — `frontend/package.json`（`"type": "module"`、devDependencies に `vitest`・`jsdom`、script `"test": "vitest run"`）、`frontend/vitest.config.js`（`environment: 'jsdom'`）。`npm --prefix frontend install` を実行し、`npm --prefix frontend test -- test/app.test.js` を実行可能にする。[NFR4]
- [x] Step 3: 業務ロジック（フロント側）の実装 — `frontend/app.js` に `validateBody(body)`（空・空白のみ、500 文字超をエラーメッセージで返す）と `sortNewestFirst(comments)`。[FR1.3, FR2.2]
- [x] Step 4: 業務ロジックのテストを書いて実行 — `frontend/test/app.test.js`。[FR1.3]
- [x] Step 5: API 呼び出し層の実装 — `app.js` に `fetchComments(apiUrl, fetchFn)` と `postComment(apiUrl, body, fetchFn)`。非 2xx では応答の `message`（なければ既定文言）でエラーを投げ、通信失敗も呼び出し元に伝える（握りつぶさない）。[FR1.1, FR2.3]
- [x] Step 6: API 呼び出し層のテストを書いて実行（fetch をモック）。[FR1.1, FR2.3]
- [x] Step 7: 画面の振る舞いの実装 — `app.js` に `renderComments(listEl, comments)`（本文・保存時刻を `textContent` で描画、`<time datetime>` に createdAt、新しい順）、`showError(el, message)` / `clearError(el)`、`initApp({ document, apiUrl, fetchFn })`（表示時に一覧取得、投稿時は送信前チェック → POST → 入力欄を空に → 一覧再取得、失敗時は「コメントを取得できませんでした」「コメントを投稿できませんでした: <理由>」を表示）。`frontend/main.js` は `window.APP_CONFIG.apiUrl` と `window.fetch` で `initApp` を呼ぶだけ。[FR1.1, FR1.3, FR2.2, FR2.3, NFR3]
- [x] Step 8: 画面の振る舞いのテストを書いて実行（jsdom + fetch モック）。[FR1.1, FR1.3, FR2.2, FR2.3, NFR3]
- [x] Step 9: 環境設定 — ローカル確認方法（`npx serve frontend` など静的サーバー経由。ES モジュールのため `file://` では動かない）を code-summary に記載。[NFR1]
- [x] Step 10: ドキュメントとトレーサビリティ — 関数に簡潔な JSDoc、`code-summary.md`・`traceability.json`・`source-manifest.json` の作成。

## テスト一覧（8 件）

| # | テスト | 要件 |
|---|---|---|
| T1 | `validateBody`: 空・空白のみ・501 文字はエラー、1 文字と 500 文字は OK | FR1.3 |
| T2 | `postComment`: POST・JSON ボディで呼び、201 の JSON を返す | FR1.1 |
| T3 | `fetchComments`: 500 応答で `message` 付きエラーを投げる | FR2.3 |
| T4 | 画面: 本文入力 → 投稿で POST が呼ばれ、入力欄が空になり、一覧が再取得され先頭に表示される | FR1.1, FR2.2 |
| T5 | 画面: 空白のみで投稿するとエラー表示され、fetch（POST）は呼ばれない | FR1.3 |
| T6 | 画面: API が 400 を返すとその `message` を含むエラーを表示し、入力欄は残る | FR1.3 |
| T7 | 画面: 表示時の一覧取得が失敗（通信エラー）すると「コメントを取得できませんでした」を表示 | FR2.3 |
| T8 | 画面: `<script>` を含む本文がテキストとして描画され、要素として挿入されない | NFR3 |

## 要件とステップの対応

| 要件 | ステップ | テスト |
|---|---|---|
| FR1.1 | Step 1, 5, 7 | T2, T4 |
| FR1.3（画面側） | Step 3, 7 | T1, T5, T6 |
| FR2.2 | Step 1, 3, 7 | T4 |
| FR2.3 | Step 5, 7 | T3, T7 |
| NFR3（画面側） | Step 7 | T8 |
| NFR4 | Step 2 | 全件 |

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

データモデル層・リポジトリ層は U1（ブラウザ側）に存在しないため省略し、API 層はフロントの API 呼び出し関数として扱う。

