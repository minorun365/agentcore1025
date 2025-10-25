import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

/**
 * Amazon Bedrock AgentCore デプロイ用の最小限スタック
 *
 * デプロイするリソース:
 * 1. ECRリポジトリ (Strands Agentコンテナイメージ用)
 * 2. IAM実行ロール (AgentCore Runtime用の権限)
 * 3. AgentCore Runtime (Strands Agentの実行環境)
 */
export class AgentCoreStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;
  public readonly agentRuntime: agentcore.Runtime;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. ECRリポジトリ作成 (ARM64コンテナイメージ保存用)
    this.ecrRepository = new ecr.Repository(this, 'StrandsAgentRepository', {
      repositoryName: 'strands-agent',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
      emptyOnDelete: true, // スタック削除時にイメージも削除
      imageScanOnPush: true, // セキュリティスキャン有効化
      lifecycleRules: [
        {
          description: 'Keep only the last 5 images',
          maxImageCount: 5,
        },
      ],
    });

    // 2. IAM実行ロール作成 (AgentCore Runtimeが使用)
    const executionRole = new iam.Role(this, 'AgentCoreExecutionRole', {
      roleName: 'AgentCoreRuntimeExecutionRole',
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'Execution role for Bedrock AgentCore Runtime',
    });

    // ECRからイメージを取得する権限
    this.ecrRepository.grantPull(executionRole);

    // CloudWatch Logsへの書き込み権限
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock/agentcore/*`,
        ],
      })
    );

    // Bedrock モデル呼び出し権限 (Strands Agentが使用)
    // Cross-Region Inference Profileを使用するため、全リージョンのリソースへのアクセスを許可
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['*'],  // Cross-Region Inference Profileのため全リソース許可
      })
    );

    // 3. AgentCore Runtime作成 (Strands Agent実行環境)
    // 注意: 最初のデプロイ前にECRにイメージをプッシュする必要があります
    //
    // 【デプロイ手順】
    // 1回目のデプロイ: CREATE_RUNTIME = false (ECRリポジトリのみ作成)
    // イメージをプッシュ後: CREATE_RUNTIME = true (Runtime作成)
    const CREATE_RUNTIME = process.env.CREATE_RUNTIME !== 'false';

    if (CREATE_RUNTIME) {
      const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(
        this.ecrRepository,
        'latest' // イメージタグ
      );

      this.agentRuntime = new agentcore.Runtime(this, 'StrandsAgentRuntime', {
        runtimeName: 'strandsAgent',
        agentRuntimeArtifact: agentRuntimeArtifact,
        executionRole: executionRole,
        description: 'Strands Agent runtime for production',
        // デフォルトでパブリックネットワーク構成を使用
        networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
        // デフォルトでIAM認証を使用(デフォルト値なので省略可能)
        // authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.iam(),
        // 環境変数 (必要に応じて追加)
        environmentVariables: {
          LOG_LEVEL: 'INFO',
          AWS_REGION: this.region,
        },
      });
    } else {
      // Runtime未作成時はダミー値を設定
      this.agentRuntime = null as any;
    }

    // 4. アウトプット: デプロイ後に必要な情報
    new cdk.CfnOutput(this, 'ECRRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI for pushing container images',
      exportName: 'StrandsAgentECRUri',
    });

    if (CREATE_RUNTIME && this.agentRuntime) {
      new cdk.CfnOutput(this, 'AgentRuntimeArn', {
        value: this.agentRuntime.agentRuntimeArn,
        description: 'AgentCore Runtime ARN for invoking the agent',
        exportName: 'StrandsAgentRuntimeArn',
      });

      new cdk.CfnOutput(this, 'AgentRuntimeId', {
        value: this.agentRuntime.agentRuntimeId,
        description: 'AgentCore Runtime ID',
        exportName: 'StrandsAgentRuntimeId',
      });
    }

    new cdk.CfnOutput(this, 'ExecutionRoleArn', {
      value: executionRole.roleArn,
      description: 'IAM Execution Role ARN',
    });

    // デプロイ手順を出力
    const deploymentSteps = CREATE_RUNTIME
      ? [
          '=== Runtime作成済み ===',
          'Agentを呼び出すには:',
          '   aws bedrock-agentcore invoke-agent-runtime \\',
          `     --agent-runtime-arn ${this.agentRuntime?.agentRuntimeArn || '<ARN>'} \\`,
          '     --runtime-session-id <session-id> \\',
          '     --payload \'{"prompt": "Hello", "tavily_api_key": "<YOUR_KEY>"}\'',
        ]
      : [
          '=== 次のステップ ===',
          '1. Dockerイメージをビルド:',
          '   cd backend && docker buildx build --platform linux/arm64 -t strands-agent .',
          '',
          '2. ECRにログイン:',
          `   aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${this.ecrRepository.repositoryUri}`,
          '',
          '3. イメージにタグ付け:',
          `   docker tag strands-agent:latest ${this.ecrRepository.repositoryUri}:latest`,
          '',
          '4. イメージをプッシュ:',
          `   docker push ${this.ecrRepository.repositoryUri}:latest`,
          '',
          '5. Runtimeを作成 (2回目のデプロイ):',
          '   npx cdk deploy --profile=<YOUR_PROFILE>',
        ];

    new cdk.CfnOutput(this, 'DeploymentInstructions', {
      value: deploymentSteps.join('\n'),
      description: 'Step-by-step deployment instructions',
    });
  }
}
