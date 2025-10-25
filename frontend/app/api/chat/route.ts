/**
 * Chat API Route - AgentCore Runtime呼び出し (BFFパターン)
 *
 * @aws-sdk/client-bedrock-agentcore を使用してAgentCore Runtimeを呼び出し、
 * ストリーミングレスポンスをブラウザに中継します。
 *
 * 認証: AWS SDK が環境変数または実行ロール (Amplify Hosting/Lambda) から自動取得
 */

import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

const encoder = new TextEncoder();

export async function POST(request: Request) {
  try {
    const { prompt, tavilyApiKey: clientTavilyApiKey } = await request.json();

    // 環境変数からAgentCore Runtime ARNを取得
    const agentRuntimeArn = process.env.AGENT_RUNTIME_ARN;
    if (!agentRuntimeArn) {
      return new Response(
        JSON.stringify({ error: 'AGENT_RUNTIME_ARN environment variable is not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Tavily APIキー: 環境変数があればそれを使用、なければクライアントから受け取る
    const tavilyApiKey = process.env.TAVILY_API_KEY || clientTavilyApiKey;

    // バリデーション
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!tavilyApiKey) {
      return new Response(
        JSON.stringify({ error: 'Tavily API key is required (set TAVILY_API_KEY or provide it in the request)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const region = process.env.AWS_REGION || 'us-west-2';

    // BedrockAgentCoreクライアント作成
    const client = new BedrockAgentCoreClient({ region });

    // ペイロード作成
    const payload = JSON.stringify({
      prompt,
      tavily_api_key: tavilyApiKey,
    });

    // セッションID生成 (33文字以上必須)
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`;

    // AgentCore Runtime呼び出し
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn,
      runtimeSessionId: sessionId,
      payload: new TextEncoder().encode(payload),
    });

    const response = await client.send(command);

    // ストリーミングレスポンスを作成
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (!response.response) {
            console.log('No response.response');
            controller.close();
            return;
          }

          // SSE形式でストリームを処理
          const decoder = new TextDecoder();

          // response.response を AsyncIterable として扱う
          const asyncIterable = response.response as AsyncIterable<any>;

          console.log('Starting to iterate over response stream...');

          for await (const event of asyncIterable) {
            console.log('Received event:', event);

            // イベントからバイトデータを取得
            let bytes: Uint8Array | undefined;

            if (event.chunk?.bytes) {
              bytes = event.chunk.bytes;
            } else if (event.data) {
              // Bufferの場合
              bytes = new Uint8Array(event.data);
            } else if (event instanceof Uint8Array) {
              bytes = event;
            }

            if (bytes) {
              const text = decoder.decode(bytes);
              console.log('Decoded text:', text);

              // SSE形式 (data: {...}) のパース
              if (text.includes('data: ')) {
                const lines = text.split('\n');
                for (const line of lines) {
                  if (line.trim() && line.startsWith('data: ')) {
                    const data = line.slice(6);

                    // 文字列として引用符で囲まれている場合はスキップ
                    if (data.startsWith('"') || data.startsWith("'")) {
                      continue;
                    }

                    try {
                      const parsedEvent = JSON.parse(data);
                      processEvent(parsedEvent, controller);
                    } catch (parseError) {
                      // JSONパースエラーは無視（デバッグ情報など）
                    }
                  }
                }
              }
            }
          }

          console.log('Stream iteration completed');
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    // イベント処理を関数化
    function processEvent(parsedEvent: any, controller: ReadableStreamDefaultController) {
      // eventプロパティが存在しない場合は何もしない（内部メタデータなど）
      if (!parsedEvent.event) {
        return;
      }

      // ツール使用開始イベント
      if (parsedEvent.event.contentBlockStart?.start?.toolUse) {
        console.log('Tool use started');
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'tool_use', tool: 'tavily' })}\n\n`
          )
        );
      }

      // テキストコンテンツ - contentBlockDelta.delta.text のみを抽出
      if (parsedEvent.event.contentBlockDelta?.delta?.text) {
        const text = parsedEvent.event.contentBlockDelta.delta.text;
        console.log('Sending text chunk:', text);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'text', data: text })}\n\n`
          )
        );
      }
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error invoking agent:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to invoke agent', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
