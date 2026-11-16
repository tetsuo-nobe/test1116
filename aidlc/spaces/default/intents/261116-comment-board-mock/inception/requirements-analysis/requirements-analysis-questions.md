# 要件分析 — 確認質問

初期リクエスト: 「非常にシンプルでMockレベルのWebアプリケーション。Webページで入力されたコメントをバックエンドのDynamoDBテーブルへ保存し、Webページにコメント一覧を表示する。コンストラクションではUNITを2名で分割して行う。」

Minimal 深度のため、要件を書くのに欠かせない点だけを確認します。

## Q1. [プロダクトオーナー] コメントとして保存・表示する項目

コメント1件に何を持たせるかで、画面の入力欄と DynamoDB の項目が決まります。

A. コメント本文のみ（保存時刻はシステムが自動付与し、一覧は新しい順）
B. 投稿者名 + コメント本文（保存時刻は自動付与し、一覧に表示）
C. 投稿者名 + コメント本文 + 保存時刻の表示に加えて、削除機能も付ける
X. Other (please specify)

[Answer]: A（依頼者の指示「重要な質問以外は任せる・スピード重視」により選択）

## Q2. [開発者] バックエンドの実装方式と言語

コメント保存 API と一覧取得 API をどの形で作るかを決めます。

A. AWS Lambda（Node.js / TypeScript）+ API Gateway
B. AWS Lambda（Python）+ API Gateway
C. ローカルで動く Node.js（Express）サーバー
D. ローカルで動く Python（FastAPI）サーバー
X. Other (please specify)

[Answer]: X. Node.js（JavaScript）で実装し、実行環境は Q3 の回答に合わせる（ローカルなら Express、AWS なら Lambda + API Gateway）（依頼者の指示「重要な質問以外は任せる・スピード重視」により選択）

## Q3. [運用エンジニア] DynamoDB テーブルとアプリをどこで動かすか

Mock レベルのため、実 AWS アカウントへのデプロイが必要かどうかで成果物（IaC の有無）が変わります。

A. ローカルのみ（DynamoDB Local を Docker で起動し、実 AWS は使わない）
B. 実 AWS アカウントにデプロイ（CDK または SAM でテーブル・API・静的ページを作成）
C. 開発はローカル（DynamoDB Local）、加えて実 AWS へデプロイできる IaC も用意
X. Other (please specify)

[Answer]: B

## Q4. [デリバリーマネージャー] 2名での UNIT 分割方法

コンストラクションを2名で分担するため、UNIT の切り方を決めます。

A. UNIT1 = フロントエンド（Web ページ: 入力フォームと一覧表示）、UNIT2 = バックエンド（API + DynamoDB テーブル）。API の入出力を先に取り決めて並行開発
B. UNIT1 = コメント投稿機能（画面〜API〜DynamoDB を縦に一貫）、UNIT2 = コメント一覧表示機能（同じく縦に一貫）
X. Other (please specify)

[Answer]: A
