import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Amplify Frontend 用のインフラストラクチャスタック
 *
 * デプロイするリソース:
 * 1. SSR Compute Role - Amplify HostingのSSR関数がAWSリソースにアクセスするためのIAMロール
 *
 * このロールは、Amplify Consoleで手動で設定する必要があります:
 * App settings → IAM roles → Compute role で、このスタックが作成したロールを選択
 */
export class AmplifyFrontendStack extends cdk.Stack {
  public readonly ssrComputeRole: iam.Role;

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
  }
}
