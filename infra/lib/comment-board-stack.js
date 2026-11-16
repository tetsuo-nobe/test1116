// コメントボード Mock の全リソースを作る CDK スタック。
// DynamoDB テーブル、Lambda（CommentService）、HTTP API、配信用 S3 バケット、CloudFront、
// frontend/ の配置と config.js（API URL）の生成までを 1 スタックで行う。
// 注意: 認証はない（ADR-003）。デプロイすると API と Web ページはインターネットに公開される。
const path = require('node:path');
const { Stack, RemovalPolicy, Duration, CfnOutput } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const logs = require('aws-cdk-lib/aws-logs');
const apigwv2 = require('aws-cdk-lib/aws-apigatewayv2');
const { HttpLambdaIntegration } = require('aws-cdk-lib/aws-apigatewayv2-integrations');
const s3 = require('aws-cdk-lib/aws-s3');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');

const DEFAULT_FRONTEND_DIR = path.join(__dirname, '../../frontend');
const DEFAULT_BACKEND_DIR = path.join(__dirname, '../../backend/src');

/** API の URL を入れた config.js の中身を作る（U1 が index.html から読み込む）。 */
function buildConfigJs(apiUrl) {
  return `window.APP_CONFIG = { apiUrl: "${apiUrl}" };\n`;
}

class CommentBoardStack extends Stack {
  /**
   * @param {import('constructs').Construct} scope
   * @param {string} id
   * @param {import('aws-cdk-lib').StackProps & { frontendDir?: string, backendDir?: string }} [props]
   */
  constructor(scope, id, props = {}) {
    const { frontendDir = DEFAULT_FRONTEND_DIR, backendDir = DEFAULT_BACKEND_DIR, ...stackProps } = props;
    super(scope, id, stackProps);

    // データストア: パーティションキー id、オンデマンド、既定のサーバー側暗号化
    const table = new dynamodb.Table(this, 'CommentsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Lambda のログは削除時に一緒に消えるよう明示的に作る
    const functionLogGroup = new logs.LogGroup(this, 'CommentsFunctionLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // CommentService。AWS SDK v3 はランタイム同梱のものを使うので backend/src をそのまま配置する
    const commentsFunction = new lambda.Function(this, 'CommentsFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(backendDir),
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: table.tableName },
      logGroup: functionLogGroup,
    });
    // 最小権限: 対象テーブルへの PutItem と Scan のみ
    table.grant(commentsFunction, 'dynamodb:PutItem', 'dynamodb:Scan');

    // HTTP API。CORS は全オリジン許可（Mock のため）
    const api = new apigwv2.HttpApi(this, 'CommentsApi', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type'],
      },
    });
    const integration = new HttpLambdaIntegration('CommentsIntegration', commentsFunction);
    api.addRoutes({
      path: '/comments',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration,
    });

    // 配信用バケット（非公開。CloudFront の OAC 経由でのみ読める）
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // frontend/ を配置し、config.js は API URL 入りのものを生成して置く
    // （frontend/config.js はローカル用なので配信対象から外し、上書きされないようにする）
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      destinationBucket: siteBucket,
      sources: [
        s3deploy.Source.asset(frontendDir, { exclude: ['config.js'] }),
        s3deploy.Source.data('config.js', buildConfigJs(api.apiEndpoint)),
      ],
      distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'WebUrl', {
      description: 'コメントボードの Web ページ URL',
      value: `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, 'ApiUrl', {
      description: 'コメント API のベース URL（末尾スラッシュなし）',
      value: api.apiEndpoint,
    });
  }
}

module.exports = { CommentBoardStack, buildConfigJs };
