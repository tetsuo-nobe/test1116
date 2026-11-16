# 要件と UNIT の対応表 — コメントボード Mock

User Stories は作成していないため、要件 ID（FR）で対応付ける。

| 要件 | Unit ID | Directory |
|---|---|---|
| FR1.1 | U1 | u1-comment-web |
| FR1.2 | U2 | u2-comment-api |
| FR1.3 | U1; U2 | u1-comment-web; u2-comment-api |
| FR2.1 | U2 | u2-comment-api |
| FR2.2 | U1 | u1-comment-web |
| FR2.3 | U1 | u1-comment-web |

## 複数 UNIT にまたがる要件

- FR1.3（入力検証）: U2 が最終判定して HTTP 400 を返し、U1 は送信前チェックとエラーメッセージ表示を担う。

## UNIT 内の実装順

- U1: config.js 既定値 → API 呼び出し関数 → 描画関数 → フォーム処理 → テスト
- U2: 検証関数 → ハンドラー（POST/GET）→ テスト → CDK スタック

## 網羅性の確認

- FR1.1〜FR2.3 の 6 件すべてに UNIT を割り当て済み。U1・U2 のどちらにも対応行がある。
