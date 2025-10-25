import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

/**
 * Amplify Frontend 用のインフラストラクチャスタック
 *
 * デプロイするリソース:
 * 1. SSR Compute Role - Amplify HostingのSSR関数がAWSリソースにアクセスするためのIAMロール
 * 2. Chat Streaming Lambda - Response Streamingを使用したチャットAPI Lambda関数
 * 3. Lambda Function URL - 匿名アクセス可能なHTTPSエンドポイント
 *
 * このロールは、Amplify Consoleで手動で設定する必要があります:
 * App settings → IAM roles → Compute role で、このスタックが作成したロールを選択
 */
export class AmplifyFrontendStack extends cdk.Stack {
  public readonly ssrComputeRole: iam.Role;
  public readonly chatStreamingFunction: lambda.Function;
  public readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. SSR Compute Role作成
    // Amplify HostingのSSR関数(Next.js API Routes)がこのロールを使用してAWSサービスを呼び出す
    this.ssrComputeRole = new iam.Role(this, 'AmplifySSRComputeRole', {
      roleName: 'AmplifySSRComputeRole-agentcore1025',
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'SSR Compute Role for Amplify Hosting to invoke Bedrock AgentCore',
    });

    // 2. Bedrock AgentCore呼び出し権限を追加
    // すべてのAgentCore Runtimeへのアクセスを許可(ワイルドカード使用)
    this.ssrComputeRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock-agentcore:InvokeAgentRuntime'],
        resources: [
          `arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:runtime/*`
        ],
      })
    );

    // 3. CloudWatch Logs書き込み権限 (デバッグ用、オプション)
    this.ssrComputeRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/amplify/*`,
        ],
      })
    );

    // 4. アウトプット
    new cdk.CfnOutput(this, 'SSRComputeRoleArn', {
      value: this.ssrComputeRole.roleArn,
      description: 'SSR Compute Role ARN - Attach this to your Amplify app in Console',
      exportName: 'AmplifySSRComputeRoleArn',
    });

    new cdk.CfnOutput(this, 'SSRComputeRoleName', {
      value: this.ssrComputeRole.roleName,
      description: 'SSR Compute Role Name',
      exportName: 'AmplifySSRComputeRoleName',
    });

    // Amplify Console設定手順を出力
    new cdk.CfnOutput(this, 'AmplifyConsoleSetupInstructions', {
      value: [
        '=== Amplify Console設定手順 ===',
        '1. Amplify Consoleにアクセス: https://console.aws.amazon.com/amplify',
        '2. アプリを選択',
        '3. 左メニューから "App settings" → "IAM roles" を選択',
        '4. "Compute role" セクションで "Edit" をクリック',
        `5. このロールを選択: ${this.ssrComputeRole.roleName}`,
        '6. "Save" をクリック',
        '7. アプリを再デプロイして変更を適用',
      ].join('\n'),
      description: 'Step-by-step Amplify Console setup instructions',
    });

    // 5. Chat Streaming Lambda関数作成
    // Response Streamingを使用してリアルタイムにAgentCoreのレスポンスを返す
    this.chatStreamingFunction = new lambda.Function(this, 'ChatStreamingFunction', {
      functionName: 'chat-streaming-agentcore',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/chat-streaming'), {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c',
            'mkdir -p /asset-output && cp -r /asset-input/* /asset-output/ && cd /asset-output && npm install --omit=dev'
          ],
          user: 'root', // Dockerコンテナ内でroot権限を使用してnpm installを実行
        },
      }),
      timeout: cdk.Duration.seconds(300), // 5分 (長時間の会話に対応)
      memorySize: 512,
      environment: {
        AGENT_RUNTIME_ARN: process.env.AGENT_RUNTIME_ARN || '',
        TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
      },
      description: 'Streaming chat API using Bedrock AgentCore with Lambda Response Streaming',
    });

    // Lambda実行ロールにBedrock AgentCore呼び出し権限を追加
    this.chatStreamingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock-agentcore:InvokeAgentRuntime'],
        resources: [
          `arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:runtime/*`
        ],
      })
    );

    // 6. Lambda Function URL作成 (Response Streaming有効)
    this.functionUrl = this.chatStreamingFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // 匿名アクセス許可 (本番環境ではIAM認証推奨)
      cors: {
        allowedOrigins: ['*'], // 本番環境では特定のドメインに制限
        allowedMethods: [lambda.HttpMethod.ALL], // すべてのHTTPメソッドを許可
        allowedHeaders: ['*'], // すべてのヘッダーを許可
      },
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM, // ストリーミング有効化
    });

    // 7. Lambda Function URLをアウトプット
    new cdk.CfnOutput(this, 'ChatStreamingFunctionUrl', {
      value: this.functionUrl.url,
      description: 'Lambda Function URL for streaming chat API (use this in frontend)',
      exportName: 'ChatStreamingFunctionUrl',
    });

    new cdk.CfnOutput(this, 'ChatStreamingFunctionArn', {
      value: this.chatStreamingFunction.functionArn,
      description: 'Lambda Function ARN',
    });
  }
}
