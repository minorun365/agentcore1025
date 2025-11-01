# Infrastructure

AWS CDKを使用したインフラストラクチャコード

## 前提条件

### 必須バージョン

```bash
# Node.js
node >= 24.0.0 < 25.0.0

# AWS CDK CLI
aws-cdk >= 2.1031.0
```

### セットアップ

1. **依存関係のインストール**:
   ```bash
   npm install
   ```

2. **グローバルCDK CLIのインストール** (初回のみ):
   ```bash
   npm install -g aws-cdk@latest
   ```

   または、既にインストール済みの場合はアップデート:
   ```bash
   npm install -g aws-cdk@latest
   ```

3. **AWS認証情報の設定**:
   ```bash
   aws sso login --profile=sandbox
   ```

### バージョン確認

```bash
# CDK CLIバージョン確認
cdk --version
# 期待値: 2.1031.0 (build 3d7b09b) 以上

# Node.jsバージョン確認
node --version
# 期待値: v24.x.x
```

## デプロイ

### 全スタックのデプロイ

```bash
AWS_PROFILE=sandbox npx cdk deploy --all --require-approval never
```

### 個別スタックのデプロイ

```bash
# AgentCore Runtime
AWS_PROFILE=sandbox npx cdk deploy AgentCoreStack --require-approval never

# Amplify Frontend (SSR Compute Role + Lambda)
AWS_PROFILE=sandbox npx cdk deploy AmplifyFrontendStack --require-approval never

# GitHub Actions Role
AWS_PROFILE=sandbox npx cdk deploy GitHubActionsRoleStack --require-approval never
```

## トラブルシューティング

### CDKバージョン不一致エラー

```
Cloud assembly schema version mismatch: Maximum schema version supported is 44.x.x, but found 48.0.0
```

**解決方法**:

1. グローバルCDK CLIをアップデート:
   ```bash
   npm install -g aws-cdk@latest
   ```

2. ローカルのCDK依存関係をアップデート:
   ```bash
   cd infrastructure
   npm install
   ```

3. 再デプロイ:
   ```bash
   AWS_PROFILE=sandbox npx cdk deploy AmplifyFrontendStack --require-approval never
   ```

### AWS認証エラー

```
Unable to resolve AWS account to use
```

**解決方法**:

```bash
aws sso login --profile=sandbox
AWS_PROFILE=sandbox npx cdk deploy AmplifyFrontendStack --require-approval never
```

## スタック構成

### AgentCoreStack

Strands AgentをBedrock AgentCore Runtimeにデプロイします。

**主なリソース**:
- Strands Agent Runtime
- Bedrock Knowledge Base
- Tavily Tool設定

### AmplifyFrontendStack

Amplify Hosting用のSSR Compute RoleとLambda Function URLを作成します。

**主なリソース**:
- SSR Compute Role (Amplify Hostingに手動でアタッチ)
- Chat Streaming Lambda (Response Streaming有効)
- Lambda Function URL (IAM認証)

**セキュリティ**:
- Lambda Function URLはIAM認証必須
- SSR Compute Roleからのみアクセス可能
- ブラウザ → Next.js API Route → Lambda (IAM署名付き) → AgentCore

### GitHubActionsRoleStack

GitHub ActionsからAgentCore Runtimeをデプロイするためのロールです。

**主なリソース**:
- GitHub OIDC Provider
- IAM Role for GitHub Actions

## デプロイ済みリソース

### AgentCoreStack

**Status**: ✅ デプロイ済み

- **Runtime ARN**: `arn:aws:bedrock-agentcore:us-west-2:715841358122:runtime/strandsAgent-oo5xY1C4tn`
- **Runtime ID**: `strandsAgent-oo5xY1C4tn`
- **リージョン**: `us-west-2` (オレゴン)

### AmplifyFrontendStack

**Status**: ✅ デプロイ済み

- **Lambda Function URL**: https://kgfw2sjc76jwecnqaz6nab7f7y0qaqvh.lambda-url.us-west-2.on.aws/
- **SSR Compute Role**: Amplify Hosting App (`d19iepfgircxoy`) にアタッチ済み
- **認証**: IAM（SSR Compute Roleからのみアクセス可）

### GitHubActionsRoleStack

**Status**: ✅ デプロイ済み

- **OIDC Provider**: GitHub Actions用
- **Role ARN**: GitHub ActionsワークフローからAgentCoreデプロイ可能

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
