#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreStack } from '../lib/agentcore-stack';
import { AmplifyFrontendStack } from '../lib/amplify-frontend-stack';
import { GitHubActionsRoleStack } from '../lib/github-actions-role-stack';

const app = new cdk.App();

// バックエンド: AgentCore Runtime
new AgentCoreStack(app, 'AgentCoreStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-west-2', // オレゴンリージョンで統一
  },
  description: 'Strands Agent on Bedrock AgentCore Runtime (Oregon)',
});

// フロントエンド: Amplify Hosting用のSSR Compute Role
new AmplifyFrontendStack(app, 'AmplifyFrontendStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-west-2', // Amplifyアプリと同じリージョン
  },
  description: 'SSR Compute Role for Amplify Hosting (Oregon)',
});

// GitHub Actions用IAMロール
new GitHubActionsRoleStack(app, 'GitHubActionsRoleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-west-2',
  },
  description: 'IAM Role for GitHub Actions to deploy AgentCore Runtime',
});
