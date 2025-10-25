#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreStack } from '../lib/agentcore-stack';

const app = new cdk.App();

new AgentCoreStack(app, 'AgentCoreStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-west-2', // オレゴンリージョンで統一
  },
  description: 'Strands Agent on Bedrock AgentCore Runtime (Oregon)',
});
