// CDK スタックのテスト（NFR1、NFR3）。合成結果を aws-cdk-lib/assertions で検査する。
// AWS の認証情報も U1 の frontend/ も不要（配信元はテスト用のフィクスチャ）。
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { App } = require('aws-cdk-lib');
const { Template, Match } = require('aws-cdk-lib/assertions');
const { CommentBoardStack, buildConfigJs } = require('../lib/comment-board-stack');

const FIXTURE_FRONTEND_DIR = path.join(__dirname, 'fixtures/frontend');

let template;

before(() => {
  const app = new App();
  const stack = new CommentBoardStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
    frontendDir: FIXTURE_FRONTEND_DIR,
  });
  template = Template.fromStack(stack);
});

function onlyLogicalId(resources) {
  const ids = Object.keys(resources);
  assert.equal(ids.length, 1, `リソースが 1 つではありません: ${ids.join(', ')}`);
  return ids[0];
}

test('DynamoDB テーブルはパーティションキー id・オンデマンドで、削除時に消える', () => {
  template.resourceCountIs('AWS::DynamoDB::Table', 1);
  template.hasResource('AWS::DynamoDB::Table', {
    Properties: {
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    DeletionPolicy: 'Delete',
    UpdateReplacePolicy: 'Delete',
  });
  // 配信用バケットも削除時に消える（中身は autoDeleteObjects で空にする）
  template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Delete' });
  template.hasResourceProperties('Custom::S3AutoDeleteObjects', {});
});

test('Lambda の IAM はテーブル ARN への PutItem と Scan だけを許可する', () => {
  const tableId = onlyLogicalId(template.findResources('AWS::DynamoDB::Table'));
  const functions = template.findResources('AWS::Lambda::Function', {
    Properties: { Handler: 'handler.handler' },
  });
  const functionId = onlyLogicalId(functions);
  const fn = functions[functionId].Properties;
  assert.equal(fn.Runtime, 'nodejs22.x');
  assert.deepEqual(fn.Environment.Variables.TABLE_NAME, { Ref: tableId });
  const roleId = fn.Role['Fn::GetAtt'][0];

  const policies = template.findResources('AWS::IAM::Policy', {
    Properties: { Roles: [{ Ref: roleId }] },
  });
  const statements = Object.values(policies).flatMap((p) => p.Properties.PolicyDocument.Statement);
  assert.deepEqual(statements, [
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem', 'dynamodb:Scan'],
      Resource: [{ 'Fn::GetAtt': [tableId, 'Arn'] }],
    },
  ]);
  // 関数のロールに付く管理ポリシーはログ出力用の基本実行ロールだけ
  const role = template.toJSON().Resources[roleId].Properties;
  assert.equal(role.ManagedPolicyArns.length, 1);
  assert.match(JSON.stringify(role.ManagedPolicyArns[0]), /AWSLambdaBasicExecutionRole/);
});

test('HTTP API のルートと CORS、OAC 経由の CloudFront、config.js の生成、出力がある', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
    ProtocolType: 'HTTP',
    CorsConfiguration: {
      AllowOrigins: ['*'],
      AllowMethods: ['GET', 'POST', 'OPTIONS'],
      AllowHeaders: ['content-type'],
    },
  });
  const routeKeys = Object.values(template.findResources('AWS::ApiGatewayV2::Route'))
    .map((r) => r.Properties.RouteKey)
    .sort();
  assert.deepEqual(routeKeys, ['GET /comments', 'POST /comments']);

  template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: 'index.html',
      DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      Origins: [Match.objectLike({ OriginAccessControlId: Match.anyValue() })],
    }),
  });

  // BucketDeployment は配信元と config.js（API URL 入り）の 2 つのソースを置く
  const deployments = Object.values(template.findResources('Custom::CDKBucketDeployment'));
  assert.equal(deployments.length, 1);
  const deployment = deployments[0].Properties;
  assert.equal(deployment.SourceBucketNames.length, 2);
  const apiId = onlyLogicalId(template.findResources('AWS::ApiGatewayV2::Api'));
  // config.js の中の API URL はデプロイ時に HTTP API のエンドポイントで置き換わる
  assert.deepEqual(Object.values(deployment.SourceMarkers[1]), [
    { 'Fn::GetAtt': [apiId, 'ApiEndpoint'] },
  ]);
  assert.equal(
    buildConfigJs('https://example.execute-api.ap-northeast-1.amazonaws.com'),
    'window.APP_CONFIG = { apiUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com" };\n',
  );
  assert.deepEqual(deployment.DistributionPaths, ['/*']);

  const outputs = template.findOutputs('*');
  assert.ok(Object.keys(outputs).includes('WebUrl'));
  assert.ok(Object.keys(outputs).includes('ApiUrl'));
  assert.match(JSON.stringify(outputs.WebUrl.Value), /https:\/\/.*DomainName/);
});
