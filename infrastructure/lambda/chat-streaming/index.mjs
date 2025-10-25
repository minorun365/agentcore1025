/**
 * Lambda Response Streaming Handler for AgentCore Chat
 *
 * @aws-sdk/client-bedrock-agentcore を使用してAgentCore Runtimeを呼び出し、
 * Lambda Response Streamingでブラウザに逐次送信します。
 *
 * 認証: Lambda実行ロールから自動取得
 */

import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

const encoder = new TextEncoder();

// 環境変数から取得
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // メタデータ設定 (ヘッダーとステータスコード)
    // 注意: CORSヘッダーはFunction URL設定で自動的に追加されるため、ここでは設定しない
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    };

    // HttpResponseStreamを作成
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    try {
      // リクエストボディをパース
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        responseStream.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: 'Invalid request body' })}\n\n`
        ));
        responseStream.end();
        await responseStream.finished();
        return;
      }

      const { prompt, tavilyApiKey: clientTavilyApiKey } = body;

      // バリデーション
      if (!AGENT_RUNTIME_ARN) {
        console.error('AGENT_RUNTIME_ARN environment variable is not set');
        responseStream.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: 'Server configuration error' })}\n\n`
        ));
        responseStream.end();
        await responseStream.finished();
        return;
      }

      if (!prompt) {
        console.error('prompt is required');
        responseStream.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: 'prompt is required' })}\n\n`
        ));
        responseStream.end();
        await responseStream.finished();
        return;
      }

      // Tavily APIキー: 環境変数があればそれを使用、なければクライアントから受け取る
      const tavilyApiKey = TAVILY_API_KEY || clientTavilyApiKey;
      if (!tavilyApiKey) {
        console.error('Tavily API key is required');
        responseStream.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: 'Tavily API key is required' })}\n\n`
        ));
        responseStream.end();
        await responseStream.finished();
        return;
      }

      // リージョンをARNから抽出
      const region = AGENT_RUNTIME_ARN.split(':')[3] || 'us-west-2';
      console.log('Using region:', region);

      // BedrockAgentCoreクライアント作成
      const client = new BedrockAgentCoreClient({ region });

      // ペイロード作成
      const payload = JSON.stringify({
        prompt,
        tavily_api_key: tavilyApiKey,
      });

      // セッションID生成 (33文字以上必須)
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`;
      console.log('Session ID:', sessionId);

      // AgentCore Runtime呼び出し
      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: AGENT_RUNTIME_ARN,
        runtimeSessionId: sessionId,
        payload: encoder.encode(payload),
      });

      console.log('Invoking AgentCore Runtime...');
      const response = await client.send(command);

      if (!response.response) {
        console.error('No response.response from AgentCore');
        responseStream.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: 'No response from agent' })}\n\n`
        ));
        responseStream.end();
        await responseStream.finished();
        return;
      }

      console.log('Starting to iterate over response stream...');

      // SSE形式でストリームを処理
      const decoder = new TextDecoder();
      const asyncIterable = response.response;

      for await (const event of asyncIterable) {
        console.log('Received event:', event);

        // イベントからバイトデータを取得
        let bytes;

        if (event.chunk?.bytes) {
          bytes = event.chunk.bytes;
        } else if (event.data) {
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

                  // eventプロパティが存在しない場合は何もしない
                  if (!parsedEvent.event) {
                    continue;
                  }

                  // ツール使用開始イベント
                  if (parsedEvent.event.contentBlockStart?.start?.toolUse) {
                    console.log('Tool use started');
                    responseStream.write(encoder.encode(
                      `data: ${JSON.stringify({ type: 'tool_use', tool: 'tavily' })}\n\n`
                    ));
                  }

                  // テキストコンテンツ
                  if (parsedEvent.event.contentBlockDelta?.delta?.text) {
                    const text = parsedEvent.event.contentBlockDelta.delta.text;
                    console.log('Sending text chunk:', text);
                    responseStream.write(encoder.encode(
                      `data: ${JSON.stringify({ type: 'text', data: text })}\n\n`
                    ));
                  }
                } catch (parseError) {
                  // JSONパースエラーは無視（デバッグ情報など）
                  console.log('Failed to parse event data:', parseError);
                }
              }
            }
          }
        }
      }

      console.log('Stream iteration completed');
      responseStream.end();
      await responseStream.finished();
    } catch (error) {
      console.error('Error invoking agent:', error);
      try {
        responseStream.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: 'Failed to invoke agent', details: String(error) })}\n\n`
        ));
        responseStream.end();
        await responseStream.finished();
      } catch (writeError) {
        console.error('Failed to write error to stream:', writeError);
      }
    }
  }
);
