#!/usr/bin/env node
// CDK アプリのエントリポイント。リージョンは ap-northeast-1（東京）。
// アカウントはデプロイ時の AWS 認証情報から決まる（コードには埋め込まない）。
const { App } = require('aws-cdk-lib');
const { CommentBoardStack } = require('../lib/comment-board-stack');

const app = new App();

new CommentBoardStack(app, 'CommentBoardStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ap-northeast-1',
  },
  description: 'コメントボード Mock（認証なし。検証後は cdk destroy で削除すること）',
});
