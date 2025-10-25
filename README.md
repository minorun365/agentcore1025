# Strands Agents + Bedrock AgentCore + Amplify Gen2 セットアップガイド

## 🌎 リージョン設定

**このプロジェクトではオレゴンリージョン(`us-west-2`)を統一して使用します。**

理由:
- Bedrock AgentCoreの可用性
- レイテンシーと安定性
- コスト最適化

## 🎯 初期化コマンドの実行順序について

**正しい順序:**
1. **Next.js**を先に初期化
2. その後、**Amplify Gen2**を追加

```bash
# 1. Next.jsプロジェクト作成
npx create-next-app@latest frontend --typescript --tailwind --app

# 2. Next.jsプロジェクト内でAmplify初期化
cd frontend
npm create amplify@latest
```

**なぜこの順序?**
- Next.jsの構成を先に確定させる
- AmplifyはNext.jsプロジェクトに後から統合可能
- カスタマイズの自由度が高い

## 📁 推奨フォルダ構成

Strands AgentsをBedrock AgentCoreにデプロイし、Amplify Gen2のNext.jsから呼び出す構成は以下のようになります:

```
agentcore1025/                          # プロジェクトルート
├── frontend/                            # フロントエンド(Next.js + Amplify Gen2)
│   ├── amplify/                         # Amplify Gen2バックエンド定義(TypeScript)
│   │   ├── auth/
│   │   │   └── resource.ts              # Cognito認証設定
│   │   ├── data/
│   │   │   └── resource.ts              # DynamoDB/AppSync設定
│   │   ├── functions/                   # Lambda関数(必要に応じて)
│   │   │   └── bedrock-agent-caller/
│   │   │       ├── handler.ts           # AgentCore呼び出しロジック
│   │   │       └── resource.ts
│   │   ├── backend.ts                   # バックエンド統合設定
│   │   └── tsconfig.json
│   ├── src/                             # Next.jsアプリケーション
│   │   ├── app/
│   │   │   ├── page.tsx                 # メインページ
│   │   │   ├── layout.tsx
│   │   │   └── api/                     # API Routes(オプション)
│   │   │       └── chat/
│   │   │           └── route.ts         # チャットエンドポイント
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx        # チャットUI
│   │   │   └── AgentResponse.tsx
│   │   └── utils/
│   │       └── agentClient.ts           # AgentCore呼び出しクライアント
│   ├── package.json
│   ├── next.config.js
│   ├── amplify_outputs.json             # Amplifyが自動生成
│   └── tsconfig.json
│
├── backend/                             # バックエンド(Strands Agent)
│   ├── agent/
│   │   ├── agent_main.py                # Strands Agentメインコード
│   │   ├── tools/                       # エージェントツール
│   │   │   ├── search_tool.py
│   │   │   └── database_tool.py
│   │   └── requirements.txt             # Pythonパッケージ
│   ├── Dockerfile                       # ARM64コンテナ
│   └── deploy_agent.py                  # デプロイスクリプト
│
├── infrastructure/                      # インフラ(AWS CDK)
│   ├── bin/
│   │   └── app.ts                       # CDKアプリエントリーポイント
│   ├── lib/
│   │   ├── agentcore-stack.ts           # AgentCoreデプロイスタック
│   │   ├── amplify-stack.ts             # Amplifyホスティングスタック
│   │   ├── networking-stack.ts          # VPC/セキュリティグループ
│   │   └── iam-stack.ts                 # IAMロール/ポリシー
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
│
├── .github/
│   └── workflows/                       # CI/CD
│       ├── deploy-frontend.yml
│       └── deploy-backend.yml
│
├── README.md
└── package.json                         # ルートpackage.json(モノレポ設定)
```

## 🔄 開発フロー

### 1. 初期セットアップ(最初に実行)

```bash
# 1. プロジェクトルート作成
mkdir agentcore1025
cd agentcore1025

# 2. フロントエンド初期化
# 2-1. Next.jsプロジェクト作成
npx create-next-app@latest frontend --typescript --tailwind --app

# 2-2. Amplify Gen2を追加
cd frontend
npm create amplify@latest
# プロンプトで「us-west-2」(オレゴン)を選択
cd ..

# 3. バックエンド(Strands Agent)セットアップ
mkdir -p backend/agent
cd backend
python3 -m venv venv
source venv/bin/activate  # Windowsの場合: venv\Scripts\activate
pip install bedrock-agentcore strands-agents
cd ..

# 4. インフラ(CDK)初期化
mkdir infrastructure
cd infrastructure
npx cdk init app --language typescript
npm install @aws-cdk/aws-bedrock-agentcore-alpha@2.221.0-alpha.0

# 5. CDK Bootstrap (初回のみ、オレゴンリージョン)
npx cdk bootstrap aws://<AWS_ACCOUNT_ID>/us-west-2 --profile=<YOUR_PROFILE>
```

### 2. 開発時

```bash
# ターミナル1: フロントエンド開発サーバー
cd frontend
npm run dev                    # Next.js開発サーバー

# ターミナル2: Amplifyサンドボックス
cd frontend
npx ampx sandbox              # バックエンドリソースをクラウドに展開

# ターミナル3: Agent開発
cd backend/agent
python agent_main.py          # ローカルテスト
```

### 3. デプロイ

#### ステップ1: AWS SSOログイン
```bash
# プロファイルでログイン
aws sso login --profile=<YOUR_PROFILE>
```

#### ステップ2: CDK Bootstrap (初回のみ)
```bash
cd infrastructure
npx cdk bootstrap aws://<AWS_ACCOUNT_ID>/us-west-2 --profile=<YOUR_PROFILE>
```

#### ステップ3: インフラをデプロイ (1回目 - ECRリポジトリのみ)

**重要**: 初回デプロイではECRリポジトリとIAMロールのみを作成します。
AgentCore Runtimeは、Dockerイメージをプッシュした後に2回目のデプロイで作成します。

```bash
cd infrastructure

# TypeScriptコンパイル
npm run build

# CloudFormationテンプレート生成・検証
npx cdk synth --profile=<YOUR_PROFILE>

# デプロイ前の差分確認
npx cdk diff --profile=<YOUR_PROFILE>

# 1回目のデプロイ (ECRリポジトリ作成、Runtime作成をスキップ)
CREATE_RUNTIME=false npx cdk deploy --profile=<YOUR_PROFILE>
```

**作成されるリソース (1回目):**
- ✅ ECRリポジトリ (`strands-agent`)
- ✅ IAM実行ロール (Bedrock/CloudWatch/ECR権限付き)

デプロイが完了したら、出力される`ECRRepositoryUri`をメモしてください。

#### ステップ4: Dockerイメージをビルド&プッシュ (ARM64必須)
```bash
cd ../backend

# ARM64でビルド
docker buildx build --platform linux/arm64 -t strands-agent .

# ECRにログイン (CDK出力のECR URIを使用)
aws ecr get-login-password --region us-west-2 --profile=<YOUR_PROFILE> | \
  docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com

# イメージにタグ付け&プッシュ
docker tag strands-agent:latest <ECR-URI>:latest
docker push <ECR-URI>:latest
```

#### ステップ5: インフラをデプロイ (2回目 - AgentCore Runtime作成)

Dockerイメージのプッシュが完了したら、AgentCore Runtimeを作成します。

```bash
cd ../infrastructure

# 2回目のデプロイ (AgentCore Runtime作成)
npx cdk deploy --profile=<YOUR_PROFILE>
```

**作成されるリソース (2回目):**
- ✅ AgentCore Runtime (オレゴンリージョン)

デプロイが完了すると、AgentCore Runtimeが自動的にECRからイメージを取得して起動します。

#### ステップ6: フロントエンドをデプロイ
```bash
cd ../frontend
git add .
git commit -m "Initial deployment"
git push origin main          # Amplify Hostingが自動デプロイ
```

**重要:** CDKデプロイ後の出力(`Outputs`セクション)に表示される以下の情報を記録:
- `ECRRepositoryUri`: Dockerイメージのプッシュ先
- `AgentRuntimeArn`: フロントエンドから呼び出すARN
- `AgentRuntimeId`: Runtime識別子
- `DeploymentInstructions`: 次のステップ手順

## 🔑 主要な技術スタックの役割

| 層 | 技術 | 役割 |
|---|---|---|
| **フロントエンド** | Next.js + Amplify Gen2 | UIとバックエンド統合 |
| **認証** | Amazon Cognito (Amplify) | ユーザー認証・認可 |
| **API** | AppSync (GraphQL) or API Routes | フロント↔︎バックエンド通信 |
| **Agent** | Strands Agents | LLMエージェントロジック |
| **実行環境** | Bedrock AgentCore Runtime | Agentのサーバーレス実行 |
| **インフラ** | AWS CDK | すべてのAWSリソース管理 |

## 💡 開発のポイント

1. **初期化順序**: Next.js → Amplify Gen2 → CDKの順で初期化
2. **リージョン統一**: すべてのリソースを`us-west-2`(オレゴン)で統一
3. **モノレポ構成**: フロント・バック・インフラを分離して管理
4. **Amplifyサンドボックス**: `npx ampx sandbox`でバックエンドを素早くテスト
5. **CDKコード管理**: 最新のalpha constructを使用(`@aws-cdk/aws-bedrock-agentcore-alpha@2.221.0-alpha.0`)
6. **ARM64必須**: AgentCoreはARM64アーキテクチャのみサポート
7. **SSOログイン**: `aws sso login --profile=sandbox`で認証
8. **CDK L2 Construct活用**: k.goto氏推奨のL2 Constructパターンを採用

## 🎓 参考にした技術情報

### k.goto氏のツイート (2025-10-24)
AWS CDKエキスパートのk.goto氏(@365_step_tech)によるAgentCore L2 Constructの活用法:
- AgentCore Starter Toolkitは手軽だが、本番運用にはCDKが推奨
- L2 ConstructはRole/ECRの管理も含めて使いやすい
- デフォルトでECR権限を自動付与してくれる
- Runtime/Browser/Code Interpreterなどがalphaモジュールでマージ済み

## 🐳 Docker設定とオブザーバビリティ

### Dockerfileの構成

`backend/Dockerfile`はCDKデプロイ用に最適化されています:

**主要な特徴:**
- **プラットフォーム**: `linux/arm64` (AgentCore Runtime必須)
- **ベースイメージ**: `python:3.12-slim-bookworm`
- **非rootユーザー**: セキュリティのため`agentcore`ユーザーで実行
- **ポート**: 8080を公開 (AgentCore Runtime要件)
- **オブザーバビリティ**: OpenTelemetry自動計装

**CMD実行コマンド:**
```bash
opentelemetry-instrument python -m agent
```

このコマンドにより、AWS Distro for OpenTelemetry (ADOT)が自動的に:
- LLM呼び出しのトレーシング
- レイテンシーメトリクスの収集
- エラーとスタックトレースの記録

### オブザーバビリティ設定

#### 1. 自動計装の仕組み

`requirements.txt`に含まれる`aws-opentelemetry-distro>=0.10.1`により、以下が自動化されます:

- **トレース収集**: Bedrock APIコール、エージェント実行、ツール呼び出し
- **メトリクス送信**: レイテンシー、エラー率、スループット
- **ログ統合**: CloudWatch Logsとトレースの紐付け

#### 2. CloudWatch GenAI Observabilityで確認できる情報

デプロイ後、CloudWatchコンソールで以下を確認可能:

1. **トレース詳細** (`X-Ray > Traces`)
   - エージェント実行時間の内訳
   - Bedrockモデル呼び出しのレイテンシー
   - 各ツール実行の所要時間

2. **メトリクス** (`CloudWatch > Metrics > GenAI`)
   - リクエスト数、成功率、エラー率
   - モデル呼び出し回数とトークン使用量
   - エージェント実行時間の分布

3. **ログ** (`CloudWatch > Log groups`)
   - エージェントの実行ログ
   - エラースタックトレース
   - カスタムログ出力

#### 3. 初回のみ: CloudWatch Transaction Searchを有効化

**手順:**
1. AWS Console → CloudWatch → Settings
2. "Transaction Search" セクションで "Enable" をクリック
3. リージョンが `us-west-2` であることを確認

これにより、トレースデータが検索可能になります。

### agentcore configureとの違い

`agentcore configure`コマンドは**Starter Toolkit**用の自動設定ツールです:

| 項目 | agentcore configure | CDK手動設定 |
|-----|---------------------|------------|
| 用途 | プロトタイピング・検証 | 本番運用 |
| ECR/IAM管理 | 自動作成 | CDKで明示的に管理 |
| オブザーバビリティ | 自動設定 | Dockerfile + requirements.txtで手動設定 |
| カスタマイズ性 | 低い | 高い (IaCで完全制御) |
| k.goto氏推奨 | プロトタイプ向け | **本番運用推奨** |

**本プロジェクトの選択:**
- CDKでインフラを明示的に管理
- Dockerfileで手動オブザーバビリティ設定
- 本番環境に適した構成

## 🔧 CDKで作成されるリソース

最小限の構成で以下のリソースが作成されます:

1. **ECRリポジトリ** - Strands AgentのDockerイメージ保存
2. **IAM実行ロール** - AgentCore Runtimeの権限管理
   - Bedrock モデル呼び出し権限
   - CloudWatch Logs書き込み権限
   - ECRイメージ取得権限
3. **AgentCore Runtime** - Strands Agentの実行環境
   - パブリックネットワーク構成
   - IAM認証
   - 環境変数サポート
   - オブザーバビリティ有効 (CloudWatch GenAI)

## 📚 参考リソース

### 公式ドキュメント
- [Strands Agents - Bedrock AgentCore デプロイメント](https://strandsagents.com/latest/documentation/docs/user-guide/deploy/deploy_to_bedrock_agentcore/)
- [AWS Amplify Gen2 ドキュメント](https://docs.amplify.aws/react/)
- [Amazon Bedrock AgentCore ドキュメント](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html)
- [AWS CDK AgentCore Alpha API](https://docs.aws.amazon.com/cdk/api/v2/docs/@aws-cdk_aws-bedrock-agentcore-alpha.html)

### パッケージバージョン情報
- **AWS CDK CLI**: `2.1031.0` (最新)
- **AWS CDK Library**: `2.221.0`
- **AgentCore Alpha Construct**: `@aws-cdk/aws-bedrock-agentcore-alpha@2.221.0-alpha.0`
- **Node.js**: `v24.0.1` (npm v11.3.0) - LTS推奨
- **Python**: `3.10+` (Strands Agent用)
- **Docker**: Buildx必須 (ARM64ビルド対応)

### 現在の進捗状況

#### ✅ 完了した作業

**1. プロジェクト設計 & セットアップ**
- ✅ プロジェクト構成設計完了
- ✅ CDK Bootstrap完了 (us-west-2)
- ✅ gitignore設定完了 (各階層に適切に配置)

**2. バックエンド (Strands Agent)**
- ✅ Strands Agentコード作成完了 ([backend/agent.py](backend/agent.py))
  - Bedrock Claude 3.5 Sonnetモデル使用
  - Tavily検索ツール統合 (MCP経由)
  - ストリーミング応答対応
- ✅ Dockerfile作成完了 (ARM64 + オブザーバビリティ対応)
  - OpenTelemetry自動計装
  - 非rootユーザー実行
  - CMD修正: `python agent.py` (moduleではない)
- ✅ requirements.txt更新完了 (ADOT追加)

**3. インフラ (AWS CDK)**
- ✅ CDKコード作成完了 ([infrastructure/lib/agentcore-stack.ts](infrastructure/lib/agentcore-stack.ts))
  - L2 Constructパターン採用 (k.goto氏推奨)
  - 2段階デプロイ対応 (`CREATE_RUNTIME`環境変数)
  - ECRリポジトリ作成
  - IAM実行ロール作成 (Bedrock/CloudWatch/ECR権限)
- ✅ CDK Synth検証完了
- ✅ **1回目CDKデプロイ完了** (`CREATE_RUNTIME=false`)
  - ECRリポジトリ作成済み
  - IAM実行ロール作成済み
- ✅ Dockerイメージビルド完了 (ARM64)
- ✅ DockerイメージをECRにプッシュ完了
  - イメージタグ: `latest`
  - Digest: `sha256:f86e314e71600a4b52ce3ca526174114f60615041b8d1d341a2ceff37f94f6a8`
- ✅ **2回目CDKデプロイ完了**
  - AgentCore Runtime作成完了
  - Runtime ARN: `arn:aws:bedrock-agentcore:us-west-2:YOUR_AWS_ACCOUNT_ID:runtime/strandsAgent-XXXXXXXXXX`

**4. フロントエンド (Next.js)**
- ✅ フロントエンド実装完了
  - チャットUI ([frontend/components/ChatInterface.tsx](frontend/components/ChatInterface.tsx))
  - API Route ([frontend/app/api/chat/route.ts](frontend/app/api/chat/route.ts))
  - BFFパターン採用 (Next.js → AgentCore Runtime)
  - 公式SDK使用 (`@aws-sdk/client-bedrock-agentcore`)
  - ストリーミング対応 (SSE)
- ✅ package.json更新完了

#### 📋 デプロイ済みリソース情報

**AgentCore Runtime:**
- **Runtime ARN**: `arn:aws:bedrock-agentcore:us-west-2:YOUR_AWS_ACCOUNT_ID:runtime/strandsAgent-XXXXXXXXXX`
- **Runtime ID**: `strandsAgent-XXXXXXXXXX`
- **リージョン**: `us-west-2` (オレゴン)
- **プラットフォーム**: ARM64
- **ネットワーク**: パブリック
- **認証**: IAM

**ECRリポジトリ:**
- **URI**: `YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/strands-agent`
- **最新イメージ**: `latest` (Digest: `sha256:f86e314e...`)

**IAM実行ロール:**
- **ARN**: `arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/AgentCoreRuntimeExecutionRole`
- **権限**: Bedrock/CloudWatch/ECR

#### ⏳ 次のステップ

**5. フロントエンドのローカルテスト**
1. 環境変数設定 (`frontend/.env.local`)
   ```bash
   AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-west-2:YOUR_AWS_ACCOUNT_ID:runtime/strandsAgent-XXXXXXXXXX
   AWS_REGION=us-west-2
   ```
2. パッケージインストール
   ```bash
   cd frontend
   npm install
   ```
3. 開発サーバー起動
   ```bash
   npm run dev
   ```
4. ブラウザで動作確認 (http://localhost:3000)

**6. CLI動作確認 (オプション)**
```bash
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn arn:aws:bedrock-agentcore:us-west-2:YOUR_AWS_ACCOUNT_ID:runtime/strandsAgent-XXXXXXXXXX \
  --runtime-session-id test-session-$(date +%s) \
  --payload '{"prompt": "東京の天気は？", "tavily_api_key": "<YOUR_KEY>"}' \
  --region us-west-2 \
  --profile sandbox
```

**7. Amplify Hostingへのデプロイ**

#### ステップ1: GitHubリポジトリの準備
```bash
# プロジェクトルートで
git init
git add .
git commit -m "Initial commit: Strands Agents + AgentCore + Next.js"

# GitHubに新しいリポジトリを作成してプッシュ
git remote add origin https://github.com/YOUR_USERNAME/agentcore1025.git
git branch -M main
git push -u origin main
```

#### ステップ2: AWS Amplify Hostingアプリを作成

**AWS Consoleで操作:**
1. [AWS Amplify Console](https://console.aws.amazon.com/amplify/)を開く
2. 「新しいアプリ」→「ウェブアプリをホスト」をクリック
3. GitHubを選択して認証
4. リポジトリとブランチを選択:
   - リポジトリ: `agentcore1025`
   - ブランチ: `main`
5. ビルド設定を確認:
   - Amplifyが `frontend/amplify.yml` を自動検出
   - アプリのルートディレクトリを `frontend` に設定
6. **詳細設定**をクリック

#### ステップ3: 環境変数を設定

Amplify Consoleの「環境変数」セクションで以下を追加:

| キー | 値 | 説明 |
|------|-----|------|
| `AGENT_RUNTIME_ARN` | `arn:aws:bedrock-agentcore:us-west-2:YOUR_AWS_ACCOUNT_ID:runtime/strandsAgent-XXXXXXXXXX` | AgentCore Runtime ARN |
| `AWS_REGION` | `us-west-2` | AWSリージョン |
| `TAVILY_API_KEY` | `tvly-YOUR_API_KEY` | Tavily APIキー |

#### ステップ4: IAMロール権限を追加

**Amplifyサービスロールに権限を付与:**

1. Amplify Consoleで「アプリ設定」→「全般」→「サービスロール」を確認
2. 表示されているロール名をクリックしてIAMコンソールへ移動
3. 「ポリシーをアタッチ」→「インラインポリシーを作成」
4. JSON エディタで以下を貼り付け:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:InvokeAgentRuntime"
      ],
      "Resource": "arn:aws:bedrock-agentcore:us-west-2:YOUR_AWS_ACCOUNT_ID:runtime/strandsAgent-*"
    }
  ]
}
```

5. ポリシー名を `BedrockAgentCoreInvokePolicy` として保存

#### ステップ5: ビルド設定の調整

Amplify Consoleで「ビルド設定」を開き、`amplify.yml` の内容を確認:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

**モノレポ設定 (frontendディレクトリ内のアプリ):**
- 「アプリ設定」→「全般」→「アプリのルートディレクトリ」を `frontend` に設定

#### ステップ6: デプロイ実行

```bash
# コードをプッシュするだけで自動デプロイが開始
git push origin main
```

**Amplify Consoleでデプロイ状況を確認:**
1. 「プロビジョン」: ビルド環境準備
2. 「ビルド」: Next.jsアプリビルド
3. 「デプロイ」: CloudFrontにデプロイ
4. 「検証」: ヘルスチェック

デプロイ完了後、AmplifyアプリのURLが表示されます (例: `https://main.d1234abcd.amplifyapp.com`)

**8. 本番環境テスト**
1. Amplify Hostingでフロントエンドにアクセス
2. エンドツーエンドテスト実行
3. CloudWatch GenAI Observabilityでトレース確認
4. エラーログ確認 (CloudWatch Logs)

## 🎨 フロントエンド (Next.js + Amplify Gen2)

### 実装済みのコンポーネント

#### 1. チャットUI ([frontend/components/ChatInterface.tsx](frontend/components/ChatInterface.tsx))
- ストリーミングレスポンス対応
- Tavily APIキー入力UI
- ツール使用インジケーター表示
- レスポンシブデザイン (Tailwind CSS)

#### 2. API Route ([frontend/app/api/chat/route.ts](frontend/app/api/chat/route.ts))
- **BFFパターン**: ブラウザ→Next.js→AgentCore Runtime
- **公式SDK使用**: `@aws-sdk/client-bedrock-agentcore`
- **ストリーミング対応**: Server-Sent Events (SSE)
- **認証**: AWS SDK が環境変数または実行ロールから自動取得

### セットアップ手順

#### 1. パッケージインストール

```bash
cd frontend
npm install
```

#### 2. 環境変数設定 (`.env.local`)

```bash
# AgentCore Runtime ARN (CDKデプロイ後の出力から取得)
AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-west-2:<AWS_ACCOUNT_ID>:agent-runtime/strandsAgent

# AWSリージョン
AWS_REGION=us-west-2

# AWS認証情報 (ローカル開発時のみ)
AWS_ACCESS_KEY_ID=<YOUR_ACCESS_KEY>
AWS_SECRET_ACCESS_KEY=<YOUR_SECRET_KEY>
```

#### 3. ローカル開発サーバー起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く

#### 4. 使い方

1. **Tavily APIキー入力**: 画面上部の入力欄に入力 ([https://tavily.com](https://tavily.com) で取得)
2. **メッセージ送信**: 画面下部にメッセージを入力して送信
3. **ストリーミング応答**: リアルタイムでエージェントの応答が表示されます

### Amplify Hostingデプロイ

#### 環境変数設定 (AWS Console)

Amplify Console → アプリ選択 → Environment variables:

- `AGENT_RUNTIME_ARN`: AgentCore RuntimeのARN
- `AWS_REGION`: `us-west-2`

#### IAMロール権限追加

Amplify HostingサービスロールにAgentCore呼び出し権限を追加:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock-agentcore:InvokeAgentRuntime"],
      "Resource": "arn:aws:bedrock-agentcore:us-west-2:*:agent-runtime/*"
    }
  ]
}
```

## 🧪 動作確認コマンド

デプロイしたAgentCore Runtimeが正常に動作するか確認できます：

```bash
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn arn:aws:bedrock-agentcore:us-west-2:YOUR_AWS_ACCOUNT_ID:runtime/strandsAgent-XXXXXXXXXX \
  --runtime-session-id test-session-$(date +%s) \
  --payload '{"prompt": "東京の天気を教えて", "tavily_api_key": "<YOUR_TAVILY_KEY>"}' \
  --region us-west-2 \
  --profile sandbox
```

**期待される動作:**
1. Tavilyツールを使って検索実行
2. ストリーミング形式でレスポンスを返す
3. CloudWatch Logsにログが出力される
4. X-Rayにトレースが記録される

## ⚠️ よくあるトラブルシューティング

### 1. CDKパッケージが404エラー
```bash
# 明示的にバージョン指定してインストール
npm install @aws-cdk/aws-bedrock-agentcore-alpha@2.221.0-alpha.0
```

### 2. Docker build時のアーキテクチャエラー
```bash
# ARM64を明示的に指定
docker buildx build --platform linux/arm64 -t strands-agent .
```

### 3. Amplifyリージョンが違う
Amplify初期化時に必ず`us-west-2`(オレゴン)を選択してください。後から変更する場合は`amplify/backend.ts`を編集。

### 4. CDK Bootstrap未実行エラー
```bash
# オレゴンリージョンでBootstrap実行
aws sso login --profile=<YOUR_PROFILE>
npx cdk bootstrap aws://<AWS_ACCOUNT_ID>/us-west-2 --profile=<YOUR_PROFILE>
```

### 5. CDK CLIバージョンエラー
```bash
# CDK CLIを最新版に更新
npm install -g aws-cdk@latest

# バージョン確認
cdk --version  # 2.1031.0以上が必要
```

### 6. TypeScriptコンパイルエラー
```bash
# node_modulesを再インストール
cd infrastructure
rm -rf node_modules package-lock.json
npm install

# ビルド実行
npm run build
```
