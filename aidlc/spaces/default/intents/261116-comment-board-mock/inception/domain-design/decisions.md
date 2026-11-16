# アーキテクチャ決定記録（ADR）— コメントボード Mock

## ADR-001: フロントエンド（CommentWebUI）とバックエンド（CommentService）の 2 コンポーネントに分ける

- **Context** — 2 名でコンストラクションを分担する（確認質問 Q4: フロント/バックで分割）。スピード最優先の Mock で、機能は投稿と一覧のみ。
- **Decision** — ブラウザで動く CommentWebUI と、検証・永続化を担う CommentService の 2 つに分ける。両者は同期 HTTP（REST/JSON）だけでつながる。
- **Consequences** — 正: API の入出力を先に決めれば 2 名が独立に並行開発・テストできる。依存は一方向のみで単純。負: API 仕様が両者の結合点になるため、変更時は 2 名の調整が必要。
- **Alternatives Rejected** — (1) 投稿/一覧での縦分割: Comment の所有者が分かれ、同じテーブルを 2 者が書き換える設計になる。(2) 単一コンポーネント: 2 名での分担という要求に合わない。

## ADR-002: Comment エンティティの所有者を CommentService に限定する

- **Context** — Comment は DynamoDB に保存される唯一のデータ。UI からの直接アクセスも技術的には可能。
- **Decision** — Comment の生成（ID・保存時刻の付与）、検証、保存、取得はすべて CommentService が行う。CommentWebUI は DynamoDB に直接アクセスしない。
- **Consequences** — 正: 検証ルールが 1 か所に集まり、ブラウザに AWS 認証情報を渡さずに済む（セキュリティ）。負: 一覧取得にも API 呼び出しが 1 段挟まる（Mock では問題にならない）。
- **Alternatives Rejected** — ブラウザから DynamoDB に直接アクセス（Cognito Identity Pool 等）: 認証情報の配布が必要になり、セキュリティ面でも実装スピード面でも不利。

## ADR-003: 認証なしで公開する（Mock 限定）

- **Context** — 要件 NFR3 で認証なしの Mock と決めた。実 AWS にデプロイするため、API と Web ページはインターネットから到達可能になる。
- **Decision** — 認証は実装しない。代わりに入力検証（500 文字上限）、XSS を防ぐ描画、Lambda の最小権限 IAM で被害範囲を抑える。検証後はリソースを削除する前提とする。
- **Consequences** — 正: 実装が最速になる。負: URL を知る誰でも投稿・閲覧できる。本番利用には認証の追加が必須。
- **Alternatives Rejected** — (1) API キー: ブラウザに埋め込むため実質的な保護にならない。(2) Cognito 認証: Mock の範囲を超えて実装を遅くする。
