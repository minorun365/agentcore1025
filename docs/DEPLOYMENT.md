# AgentCore Runtime 自動デプロイメントガイド

このガイドでは、backendディレクトリのコードを更新したときに、自動的にECRにプッシュしてAgentCore Runtimeを更新する方法を説明します。

## 🎯 仕組みの概要

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. backend/** を変更して main ブランチにプッシュ              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. GitHub Actions が自動実行                                   │
│    - Dockerイメージをビルド(ARM64)                              │
│    - ECRにプッシュ                                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. AgentCore Runtime を更新                                     │
│    - UpdateAgentRuntime API 実行                                │
│    - 自動的に新しいバージョンが作成される                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DEFAULTエンドポイントが自動更新                              │
│    - 最新バージョンを即座に参照                                 │
│    - CDKの再デプロイ不要!                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 初回セットアップ手順

### ステップ1: GitHub Actions用IAMロールをデプロイ

まず、GitHub ActionsがAWSリソースにアクセスするためのIAMロールを作成します。

```bash
cd infrastructure

# GitHub OIDC認証用のIAMロールをデプロイ
cdk deploy GitHubActionsRoleStack
```

デプロイが完了すると、以下の出力が表示されます:

```
Outputs:
GitHubActionsRoleStack.GitHubActionsRoleArn = arn:aws:iam::123456789012:role/GitHubActionsDeployRole
```

**このARNをコピーしてください** - 次のステップで使います。

### ステップ2: GitHub Secretsを設定

1. GitHubリポジトリのページに移動
2. **Settings** > **Secrets and variables** > **Actions** をクリック
3. **New repository secret** をクリック
4. 以下の情報を入力:
   - Name: `AWS_ROLE_ARN`
   - Value: (ステップ1でコピーしたARN)
5. **Add secret** をクリック

### ステップ3: ワークフローファイルを編集

[.github/workflows/deploy-agentcore.yml](../.github/workflows/deploy-agentcore.yml) を開いて、以下の環境変数を実際の値に変更してください:

```yaml
env:
  AWS_REGION: us-west-2  # あなたのAWSリージョン
  ECR_REPOSITORY: agentcore-strands-agent  # ECRリポジトリ名に変更
  AGENT_RUNTIME_ID: your-agent-runtime-id  # AgentCore Runtime IDに変更
```

#### 📝 必要な情報の取得方法

**ECRリポジトリ名を確認:**
```bash
aws ecr describe-repositories --region us-west-2 --query 'repositories[].repositoryName'
```

**AgentCore Runtime IDを確認:**
```bash
aws bedrock-agentcore list-agent-runtimes --region us-west-2
```

### ステップ4: 動作確認

1. backendディレクトリのコードを変更
2. 変更をコミット&プッシュ:
   ```bash
   git add backend/
   git commit -m "Update Strands agent code"
   git push origin main
   ```
3. GitHubの **Actions** タブで実行状況を確認
4. デプロイが完了したら、AgentCore Runtimeが自動的に更新されます!

## 🚀 使い方

### 自動デプロイ(推奨)

backendディレクトリのファイルを変更してmainブランチにプッシュするだけで、自動的にデプロイされます:

```bash
# agent.pyを編集
vi backend/agent.py

# コミット&プッシュ
git add backend/agent.py
git commit -m "feat: Add new tool for agent"
git push origin main
```

GitHub Actionsが自動実行され、約5-10分でデプロイが完了します。

### 手動デプロイ

緊急時は、GitHub ActionsのUIから手動実行も可能です:

1. GitHubリポジトリの **Actions** タブを開く
2. 左サイドバーから **Deploy Agentcore Runtime** を選択
3. **Run workflow** ボタンをクリック
4. ブランチを選択して **Run workflow** を実行

## 📊 デプロイの確認

### GitHub Actionsのログで確認

GitHub Actionsの実行ログで以下を確認できます:

- Dockerイメージのビルド状況
- ECRへのプッシュ結果
- AgentCore Runtimeの更新状況
- 新しいバージョン番号

### AWS CLIで確認

```bash
# 現在のAgentCore Runtimeの状態を確認
aws bedrock-agentcore describe-agent-runtime \
  --agent-runtime-id <your-agent-runtime-id> \
  --region us-west-2

# バージョン履歴を確認
aws bedrock-agentcore list-agent-runtime-versions \
  --agent-runtime-id <your-agent-runtime-id> \
  --region us-west-2

# エンドポイント一覧を確認
aws bedrock-agentcore list-agent-runtime-endpoints \
  --agent-runtime-id <your-agent-runtime-id> \
  --region us-west-2
```

## 🔧 トラブルシューティング

### ECRへのプッシュが失敗する

**原因**: IAMロールにECRの権限がない

**解決策**:
```bash
# GitHubActionsRoleStackを再デプロイ
cd infrastructure
cdk deploy GitHubActionsRoleStack
```

### UpdateAgentRuntime APIが失敗する

**原因**: IAMロールにAgentCore Runtimeの権限がない、または設定が不正

**解決策**:
1. IAMロールの権限を確認
2. AgentCore Runtime IDが正しいか確認
3. 現在の設定を取得して、必須パラメータを確認:
   ```bash
   aws bedrock-agentcore describe-agent-runtime \
     --agent-runtime-id <your-agent-runtime-id> \
     --region us-west-2
   ```

### Runtime が READY にならない

**原因**: コンテナイメージに問題がある、またはネットワーク設定の問題

**解決策**:
1. ローカルでDockerイメージをテスト:
   ```bash
   cd backend
   docker build --platform linux/arm64 -t test-agent .
   docker run -p 8080:8080 test-agent
   ```
2. CloudWatch Logsでエラーを確認
3. AgentCore Runtimeのステータス詳細を確認

## 🎓 知っておくべきこと

### バージョニングの仕組み

- **自動バージョニング**: コンテナイメージを更新すると、AgentCore Runtimeは自動的に新しいバージョンを作成します
- **DEFAULTエンドポイント**: 常に最新バージョンを参照します(自動更新)
- **カスタムエンドポイント**: 手動で更新が必要です

### 本番環境用エンドポイントの管理

本番環境用に別のエンドポイント(例: `production`)を作成している場合は、手動で更新が必要です:

```bash
# 本番エンドポイントを最新バージョンに更新
aws bedrock-agentcore update-agent-runtime-endpoint \
  --agent-runtime-id <your-agent-runtime-id> \
  --endpoint-name production \
  --agent-runtime-version <new-version> \
  --region us-west-2
```

### CDK再デプロイが必要なケース

以下の変更を行う場合は、GitHub Actionsではなく、CDKの再デプロイが必要です:

- IAMロールの変更
- ネットワーク設定の変更(VPC、サブネット、セキュリティグループ)
- プロトコル設定の変更
- 環境変数の追加・削除(既存の環境変数の値の変更のみなら、GitHub Actionsで可能)

## 📚 参考リンク

- [AgentCore Runtime バージョニングドキュメント](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agent-runtime-versioning.html)
- [UpdateAgentRuntime API リファレンス](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_UpdateAgentRuntime.html)
- [GitHub Actions OIDC認証](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
