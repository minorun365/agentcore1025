# フロントエンド - なんでも検索エージェント

Next.js + Amplify Gen2で構築されたチャットアプリケーション。Strands AgentsがMCPサーバー（Tavily）を使って情報収集します。

## 🌐 本番環境

**URL**: https://d19iepfgircxoy.amplifyapp.com

## 🔑 主な機能

- **認証**: Amazon Cognito（メールアドレス + パスワード）
- **チャット**: リアルタイムストリーミング応答
- **検索**: Tavily APIによるWeb検索
- **AI**: Strands Agents + Bedrock Claude 3.5 Sonnet

## 📁 プロジェクト構成

```
frontend/
├── app/
│   ├── page.tsx                    # メインページ（認証ラッパー含む）
│   ├── layout.tsx                  # ルートレイアウト
│   └── api/
│       └── chat/
│           └── route.ts            # Chat API Route（BFFパターン）
├── components/
│   ├── ChatInterface.tsx           # チャットUI
│   └── ConfigureAmplify.tsx        # Amplify設定コンポーネント
├── amplify/
│   ├── auth/
│   │   └── resource.ts             # Cognito認証設定
│   └── data/
│       └── resource.ts             # AppSync GraphQL設定
├── amplify_outputs.json            # Amplifyバックエンド設定（本番環境）
├── amplify.yml                     # Amplify Hostingビルド設定
└── .env.local                      # ローカル開発用環境変数
```

## 🚀 ローカル開発

### 前提条件

- Node.js 18+
- npm または yarn
- AWS SSO設定済み (`aws sso login --profile=sandbox`)

### セットアップ

1. **依存関係のインストール**:
   ```bash
   npm install
   ```

2. **環境変数設定** (`.env.local`):
   ```bash
   # Lambda Function URL (API Routeから呼び出し用 - サーバーサイドのみ)
   LAMBDA_FUNCTION_URL=https://kgfw2sjc76jwecnqaz6nab7f7y0qaqvh.lambda-url.us-west-2.on.aws/

   # AgentCore Runtime ARN (CDKデプロイ後の出力から取得)
   AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-west-2:715841358122:runtime/strandsAgent-oo5xY1C4tn

   # AWSリージョン
   AWS_REGION=us-west-2

   # AWS CLIプロファイル (SSOログイン済みプロファイルを指定)
   AWS_PROFILE=sandbox

   # Tavily API Key (ローカル開発用 - 本番環境では使用しない)
   TAVILY_API_KEY=tvly-YOUR_API_KEY
   ```

3. **開発サーバー起動**:
   ```bash
   npm run dev
   ```

4. ブラウザで [http://localhost:3000](http://localhost:3000) を開く

### Amplifyサンドボックス（開発環境）

開発環境用のバックエンドを起動する場合:

```bash
# 開発環境サンドボックス起動
npx ampx sandbox

# または、一度だけデプロイ
npx ampx sandbox --once
```

**注意**: 本番環境用バックエンドは`production` identifierで別途デプロイ済みです。

## 🏗️ アーキテクチャ

### BFFパターン（Backend For Frontend）

```
ブラウザ
  ↓ (HTTPS)
Next.js API Route (/api/chat)
  ↓ (IAM署名付きHTTPS)
Lambda Function URL
  ↓ (AWS SDK)
Bedrock AgentCore Runtime
  ↓
Strands Agent
  ↓ (MCP)
Tavily API
```

### 認証フロー

```
ブラウザ
  ↓
Amplify Authenticator Component
  ↓
Amazon Cognito User Pool
  ↓
認証済みセッション
  ↓
ChatInterface (チャット画面表示)
```

## 📝 主要コンポーネント

### 1. `app/page.tsx`

メインページ。Amplify `Authenticator`コンポーネントでラップしています。

- **認証UI**: 日本語ラベル対応
- **サインアウト**: ヘッダーにボタン配置
- **ユーザー情報**: ログイン中のメールアドレス表示

### 2. `components/ChatInterface.tsx`

チャットUIコンポーネント。

- **ストリーミング表示**: リアルタイムで応答を表示
- **Tavily APIキー入力**: 初回のみ入力
- **ツール使用表示**: 検索実行中のインジケーター
- **レスポンシブデザイン**: Tailwind CSSで実装

### 3. `app/api/chat/route.ts`

Chat API Route（BFFパターン）。

- **Lambda Function URL呼び出し**: IAM署名付きリクエスト
- **ストリーミング応答**: Server-Sent Events (SSE)
- **エラーハンドリング**: 詳細なエラーメッセージ

### 4. `components/ConfigureAmplify.tsx`

Amplifyクライアント設定コンポーネント。

- **SSR対応**: Next.js App Router対応
- **自動設定**: `amplify_outputs.json`から読み込み

## 🔒 セキュリティ

### amplify_outputs.jsonについて

このファイルは**安全にGitコミット可能**です。理由:

- **公開情報のみ含む**: Cognito User Pool ID、AppSync エンドポイントなど
- **機密情報なし**: アクセスキー、シークレットキーは含まれない
- **クライアント設定**: ブラウザで動作するフロントエンドが接続先を知るための設定

実際のセキュリティは以下で保護されています:

- **IAM認証**: Lambda Function URLへのアクセス制限
- **Cognito認証**: ユーザーログイン必須
- **API署名**: AWS SDKによる自動署名

## 🚢 デプロイ

### Amplify Hostingへのデプロイ

GitHubへプッシュすると自動的にデプロイされます:

```bash
git add .
git commit -m "Update frontend"
git push origin main
```

### ビルド設定 (`amplify.yml`)

```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci --cache .npm --prefer-offline
        build:
          commands:
            - env | grep -e LAMBDA_FUNCTION_URL >> .env.production
            - env | grep -e AGENT_RUNTIME_ARN >> .env.production
            - env | grep -e TAVILY_API_KEY >> .env.production
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - .npm/**/*
          - node_modules/**/*
          - .next/cache/**/*
```

### 環境変数（Amplify Console）

Amplify Consoleで以下の環境変数を設定済み:

- `LAMBDA_FUNCTION_URL`: Lambda Function URL
- `AGENT_RUNTIME_ARN`: AgentCore Runtime ARN
- `TAVILY_API_KEY`: Tavily APIキー

## 🛠️ トラブルシューティング

### 1. 認証エラー

```
User is not authenticated
```

**解決方法**: サインアウトして再度ログインしてください。

### 2. API呼び出しエラー

```
Failed to fetch
```

**解決方法**:
1. `.env.local`に正しい`LAMBDA_FUNCTION_URL`が設定されているか確認
2. AWS SSOログインが有効か確認 (`aws sso login --profile=sandbox`)

### 3. Amplifyサンドボックスエラー

```
Deployment failed
```

**解決方法**:
```bash
# サンドボックスを削除して再デプロイ
npx ampx sandbox delete
npx ampx sandbox --once
```

## 📚 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Amplify Gen2 Documentation](https://docs.amplify.aws/nextjs/)
- [Strands Agents Documentation](https://strandsagents.com/)
- [Tavily API Documentation](https://tavily.com/docs)

## 📄 ライセンス

このプロジェクトは個人学習用です。
