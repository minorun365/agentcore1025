import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * GitHub ActionsからAWSリソースにアクセスするためのIAMロールを作成するStack
 * OIDCを使用してシークレットキー不要で安全に認証できます
 */
export class GitHubActionsRoleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // あなたのGitHubリポジトリ情報を設定してください
    const GITHUB_ORG = 'minorun365';  // GitHubユーザー名または組織名
    const GITHUB_REPO = 'agentcore1025';  // リポジトリ名

    // 1. 既存のGitHub OIDC Providerを取得
    // すでにGitHub OIDC Providerが存在する場合は、そのARNを使用
    const githubProviderArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;

    const githubProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubProvider',
      githubProviderArn
    );

    // 2. GitHub Actionsが使用するIAMロールを作成
    const githubActionsRole = new iam.Role(this, 'GitHubActionsRole', {
      roleName: 'GitHubActionsDeployRole',
      description: 'Role for GitHub Actions to deploy AgentCore Runtime',
      assumedBy: new iam.FederatedPrincipal(
        githubProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            // mainブランチからのみアクセスを許可
            'token.actions.githubusercontent.com:sub': `repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main`,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // 3. 必要な権限を付与

    // ECRへのプッシュ権限
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ECRAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
        ],
        resources: ['*'],  // ECRリポジトリARNに制限することも可能
      })
    );

    // AgentCore Runtimeの管理権限
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AgentCoreRuntimeAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:DescribeAgentRuntime',
          'bedrock-agentcore:UpdateAgentRuntime',
          'bedrock-agentcore:UpdateAgentRuntimeEndpoint',
          'bedrock-agentcore:ListAgentRuntimeVersions',
          'bedrock-agentcore:ListAgentRuntimeEndpoints',
        ],
        resources: ['*'],  // 特定のAgentCore Runtime ARNに制限することも可能
      })
    );

    // 4. ロールARNを出力(GitHub Secretsに設定する値)
    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', {
      value: githubActionsRole.roleArn,
      description: 'GitHub Secretsに AWS_ROLE_ARN として設定してください',
      exportName: 'GitHubActionsRoleArn',
    });

    new cdk.CfnOutput(this, 'SetupInstructions', {
      value: [
        '1. GitHub リポジトリの Settings > Secrets and variables > Actions に移動',
        '2. New repository secret をクリック',
        '3. Name: AWS_ROLE_ARN',
        `4. Value: ${githubActionsRole.roleArn}`,
        '5. Add secret をクリック',
      ].join('\n'),
      description: 'GitHub Secretsのセットアップ手順',
    });
  }
}
