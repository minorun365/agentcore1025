# 必要なライブラリをインポート
import os
import boto3
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp.mcp_client import MCPClient
from mcp.client.streamable_http import streamablehttp_client
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# AgentCoreランタイム用のAPIサーバーを作成
app = BedrockAgentCoreApp()

# リージョン設定を環境変数から取得
AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")

# エージェント呼び出し関数を、APIサーバーのエントリーポイントに設定
@app.entrypoint
async def invoke_agent(payload, context):

    # フロントエンドで入力されたプロンプトとAPIキーを取得
    prompt = payload.get("prompt")
    tavily_api_key = payload.get("tavily_api_key")

    ### この中が通常のStrandsのコード ----------------------------------
    # Tavily MCPサーバーを設定
    mcp = MCPClient(lambda: streamablehttp_client(
        f"https://mcp.tavily.com/mcp/?tavilyApiKey={tavily_api_key}"
    ))

    # Boto3 sessionを作成してリージョンを明示的に指定
    boto_session = boto3.Session(region_name=AWS_REGION)

    # BedrockModelを作成 (Cross-Region Inference Profileを使用)
    bedrock_model = BedrockModel(
        model_id="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
        boto_session=boto_session  # boto_sessionにリージョンが含まれている
    )

    # MCPクライアントを起動したまま、エージェントを呼び出し
    with mcp:
        agent = Agent(
            model=bedrock_model,
            tools=mcp.list_tools_sync()
        )

        # エージェントの応答をストリーミングで取得
        stream = agent.stream_async(prompt)
        async for event in stream:
            yield event
    ### ------------------------------------------------------------

# APIサーバーを起動
app.run()
