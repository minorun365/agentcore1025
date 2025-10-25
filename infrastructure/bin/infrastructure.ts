#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import { GitHubActionsRoleStack } from '../lib/github-actions-role-stack';

const app = new cdk.App();

// メインインフラストラクチャスタック
new InfrastructureStack(app, 'InfrastructureStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

// GitHub Actions用IAMロールスタック(別スタックとして管理)
new GitHubActionsRoleStack(app, 'GitHubActionsRoleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});